// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Silent session renewal (P2-01) against the REAL authentication chain: AuthenticationService login (Argon2id), RefreshService rotation and
 * reuse detection, EdDSA tokens, SessionStore - over in-memory repositories (see ../semi-integrated-server.mts). The SERVER clock is moved
 * with POST /__semi/advance-clock so access-token and session expiry are real, not simulated by the test.
 * NOT a substitute for the PostgreSQL-backed run (real session table, real clock, real network).
 */
const API = 'http://127.0.0.1:4000';
const PASSWORD = 'semi-password-not-a-secret';
const ACCESS_TTL_MS = 900_000;
const SESSION_LIFETIME_MS = 3_600_000;

const advance = (request, ms) => request.post(`${API}/__semi/advance-clock`, { data: { ms } });

async function loginAs(page, identifier) {
  await page.goto('/production');
  await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 15_000 });
  await page.fill('#unified-identifier-input', identifier);
  await page.fill('#unified-password-input', PASSWORD);
  await page.click('#btn-unified-login');
  await expect(page.locator('#my-commissions-panel')).toBeVisible({ timeout: 15_000 });
}

test.describe('Silent renewal against the real auth chain (in-memory stores)', () => {
  test('SR-1: an expired access token is renewed through the REAL /auth/refresh and the user stays signed in with fresh data', async ({ page, request }) => {
    await loginAs(page, '700000001');
    const before = await page.evaluate(() => ({ access: state.session.accessToken, refresh: state.session.refreshToken }));
    await advance(request, ACCESS_TTL_MS + 60_000);
    await page.click('#btn-my-comm-load');
    await expect(page.locator('.my-comm-total[data-currency="YER"] .my-comm-total-accrued')).toHaveText('100.0000');
    const after = await page.evaluate(() => ({ access: state.session.accessToken, refresh: state.session.refreshToken, authed: state.session.isAuthenticated }));
    expect(after.authed).toBe(true);
    expect(after.access).not.toBe(before.access);
    expect(after.refresh).not.toBe(before.refresh);
  });

  test('SR-2: four calls failing at once cause ONE rotation - a second use of the rotated refresh token would be detected as theft and end the session', async ({ page, request }) => {
    await loginAs(page, '700000001');
    await advance(request, ACCESS_TTL_MS + 60_000);
    const statuses = await page.evaluate(async () => (await Promise.all([
      ApiClient.get('/api/v1/wallet/balance'), ApiClient.get('/api/v1/commissions/rates'), ApiClient.get('/api/v1/transactions'), ApiClient.get('/api/v1/auth/me'),
    ])).map((r) => r.status));
    expect(statuses).toEqual([200, 200, 200, 200]);
    expect(await page.evaluate(() => state.session.isAuthenticated)).toBe(true);
    // the family is still alive: one more expiry renews again
    await advance(request, ACCESS_TTL_MS + 60_000);
    expect(await page.evaluate(async () => (await ApiClient.get('/api/v1/wallet/balance')).status)).toBe(200);
  });

  test('SR-3: reuse detection - after the refresh token was used elsewhere, the SPA\'s stale token is refused, the family is revoked and the user lands on the login screen', async ({ page, request }) => {
    await loginAs(page, '700000001');
    const stale = await page.evaluate(() => state.session.refreshToken);
    const rotated = await request.post(`${API}/api/v1/auth/refresh`, { data: { refresh_token: stale } });
    expect(rotated.status()).toBe(200);
    const fresh = (await rotated.json()).data.refresh_token;
    await advance(request, ACCESS_TTL_MS + 60_000);
    await page.click('#btn-my-comm-load'); // 401 -> the SPA presents the already-used token
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 10_000 });
    expect(await page.evaluate(() => state.session.accessToken)).toBeNull();
    // the whole family is revoked: even the legitimately rotated token no longer works
    const afterTheft = await request.post(`${API}/api/v1/auth/refresh`, { data: { refresh_token: fresh } });
    expect(afterTheft.status()).toBe(401);
  });

  test('SR-4: after the session lifetime ends the refresh token is refused and the SPA returns to the login screen with nothing left in memory', async ({ page, request }) => {
    await loginAs(page, '700000001');
    await advance(request, SESSION_LIFETIME_MS + 60_000);
    await page.click('#btn-my-comm-load');
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 10_000 });
    const leftovers = await page.evaluate(() => JSON.stringify({ a: state.session.accessToken, r: state.session.refreshToken, w: state.session.myWallet && state.session.myWallet.data, c: state.session.myCommissions && state.session.myCommissions.summary }));
    expect(leftovers).toBe('{"a":null,"r":null,"w":null,"c":null}');
  });

  test('SR-5: a wrong password is refused (401) without any renewal attempt, and a protected route stays closed', async ({ page, request }) => {
    await page.goto('/production');
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 15_000 });
    await page.fill('#unified-identifier-input', '700000001');
    await page.fill('#unified-password-input', 'definitely-wrong');
    await page.click('#btn-unified-login');
    await expect(page.locator('#my-commissions-panel')).toHaveCount(0);
    expect((await request.get(`${API}/api/v1/commissions/rates`)).status()).toBe(401);
  });
});
