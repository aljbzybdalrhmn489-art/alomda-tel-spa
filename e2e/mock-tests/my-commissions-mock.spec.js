// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * "My Commissions" (agent commission report) — SPA behaviour against a MOCKED backend (no database).
 * The mock answers with exactly the response shapes of `commission-report-routes.ts` (checked by that module's own route tests).
 * What this proves: request construction (no agent id anywhere, bearer token present, bucket drill-down parameters), rendering of
 * ACCRUED / EXPECTED separately and per currency, empty / error / 401 / inactive-agent states, HTML escaping, cursor paging.
 * What it does not prove: the real backend, the real SQL, or the real login — see the database-backed suite.
 */
const API = 'http://127.0.0.1:4000';
const PARTY = '11111111-1111-4111-8111-111111111111';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' };

const envelope = (data, meta = {}) => ({ data, meta: { correlationId: 'corr-mock', asOf: '2026-10-15T12:00:00.000Z', ...meta } });
const SETTLEMENT = { implemented: false, note: 'Totals are sums of recorded commission facts. Monthly settlement into the wallet is not implemented; nothing here has been credited to a wallet.' };
const AGENT_OK = { id: PARTY, display_name: 'Agent', party_type: 'AGENT', status: 'ACTIVE', review_required: false };

function summaryBody(overrides = {}) {
  return {
    agent: AGENT_OK, settlement: SETTLEMENT,
    period: { granularity: 'month', from: '2026-10', to: '2026-10', basis: { time_zone: 'UTC' } },
    series: [
      { bucket: '2026-10', currency: 'SAR', accrued_total: '0.2900', accrued_count: 2, expected_total: '0.0000', expected_count: 0, accrued_on_reversed_transaction_count: 0, accrued_on_reversed_transaction_total: '0.0000' },
      { bucket: '2026-10', currency: 'YER', accrued_total: '80.0000', accrued_count: 3, expected_total: '50.0000', expected_count: 1, accrued_on_reversed_transaction_count: 0, accrued_on_reversed_transaction_total: '0.0000' },
    ],
    totals: [
      { currency: 'SAR', accrued_total: '0.2900', accrued_count: 2, expected_total: '0.0000', expected_count: 0 },
      { currency: 'YER', accrued_total: '80.0000', accrued_count: 3, expected_total: '50.0000', expected_count: 1 },
    ],
    ...overrides,
  };
}
const item = (id, status, amount, currency = 'YER', extra = {}) => ({
  id, status, transaction_id: `bbbbbbbb-0000-4000-8000-${id.slice(-12)}`, transaction_status: status === 'ACCRUED' ? 'SETTLED' : 'VALIDATED', service_id: 'svc-1', package_ref: 'PKG-1',
  amount, currency, date: '2026-10-06T10:00:00.000Z', recorded_at: '2026-10-06T10:00:01.000Z', policy: { id: 'p-1', version: 1 }, rate: { formula_type: 'PERCENTAGE', parameters: { rate: '0.1' } }, fx_reference_id: null, ...extra,
});

/** Installs the mock backend. `handlers` may override the commission routes; every request is recorded. */
async function installBackend(page, handlers = {}) {
  /** @type {Array<{method:string,url:string,auth:string|undefined}>} */
  const requests = [];
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
    requests.push({ method: request.method(), url: url.pathname + url.search, auth: request.headers()['authorization'] });
    const json = (status, body) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const path = url.pathname;
    if (path === '/api/v1/auth/login') return json(200, envelope({ access_token: 'access-mock', refresh_token: 'refresh-mock' }));
    if (path === '/api/v1/auth/me') return json(200, envelope({ party_id: PARTY, roles: [], employee_profile: null }));
    if (path === '/api/v1/wallet/balance') return json(200, envelope({ party_id: PARTY, currency: 'YER', wallet_kind: 'MAIN', ledger_balance: '100.0000', held: '0.0000', credit_limit: '0.0000', available: '100.0000', source: 'LEDGER_PROJECTION' }));
    if (path === '/api/v1/transactions') return json(200, envelope([], { nextCursor: null }));
    if (path === '/api/v1/catalog') return json(200, envelope([]));
    const custom = handlers[path];
    if (custom) return custom(url, json);
    return json(404, { error: { code: 'NOT_FOUND', message: 'Route not found.', details: [] } });
  });
  return requests;
}

