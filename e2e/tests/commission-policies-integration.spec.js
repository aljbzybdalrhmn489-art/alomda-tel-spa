// @ts-check
const { test, expect } = require('@playwright/test');
const { queryOne } = require('./db-evidence');

/**
 * COMMISSION POLICY ADMIN (real backend) — real browser, real backend, real PostgreSQL. CP-UI-1…5: the list of policy
 * versions, a version's details, creation through the real API (GLOBAL / AGENT / AGENT_GROUP / AGENT_TIER targets picked from
 * REAL lists only), the "next version" flow (history is immutable), UI + backend validation errors, 403 and 401. The SPA
 * calculates nothing and generates the V1 direct-agent-only distribution itself.
 */

const ADMIN_LOGIN_IDENTIFIER = 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password-1';
const API_BASE_URL = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:4000';

async function completeLocalSetupGateIfShown(page) {
  const setupButton = page.locator('#btn-admin-setup-create');
  if (await setupButton.count() === 0) return;
  await page.fill('#setup-name-input', 'Throwaway Local Setup');
  await page.fill('#setup-identifier-input', 'local-setup-' + Date.now());
  await page.fill('#setup-password-input', 'throwaway-local-1');
  await page.fill('#setup-confirm-password-input', 'throwaway-local-1');
  await setupButton.click();
  await page.click('#btn-admin-drawer-open');
  await page.locator('#btn-admin-logout').click();
}

async function loginWithRealBackend(page, loginIdentifier, password) {
  await page.fill('#unified-identifier-input', loginIdentifier);
  await page.fill('#unified-password-input', password);
  await page.click('#btn-unified-login');
  await expect.poll(() => page.evaluate(() => (typeof state !== 'undefined' && state.session && !!state.session.accessToken))).toBe(true);
}

async function openPoliciesModule(page) {
  await page.click('#btn-admin-drawer-open');
  await page.click('.admin-nav-item[data-module-id="commissionPoliciesBackend"]');
  await expect(page.locator('#cpb-intro')).toBeVisible({ timeout: 15_000 });
}

const backendPolicies = (page, serviceCode) => page.evaluate(async (s) => {
  const r = await BackendCommissionPolicyApi.list(null);
  return r.ok ? r.data.filter((p) => p.service_code === s) : null;
}, serviceCode);

