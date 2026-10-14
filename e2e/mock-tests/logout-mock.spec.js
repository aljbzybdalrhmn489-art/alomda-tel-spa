// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * User-initiated logout also ends the login on the server (SEC-DEC-02) - SPA behaviour against a MOCKED backend (no database).
 * Proves: the logout request is made (POST /api/v1/auth/logout, public, with the refresh token in the body and no bearer), the screen is cleared at once, a
 * failing logout request never keeps the user signed in, and nothing is stored afterwards. That the server really revokes is proved by
 * backend/test/interfaces/http/disabled-account-sessions-characterization.test.ts and tests/session-logout-integration.spec.js.
 */
const API = 'http://127.0.0.1:4000';
const PARTY = '11111111-1111-4111-8111-111111111111';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' };
const envelope = (data, meta = {}) => ({ data, meta: { correlationId: 'corr-mock', asOf: '2026-10-15T12:00:00.000Z', ...meta } });

async function install(page, logoutHandler) {
  const requests = [];
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
    requests.push({ method: request.method(), path: url.pathname, auth: request.headers()['authorization'], body: request.postData() });
    const json = (status, body) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    switch (url.pathname) {
      case '/api/v1/auth/login': return json(200, envelope({ access_token: 'access-mock', refresh_token: 'refresh-mock', expires_in: 900 }));
      case '/api/v1/auth/me': return json(200, envelope({ party_id: PARTY, roles: [], employee_profile: null }));
      case '/api/v1/auth/logout': return logoutHandler(route, json);
      case '/api/v1/wallet/balance': return json(200, envelope({ party_id: PARTY, currency: 'YER', wallet_kind: 'MAIN', ledger_balance: '100.0000', held: '0.0000', credit_limit: '0.0000', available: '100.0000', source: 'LEDGER_PROJECTION' }));
      case '/api/v1/transactions': return json(200, envelope([], { nextCursor: null }));
      case '/api/v1/catalog': return json(200, envelope([]));
      default: return json(404, { error: { code: 'NOT_FOUND', message: 'Route not found.', details: [] } });
    }
  });
  return requests;
}
async function loginAgent(page) {
  await page.goto('/production');
  await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 15_000 });
  await page.fill('#unified-identifier-input', '700000001');
  await page.fill('#unified-password-input', 'mock-password-not-a-secret');
  await page.click('#btn-unified-login');
  await expect(page.locator('#btn-my-wallet-logout')).toBeVisible({ timeout: 15_000 });
}

test.describe('Logout ends the server session - mocked backend', () => {
  test('LG-1: logout sends the refresh token to POST /auth/logout (no bearer), clears the screen at once and returns to login with nothing stored', async ({ page }) => {
    const requests = await install(page, (_route, json) => json(200, envelope({ logged_out: true })));
    await loginAgent(page);
    await page.click('#btn-my-wallet-logout');
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => requests.filter((r) => r.path === '/api/v1/auth/logout').length).toBe(1);
    const call = requests.find((r) => r.path === '/api/v1/auth/logout');
    expect(call.method).toBe('POST');
    expect(call.auth).toBeUndefined();
    expect(JSON.parse(call.body)).toEqual({ refresh_token: 'refresh-mock' });
    const stored = await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]));
    expect(stored).not.toContain('refresh-mock');
    expect(stored).not.toContain('access-mock');
  });

  test('LG-2: a failing logout request (500 or no network) never keeps the user signed in', async ({ page }) => {
    await install(page, (route) => route.abort('failed'));
    await loginAgent(page);
    await page.click('#btn-my-wallet-logout');
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 10_000 });
    expect(await page.evaluate(() => state.session.accessToken)).toBeFalsy();
  });

  test('LG-3: an expired session (401 on a protected call) returns to login WITHOUT a logout request - there is nothing left to revoke', async ({ page }) => {
    let mode = 'ok';
    const requests = [];
    await page.route(`${API}/**`, async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
      requests.push(url.pathname);
      const json = (status, body) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (url.pathname === '/api/v1/auth/login') return json(200, envelope({ access_token: 'access-mock', refresh_token: 'refresh-mock', expires_in: 900 }));
      if (url.pathname === '/api/v1/auth/me') return json(200, envelope({ party_id: PARTY, roles: [], employee_profile: null }));
      if (url.pathname === '/api/v1/auth/refresh') return json(401, { error: { code: 'UNAUTHORIZED', message: 'The refresh token is invalid, expired, or no longer active.', details: [] } });
      if (url.pathname === '/api/v1/commissions/summary') return mode === 'ok' ? json(500, { error: { code: 'INTERNAL_ERROR', message: 'not under test', details: [] } }) : json(401, { error: { code: 'UNAUTHORIZED', message: 'A valid access token is required.', details: [] } });
      if (url.pathname === '/api/v1/wallet/balance') return json(200, envelope({ party_id: PARTY, currency: 'YER', wallet_kind: 'MAIN', ledger_balance: '1.0000', held: '0.0000', credit_limit: '0.0000', available: '1.0000', source: 'LEDGER_PROJECTION' }));
      return json(200, envelope([]));
    });
    await loginAgent(page);
    mode = 'expired';
    await page.click('#btn-my-comm-load');
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 10_000 });
    expect(requests).not.toContain('/api/v1/auth/logout');
  });
});
