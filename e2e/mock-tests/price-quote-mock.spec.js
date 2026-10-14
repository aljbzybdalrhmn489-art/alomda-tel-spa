// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Price QUOTE in the real transaction form - SPA behaviour against a MOCKED backend (no database).
 * Proves: one quote request per selection with exactly service + package (no party / tenant), the price is shown as the server's decimal string with its
 * currency, an override is flagged, errors are readable and recoverable ("refresh"), a stale answer never replaces a newer selection's, 401 returns to
 * login, and the screen says a quote is not a reservation. The real server is proved by backend/test/interfaces/http/price-quote-api.test.ts.
 */
const API = 'http://127.0.0.1:4000';
const PARTY = '11111111-1111-4111-8111-111111111111';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' };
const envelope = (data, meta = {}) => ({ data, meta: { correlationId: 'corr-mock', asOf: '2026-10-15T12:00:00.000Z', ...meta } });
const CATALOG = [{ service_code: 'svc-a', name: 'Service A', packages: [{ package_code: 'pkg-1', name: 'One', display_order: 0 }, { package_code: 'pkg-2', name: 'Two', display_order: 1 }] }];
const quoteBody = (pkg, amount, currency, source = 'SERVICE_PRICING') => envelope({ party_id: PARTY, service: 'svc-a', package: pkg, price: { amount, currency }, price_source: source, pricing_rule_version: 1, binding: false, note: 'x' });

