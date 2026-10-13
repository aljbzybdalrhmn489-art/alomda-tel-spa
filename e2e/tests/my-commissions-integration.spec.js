// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

/**
 * "My Commissions" — real browser -> REAL backend (startApplication) -> REAL PostgreSQL (isolated instance), end to end.
 *
 * Setup uses the real admin API (two real agents, activated). The commission facts the settlement poller would have written are INSERTED
 * directly (the poller is not part of the E2E server), with FK checks off for that one seeding transaction only, in the E2E tenant of the isolated
 * database. Everything the test then observes - authentication, authorization, the SQL report reader, the HTTP envelope, the SPA rendering - is real.
 *
 * Requires DATABASE_URL_TEST (the isolated instance); skipped otherwise.
 */
const API = 'http://127.0.0.1:4000';
const TENANT = 'e2e-spa-integration';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password-1';

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
  const login_identifier = `e2e-comm-${label}-${suffix}`;
  const password = `e2e-agent-password-${suffix}-${label}`;
  const created = await request.post(`${API}/api/v1/admin/agents`, {
    ...auth,
    data: { party_type: 'AGENT', account_number: `CM-${label}-${suffix}`, display_name: `Commission Agent ${label} ${suffix}`, phone: `7${label === 'A' ? '3' : '4'}${suffix.slice(-7)}`, zone_code: 'SOUTH', login_identifier, password },
  });
  expect(created.status(), await created.text()).toBe(201);
  const id = (await created.json()).data.id;
  expect((await request.post(`${API}/api/v1/admin/agents/${id}/activate`, auth)).status()).toBe(200);
  return { id, login_identifier, password };
}

/** Facts for the CURRENT UTC month so the SPA's default period contains them. */
async function seedFacts(agentA, agentB) {
  const client = pgClient();
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL session_replication_role = replica');
    const now = new Date();
    const at = (day, hour) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, hour, 0, 0)).toISOString();
    let n = 0;
    const tx = async (agent, status, settledAt) => {
      const id = randomUUID();
      await client.query(
        `INSERT INTO transactions (tenant_id, id, client_ref, party_id, request_hash, service_id, package_id, status, requires_hold, version, correlation_id, created_at, settled_at, gateway_id)
         VALUES ($1, $2, $3, $4, 'seed-e2e-mci', 'svc-1', 'pkg-1', $5, false, 0, 'corr', $6, $7, $8)`,
        [TENANT, id, `ref-${randomUUID()}`, agent, status, at(1, 1), settledAt, randomUUID()],
      );
      return id;
    };
    const fact = async (kind, transactionId, agent, shares, total, factAt) => {
      n += 1;
      await client.query(
        `INSERT INTO commission_facts (tenant_id, id, kind, transaction_id, policy_id, policy_version, recipient_type, pool_id, basis_type, formula_type, funding_source, distribution_model,
           total_amount, currency_code, company_retained_amount, recipient_shares, journal_entry_id, fact_at, agent_id, service_id, package_ref, formula_parameters)
         VALUES ($1, $2, $3, $4, 'p-e2e', 1, 'AGENT_FAMILY', $5, 'CUSTOMER_PRICE', 'PERCENTAGE', 'COMPANY_SUPPORTED', 'SINGLE_RECIPIENT', $6, 'YER', 0, $7::jsonb, $8, $9, $10, 'svc-1', 'PKG-1', '{"rate":"0.1"}'::jsonb)`,
        [TENANT, randomUUID(), kind, transactionId, `pool-${randomUUID()}-${n}`, total, JSON.stringify(shares), kind === 'ACCRUAL' ? randomUUID() : null, factAt, agent],
      );
    };
    const share = (party, amount) => [{ party_id: party, hierarchy_depth: 0, weight: '1', share_amount: amount }];
    // agent A: YER accrued 30 + 70 = 100, expected 40
    await fact('ACCRUAL', await tx(agentA, 'SETTLED', at(2, 9)), agentA, share(agentA, '30'), '30', at(2, 10));
    await fact('ACCRUAL', await tx(agentA, 'SETTLED', at(2, 11)), agentA, share(agentA, '70'), '70', at(2, 12));
    await fact('PROJECTION', await tx(agentA, 'VALIDATED', null), agentA, share(agentA, '40'), '40', at(3, 9));
    // agent B: an amount that must NEVER appear for agent A
    await fact('ACCRUAL', await tx(agentB, 'SETTLED', at(2, 9)), agentB, share(agentB, '987654'), '987654', at(2, 10));
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

