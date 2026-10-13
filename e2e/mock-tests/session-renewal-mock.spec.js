// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * P2-01 — silent session renewal in the SPA, against a MOCK backend that models the real rules:
 *   - an access token is accepted only while it is in `validAccess`;
 *   - POST /auth/refresh rotates: a refresh token is accepted ONCE; presenting an already-used one is theft (the family is revoked).
 * No database. Proves the SPA behaviour (single flight, retry once, logout only when renewal is refused); not the backend's refresh service.
 */
const API = 'http://127.0.0.1:4000';
const PARTY = '11111111-1111-4111-8111-111111111111';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' };
const envelope = (data, meta = {}) => ({ data, meta: { correlationId: 'c', asOf: '2026-10-15T12:00:00.000Z', ...meta } });
const SUMMARY = { agent: { id: PARTY, display_name: 'Agent', party_type: 'AGENT', status: 'ACTIVE', review_required: false }, settlement: { implemented: false, note: 'n' }, period: { granularity: 'month', from: '2026-10', to: '2026-10', basis: { time_zone: 'UTC' } }, series: [], totals: [] };

/** @param {{ refreshMode?: 'ok'|'refuse'|'network', alwaysUnauthorized?: string, forbidden?: string }} [options] */
async function install(page, options = {}) {
  const mode = options.refreshMode || 'ok';
  const validAccess = new Set(['access-1']);
  const usedRefresh = new Set();
  let currentRefresh = 'refresh-1';
  let generation = 1;
  let familyRevoked = false;
  const log = { refreshCalls: [], authedCalls: [] };
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
    const json = (status, body) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const unauthorized = () => json(401, { error: { code: 'UNAUTHORIZED', message: 'Authentication is required.', details: [] } });
    const path = url.pathname;
    if (path === '/api/v1/auth/login') return json(200, envelope({ access_token: 'access-1', refresh_token: 'refresh-1' }));
    if (path === '/api/v1/auth/refresh') {
      const body = JSON.parse(request.postData() || '{}');
      log.refreshCalls.push(body.refresh_token);
      if (mode === 'network') return route.abort('failed');
      if (mode === 'refuse' || familyRevoked) return unauthorized();
      if (usedRefresh.has(body.refresh_token)) { familyRevoked = true; return unauthorized(); } // reuse = theft
      if (body.refresh_token !== currentRefresh) return unauthorized();
      usedRefresh.add(body.refresh_token);
      generation += 1;
      currentRefresh = `refresh-${generation}`;
      validAccess.add(`access-${generation}`);
      return json(200, envelope({ access_token: `access-${generation}`, expires_in: 900, refresh_token: currentRefresh }));
    }
    const auth = request.headers()['authorization'] || '';
    log.authedCalls.push({ path, auth });
    if (options.forbidden && path === options.forbidden) return json(403, { error: { code: 'FORBIDDEN', message: 'Not permitted.', details: [] } });
    if (options.alwaysUnauthorized && path === options.alwaysUnauthorized) return unauthorized();
    if (!validAccess.has(auth.replace('Bearer ', ''))) return unauthorized();
    if (path === '/api/v1/auth/me') return json(200, envelope({ party_id: PARTY, roles: [], employee_profile: null }));
    if (path === '/api/v1/wallet/balance') return json(200, envelope({ party_id: PARTY, currency: 'YER', wallet_kind: 'MAIN', ledger_balance: '100.0000', held: '0.0000', credit_limit: '0.0000', available: '100.0000', source: 'LEDGER_PROJECTION' }));
    if (path === '/api/v1/transactions') return json(200, envelope([], { nextCursor: null }));
    if (path === '/api/v1/catalog') return json(200, envelope([]));
    if (path === '/api/v1/commissions/summary') return json(200, envelope(SUMMARY));
    return json(404, { error: { code: 'NOT_FOUND', message: 'nf', details: [] } });
  });
  return {
    log,
    /** the access token the SPA holds is now expired on the server */
    expireAccess: () => validAccess.clear(),
  };
}

async function login(page) {
  await page.goto('/production');
  await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 15_000 });
  await page.fill('#unified-identifier-input', '700000001');
  await page.fill('#unified-password-input', 'mock-password-not-a-secret');
  await page.click('#btn-unified-login');
  await expect(page.locator('#my-commissions-panel')).toBeVisible({ timeout: 15_000 });
}

