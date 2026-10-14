// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

/**
 * Administrative read screen - real browser -> REAL backend (startApplication) -> REAL PostgreSQL (isolated instance), end to end.
 *
 * Setup uses the real admin API (a real agent). Transactions, a hold, commission facts and wallet rows are INSERTED directly (the flows that would
 * create them are not what is under test), with FK checks off for that one seeding transaction only; the transactions carry the `seed-e2e-mci`
 * tag the financial-invariant audit already recognises. A second tenant gets rows with the SAME service id and the SAME shape: none of them may
 * ever reach the screen. Every number the screen shows is then compared with an independent SUM computed straight from PostgreSQL.
 *
 * Requires DATABASE_URL_TEST (the isolated instance); skipped otherwise.
 */
const API = 'http://127.0.0.1:4000';
const TENANT = 'e2e-spa-integration';
const FOREIGN_TENANT = 'e2e-spa-integration-foreign';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password-1';
const TAG = 'seed-e2e-mci';

function pgClient() {
  const pg = require(path.resolve(__dirname, '..', '..', 'backend', 'node_modules', 'pg'));
  return new pg.Client({ connectionString: process.env.DATABASE_URL_TEST });
}
async function login(request, identifier, password) {
  const res = await request.post(`${API}/api/v1/auth/login`, { data: { login_identifier: identifier, password } });
  expect(res.status()).toBe(200);
  return (await res.json()).data.access_token;
}
async function createActiveAgent(request, adminToken, suffix, label) {
  const auth = { headers: { authorization: `Bearer ${adminToken}` } };
  const login_identifier = `e2e-ard-${label}-${suffix}`;
  const password = `e2e-agent-password-${suffix}-${label}`;
  const created = await request.post(`${API}/api/v1/admin/agents`, {
    ...auth, data: { party_type: 'AGENT', account_number: `AR-${label}-${suffix}`, display_name: `Read Agent ${label} ${suffix}`, phone: `7${label === 'A' ? '5' : '6'}${suffix.slice(-7)}`, zone_code: 'SOUTH', login_identifier, password },
  });
  expect(created.status(), await created.text()).toBe(201);
  const id = (await created.json()).data.id;
  expect((await request.post(`${API}/api/v1/admin/agents/${id}/activate`, auth)).status()).toBe(200);
  return { id, login_identifier, password };
}