async function spaLogin(page, identifier, password) {
  await page.goto('/production');
  await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 15_000 });
  await page.fill('#unified-identifier-input', identifier);
  await page.fill('#unified-password-input', password);
  await page.click('#btn-unified-login');
  await expect(page.locator('#my-commissions-panel')).toBeVisible({ timeout: 15_000 });
}

test.describe('My Commissions — real backend + real PostgreSQL', () => {
  test.skip(!process.env.DATABASE_URL_TEST, 'needs the isolated DATABASE_URL_TEST');

  test('MCI-1..4: exact totals from the real SQL reader; another agent never visible; a non-agent party refused; the removed admin route is 404', async ({ page, request }) => {
    const suffix = String(Date.now());
    const adminToken = await login(request, 'admin', ADMIN_PASSWORD);
    const A = await createActiveAgent(request, adminToken, suffix, 'A');
    const B = await createActiveAgent(request, adminToken, suffix, 'B');
    await seedFacts(A.id, B.id);

    // agent A in the browser
    await spaLogin(page, A.login_identifier, A.password);
    const yer = page.locator('.my-comm-total[data-currency="YER"]');
    await expect(yer.locator('.my-comm-total-accrued')).toHaveText('100.0000');
    await expect(yer.locator('.my-comm-total-expected')).toHaveText('40.0000');
    await expect(page.locator('#my-commissions-panel')).not.toContainText('987654');

    // drill down: 2 accrued + 1 expected, each from the database
    await page.locator('.my-comm-bucket[data-currency="YER"]').first().click();
    await expect(page.locator('.my-comm-item')).toHaveCount(3);
    await expect(page.locator('#my-commissions-panel')).not.toContainText('987654');

    // HTTP level, real tokens: forged agent_id ignored; detail of another agent's fact is 404; admin (no agent commission) sees nothing of B
    const tokenA = await login(request, A.login_identifier, A.password);
    const month = new Date().toISOString().slice(0, 7);
    const forged = await request.get(`${API}/api/v1/commissions/summary?granularity=month&from=${month}&to=${month}&agent_id=${B.id}`, { headers: { authorization: `Bearer ${tokenA}` } });
    expect(forged.status()).toBe(200);
    expect(JSON.stringify(await forged.json())).not.toContain('987654');
    const itemsB = await (await request.get(`${API}/api/v1/commissions/items?granularity=month&from=${month}&to=${month}&currency=YER&limit=50`, { headers: { authorization: `Bearer ${await login(request, B.login_identifier, B.password)}` } })).json();
    const foreignFactId = itemsB.data.items[0].id;
    expect((await request.get(`${API}/api/v1/commissions/items/${foreignFactId}`, { headers: { authorization: `Bearer ${tokenA}` } })).status()).toBe(404);
    expect((await request.get(`${API}/api/v1/commissions/summary?granularity=month&from=${month}&to=${month}`, { headers: { authorization: `Bearer ${adminToken}` } })).status()).toBe(403);
    expect((await request.get(`${API}/api/v1/admin/commissions/review/agents`, { headers: { authorization: `Bearer ${adminToken}` } })).status()).toBe(404);
    expect((await request.get(`${API}/api/v1/commissions/summary?granularity=month&from=${month}&to=${month}`)).status()).toBe(401);
  });
});
