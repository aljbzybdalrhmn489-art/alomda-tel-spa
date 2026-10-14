// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Administrative READ screen ("المراقبة والتقارير") - SPA behaviour against a MOCKED backend (no database), with the response shapes of
 * `admin-read-routes.ts`. Proves: request construction (filters become query parameters, no tenant anywhere, bearer token, GET only),
 * rendering per currency without mixing, cursor paging, empty / 400 / 403 / 404 / 5xx / 401 states, HTML escaping, and that a hostile string
 * from the server never becomes markup. The database-backed suite (tests/admin-read-integration.spec.js) proves the real backend.
 */
const API = 'http://127.0.0.1:4000';
const ADMIN = '99999999-9999-4999-8999-999999999999';
const PARTY_A = '11111111-1111-4111-8111-111111111111';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' };
const envelope = (data, meta = {}) => ({ data, meta: { correlationId: 'corr-mock', asOf: '2026-10-15T12:00:00.000Z', ...meta } });
const tx = (n, status, extra = {}) => ({
  transaction_id: `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`, client_ref: `ref-${n}`, party: { id: PARTY_A, display_name: 'Agent A', party_type: 'AGENT' },
  service_id: 'svc-prov', package_id: 'pkg-2', target_identifier: '+967700000001', status, fulfillment_strategy: 'PROVIDER',
  customer_price: { amount: '50.2500', currency: 'SAR' }, provider_cost: { amount: '40.0000', currency: 'SAR' }, provider_id: null,
  created_at: '2026-10-02T12:00:00.000Z', settled_at: null, ...extra,
});

async function installBackend(page, handlers = {}) {
  /** @type {Array<{method:string,url:string,auth:string|undefined}>} */
  const requests = [];
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
    requests.push({ method: request.method(), url: url.pathname + url.search, auth: request.headers()['authorization'] });
    const json = (status, body) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (url.pathname === '/api/v1/auth/login') return json(200, envelope({ access_token: 'access-mock', refresh_token: 'refresh-mock' }));
    if (url.pathname === '/api/v1/auth/me') return json(200, envelope({ party_id: ADMIN, roles: ['SYSTEM_ADMIN'], employee_profile: null }));
    const custom = handlers[url.pathname];
    if (custom) return custom(url, json);
    return json(200, envelope([]));
  });
  return requests;
}

async function openModule(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/production');
  await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 15_000 });
  await page.fill('#unified-identifier-input', 'admin');
  await page.fill('#unified-password-input', 'mock-password-not-a-secret');
  await page.click('#btn-unified-login');
  await expect(page.locator('#btn-admin-drawer-open')).toBeVisible({ timeout: 15_000 });
  await page.click('#btn-admin-drawer-open');
  await page.locator('.admin-nav-item[data-module-id="adminReadBackend"]').click();
  await expect(page.locator('#admin-read-panel')).toBeVisible({ timeout: 10_000 });
  return errors;
}
const err = (code, message) => ({ error: { code, message, details: [] } });