/** @returns {Promise<{service:string, txIds:string[]}>} */
async function seed(agent, foreignParty, suffix) {
  const service = `svc-ard-${suffix}`;
  const client = pgClient();
  await client.connect();
  const txIds = [];
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL session_replication_role = replica');
    const now = Date.now();
    const iso = (minutesAgo) => new Date(now - minutesAgo * 60_000).toISOString();
    const tx = async (tenant, party, status, price, cur, cost, costCur, minutesAgo) => {
      const id = randomUUID();
      if (tenant === TENANT) txIds.push(id);
      await client.query(
        `INSERT INTO transactions (tenant_id, id, client_ref, party_id, request_hash, service_id, package_id, status, requires_hold, version, correlation_id, created_at, settled_at, gateway_id,
           fulfillment_strategy, locked_customer_price, locked_currency, locked_provider_cost, locked_cost_currency, target_identifier, pricing_rule_version)
         VALUES ($1, $2, $3, $4, $5, $6, 'pkg-ard', $7, false, 1, 'corr', $8, $9, $10, 'MANUAL', $11, $12, $13, $14, '+967700000009', 1)`,
        [tenant, id, `ref-${randomUUID()}`, party, TAG, service, status, iso(minutesAgo), status === 'SETTLED' ? iso(minutesAgo - 1) : null, randomUUID(), price, cur, cost, costCur],
      );
      await client.query(`INSERT INTO transaction_status_history (tenant_id, id, transaction_id, from_status, to_status, actor_kind, reason, at, correlation_id) VALUES ($1, $2, $3, NULL, 'CREATED', 'USER', 'seed', $4, 'corr')`, [tenant, randomUUID(), id, iso(minutesAgo)]);
      return id;
    };
    const first = await tx(TENANT, agent, 'SETTLED', '100.5000', 'YER', '0.0000', 'YER', 30);
    await tx(TENANT, agent, 'SETTLED', '50.2500', 'SAR', '40.0000', 'SAR', 20);
    await tx(TENANT, agent, 'FAILED', '70.0000', 'YER', '60.0000', 'YER', 10);
    // the foreign tenant: same service, same shape, an amount that must never appear
    await tx(FOREIGN_TENANT, foreignParty, 'SETTLED', '987654.0000', 'YER', '1.0000', 'YER', 15);
    await client.query(
      `INSERT INTO parties (tenant_id, id, party_type, account_number, display_name, phone, zone_code, default_currency_code, status) VALUES ($1, $2, 'AGENT', $3, 'Foreign Tenant Agent', $4, 'NORTH', 'YER', 'ACTIVE') ON CONFLICT DO NOTHING`,
      [FOREIGN_TENANT, foreignParty, `FT-${suffix}`, `+9678${suffix.slice(-8)}`],
    );
    await client.query(
      `INSERT INTO commission_facts (tenant_id, id, kind, transaction_id, policy_id, policy_version, recipient_type, pool_id, basis_type, formula_type, funding_source, distribution_model, total_amount, currency_code, company_retained_amount,
         recipient_shares, journal_entry_id, fact_at, agent_id, service_id, package_ref, formula_parameters)
       VALUES ($1, $2, 'ACCRUAL', $3, 'p-e2e', 1, 'AGENT_FAMILY', $4, 'CUSTOMER_PRICE', 'PERCENTAGE', 'COMPANY_SUPPORTED', 'SINGLE_RECIPIENT', 10.0000, 'YER', 2.0000, '[]'::jsonb, $5, $6, $7, $8, 'pkg-ard', '{}'::jsonb)`,
      [TENANT, randomUUID(), first, `pool-${randomUUID()}`, randomUUID(), iso(5), agent, service],
    );
    await client.query(`INSERT INTO party_wallet_projection (tenant_id, party_id, currency_code, wallet_kind, ledger_balance, held_amount, credit_limit) VALUES ($1, $2, 'YER', 'MAIN', 700.0000, 0.0000, 0.0000)`, [TENANT, agent]);
    const mv = (k, dir, amount, minutesAgo) => client.query(
      `INSERT INTO wallet_ledger_movements (tenant_id, id, source_type, source_id, journal_entry_id, line_index, party_id, currency_code, wallet_kind, direction, amount, applied_at) VALUES ($1, $2, 'seed', $3, $4, 0, $5, 'YER', 'MAIN', $6, $7, $8)`,
      [TENANT, randomUUID(), `ard-${suffix}-${k}`, randomUUID(), agent, dir, amount, iso(minutesAgo)],
    );
    await mv(1, 'INCREASE', '1000.0000', 50);
    await mv(2, 'DECREASE', '300.0000', 40);
    await client.query(`INSERT INTO party_wallet_projection (tenant_id, party_id, currency_code, wallet_kind, ledger_balance, held_amount, credit_limit) VALUES ($1, $2, 'YER', 'MAIN', 555555.0000, 0.0000, 0.0000)`, [FOREIGN_TENANT, foreignParty]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
  return { service, txIds };
}

async function sqlSettledByCurrency(service) {
  const client = pgClient();
  await client.connect();
  try {
    const r = await client.query(`SELECT locked_currency AS cur, SUM(locked_customer_price)::text AS total, count(*)::int AS n FROM transactions WHERE tenant_id = $1 AND service_id = $2 AND status = 'SETTLED' GROUP BY 1 ORDER BY 1`, [TENANT, service]);
    return Object.fromEntries(r.rows.map((x) => [x.cur, { total: x.total, n: x.n }]));
  } finally { await client.end(); }
}

test.describe('Administrative read screen - real backend + real PostgreSQL', () => {
  test.skip(!process.env.DATABASE_URL_TEST, 'needs the isolated DATABASE_URL_TEST');

  test('ARI-1..6: UI -> API -> DB: exact figures, filters, detail, wallet, audit; another tenant is never visible; a non-admin is refused', async ({ page, request }) => {
    const suffix = String(Date.now());
    const adminToken = await login(request, 'admin', ADMIN_PASSWORD);
    const agent = await createActiveAgent(request, adminToken, suffix, 'A');
    const foreignParty = randomUUID();
    const { service } = await seed(agent.id, foreignParty, suffix);

    // ---- administrator in the browser
    await page.goto('/production');
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 15_000 });
    await page.fill('#unified-identifier-input', 'admin');
    await page.fill('#unified-password-input', ADMIN_PASSWORD);
    await page.click('#btn-unified-login');
    await expect(page.locator('#btn-admin-drawer-open')).toBeVisible({ timeout: 15_000 });
    await page.click('#btn-admin-drawer-open');
    await page.locator('.admin-nav-item[data-module-id="adminReadBackend"]').click();
    await expect(page.locator('#admin-read-panel')).toBeVisible();

    // a tab loads itself when opened; let that first load finish before interacting, or its re-render can swallow a click
    await expect(page.locator('#ard-tx-list, #ard-tx-empty')).toBeVisible();
    // transactions: filtered to THIS run's service -> exactly the three tenant rows, never the foreign one
    await page.fill('.ard-input[data-tab="tx"][data-field="service"]', service);
    await page.click('#btn-ard-tx-search');
    await expect(page.locator('.ard-tx-row')).toHaveCount(3);
    await expect(page.locator('#ard-tx-list')).toContainText('100.5000 YER');
    await expect(page.locator('#ard-tx-list')).toContainText('50.2500 SAR');
    await expect(page.locator('#admin-read-panel')).not.toContainText('987654');
    await expect(page.locator('#admin-read-panel')).not.toContainText('Foreign Tenant Agent');
    await page.selectOption('.ard-input[data-tab="tx"][data-field="status"]', 'FAILED');
    await page.click('#btn-ard-tx-search');
    await expect(page.locator('.ard-tx-row')).toHaveCount(1);
    await page.selectOption('.ard-input[data-tab="tx"][data-field="status"]', '');
    await page.selectOption('.ard-input[data-tab="tx"][data-field="currency"]', 'SAR');
    await page.click('#btn-ard-tx-search');
    await expect(page.locator('.ard-tx-row')).toHaveCount(1);
    await page.selectOption('.ard-input[data-tab="tx"][data-field="currency"]', '');
    await page.click('#btn-ard-tx-search');
    await expect(page.locator('.ard-tx-row')).toHaveCount(3);

    // detail of the YER settled row: frozen facts + history from the database
    await page.locator('.ard-tx-row[data-status="SETTLED"]', { hasText: '100.5000 YER' }).click();
    await expect(page.locator('.ard-d-price')).toHaveText('100.5000 YER');
    await expect(page.locator('.ard-d-hist')).toHaveCount(1);
    await expect(page.locator('.ard-d-comm')).toContainText('ACCRUAL · 10.0000 YER');
    await page.click('#btn-ard-tx-detail-close');

    // operations summary: equals an independent SUM straight from PostgreSQL, per currency
    await page.click('.ard-tab[data-tab="report"]');
    await expect(page.locator('#ard-report-rows, #ard-report-empty')).toBeVisible();
    await page.selectOption('.ard-input[data-tab="report"][data-field="groupBy"]', 'service');
    await page.click('#btn-ard-report-load');
    const sql = await sqlSettledByCurrency(service);
    await expect(page.locator(`.ard-report-row[data-key="${service}"][data-currency="YER"]`)).toContainText(sql.YER.total);
    await expect(page.locator(`.ard-report-row[data-key="${service}"][data-currency="SAR"]`)).toContainText(sql.SAR.total);
    expect(sql.YER.total).toBe('100.5000');
    await expect(page.locator('#ard-report-rows')).not.toContainText('987654');
    await expect(page.locator('.ard-commission[data-currency="YER"]')).toBeVisible();

    // audit log: the bootstrap records are there; no hash bytes, no password
    await page.click('.ard-tab[data-tab="audit"]');
    await expect(page.locator('.ard-audit-row').first()).toBeVisible();
    await expect(page.locator('#ard-audit-list')).not.toContainText(/password|private key|previous_hash/i);

    // parties: the real agent is found by name; the foreign tenant's party never is
    await page.click('.ard-tab[data-tab="parties"]');
    await expect(page.locator('#ard-parties-list, #ard-parties-empty')).toBeVisible();
    await page.fill('.ard-input[data-tab="parties"][data-field="search"]', `Read Agent A ${suffix}`);
    await page.click('#btn-ard-parties-search');
    await expect(page.locator('.ard-party-row')).toHaveCount(1);
    await expect(page.locator('.ard-party-row')).toHaveAttribute('data-id', agent.id);
    await page.fill('.ard-input[data-tab="parties"][data-field="search"]', 'Foreign Tenant Agent');
    await page.click('#btn-ard-parties-search');
    await expect(page.locator('#ard-parties-empty')).toBeVisible();

    // wallet of the agent: projection and movements from the database; the foreign tenant's party is 404 inside the tab
    await page.click('.ard-tab[data-tab="wallet"]');
    await page.fill('.ard-input[data-tab="wallet"][data-field="partyId"]', agent.id);
    await page.click('#btn-ard-wallet-load');
    await expect(page.locator('.ard-position[data-currency="YER"]')).toContainText('700.0000');
    await expect(page.locator('.ard-movement')).toHaveCount(2);
    await page.fill('.ard-input[data-tab="wallet"][data-field="partyId"]', foreignParty);
    await page.click('#btn-ard-wallet-load');
    await expect(page.locator('#ard-wallet-error')).toContainText('غير موجود');
    await expect(page.locator('#admin-read-panel')).not.toContainText('555555');

    // ---- HTTP level with real tokens: an agent is refused on every administrative read route; no token -> 401; the foreign ids are 404
    const agentToken = await login(request, agent.login_identifier, agent.password);
    const month = new Date().toISOString().slice(0, 10);
    for (const p of ['/api/v1/admin/transactions', `/api/v1/admin/reports/operations?from=${month}&to=${month}`, '/api/v1/admin/audit-log', `/api/v1/admin/parties/${agent.id}/wallet`, `/api/v1/admin/parties/${agent.id}/wallet/movements`]) {
      expect((await request.get(`${API}${p}`)).status(), p).toBe(401);
      expect((await request.get(`${API}${p}`, { headers: { authorization: `Bearer ${agentToken}` } })).status(), p).toBe(403);
    }
    expect((await request.get(`${API}/api/v1/admin/parties/${foreignParty}/wallet`, { headers: { authorization: `Bearer ${adminToken}` } })).status()).toBe(404);
    const own = await request.get(`${API}/api/v1/wallet/movements?limit=100`, { headers: { authorization: `Bearer ${agentToken}` } });
    expect(own.status()).toBe(200);
    expect((await own.json()).data.length).toBe(2);
  });
});
