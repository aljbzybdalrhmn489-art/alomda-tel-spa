// @ts-check
const { test, expect } = require('@playwright/test');
const { queryOne } = require('./db-evidence.js');

/**
 * Logout, deactivation and lock against the REAL backend and the REAL isolated PostgreSQL, driven through a real browser (SEC-DEC-01 / 02 / 04).
 * SL-1  the user's logout button revokes the login on the server: the captured refresh token is refused afterwards, the session row says LOGOUT, and (SEC-DEC-05)
 *       the ACCESS token captured before the click is refused at once although its expiry has not elapsed, while a second login of the same agent stays active.
 * SL-2  an administrator deactivates an agent whose browser is open: the agent's very next protected call fails and the app returns to login (the access token
 *       is refused at once, the renewal is refused, the sessions are revoked with ACCOUNT_DISABLED).
 * SL-3  failed logins lock an agent whose browser is open: same result with ACCOUNT_LOCKED (the server runs the default lock threshold of 5).
 * Requires DATABASE_URL_TEST (the isolated instance); skipped otherwise.
 */
const API = 'http://127.0.0.1:4000';
const TENANT = 'e2e-spa-integration';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password-1';

async function login(request, identifier, password) {
  const res = await request.post(`${API}/api/v1/auth/login`, { data: { login_identifier: identifier, password } });
  expect(res.status()).toBe(200);
  return (await res.json()).data.access_token;
}
async function createActiveAgent(request, adminToken, suffix, label) {
  const auth = { headers: { authorization: `Bearer ${adminToken}` } };
  const login_identifier = `e2e-slo-${label}-${suffix}`;
  const password = `e2e-agent-password-${suffix}-${label}`;
  const created = await request.post(`${API}/api/v1/admin/agents`, {
    ...auth,
    data: { party_type: 'AGENT', account_number: `SL-${label}-${suffix}`, display_name: `Session Agent ${label} ${suffix}`, phone: `7${label === 'A' ? '7' : label === 'B' ? '8' : '9'}${suffix.slice(-7)}`, zone_code: 'SOUTH', login_identifier, password },
  });
  expect(created.status(), await created.text()).toBe(201);
  const id = (await created.json()).data.id;
  expect((await request.post(`${API}/api/v1/admin/agents/${id}/activate`, auth)).status()).toBe(200);
  return { id, login_identifier, password };
}
async function spaLogin(page, identifier, password) {
  await page.goto('/production');
  await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 15_000 });
  await page.fill('#unified-identifier-input', identifier);
  await page.fill('#unified-password-input', password);
  await page.click('#btn-unified-login');
  await expect(page.locator('#my-commissions-panel')).toBeVisible({ timeout: 15_000 });
  // let the first automatic loads finish so the next click is not swallowed by a re-render
  await expect(page.locator('#btn-my-comm-load')).toBeEnabled({ timeout: 10_000 });
}
const sessionState = (userId) => queryOne(
  `SELECT count(*)::int AS total, count(*) FILTER (WHERE revoked_at IS NULL)::int AS live, max(revoke_reason) AS reason FROM sessions WHERE tenant_id = $1 AND user_id = $2`, [TENANT, userId]);

