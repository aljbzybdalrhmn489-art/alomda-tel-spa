// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Error classes seen by the SPA (Owner decisions A and B), against a MOCKED backend (no database).
 *   401 UNAUTHORIZED         -> the credential is bad: ONE silent renewal is attempted, and if it is refused the user returns to the login screen.
 *   503 SERVICE_UNAVAILABLE  -> the server could not check the identity (infrastructure failure): the session is KEPT, no renewal is attempted,
 *                               the user is told to retry, and a retry that succeeds shows the data.
 *   429 RATE_LIMITED         -> the same: session kept, no renewal, "try again" message.
 * The shapes are the ones the backend tests assert (auth-infrastructure-and-limits.test.ts); this proves the SPA's reaction only.
 */
const API = 'http://127.0.0.1:4000';
const PARTY = '11111111-1111-4111-8111-111111111111';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' };
const envelope = (data, meta = {}) => ({ data, meta: { correlationId: 'corr-mock', asOf: '2026-10-15T12:00:00.000Z', ...meta } });
const SUMMARY = { agent: { id: PARTY, display_name: 'Agent', party_type: 'AGENT', status: 'ACTIVE', review_required: false }, settlement: { implemented: false, note: 'n' }, period: { granularity: 'month', from: '2026-10', to: '2026-10', basis: { time_zone: 'UTC' } }, series: [], totals: [] };

async function install(page, summaryHandler) {
  const calls = { refresh: 0, summary: 0 };
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
    const json = (status, body) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    switch (url.pathname) {
      case '/api/v1/auth/login': return json(200, envelope({ access_token: 'access-1', refresh_token: 'refresh-1' }));
      case '/api/v1/auth/refresh': calls.refresh += 1; return json(401, { error: { code: 'UNAUTHORIZED', message: 'The refresh token is invalid, expired, or no longer active.', details: [], correlationId: 'c', retryable: false } });
      case '/api/v1/auth/me': return json(200, envelope({ party_id: PARTY, roles: [], employee_profile: null }));
      case '/api/v1/wallet/balance': return json(200, envelope({ party_id: PARTY, currency: 'YER', wallet_kind: 'MAIN', ledger_balance: '100.0000', held: '0.0000', credit_limit: '0.0000', available: '100.0000', source: 'LEDGER_PROJECTION' }));
      case '/api/v1/transactions': return json(200, envelope([], { nextCursor: null }));
      case '/api/v1/catalog': return json(200, envelope([]));
      case '/api/v1/commissions/summary': calls.summary += 1; return summaryHandler(json);
      default: return json(404, { error: { code: 'NOT_FOUND', message: 'Route not found.', details: [] } });
    }
  });
  return calls;
}

async function loginAsAgent(page) {
  await page.goto('/production');
  await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 15_000 });
  await page.fill('#unified-identifier-input', '700000001');
  await page.fill('#unified-password-input', 'mock-password-not-a-secret');
  await page.click('#btn-unified-login');
  await expect(page.locator('#my-commissions-panel')).toBeVisible({ timeout: 15_000 });
}

const unavailable = { error: { code: 'SERVICE_UNAVAILABLE', message: 'The service is temporarily unavailable. Retry the request.', details: [], correlationId: 'c', retryable: true } };
const limited = { error: { code: 'RATE_LIMITED', message: 'Too many requests. Retry after the indicated delay.', details: [], correlationId: 'c', retryable: true } };
const expired = { error: { code: 'UNAUTHORIZED', message: 'A valid access token is required.', details: [], correlationId: 'c', retryable: false } };

test.describe('401 / 429 / 503 as the SPA sees them — mocked backend', () => {
  test('EC-1: 503 SERVICE_UNAVAILABLE keeps the session, attempts NO renewal, says "retry", and a later success shows the data', async ({ page }) => {
    let mode = 'ok';
    const calls = await install(page, (json) => (mode === 'down' ? json(503, unavailable) : json(200, envelope(SUMMARY))));
    await loginAsAgent(page);
    mode = 'down';
    await page.click('#btn-my-comm-load');
    await expect(page.locator('#my-comm-error')).toContainText('غير متاحة مؤقتاً');
    await expect(page.locator('#my-commissions-panel')).toBeVisible();
    await expect(page.locator('#btn-unified-login')).toHaveCount(0);
    expect(calls.refresh).toBe(0);
    mode = 'ok';
    await page.click('#btn-my-comm-load');
    await expect(page.locator('#my-comm-error')).toHaveCount(0);
    await expect(page.locator('#my-commissions-panel')).toBeVisible();
    expect(calls.refresh).toBe(0);
  });

  test('EC-2: 429 RATE_LIMITED keeps the session, attempts NO renewal, and asks the user to wait', async ({ page }) => {
    let mode = 'ok';
    const calls = await install(page, (json) => (mode === 'limited' ? json(429, limited) : json(200, envelope(SUMMARY))));
    await loginAsAgent(page);
    mode = 'limited';
    await page.click('#btn-my-comm-load');
    await expect(page.locator('#my-comm-error')).toContainText('انتظر');
    await expect(page.locator('#my-commissions-panel')).toBeVisible();
    expect(calls.refresh).toBe(0);
  });

  test('EC-3 (contrast): a 401 DOES attempt exactly one renewal and, when it is refused, returns to the login screen', async ({ page }) => {
    let mode = 'ok';
    const calls = await install(page, (json) => (mode === 'expired' ? json(401, expired) : json(200, envelope(SUMMARY))));
    await loginAsAgent(page);
    mode = 'expired';
    await page.click('#btn-my-comm-load');
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 10_000 });
    expect(calls.refresh).toBe(1);
  });
});