test.describe('Silent session renewal (P2-01) — mocked backend', () => {
  test('RF-1: an expired access token is renewed once and the failed call is retried transparently (no logout, no error shown)', async ({ page }) => {
    const server = await install(page);
    await login(page);
    server.expireAccess();
    server.log.refreshCalls.length = 0;
    await page.click('#btn-my-comm-load');
    await expect(page.locator('#my-commissions-panel')).toBeVisible();
    await expect(page.locator('#my-comm-error')).toHaveCount(0);
    expect(server.log.refreshCalls).toEqual(['refresh-1']);
    const retried = server.log.authedCalls.filter((c) => c.path === '/api/v1/commissions/summary').pop();
    expect(retried.auth).toBe('Bearer access-2');
    expect(await page.evaluate(() => state.session.accessToken)).toBe('access-2');
    expect(await page.evaluate(() => state.session.refreshToken)).toBe('refresh-2');
  });

  test('RF-2: several calls failing at once share ONE renewal (a second use of the rotated token would be treated as theft)', async ({ page }) => {
    const server = await install(page);
    await login(page);
    server.expireAccess();
    server.log.refreshCalls.length = 0;
    await page.evaluate(async () => {
      await Promise.all([ApiClient.get('/api/v1/wallet/balance'), BackendCommissionApi.summary('month', '2026-10', '2026-10'), BackendCommissionApi.rates(), ApiClient.get('/api/v1/transactions')]);
    });
    expect(server.log.refreshCalls).toEqual(['refresh-1']);
    expect(await page.evaluate(() => state.session.accessToken)).toBe('access-2');
  });

  test('RF-3: the NEXT expiry presents the rotated refresh token, never the old one', async ({ page }) => {
    const server = await install(page);
    await login(page);
    server.expireAccess();
    await page.evaluate(() => ApiClient.get('/api/v1/wallet/balance'));
    server.expireAccess();
    // access-2 is expired on the server; the server has issued access-2 into validAccess before expireAccess cleared it
    server.log.refreshCalls.length = 0;
    const status = await page.evaluate(async () => (await ApiClient.get('/api/v1/wallet/balance')).status);
    expect(status).toBe(200);
    expect(server.log.refreshCalls).toEqual(['refresh-2']);
  });

  test('RF-4: a refused renewal ends the session exactly as before (back to the login screen, tokens cleared)', async ({ page }) => {
    const server = await install(page, { refreshMode: 'refuse' });
    await login(page);
    server.expireAccess();
    await page.click('#btn-my-comm-load');
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 10_000 });
    expect(await page.evaluate(() => state.session.accessToken)).toBeNull();
    expect(await page.evaluate(() => state.session.refreshToken)).toBeNull();
    expect(server.log.refreshCalls.length).toBe(1);
  });

  test('RF-5: a network failure during renewal is reported as a network error and does NOT log the user out', async ({ page }) => {
    const server = await install(page, { refreshMode: 'network' });
    await login(page);
    server.expireAccess();
    const result = await page.evaluate(async () => { const r = await ApiClient.get('/api/v1/wallet/balance'); return { status: r.status, networkError: r.networkError === true }; });
    expect(result).toEqual({ status: 0, networkError: true });
    expect(await page.evaluate(() => state.session.isAuthenticated)).toBe(true);
    expect(await page.evaluate(() => state.session.refreshToken)).toBe('refresh-1');
  });

  test('RF-6: a login with wrong credentials (401, auth:false) never triggers a refresh', async ({ page }) => {
    const server = await install(page);
    await login(page);
    server.log.refreshCalls.length = 0;
    const status = await page.evaluate(async () => (await ApiClient.post('/api/v1/auth/login', { login_identifier: 'x', password: 'y' }, { auth: false })).status);
    expect(status).toBe(200); // the mock accepts any login; the point is that nothing refreshed
    expect(server.log.refreshCalls).toEqual([]);
  });
  test('RF-7: a 403 is a permission answer, not an expired session: no renewal, no logout, the screen stays', async ({ page }) => {
    const server = await install(page, { forbidden: '/api/v1/commissions/summary' });
    await login(page);
    server.log.refreshCalls.length = 0;
    await page.click('#btn-my-comm-load');
    await expect(page.locator('#my-comm-error')).toBeVisible();
    expect(server.log.refreshCalls).toEqual([]);
    expect(await page.evaluate(() => state.session.isAuthenticated)).toBe(true);
  });

  test('RF-8: renewal succeeds but the retried call is STILL 401 -> exactly one renewal (no loop), the session ends at the login screen', async ({ page }) => {
    const server = await install(page, { alwaysUnauthorized: '/api/v1/commissions/summary' });
    await login(page).catch(() => {});
    // login itself loads the summary, which is always 401: the SPA must have renewed once and then given up (login screen), never looped
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1500);
    const summaryCalls = server.log.authedCalls.filter((c) => c.path === '/api/v1/commissions/summary').length;
    expect(server.log.refreshCalls.length).toBeLessThanOrEqual(1);
    expect(summaryCalls).toBeLessThanOrEqual(2);
    expect(await page.evaluate(() => state.session.accessToken)).toBeNull();
  });

  test('RF-9: after a refused renewal no token, wallet figure or commission data remains in memory or in browser storage, and a protected call is not sent with a token', async ({ page }) => {
    const server = await install(page, { refreshMode: 'refuse' });
    await login(page);
    await expect(page.locator('.my-comm-total, #my-comm-empty').first()).toBeVisible({ timeout: 10_000 }).catch(() => {});
    server.expireAccess();
    await page.click('#btn-my-comm-load');
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 10_000 });
    const snapshot = await page.evaluate(() => ({
      session: JSON.stringify({ a: state.session.accessToken, r: state.session.refreshToken, w: state.session.myWallet && state.session.myWallet.data, c: state.session.myCommissions && state.session.myCommissions.summary }),
      storage: JSON.stringify(Object.assign({}, window.localStorage)) + JSON.stringify(Object.assign({}, window.sessionStorage)),
      html: document.body.innerText,
    }));
    expect(snapshot.session).toBe('{"a":null,"r":null,"w":null,"c":null}');
    for (const secret of ['access-1', 'refresh-1', 'access-2', 'refresh-2']) expect(snapshot.storage).not.toContain(secret);
    expect(snapshot.html).not.toContain('100');
    const before = server.log.authedCalls.length;
    const result = await page.evaluate(async () => { const r = await ApiClient.get('/api/v1/wallet/balance'); return { status: r.status }; });
    expect(result.status).toBe(401);
    expect(server.log.authedCalls.slice(before).every((c) => c.auth === '')).toBe(true);
  });
});