test.describe('Server-side session end - real browser, real backend, real PostgreSQL', () => {
  test.skip(!process.env.DATABASE_URL_TEST, 'needs the isolated DATABASE_URL_TEST');

  test('SL-1: the logout button revokes the login on the server; the refresh token it held is refused and the row says LOGOUT', async ({ page, request }) => {
    const suffix = String(Date.now());
    const adminToken = await login(request, 'admin', ADMIN_PASSWORD);
    const a = await createActiveAgent(request, adminToken, suffix, 'A');
    await spaLogin(page, a.login_identifier, a.password);
    const refreshToken = await page.evaluate(() => state.session.refreshToken);
    const accessToken = await page.evaluate(() => state.session.accessToken);
    expect(typeof refreshToken).toBe('string');
    expect((await sessionState(a.id)).live).toBe(1);
    // a second device of the same agent
    const otherDevice = await login(request, a.login_identifier, a.password);
    expect((await sessionState(a.id)).live).toBe(2);
    const me = (token) => request.get(`${API}/api/v1/auth/me`, { headers: { authorization: `Bearer ${token}` } });
    expect((await me(accessToken)).status(), 'the token works before the logout').toBe(200);

    const logoutResponse = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/v1/auth/logout');
    await page.click('#btn-my-wallet-logout');
    expect((await logoutResponse).status()).toBe(200);
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 10_000 });

    const reuse = await request.post(`${API}/api/v1/auth/refresh`, { data: { refresh_token: refreshToken } });
    expect(reuse.status(), 'the revoked refresh token cannot rotate').toBe(401);
    expect((await me(accessToken)).status(), 'SEC-DEC-05: the same access token is refused immediately').toBe(401);
    expect((await me(otherDevice)).status(), 'the other device is untouched').toBe(200);
    const row = await sessionState(a.id);
    expect(row.live).toBe(1);
    expect(row.reason).toBe('LOGOUT');
  });

  test('SL-2: deactivating an agent with an open browser session ends it at the next protected call', async ({ page, request }) => {
    const suffix = String(Date.now());
    const adminToken = await login(request, 'admin', ADMIN_PASSWORD);
    const a = await createActiveAgent(request, adminToken, suffix, 'B');
    await spaLogin(page, a.login_identifier, a.password);
    const tokens = await page.evaluate(() => ({ access: state.session.accessToken, refresh: state.session.refreshToken }));

    const off = await request.post(`${API}/api/v1/admin/agents/${a.id}/deactivate`, { headers: { authorization: `Bearer ${adminToken}` } });
    expect(off.status()).toBe(200);

    // the token is refused at once (HTTP), and so is the renewal
    const me = await request.get(`${API}/api/v1/auth/me`, { headers: { authorization: `Bearer ${tokens.access}` } });
    expect(me.status()).toBe(401);
    expect((await request.post(`${API}/api/v1/auth/refresh`, { data: { refresh_token: tokens.refresh } })).status()).toBe(401);

    // and the open page falls back to the login screen on its next protected call
    await page.click('#btn-my-comm-load');
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 10_000 });
    const row = await sessionState(a.id);
    expect(row.live).toBe(0);
    expect(row.reason).toBe('ACCOUNT_DISABLED');
    // the generic login refusal is unchanged: nothing says the account is disabled
    const attempt = await request.post(`${API}/api/v1/auth/login`, { data: { login_identifier: a.login_identifier, password: a.password } });
    expect(attempt.status()).toBe(401);
    expect((await attempt.json()).error.message).toBe('The login identifier or password is incorrect.');
  });

  test('SL-3: failed logins that lock an agent end its open browser session (default lock threshold, unchanged)', async ({ page, request }) => {
    const suffix = String(Date.now());
    const adminToken = await login(request, 'admin', ADMIN_PASSWORD);
    const a = await createActiveAgent(request, adminToken, suffix, 'C');
    await spaLogin(page, a.login_identifier, a.password);
    const tokens = await page.evaluate(() => ({ access: state.session.accessToken, refresh: state.session.refreshToken }));

    for (let i = 0; i < 5; i += 1) {
      expect((await request.post(`${API}/api/v1/auth/login`, { data: { login_identifier: a.login_identifier, password: 'wrong-password' } })).status()).toBe(401);
    }
    expect((await request.get(`${API}/api/v1/auth/me`, { headers: { authorization: `Bearer ${tokens.access}` } })).status()).toBe(401);
    expect((await request.post(`${API}/api/v1/auth/refresh`, { data: { refresh_token: tokens.refresh } })).status()).toBe(401);
    await page.click('#btn-my-comm-load');
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 10_000 });
    const row = await sessionState(a.id);
    expect(row.live).toBe(0);
    expect(row.reason).toBe('ACCOUNT_LOCKED');
  });
});