async function loginAsAgent(page) {
  await page.goto('/production');
  await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 15_000 });
  await page.fill('#unified-identifier-input', '700000001');
  await page.fill('#unified-password-input', 'mock-password-not-a-secret');
  await page.click('#btn-unified-login');
  await expect(page.locator('#my-commissions-panel')).toBeVisible({ timeout: 15_000 });
}

test.describe('My Commissions — mocked backend', () => {
  test('MC-1: totals are shown per currency with ACCRUED and EXPECTED apart; no request carries an agent id; the bearer token is sent', async ({ page }) => {
    const requests = await installBackend(page, { '/api/v1/commissions/summary': (_url, json) => json(200, envelope(summaryBody())) });
    await loginAsAgent(page);
    await expect(page.locator('.my-comm-total')).toHaveCount(2);
    const yer = page.locator('.my-comm-total[data-currency="YER"]');
    await expect(yer.locator('.my-comm-total-accrued')).toHaveText('80.0000');
    await expect(yer.locator('.my-comm-total-expected')).toHaveText('50.0000');
    await expect(page.locator('.my-comm-total[data-currency="SAR"] .my-comm-total-accrued')).toHaveText('0.2900');
    await expect(page.locator('.my-comm-status[data-status="ACCRUED"]').first()).toContainText('مُستحقة');
    await expect(page.locator('.my-comm-status[data-status="EXPECTED"]').first()).toContainText('متوقعة');
    await expect(page.locator('#my-comm-note')).toContainText('not implemented');
    const commissionCalls = requests.filter((r) => r.url.startsWith('/api/v1/commissions/'));
    expect(commissionCalls.length).toBeGreaterThan(0);
    for (const call of commissionCalls) {
      expect(call.method).toBe('GET');
      expect(call.auth).toBe('Bearer access-mock');
      expect(call.url).not.toMatch(/agent_id|party_id|tenant/i);
    }
    expect(commissionCalls[0].url).toMatch(/granularity=month&from=\d{4}-\d{2}&to=\d{4}-\d{2}$/);
  });

  test('MC-2: clicking a bucket drills down to its facts with the exact bucket and currency, and "more" follows the server cursor', async ({ page }) => {
    const requests = await installBackend(page, {
      '/api/v1/commissions/summary': (_u, json) => json(200, envelope(summaryBody())),
      '/api/v1/commissions/items': (url, json) => {
        const cursor = url.searchParams.get('cursor');
        if (!cursor) return json(200, envelope({ agent: AGENT_OK, items: [item('aaaaaaaa-0000-4000-8000-000000000001', 'ACCRUED', '38.0000'), item('aaaaaaaa-0000-4000-8000-000000000002', 'EXPECTED', '50.0000')] }, { next_cursor: 'CURSOR-2' }));
        return json(200, envelope({ agent: AGENT_OK, items: [item('aaaaaaaa-0000-4000-8000-000000000003', 'ACCRUED', '42.0000')] }, { next_cursor: null }));
      },
    });
    await loginAsAgent(page);
    await page.locator('.my-comm-bucket[data-currency="YER"]').click();
    await expect(page.locator('.my-comm-item')).toHaveCount(2);
    await expect(page.locator('.my-comm-item[data-status="EXPECTED"] .my-comm-item-amount')).toContainText('50.0000 YER');
    await page.click('#btn-my-comm-more');
    await expect(page.locator('.my-comm-item')).toHaveCount(3);
    await expect(page.locator('#btn-my-comm-more')).toHaveCount(0);
    const itemCalls = requests.filter((r) => r.url.startsWith('/api/v1/commissions/items'));
    expect(itemCalls[0].url).toContain('granularity=month&from=2026-10-' === '' ? '' : 'from=');
    const first = new URL(`http://x${itemCalls[0].url}`);
    expect(first.searchParams.get('currency')).toBe('YER');
    expect(first.searchParams.get('from')).toBe(first.searchParams.get('to'));
    expect(first.searchParams.get('cursor')).toBeNull();
    expect(new URL(`http://x${itemCalls[1].url}`).searchParams.get('cursor')).toBe('CURSOR-2');
  });

  test('MC-3: an empty period says so; a server error is shown without breaking the page; a 401 returns to the login screen', async ({ page }) => {
    let mode = 'empty';
    await installBackend(page, {
      '/api/v1/commissions/summary': (_u, json) => {
        if (mode === 'empty') return json(200, envelope(summaryBody({ series: [], totals: [] })));
        if (mode === 'error') return json(500, { error: { code: 'INTERNAL_ERROR', message: 'Building the commission report failed unexpectedly.', details: [] } });
        return json(401, { error: { code: 'UNAUTHORIZED', message: 'A valid access token is required.', details: [] } });
      },
    });
    await loginAsAgent(page);
    await expect(page.locator('#my-comm-empty')).toBeVisible();
    mode = 'error';
    await page.click('#btn-my-comm-load');
    await expect(page.locator('#my-comm-error')).toContainText('Building the commission report failed');
    await expect(page.locator('#my-commissions-panel')).toBeVisible();
    mode = 'expired';
    await page.click('#btn-my-comm-load');
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 10_000 });
  });

  test('MC-4: an inactive agent sees a review banner and still only its own data', async ({ page }) => {
    await installBackend(page, {
      '/api/v1/commissions/summary': (_u, json) => json(200, envelope(summaryBody({ agent: { ...AGENT_OK, status: 'SUSPENDED', review_required: true } }))),
    });
    await loginAsAgent(page);
    await expect(page.locator('#my-comm-review')).toContainText('SUSPENDED');
  });

  test('MC-5: switching to daily changes the period format and the request; the server-side validation error is displayed', async ({ page }) => {
    const requests = await installBackend(page, {
      '/api/v1/commissions/summary': (url, json) => {
        if (url.searchParams.get('granularity') === 'day' && url.searchParams.get('from') === '2026-02-30') {
          return json(400, { error: { code: 'VALIDATION_ERROR', message: 'from must be a date YYYY-MM-DD.', details: [{ field: 'from', message: '2026-02-30' }] } });
        }
        return json(200, envelope(summaryBody()));
      },
    });
    await loginAsAgent(page);
    await page.selectOption('#my-comm-granularity', 'day');
    await expect(page.locator('#my-comm-from')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
    await page.fill('#my-comm-from', '2026-02-30');
    await page.click('#btn-my-comm-load');
    await expect(page.locator('#my-comm-error')).toContainText('YYYY-MM-DD');
    expect(requests.some((r) => r.url.includes('granularity=day') && r.url.includes('from=2026-02-30'))).toBe(true);
  });

  test('MC-6: server-provided text is escaped — markup in a currency, bucket or id never becomes an element', async ({ page }) => {
    await installBackend(page, {
      '/api/v1/commissions/summary': (_u, json) => json(200, envelope(summaryBody({
        series: [{ bucket: '<img src=x onerror=window.__pwned=1>', currency: '<b id=evil>X</b>', accrued_total: '<i>1</i>', accrued_count: 1, expected_total: '0', expected_count: 0, accrued_on_reversed_transaction_count: 0, accrued_on_reversed_transaction_total: '0' }],
        totals: [{ currency: '<b id=evil2>X</b>', accrued_total: '<i>1</i>', accrued_count: 1, expected_total: '0', expected_count: 0 }],
      }))),
    });
    await loginAsAgent(page);
    await expect(page.locator('#my-comm-series')).toBeVisible();
    expect(await page.locator('#evil, #evil2, img[src="x"]').count()).toBe(0);
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  });

  test('MC-7: "my commission rates" lists the applicable policies in precedence order from the server', async ({ page }) => {
    await installBackend(page, {
      '/api/v1/commissions/summary': (_u, json) => json(200, envelope(summaryBody())),
      '/api/v1/commissions/rates': (_u, json) => json(200, envelope({
        agent: AGENT_OK, as_of: '2026-10-15T12:00:00.000Z', precedence: '...',
        rates: [
          { policy_id: 'a', version: 1, precedence_rank: 1, assignment_tier: 'AGENT', scope: { tier: 'PACKAGE', service_id: null, package_id: 'pkg-1', provider_id: null }, formula: { type: 'PERCENTAGE', parameters: { rate: '0.04' } }, currency: 'YER', valid_from: '2026-01-01T00:00:00.000Z', valid_to: null },
          { policy_id: 'b', version: 1, precedence_rank: 14, assignment_tier: 'GLOBAL', scope: { tier: 'SERVICE', service_id: 'svc-1', package_id: null, provider_id: null }, formula: { type: 'PERCENTAGE', parameters: { rate: '0.01' } }, currency: 'YER', valid_from: '2026-01-01T00:00:00.000Z', valid_to: null },
        ],
      })),
    });
    await loginAsAgent(page);
    await page.click('#btn-my-comm-rates');
    await expect(page.locator('.my-comm-rate')).toHaveCount(2);
    await expect(page.locator('.my-comm-rate').first()).toContainText('نسبة 0.04');
    await expect(page.locator('.my-comm-rate').last()).toContainText('#14');
  });
});
