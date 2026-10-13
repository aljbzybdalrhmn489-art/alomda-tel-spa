// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Silent session renewal against the REAL backend + REAL PostgreSQL session table (P2-01). The access token really expires: the server is started
 * with a short AUTH_ACCESS_TOKEN_TTL_MS (E2E_ACCESS_TTL_MS, e.g. 2000) - run this spec ONLY with that variable set, otherwise it is skipped.
 *   E2E_ACCESS_TTL_MS=2000 npx playwright test tests/session-renewal-integration.spec.js
 */
const API = 'http://127.0.0.1:4000';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password-1';
const TTL = Number(process.env.E2E_ACCESS_TTL_MS || 0);

test.describe('Silent renewal — real /auth/refresh, real session table', () => {
  test.skip(!(TTL > 0 && TTL <= 5000), 'needs E2E_ACCESS_TTL_MS <= 5000 so the access token really expires');

  async function spaLogin(page) {
    await page.goto('/production');
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 15_000 });
    await page.fill('#unified-identifier-input', 'admin');
    await page.fill('#unified-password-input', ADMIN_PASSWORD);
    await page.click('#btn-unified-login');
    await expect.poll(() => page.evaluate(() => !!(state.session && state.session.accessToken))).toBe(true);
  }

  test('RI-1: after the access token expired a protected call is renewed transparently through the real refresh endpoint (tokens rotate, user stays signed in)', async ({ page }) => {
    await spaLogin(page);
    const before = await page.evaluate(() => ({ a: state.session.accessToken, r: state.session.refreshToken }));
    await page.waitForTimeout(TTL + 1500);
    const status = await page.evaluate(async () => (await ApiClient.get('/api/v1/auth/me')).status);
    expect(status).toBe(200);
    const after = await page.evaluate(() => ({ a: state.session.accessToken, r: state.session.refreshToken, authed: state.session.isAuthenticated }));
    expect(after.authed).toBe(true);
    expect(after.a).not.toBe(before.a);
    expect(after.r).not.toBe(before.r);
  });

  test('RI-2: parallel calls after expiry share ONE rotation (a second use of the rotated token would revoke the family)', async ({ page }) => {
    await spaLogin(page);
    await page.waitForTimeout(TTL + 1500);
    const statuses = await page.evaluate(async () => (await Promise.all([1, 2, 3, 4].map(() => ApiClient.get('/api/v1/auth/me')))).map((r) => r.status));
    expect(statuses).toEqual([200, 200, 200, 200]);
    // the family is still alive: another expiry renews again
    await page.waitForTimeout(TTL + 1500);
    expect(await page.evaluate(async () => (await ApiClient.get('/api/v1/auth/me')).status)).toBe(200);
  });

  test('RI-3: reuse detection against the real session table - a refresh token already used elsewhere is refused, the family is revoked, the SPA lands on the login screen', async ({ page, request }) => {
    await spaLogin(page);
    const stale = await page.evaluate(() => state.session.refreshToken);
    const rotated = await request.post(`${API}/api/v1/auth/refresh`, { data: { refresh_token: stale } });
    expect(rotated.status()).toBe(200);
    const fresh = (await rotated.json()).data.refresh_token;
    await page.waitForTimeout(TTL + 1500);
    await page.evaluate(() => loadCommissionPoliciesBackendFromBackend()); // a screen loader: 401 -> the SPA presents the already-used token, is refused, and the loader logs out
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 10_000 });
    expect(await page.evaluate(() => state.session.accessToken)).toBeNull();
    expect((await request.post(`${API}/api/v1/auth/refresh`, { data: { refresh_token: fresh } })).status()).toBe(401);
  });
});