async function install(page, quoteHandler) {
  const requests = [];
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
    requests.push({ method: request.method(), url: url.pathname + url.search, auth: request.headers()['authorization'] });
    const json = (status, body) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    switch (url.pathname) {
      case '/api/v1/auth/login': return json(200, envelope({ access_token: 'access-mock', refresh_token: 'refresh-mock' }));
      case '/api/v1/auth/me': return json(200, envelope({ party_id: PARTY, roles: [], employee_profile: null }));
      case '/api/v1/wallet/balance': return json(200, envelope({ party_id: PARTY, currency: 'YER', wallet_kind: 'MAIN', ledger_balance: '100.0000', held: '0.0000', credit_limit: '0.0000', available: '100.0000', source: 'LEDGER_PROJECTION' }));
      case '/api/v1/transactions': return json(200, envelope([], { nextCursor: null }));
      case '/api/v1/catalog': return json(200, envelope(CATALOG));
      case '/api/v1/pricing/quote': return quoteHandler(url, json, route);
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
  await expect(page.locator('#rtx-catalog-package')).toBeVisible({ timeout: 15_000 });
}

test.describe('Price quote in the transaction form - mocked backend', () => {
  test('PQ-1: the quote is requested once per selection with only service + package, shown exactly as sent, and marked as not binding', async ({ page }) => {
    const requests = await install(page, (url, json) => json(200, url.searchParams.get('package') === 'pkg-1' ? quoteBody('pkg-1', '100', 'YER') : quoteBody('pkg-2', '50.25', 'SAR')));
    await loginAgent(page);
    await expect(page.locator('#rtx-quote-price')).toHaveText('100 YER');
    await expect(page.locator('#rtx-quote')).toContainText('لا حجز ولا خصم');
    await page.selectOption('#rtx-catalog-package', 'pkg-2');
    await expect(page.locator('#rtx-quote-price')).toHaveText('50.25 SAR');
    const calls = requests.filter((r) => r.url.startsWith('/api/v1/pricing/quote'));
    expect(calls.map((c) => c.url)).toEqual(['/api/v1/pricing/quote?service=svc-a&package=pkg-1', '/api/v1/pricing/quote?service=svc-a&package=pkg-2']);
    for (const c of calls) { expect(c.method).toBe('GET'); expect(c.auth).toBe('Bearer access-mock'); expect(c.url).not.toMatch(/party|tenant|agent/i); }
    // looking at prices creates nothing: the only POST is the login
    expect(requests.filter((r) => r.method === 'POST').map((r) => r.url)).toEqual(['/api/v1/auth/login']);
  });

  test('PQ-2: an override price is flagged; a refusal (400) is readable and "refresh" asks again', async ({ page }) => {
    let mode = 'override';
    await install(page, (_u, json) => mode === 'override' ? json(200, quoteBody('pkg-1', '80', 'YER', 'OVERRIDE')) : mode === 'bad'
      ? json(400, { error: { code: 'VALIDATION_ERROR', message: 'No active service pricing rule applies to this package.', details: [] } })
      : json(200, quoteBody('pkg-1', '90', 'YER')));
    await loginAgent(page);
    await expect(page.locator('#rtx-quote-override')).toBeVisible();
    await expect(page.locator('#rtx-quote-price')).toHaveText('80 YER');
    mode = 'bad';
    await page.click('#btn-rtx-quote-refresh');
    await expect(page.locator('#rtx-quote[data-state="error"]')).toContainText('No active service pricing rule');
    mode = 'ok';
    await page.click('#btn-rtx-quote-refresh');
    await expect(page.locator('#rtx-quote-price')).toHaveText('90 YER');
    await expect(page.locator('#rtx-quote-override')).toHaveCount(0);
  });

  test('PQ-3: a slow answer for the previous package never replaces the current selection price', async ({ page }) => {
    await install(page, async (url, json) => {
      if (url.searchParams.get('package') === 'pkg-1') await new Promise((r) => setTimeout(r, 1500));
      return json(200, url.searchParams.get('package') === 'pkg-1' ? quoteBody('pkg-1', '100', 'YER') : quoteBody('pkg-2', '50.25', 'SAR'));
    });
    await loginAgent(page);
    await page.selectOption('#rtx-catalog-package', 'pkg-2');
    await expect(page.locator('#rtx-quote-price')).toHaveText('50.25 SAR');
    await page.waitForTimeout(2000);
    await expect(page.locator('#rtx-quote-price')).toHaveText('50.25 SAR');
  });

  test('PQ-4: a 401 on the quote returns to the login screen; a 500 is shown inside the quote box only', async ({ page }) => {
    let mode = '500';
    await install(page, (_u, json) => mode === '500' ? json(500, { error: { code: 'INTERNAL_ERROR', message: 'Something failed.', details: [] } }) : json(401, { error: { code: 'UNAUTHORIZED', message: 'A valid access token is required.', details: [] } }));
    await loginAgent(page);
    await expect(page.locator('#rtx-quote[data-state="error"]')).toContainText('Something failed');
    await expect(page.locator('#rtx-catalog-package')).toBeVisible();
    mode = '401';
    await page.click('#btn-rtx-quote-refresh');
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 10_000 });
  });

  test('PQ-5: the quote box is RTL and stays inside the form on a phone, a tablet and a large screen (long amount, long error text)', async ({ page }) => {
    let mode = 'ok';
    await install(page, (_u, json) => mode === 'ok' ? json(200, quoteBody('pkg-1', '123456789012345.25', 'SAR', 'OVERRIDE')) : json(400, { error: { code: 'VALIDATION_ERROR', message: 'No active service pricing rule applies to this package. '.repeat(4), details: [] } }));
    await loginAgent(page);
    for (const viewport of [{ width: 360, height: 640 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      for (const state of ['ok', 'error']) {
        mode = state;
        await page.click('#btn-rtx-quote-refresh');
        await expect(page.locator('#rtx-quote[data-state="' + state + '"]')).toBeVisible();
        const m = await page.evaluate(() => {
          const box = document.getElementById('rtx-quote').getBoundingClientRect();
          const form = (document.getElementById('rtx-form') || document.body).getBoundingClientRect();
          return { dir: document.documentElement.getAttribute('dir') || getComputedStyle(document.body).direction, over: document.documentElement.scrollWidth - document.documentElement.clientWidth, outside: box.right > form.right + 1 || box.left < form.left - 1 };
        });
        expect(m.dir).toBe('rtl');
        expect(m.over, 'overflow ' + state + ' ' + viewport.width).toBeLessThanOrEqual(1);
        expect(m.outside, 'quote box outside the form ' + state + ' ' + viewport.width).toBe(false);
      }
    }
  });
});