test.describe('Admin read model - mocked backend', () => {
  test('AR-1: the module is listed in production; the list loads, shows decimal strings with their currency, and is read-only (GET, bearer, no tenant)', async ({ page }) => {
    const requests = await installBackend(page, { '/api/v1/admin/transactions': (_u, json) => json(200, envelope([tx(1, 'SETTLED'), tx(2, 'FAILED', { customer_price: null })], { nextCursor: null, hasMore: false })) });
    const errors = await openModule(page);
    await expect(page.locator('.ard-tx-row')).toHaveCount(2);
    await expect(page.locator('.ard-tx-row[data-status="SETTLED"]')).toContainText('50.2500 SAR');
    await expect(page.locator('.ard-tx-row[data-status="FAILED"]')).toContainText('—');
    const calls = requests.filter((r) => r.url.startsWith('/api/v1/admin/'));
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) { expect(c.method).toBe('GET'); expect(c.auth).toBe('Bearer access-mock'); expect(c.url).not.toMatch(/tenant/i); }
    expect(errors).toEqual([]);
  });

  test('AR-2: filters become exact query parameters; blank filters are omitted; "more" follows nextCursor and appends', async ({ page }) => {
    const requests = await installBackend(page, {
      '/api/v1/admin/transactions': (url, json) => url.searchParams.get('cursor')
        ? json(200, envelope([tx(3, 'SETTLED')], { nextCursor: null, hasMore: false }))
        : json(200, envelope([tx(1, 'SETTLED'), tx(2, 'SETTLED')], { nextCursor: 'CUR-2', hasMore: true })),
    });
    await openModule(page);
    await expect(page.locator('.ard-tx-row')).toHaveCount(2);
    await page.selectOption('.ard-input[data-tab="tx"][data-field="status"]', 'SETTLED');
    await page.selectOption('.ard-input[data-tab="tx"][data-field="currency"]', 'SAR');
    await page.fill('.ard-input[data-tab="tx"][data-field="partyId"]', PARTY_A);
    await page.fill('.ard-input[data-tab="tx"][data-field="from"]', '2026-10-01');
    await page.click('#btn-ard-tx-search');
    await expect(page.locator('.ard-tx-row')).toHaveCount(2);
    const search = new URL(`http://x${requests.filter((r) => r.url.startsWith('/api/v1/admin/transactions')).at(-1).url}`);
    expect(search.searchParams.get('status')).toBe('SETTLED');
    expect(search.searchParams.get('currency')).toBe('SAR');
    expect(search.searchParams.get('party_id')).toBe(PARTY_A);
    expect(search.searchParams.get('from')).toBe('2026-10-01');
    expect(search.searchParams.get('to')).toBeNull();
    expect(search.searchParams.get('service')).toBeNull();
    await page.click('#btn-ard-tx-more');
    await expect(page.locator('.ard-tx-row')).toHaveCount(3);
    await expect(page.locator('#btn-ard-tx-more')).toHaveCount(0);
    const more = new URL(`http://x${requests.filter((r) => r.url.startsWith('/api/v1/admin/transactions')).at(-1).url}`);
    expect(more.searchParams.get('cursor')).toBe('CUR-2');
    expect(more.searchParams.get('status')).toBe('SETTLED');
  });

  test('AR-3: transaction detail shows the frozen price, timeline, hold and commission; a 404 is shown inside the detail only', async ({ page }) => {
    const known = tx(1, 'SETTLED').transaction_id;
    await installBackend(page, {
      '/api/v1/admin/transactions': (_u, json) => json(200, envelope([tx(1, 'SETTLED'), tx(2, 'SETTLED')], { nextCursor: null, hasMore: false })),
      [`/api/v1/admin/transactions/${known}`]: (_u, json) => json(200, envelope({
        ...tx(1, 'SETTLED'), pricing: { rule_version: 3, commission_policy_version: 'cp-1', fx_rate: null }, settlement_journal_entry_id: null,
        history: [{ from: null, to: 'CREATED', actor_kind: 'USER', reason: 'x', at: '2026-10-02T12:00:00.000Z' }, { from: 'CREATED', to: 'SETTLED', actor_kind: 'SYSTEM', reason: null, at: '2026-10-02T13:00:00.000Z' }],
        hold: { status: 'RELEASED', amount: { amount: '50.2500', currency: 'SAR' }, created_at: '2026-10-02T12:00:01.000Z', released_at: null, release_reason: null },
        commission: [{ kind: 'ACCRUAL', total: { amount: '5.0000', currency: 'SAR' }, policy_id: 'p', policy_version: 1, agent_id: PARTY_A, no_commission_reason: null, fact_at: '2026-10-03T00:00:00.000Z' }],
      })),
      [`/api/v1/admin/transactions/${tx(2, 'SETTLED').transaction_id}`]: (_u, json) => json(404, err('NOT_FOUND', 'Transaction not found.')),
    });
    await openModule(page);
    await page.locator('.ard-tx-row').first().click();
    await expect(page.locator('.ard-d-price')).toHaveText('50.2500 SAR');
    await expect(page.locator('.ard-d-cost')).toHaveText('40.0000 SAR');
    await expect(page.locator('.ard-d-hist')).toHaveCount(2);
    await expect(page.locator('.ard-d-comm')).toContainText('ACCRUAL · 5.0000 SAR');
    await page.click('#btn-ard-tx-detail-close');
    await page.locator('.ard-tx-row').nth(1).click();
    await expect(page.locator('#ard-tx-detail-error')).toContainText('غير موجود');
    await expect(page.locator('.ard-tx-row')).toHaveCount(2);
  });

  test('AR-4: empty, 400, 403 and 500 are distinct, readable states and never break the page; 401 returns to the login screen', async ({ page }) => {
    let mode = 'empty';
    await installBackend(page, {
      '/api/v1/admin/transactions': (_u, json) => {
        if (mode === 'empty') return json(200, envelope([], { nextCursor: null, hasMore: false }));
        if (mode === '400') return json(400, err('VALIDATION_ERROR', 'Unknown query parameter: bogus.'));
        if (mode === '403') return json(403, err('FORBIDDEN', 'Missing required permission: transaction:read_all.'));
        if (mode === '500') return json(500, err('INTERNAL_ERROR', 'Something failed.'));
        return json(401, err('UNAUTHORIZED', 'A valid access token is required.'));
      },
    });
    await openModule(page);
    await expect(page.locator('#ard-tx-empty')).toBeVisible();
    for (const [m, text] of [['400', 'المدخلات غير صالحة'], ['403', 'لا تملك الصلاحية'], ['500', 'Something failed']]) {
      mode = m;
      await page.click('#btn-ard-tx-search');
      await expect(page.locator('#ard-tx-error')).toContainText(text);
      await expect(page.locator('#admin-read-panel')).toBeVisible();
    }
    mode = '401';
    await page.click('#btn-ard-tx-search');
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 10_000 });
  });

  test('AR-5: the operations summary renders each currency apart (price, provider cost, commission), the empty window, and the 400 for a bad window', async ({ page }) => {
    let mode = 'ok';
    const requests = await installBackend(page, {
      '/api/v1/admin/reports/operations': (_u, json) => {
        if (mode === 'bad') return json(400, err('VALIDATION_ERROR', 'to must not be before from.'));
        if (mode === 'empty') return json(200, envelope({ group_by: 'status', period: { from: '2026-10-01', to: '2026-10-31' }, rows: [], status_counts: [], settled_provider_cost: [], commission_accrued: [] }, { basis: 'x' }));
        return json(200, envelope({
          group_by: 'status', period: { from: '2026-10-01', to: '2026-10-31' },
          rows: [{ key: 'SETTLED', currency: 'SAR', total: 2, settled: 2, failed: 0, other: 0, settled_customer_price: '100.5000' }, { key: 'SETTLED', currency: 'YER', total: 1, settled: 1, failed: 0, other: 0, settled_customer_price: '2000.0000' }],
          status_counts: [{ status: 'SETTLED', count: 3 }], settled_provider_cost: [{ currency: 'SAR', total: '1540.0000' }], commission_accrued: [{ currency: 'YER', pool_total: '10.0000', company_retained: '2.0000' }, { currency: 'SAR', pool_total: '5.0000', company_retained: '0.5000' }],
        }, { basis: 'transactions by created_at (UTC)' }));
      },
    });
    await openModule(page);
    await page.click('.ard-tab[data-tab="report"]');
    await expect(page.locator('.ard-report-row')).toHaveCount(2);
    await expect(page.locator('.ard-report-row[data-currency="SAR"]')).toContainText('100.5000');
    await expect(page.locator('.ard-report-row[data-currency="YER"]')).toContainText('2000.0000');
    await expect(page.locator('.ard-cost[data-currency="SAR"]')).toContainText('1540.0000');
    await expect(page.locator('.ard-commission[data-currency="YER"]')).toContainText('10.0000');
    await expect(page.locator('.ard-commission[data-currency="SAR"]')).toContainText('0.5000');
    await expect(page.locator('#ard-report-note')).toContainText('لا تُجمع العملات');
    const call = new URL(`http://x${requests.filter((r) => r.url.startsWith('/api/v1/admin/reports')).at(-1).url}`);
    expect(call.searchParams.get('group_by')).toBe('status');
    expect(call.searchParams.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    mode = 'empty';
    await page.click('#btn-ard-report-load');
    await expect(page.locator('#ard-report-empty')).toBeVisible();
    mode = 'bad';
    await page.click('#btn-ard-report-load');
    await expect(page.locator('#ard-report-error')).toContainText('المدخلات غير صالحة');
  });

  test('AR-6: audit log lists newest first with filters and paging; hostile text from the server is escaped, never markup', async ({ page }) => {
    const requests = await installBackend(page, {
      '/api/v1/admin/audit-log': (url, json) => url.searchParams.get('cursor')
        ? json(200, envelope([{ id: 'a3', occurred_at: '2026-10-01T00:00:00.000Z', stream: 's', action: 'x.old', actor_party_id: null, actor_role: null, target_type: null, target_id: null, before: null, after: null, request_id: null, ip_address: null, reason: null }], { nextCursor: null, hasMore: false }))
        : json(200, envelope([
          { id: 'a1', occurred_at: '2026-10-03T00:00:00.000Z', stream: 'admin-bootstrap', action: '<img src=x onerror=window.__pwned=1>', actor_party_id: null, actor_role: null, target_type: 'T', target_id: '"><script>window.__pwned=1</script>', before: null, after: null, request_id: null, ip_address: null, reason: null },
          { id: 'a2', occurred_at: '2026-10-02T00:00:00.000Z', stream: 'admin-bootstrap', action: 'bootstrap.roles_seeded', actor_party_id: null, actor_role: null, target_type: null, target_id: null, before: null, after: null, request_id: null, ip_address: null, reason: null },
        ], { nextCursor: 'AC-2', hasMore: true })),
    });
    await openModule(page);
    await page.click('.ard-tab[data-tab="audit"]');
    await expect(page.locator('.ard-audit-row')).toHaveCount(2);
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
    await expect(page.locator('#ard-audit-list img, #ard-audit-list script')).toHaveCount(0);
    await page.fill('.ard-input[data-tab="audit"][data-field="action"]', 'bootstrap.roles_seeded');
    await page.click('#btn-ard-audit-search');
    await expect(page.locator('.ard-audit-row')).toHaveCount(2);
    expect(new URL(`http://x${requests.filter((r) => r.url.startsWith('/api/v1/admin/audit-log')).at(-1).url}`).searchParams.get('action')).toBe('bootstrap.roles_seeded');
    await page.click('#btn-ard-audit-more');
    await expect(page.locator('.ard-audit-row')).toHaveCount(3);
  });

  test('AR-7: party wallet shows positions per currency, holds and movements; a 404 party is an error inside the tab; no tenant is ever sent', async ({ page }) => {
    const requests = await installBackend(page, {
      [`/api/v1/admin/parties/${PARTY_A}/wallet`]: (_u, json) => json(200, envelope({
        party: { id: PARTY_A, display_name: 'Agent A', party_type: 'AGENT' },
        positions: [{ currency: 'SAR', wallet_kind: 'MAIN', ledger_balance: '20.0000', held: '5.0000', credit_limit: '0.0000', is_spendable: true }, { currency: 'YER', wallet_kind: 'MAIN', ledger_balance: '700.0000', held: '0.0000', credit_limit: '0.0000', is_spendable: true }],
        active_holds: [{ id: 'h1', transaction_id: 'bbbbbbbb-0000-4000-8000-000000000001', wallet_kind: 'MAIN', amount: { amount: '5.0000', currency: 'SAR' }, created_at: '2026-10-03T00:00:00.000Z' }],
      })),
      [`/api/v1/admin/parties/${PARTY_A}/wallet/movements`]: (_u, json) => json(200, envelope([
        { id: 'm1', source_type: 'seed', source_id: 's', journal_entry_id: 'j', wallet_kind: 'MAIN', direction: 'DECREASE', amount: { amount: '300.0000', currency: 'YER' }, applied_at: '2026-10-02T00:00:00.000Z' },
        { id: 'm2', source_type: 'seed', source_id: 's2', journal_entry_id: 'j2', wallet_kind: 'MAIN', direction: 'INCREASE', amount: { amount: '1000.0000', currency: 'YER' }, applied_at: '2026-10-01T00:00:00.000Z' },
      ], { nextCursor: null, hasMore: false })),
      '/api/v1/admin/parties/22222222-2222-4222-8222-222222222222/wallet': (_u, json) => json(404, err('NOT_FOUND', 'Party not found.')),
    });
    await openModule(page);
    await page.click('.ard-tab[data-tab="wallet"]');
    await page.fill('.ard-input[data-tab="wallet"][data-field="partyId"]', PARTY_A);
    await page.click('#btn-ard-wallet-load');
    await expect(page.locator('.ard-position')).toHaveCount(2);
    await expect(page.locator('.ard-position[data-currency="YER"]')).toContainText('700.0000');
    await expect(page.locator('.ard-position[data-currency="SAR"]')).toContainText('محجوز 5.0000');
    await expect(page.locator('.ard-hold')).toHaveCount(1);
    await expect(page.locator('.ard-movement')).toHaveCount(2);
    await expect(page.locator('.ard-movement[data-direction="DECREASE"]')).toContainText('300.0000 YER');
    await page.fill('.ard-input[data-tab="wallet"][data-field="partyId"]', '22222222-2222-4222-8222-222222222222');
    await page.click('#btn-ard-wallet-load');
    await expect(page.locator('#ard-wallet-error')).toContainText('غير موجود');
    expect(requests.filter((r) => r.url.includes('/admin/')).every((r) => r.method === 'GET' && !/tenant/i.test(r.url))).toBe(true);
  });

  test('AR-9: parties tab - filters become query parameters, rows show the default agent, paging appends, "wallet" jumps to that party wallet, empty and 403 are readable', async ({ page }) => {
    const party = (n, type, name, extra = {}) => ({ id: `aaaaaaaa-1111-4111-8111-${String(n).padStart(12, '0')}`, party_type: type, parent_id: null, account_number: `ACC-${n}`, display_name: name, phone: `+96770000000${n}`, zone_code: 'NORTH', default_currency: 'YER', status: 'ACTIVE', created_at: '2026-10-01T00:00:00.000Z', default_agent_id: null, ...extra });
    let mode = 'ok';
    const requests = await installBackend(page, {
      '/api/v1/admin/parties': (url, json) => {
        if (mode === '403') return json(403, err('FORBIDDEN', 'Missing required permission: party:read_all.'));
        if (mode === 'empty') return json(200, envelope([], { nextCursor: null, hasMore: false }));
        return url.searchParams.get('cursor')
          ? json(200, envelope([party(3, 'POS', 'POS Three')], { nextCursor: null, hasMore: false }))
          : json(200, envelope([party(1, 'CUSTOMER', 'Customer <b>One</b>', { default_agent_id: 'bbbbbbbb-2222-4222-8222-000000000009' }), party(2, 'AGENT', 'Agent Two')], { nextCursor: 'PC-2', hasMore: true }));
      },
      '/api/v1/admin/parties/aaaaaaaa-1111-4111-8111-000000000001/wallet': (_u, json) => json(200, envelope({ party: { id: 'aaaaaaaa-1111-4111-8111-000000000001', display_name: 'Customer One', party_type: 'CUSTOMER' }, positions: [{ currency: 'YER', wallet_kind: 'MAIN', ledger_balance: '5.0000', held: '0.0000', credit_limit: '0.0000', is_spendable: true }], active_holds: [] })),
      '/api/v1/admin/parties/aaaaaaaa-1111-4111-8111-000000000001/wallet/movements': (_u, json) => json(200, envelope([], { nextCursor: null, hasMore: false })),
    });
    await openModule(page);
    await page.click('.ard-tab[data-tab="parties"]');
    await expect(page.locator('.ard-party-row')).toHaveCount(2);
    await expect(page.locator('.ard-party-row[data-type="CUSTOMER"]')).toContainText('الوكيل الافتراضي bbbbbbbb');
    await expect(page.locator('#ard-parties-list b')).toHaveCount(0); // the hostile name is text, not markup
    await page.click('#btn-ard-parties-more');
    await expect(page.locator('.ard-party-row')).toHaveCount(3);
    await page.selectOption('.ard-input[data-tab="parties"][data-field="partyType"]', 'CUSTOMER');
    await page.fill('.ard-input[data-tab="parties"][data-field="search"]', 'One');
    await page.click('#btn-ard-parties-search');
    const last = new URL(`http://x${requests.filter((r) => r.url.startsWith('/api/v1/admin/parties?')).at(-1).url}`);
    expect(last.searchParams.get('party_type')).toBe('CUSTOMER');
    expect(last.searchParams.get('search')).toBe('One');
    expect(last.searchParams.get('status')).toBeNull();
    await page.locator('.ard-party-wallet').first().click();
    await expect(page.locator('.ard-position[data-currency="YER"]')).toContainText('5.0000');
    await page.click('.ard-tab[data-tab="parties"]');
    mode = 'empty';
    await page.click('#btn-ard-parties-search');
    await expect(page.locator('#ard-parties-empty')).toBeVisible();
    mode = '403';
    await page.click('#btn-ard-parties-search');
    await expect(page.locator('#ard-parties-error')).toContainText('لا تملك الصلاحية');
  });

  test('AR-10: RTL and no horizontal overflow on a phone, a tablet and a large screen, in every tab, with long real-looking values', async ({ page }) => {
    const LONG = 'محمد عبدالله الحميري للاتصالات والخدمات الرقمية المحدودة جدًا '.repeat(2);
    const party = { id: 'aaaaaaaa-1111-4111-8111-000000000001', display_name: LONG, party_type: 'CUSTOMER' };
    await installBackend(page, {
      '/api/v1/admin/transactions': (_u, json) => json(200, envelope([tx(1, 'SETTLED', { party, service_id: 'service-with-a-very-long-code-0123456789', package_id: 'package-with-a-very-long-code-0123456789', customer_price: { amount: '123456789012.5000', currency: 'SAR' } })], { nextCursor: 'C', hasMore: true })),
      '/api/v1/admin/reports/operations': (_u, json) => json(200, envelope({ group_by: 'status', period: { from: '2026-10-01', to: '2026-10-31' }, rows: [{ key: 'SETTLED', currency: 'SAR', total: 12345, settled: 12000, failed: 300, other: 45, settled_customer_price: '123456789012.5000' }], status_counts: [{ status: 'SETTLED', count: 12000 }], settled_provider_cost: [{ currency: 'SAR', total: '98765432101.0000' }], commission_accrued: [{ currency: 'SAR', pool_total: '12345678.0000', company_retained: '1234.0000' }] }, { basis: { time_zone: 'UTC', note: LONG } })),
      '/api/v1/admin/audit-log': (_u, json) => json(200, envelope([{ id: 'a1', occurred_at: '2026-10-03T00:00:00.000Z', stream: 'stream-with-a-long-name-0123456789', action: 'module.some_long_action_name_for_the_audit_trail', actor_party_id: null, actor_role: null, target_type: 'LONG_TARGET_TYPE', target_id: 'target-id-0123456789012345678901234567890123456789', before: null, after: null, request_id: null, ip_address: null, reason: null }], { nextCursor: null, hasMore: false })),
      '/api/v1/admin/parties': (_u, json) => json(200, envelope([{ id: party.id, party_type: 'CUSTOMER', parent_id: null, account_number: 'ACC-0123456789012345', display_name: LONG, phone: '+967700000001', zone_code: 'NORTH', default_currency: 'YER', status: 'PENDING_VERIFICATION', created_at: '2026-10-01T00:00:00.000Z', default_agent_id: 'bbbbbbbb-2222-4222-8222-000000000009' }], { nextCursor: null, hasMore: false })),
      [`/api/v1/admin/parties/${party.id}/wallet`]: (_u, json) => json(200, envelope({ party, positions: [{ currency: 'YER', wallet_kind: 'COMMISSION', ledger_balance: '123456789012345.0000', held: '0.0000', credit_limit: '0.0000', is_spendable: true }], active_holds: [] })),
      [`/api/v1/admin/parties/${party.id}/wallet/movements`]: (_u, json) => json(200, envelope([], { nextCursor: null, hasMore: false })),
    });
    await openModule(page);
    for (const viewport of [{ width: 360, height: 640 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      for (const tab of ['transactions', 'report', 'audit', 'parties', 'wallet']) {
        await page.click(`.ard-tab[data-tab="${tab}"]`);
        if (tab === 'wallet') { await page.fill('.ard-input[data-tab="wallet"][data-field="partyId"]', party.id); await page.click('#btn-ard-wallet-load'); await expect(page.locator('.ard-position')).toBeVisible(); }
        else await expect(page.locator({ transactions: '.ard-tx-row', report: '.ard-report-row', audit: '.ard-audit-row', parties: '.ard-party-row' }[tab]).first()).toBeVisible();
        const m = await page.evaluate(() => {
          const panel = document.getElementById('admin-read-panel');
          const box = panel.getBoundingClientRect();
          // the page itself, the panel's own scroll width, and every descendant's rectangle against the panel (a clipped overflow:hidden ancestor would hide the first)
          const escaping = [...panel.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > box.right + 1 || r.left < box.left - 1); }).length;
          return { dir: document.documentElement.getAttribute('dir') || getComputedStyle(document.body).direction, over: Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, panel.scrollWidth - panel.clientWidth), escaping };
        });
        expect(m.escaping, `elements outside the panel in the ${tab} tab at ${viewport.width}px`).toBe(0);
        expect(m.dir, `${tab} ${viewport.width}`).toBe('rtl');
        expect(m.over, `horizontal overflow in the ${tab} tab at ${viewport.width}px`).toBeLessThanOrEqual(1);
      }
    }
  });

  test('AR-8: the read state is not persisted - nothing from the lists reaches browser storage', async ({ page }) => {
    await installBackend(page, { '/api/v1/admin/transactions': (_u, json) => json(200, envelope([tx(1, 'SETTLED')], { nextCursor: null, hasMore: false })) });
    await openModule(page);
    await expect(page.locator('.ard-tx-row')).toHaveCount(1);
    const stored = await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]));
    expect(stored).not.toContain('ref-1');
    expect(stored).not.toContain('Agent A');
    expect(stored).not.toContain('50.2500');
  });
});