test.describe('Commission Policy Admin — real backend', () => {
  test('CP-UI-1…5: list -> create (all targets) -> details -> invalid targets -> next version -> validation -> 403 -> 401', async ({ page }) => {
    const suffix = String(Date.now());
    const serviceCode = 'e2e-cp-svc-' + suffix;
    const packageCode = 'cp-pkg-' + suffix;

    await page.goto('/');
    await completeLocalSetupGateIfShown(page);
    await loginWithRealBackend(page, ADMIN_LOGIN_IDENTIFIER, ADMIN_PASSWORD);

    // Real catalog data to scope policies to, a real agent and a real agent group to target.
    const prepared = await page.evaluate(async ({ s, p, tag }) => {
      const service = await BackendServiceApi.create({ code: s, name: 'E2E CP Service ' + tag, fulfillment_strategy: 'MANUAL', requires_hold: true });
      if (!service.ok) return { ok: false, step: 'service' };
      if (!(await BackendServiceApi.activate(service.data.id)).ok) return { ok: false, step: 'service-activate' };
      const pkg = await BackendPackageApi.create({ service_code: s, code: p, name: 'E2E CP Package ' + tag });
      if (!pkg.ok) return { ok: false, step: 'package' };
      if (!(await BackendPackageApi.activate(pkg.data.id)).ok) return { ok: false, step: 'package-activate' };
      const agent = await BackendAgentApi.create({
        party_type: 'AGENT', account_number: 'CP-' + tag, display_name: 'E2E CP Agent ' + tag, phone: '7' + tag.slice(-8),
        zone_code: 'SOUTH', login_identifier: 'e2e-cp-agent-' + tag, password: 'e2e-cp-password-' + tag,
      });
      if (!agent.ok) return { ok: false, step: 'agent' };
      if (!(await BackendAgentApi.activate(agent.data.id)).ok) return { ok: false, step: 'agent-activate' };
      const group = await ApiClient.post('/api/v1/admin/agent-groups', { code: 'CPG-' + tag, name: 'E2E CP Group ' + tag });
      if (!group.ok) return { ok: false, step: 'group', status: group.status };
      return { ok: true, packageUuid: pkg.data.id, agentId: agent.data.id, agentName: agent.data.display_name, groupId: group.data.id, groupCode: group.data.code, login: 'e2e-cp-agent-' + tag, password: 'e2e-cp-password-' + tag };
    }, { s: serviceCode, p: packageCode, tag: suffix });
    expect(prepared.ok, JSON.stringify(prepared)).toBe(true);

    // CP-UI-1) The module lists the policy versions from the backend; the form's "V1" note states the direct-agent-only rule.
    await openPoliciesModule(page);
    await expect(page.locator('#cpb-intro')).toContainText('المباشر فقط');
    await expect(page.locator('#cpb-list')).toBeVisible();
    expect(await page.locator('#admin-legacy-local-banner').count()).toBe(0);

    // CP-UI-4a) Create a GLOBAL-assignment policy scoped to the service + package (picked from the catalog).
    await page.click('#btn-cpb-add');
    await page.selectOption('#cpb-service', serviceCode);
    await page.selectOption('#cpb-package', prepared.packageUuid);
    await page.selectOption('#cpb-assignment-type', 'GLOBAL');
    await expect(page.locator('#cpb-target')).toHaveCount(0);
    await page.fill('#cpb-rate', '0.05');
    // The distribution is generated by the SPA for V1: a single depth-0 recipient, shown read-only.
    await expect(page.locator('#cpb-ro-distribution')).toContainText('"hierarchyDepth":0');
    await expect(page.locator('#cpb-ro-distribution')).not.toContainText('"hierarchyDepth":1');
    const createRequest = page.waitForRequest((req) => req.method() === 'POST' && req.url().endsWith('/api/v1/admin/commission-policies'));
    await page.click('#btn-cpb-form-save');
    const sent = JSON.parse((await createRequest).postData() || '{}');
    expect(sent).toMatchObject({
      service_code: serviceCode, package_id: packageCode, package_uuid: prepared.packageUuid, assignment_type: 'GLOBAL', basis_type: 'CUSTOMER_PRICE', formula_type: 'PERCENTAGE',
      formula_parameters: { rate: '0.05' }, funding_source: 'COMPANY_SUPPORTED', distribution_model: 'SIMULTANEOUS_WEIGHTED_SPLIT',
      weight_parameters: { recipients: [{ hierarchyDepth: 0, weight: '1.0' }] }, allows_company_retention: false, currency_code: 'YER',
    });
    expect(Object.keys(sent)).not.toContain('assignment_target_id');
    await expect(page.locator('#cpb-success')).toBeVisible({ timeout: 15_000 });
    const globalPolicy = (await backendPolicies(page, serviceCode)).find((p) => p.assignment_type === 'GLOBAL');
    expect(globalPolicy).toMatchObject({ version: 1, package_id: packageCode, package_uuid: prepared.packageUuid, formula_parameters: { rate: '0.05' } });
    const globalRow = page.locator('.cpb-row[data-policy-id="' + globalPolicy.policy_id + '"][data-version="1"]');
    await expect(globalRow).toBeVisible();
    await expect(globalRow.locator('.cpb-scope')).toContainText(serviceCode);

    // CP-UI-2) The details of a version (read-only): formula parameters and the generated V1 weights.
    await globalRow.locator('.cpb-detail-btn').click();
    await expect(page.locator('#cpb-detail')).toHaveAttribute('data-policy-id', globalPolicy.policy_id);
    await expect(page.locator('#cpb-detail .cpb-detail-formula')).toHaveText('{"rate":"0.05"}');
    // (the backend stores JSONB, so key order is its own: compare the parsed value)
    expect(JSON.parse(await page.locator('#cpb-detail .cpb-detail-weights').innerText())).toEqual({ recipients: [{ hierarchyDepth: 0, weight: '1.0' }] });
    await expect(page.locator('#cpb-detail .cpb-detail-version')).toHaveText('1');
    await page.click('#btn-cpb-detail-close');
    await expect(page.locator('#cpb-detail')).toHaveCount(0);

    // CP-UI-3) Targets come from REAL lists only: AGENT lists agents (never a customer / POS), the form refuses an empty target,
    // and the backend still refuses a customer id sent directly (400, shown with its own message).
    const customer = await queryOne("SELECT id FROM parties WHERE account_number LIKE 'E2E-DA-C1-%' ORDER BY created_at DESC LIMIT 1", []);
    await page.click('#btn-cpb-add');
    await page.selectOption('#cpb-service', serviceCode);
    await page.selectOption('#cpb-assignment-type', 'AGENT');
    await expect(page.locator('#cpb-target')).toBeVisible();
    const agentOptions = await page.locator('#cpb-target option').evaluateAll((els) => els.map((e) => e.getAttribute('value')));
    expect(agentOptions).toContain(prepared.agentId);
    if (customer) expect(agentOptions).not.toContain(String(customer.id));
    await page.fill('#cpb-rate', '0.04');
    await page.click('#btn-cpb-form-save');
    await expect(page.locator('#cpb-form-error')).toContainText('اختر وكيلاً حقيقياً');
    await page.fill('#cpb-rate', 'abc');
    await page.selectOption('#cpb-target', prepared.agentId);
    await page.click('#btn-cpb-form-save');
    await expect(page.locator('#cpb-form-error')).toContainText('النسبة');
    await page.click('#btn-cpb-form-cancel');
    expect((await backendPolicies(page, serviceCode)).filter((p) => p.assignment_type === 'AGENT')).toHaveLength(0); // nothing was sent
    const backendRefusal = await page.evaluate(async ({ s, target }) => {
      const r = await BackendCommissionPolicyApi.create({
        service_code: s, assignment_type: 'AGENT', assignment_target_id: target, basis_type: 'CUSTOMER_PRICE', formula_type: 'PERCENTAGE', formula_parameters: { rate: '0.04' },
        funding_source: 'COMPANY_SUPPORTED', distribution_model: 'SIMULTANEOUS_WEIGHTED_SPLIT', weight_parameters: { recipients: [{ hierarchyDepth: 0, weight: '1.0' }] }, allows_company_retention: false, currency_code: 'YER',
      });
      return { status: r.status, code: r.error && r.error.code, message: describeAdminApiError(r) };
    }, { s: serviceCode, target: customer ? String(customer.id) : '0192e2e0-ffff-7000-8000-00000000dead' });
    expect(backendRefusal).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    expect(backendRefusal.message).toContain('بيانات غير صالحة');

    // CP-UI-4b) AGENT, AGENT_GROUP and AGENT_TIER policies, each from its real picker.
    await page.click('#btn-cpb-add');
    await page.selectOption('#cpb-service', serviceCode);
    await page.selectOption('#cpb-assignment-type', 'AGENT');
    await page.selectOption('#cpb-target', prepared.agentId);
    await page.selectOption('#cpb-formula-type', 'FIXED_AMOUNT');
    await page.fill('#cpb-amount', '15');
    await page.click('#btn-cpb-form-save');
    await expect(page.locator('#cpb-success')).toBeVisible({ timeout: 15_000 });
    await page.click('#btn-cpb-add');
    await page.selectOption('#cpb-service', serviceCode);
    await page.selectOption('#cpb-assignment-type', 'AGENT_GROUP');
    expect(await page.locator('#cpb-target option').evaluateAll((els) => els.map((e) => e.getAttribute('value')))).toContain(prepared.groupId);
    await page.selectOption('#cpb-target', prepared.groupId);
    await page.fill('#cpb-rate', '0.03');
    await page.click('#btn-cpb-form-save');
    await expect(page.locator('#cpb-success')).toBeVisible({ timeout: 15_000 });
    await page.click('#btn-cpb-add');
    await page.selectOption('#cpb-service', serviceCode);
    await page.selectOption('#cpb-assignment-type', 'AGENT_TIER');
    expect(await page.locator('#cpb-target option').evaluateAll((els) => els.map((e) => e.getAttribute('value')))).toEqual(['', 'BRONZE', 'SILVER', 'GOLD', 'VIP']);
    await page.selectOption('#cpb-target', 'GOLD');
    await page.fill('#cpb-rate', '0.02');
    await page.click('#btn-cpb-form-save');
    await expect(page.locator('#cpb-success')).toBeVisible({ timeout: 15_000 });
    const all = await backendPolicies(page, serviceCode);
    expect(all.map((p) => [p.assignment_type, p.assignment_target_id]).sort()).toEqual([
      ['AGENT', prepared.agentId], ['AGENT_GROUP', prepared.groupId], ['AGENT_TIER', 'GOLD'], ['GLOBAL', null],
    ].sort());
    const agentPolicy = all.find((p) => p.assignment_type === 'AGENT');
    await expect(page.locator('.cpb-row[data-policy-id="' + agentPolicy.policy_id + '"] .cpb-assignment')).toContainText(prepared.agentName);
    await expect(page.locator('.cpb-row[data-policy-id="' + agentPolicy.policy_id + '"] .cpb-formula')).toContainText('FIXED_AMOUNT');

    // CP-UI-4c) A change is a NEXT VERSION: scope / assignment / currency are read-only, the old version is untouched and has no "new version" action.
    await globalRow.locator('.cpb-new-version').click();
    await expect(page.locator('#cpb-version-note')).toContainText(globalPolicy.policy_id);
    await expect(page.locator('#cpb-service, #cpb-assignment-type, #cpb-currency, #cpb-target')).toHaveCount(0);
    await expect(page.locator('#cpb-ro-assignment')).toContainText('GLOBAL');
    await expect(page.locator('#cpb-rate')).toHaveValue('0.05');
    await page.fill('#cpb-rate', '0.07');
    await page.click('#btn-cpb-form-save');
    await expect(page.locator('#cpb-success')).toContainText('إصدار جديد', { timeout: 15_000 });
    const versions = (await backendPolicies(page, serviceCode)).filter((p) => p.policy_id === globalPolicy.policy_id).sort((a, b) => a.version - b.version);
    expect(versions.map((v) => [v.version, v.formula_parameters.rate])).toEqual([[1, '0.05'], [2, '0.07']]); // v1 immutable
    await expect(page.locator('.cpb-row[data-policy-id="' + globalPolicy.policy_id + '"][data-version="1"]')).toHaveAttribute('data-latest', 'false');
    await expect(page.locator('.cpb-row[data-policy-id="' + globalPolicy.policy_id + '"][data-version="1"] .cpb-new-version')).toHaveCount(0);
    await expect(page.locator('.cpb-row[data-policy-id="' + globalPolicy.policy_id + '"][data-version="2"]')).toHaveAttribute('data-latest', 'true');

    // CP-UI-5) Validation: a backend 400 (window ends before it starts) is shown with the backend's own message; the form stays open.
    await page.locator('.cpb-row[data-policy-id="' + globalPolicy.policy_id + '"][data-version="2"] .cpb-new-version').click();
    await page.fill('#cpb-valid-from', '2031-06-01T00:00');
    await page.fill('#cpb-valid-to', '2030-06-01T00:00');
    await page.click('#btn-cpb-form-save');
    await expect(page.locator('#cpb-form-error')).toContainText('بيانات غير صالحة', { timeout: 15_000 });
    await page.click('#btn-cpb-form-cancel');
    expect((await backendPolicies(page, serviceCode)).filter((p) => p.policy_id === globalPolicy.policy_id)).toHaveLength(2); // nothing was written

    // CP-UI-5) 403: a token without commission_policy:* is told so (reads and writes); the backend decides.
    const agentToken = await page.evaluate(async ({ base, login, password }) => {
      const response = await fetch(base + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login_identifier: login, password }) });
      const body = await response.json();
      return body.data ? body.data.access_token : null;
    }, { base: API_BASE_URL, login: prepared.login, password: prepared.password });
    expect(agentToken).toBeTruthy();
    const adminToken = await page.evaluate(() => state.session.accessToken);
    await page.evaluate((token) => { state.session.accessToken = token; }, agentToken);
    await page.evaluate(() => loadCommissionPoliciesBackendFromBackend());
    await expect(page.locator('#admin-commission-policies-error')).toContainText('لا تملك صلاحية', { timeout: 15_000 });
    await expect(page.locator('.cpb-row')).toHaveCount(0);
    const forbiddenWrite = await page.evaluate(async (s) => {
      const r = await BackendCommissionPolicyApi.create({ service_code: s, basis_type: 'CUSTOMER_PRICE', formula_type: 'PERCENTAGE', formula_parameters: { rate: '0.01' }, funding_source: 'COMPANY_SUPPORTED', distribution_model: 'SIMULTANEOUS_WEIGHTED_SPLIT', weight_parameters: { recipients: [{ hierarchyDepth: 0, weight: '1.0' }] }, allows_company_retention: false, currency_code: 'YER' });
      return { status: r.status, message: describeAdminApiError(r) };
    }, serviceCode);
    expect(forbiddenWrite.status).toBe(403);
    expect(forbiddenWrite.message).toContain('لا تملك صلاحية');
    await page.evaluate((token) => { state.session.accessToken = token; }, adminToken);
    expect((await backendPolicies(page, serviceCode)).length).toBe(5); // 4 policies, one of them with 2 versions

    // 401: an invalid token sends the user back to sign-in with no stale policy data.
    await page.evaluate(() => { state.session.accessToken = 'invalid-token'; });
    await page.evaluate(() => loadCommissionPoliciesBackendFromBackend());
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 10_000 });
    expect(await page.evaluate(() => state.session.accessToken)).toBeFalsy();
  });
});
