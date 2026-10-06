// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * SPA PRICING ADMIN (real backend) — real browser, real backend, real PostgreSQL.
 * PricingGroup → Party Pricing Assignment → Service Pricing (versions). Covers: group create/read/update and
 * activate/deactivate, assignment create/read (append-only history, one open assignment per party), service
 * pricing create/read (new VERSION per price change) from a Package PICKED from the Package API — the request
 * carries the backend-issued package UUID, the service code and the package code, never retyped text — plus
 * validation/conflict feedback, no write to the local mock pricing array, reload persistence, 403 and 401.
 */

const ADMIN_LOGIN_IDENTIFIER = 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password-1';
const API_BASE_URL = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:4000';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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

async function openPricingModule(page) {
  await page.click('#btn-admin-drawer-open');
  await page.click('.admin-nav-item[data-module-id="pricingBackend"]');
  await expect(page.locator('.pricing-backend-tab[data-tab-id="groups"]')).toBeVisible({ timeout: 10_000 });
}

async function openTab(page, tabId) {
  await page.click('.pricing-backend-tab[data-tab-id="' + tabId + '"]');
  await expect(page.locator('.pricing-backend-tab[data-tab-id="' + tabId + '"]')).toHaveAttribute('aria-pressed', 'true');
}

function groupRow(page, name) {
  return page.locator('.admin-pricing-group-row[data-group-name="' + name + '"]');
}

async function backendGroupByName(page, name) {
  return page.evaluate(async (n) => {
    const r = await BackendPricingGroupApi.list();
    return r.ok ? (r.data.find((g) => g.name === n) || null) : { error: r.error };
  }, name);
}

test.describe('SPA Pricing Admin — real backend', () => {
  test('groups -> assignments -> service pricing (canonical package) -> validation/conflict -> no local write -> reload -> 403 -> 401', async ({ page }) => {
    const suffix = String(Date.now());
    const serviceCode = 'e2e-pr-svc-' + suffix;
    const packageCode = 'pr-pkg-' + suffix;
    const groupName = 'E2E Pricing Group ' + suffix;
    const secondGroupName = 'E2E Pricing Group B ' + suffix;
    const agentLogin = 'e2e-pr-agent-' + suffix;
    const agentPassword = 'e2e-agent-password-' + suffix;

    await page.goto('/');
    await completeLocalSetupGateIfShown(page);
    await loginWithRealBackend(page, ADMIN_LOGIN_IDENTIFIER, ADMIN_PASSWORD);

    // Real prerequisites, created through the real APIs: a Service, a catalog Package, an Agent (the party to assign).
    const prepared = await page.evaluate(async ({ s, p, login, password, tag }) => {
      const svc = await BackendServiceApi.create({ code: s, name: 'E2E Pricing Service ' + tag, fulfillment_strategy: 'PROVIDER', requires_hold: false });
      const pkg = await BackendPackageApi.create({ service_code: s, code: p, name: 'E2E Pricing Package ' + tag });
      const agent = await BackendAgentApi.create({
        party_type: 'AGENT', account_number: 'PR-' + tag, display_name: 'E2E Pricing Agent ' + tag, phone: '7' + tag.slice(-8),
        zone_code: 'SOUTH', login_identifier: login, password,
      });
      return { svc: svc.ok, pkg: pkg.ok ? pkg.data : null, agent: agent.ok ? agent.data : null };
    }, { s: serviceCode, p: packageCode, login: agentLogin, password: agentPassword, tag: suffix });
    expect(prepared.svc).toBe(true);
    expect(prepared.pkg.id).toMatch(UUID_RE);
    expect(prepared.agent.id).toMatch(UUID_RE);
    const packageUuid = prepared.pkg.id;
    const agentId = prepared.agent.id;

    const localBefore = await page.evaluate(() => (typeof PRICING_RULE_DIRECTORY !== 'undefined' ? JSON.stringify(PRICING_RULE_DIRECTORY) : ''));

    // ── 1) Pricing groups: create / read / update / activate / deactivate ──
    await openPricingModule(page);
    await page.click('#btn-admin-pricing-group-add');
    await page.fill('#prg-name', groupName);
    await page.selectOption('#prg-zone', 'SOUTH');
    await page.fill('#prg-tier', '2');
    await page.fill('#prg-description', 'created from the SPA');
    await page.click('#btn-admin-pricing-group-form-save');
    await expect(groupRow(page, groupName)).toBeVisible({ timeout: 10_000 });
    const group = await backendGroupByName(page, groupName);
    expect(group).toMatchObject({ name: groupName, zone_id: 'SOUTH', tier_rank: 2, description: 'created from the SPA', is_active: true });
    await expect(groupRow(page, groupName).locator('.pricing-group-status')).toHaveAttribute('data-is-active', 'true');

    // Edit: zone and tier are read-only (the backend's PATCH accepts only name/description).
    const editedName = groupName + ' (edited)';
    await groupRow(page, groupName).locator('.admin-pricing-group-edit').click();
    await expect(page.locator('#prg-zone-readonly')).toHaveText('SOUTH');
    await expect(page.locator('#prg-tier-readonly')).toHaveText('2');
    await expect(page.locator('#prg-zone')).toHaveCount(0);
    await page.fill('#prg-name', editedName);
    await page.fill('#prg-description', '');
    await page.click('#btn-admin-pricing-group-form-save');
    await expect(groupRow(page, editedName)).toBeVisible({ timeout: 10_000 });
    expect(await backendGroupByName(page, editedName)).toMatchObject({ id: group.id, name: editedName, description: null, zone_id: 'SOUTH', tier_rank: 2 });

    // A second group, then deactivate / activate exactly as the backend allows.
    await page.click('#btn-admin-pricing-group-add');
    await page.fill('#prg-name', secondGroupName);
    await page.click('#btn-admin-pricing-group-form-save');
    await expect(groupRow(page, secondGroupName)).toBeVisible({ timeout: 10_000 });
    const second = await backendGroupByName(page, secondGroupName);
    const toggle = groupRow(page, secondGroupName).locator('.admin-pricing-group-toggle');
    await expect(toggle).toHaveAttribute('data-next-action', 'deactivate');
    await toggle.click();
    await expect(groupRow(page, secondGroupName).locator('.pricing-group-status')).toHaveAttribute('data-is-active', 'false', { timeout: 10_000 });
    expect(await backendGroupByName(page, secondGroupName)).toMatchObject({ is_active: false });
    await toggle.click();
    await expect(groupRow(page, secondGroupName).locator('.pricing-group-status')).toHaveAttribute('data-is-active', 'true', { timeout: 10_000 });

    // Group validation: client (empty name, non-integer tier) and backend (invalid zone is impossible from the UI, rejected by the API).
    await page.click('#btn-admin-pricing-group-add');
    await page.click('#btn-admin-pricing-group-form-save');
    await expect(page.locator('#pricing-group-form-error')).toBeVisible();
    await page.fill('#prg-name', 'bad tier');
    await page.fill('#prg-tier', 'abc');
    await page.click('#btn-admin-pricing-group-form-save');
    await expect(page.locator('#pricing-group-form-error')).toContainText('عدداً صحيحاً');
    await page.click('#btn-admin-pricing-group-form-cancel');
    const badZone = await page.evaluate(async () => {
      const r = await BackendPricingGroupApi.create({ name: 'bad zone', zone_id: 'MOON', tier_rank: 0 });
      return { status: r.status, code: r.error && r.error.code };
    });
    expect(badZone).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });

    // ── 2) Assignments: create / read, append-only history, one open assignment per party ──
    await openTab(page, 'assignments');
    await page.click('#btn-admin-pricing-assignment-add');
    await page.selectOption('#prasg-party', agentId);
    await page.selectOption('#prasg-group', group.id);
    await page.fill('#prasg-reason', 'first assignment');
    await page.click('#btn-admin-pricing-assignment-form-save');
    const assignmentRow = (partyId, groupId) => page.locator('.admin-pricing-assignment-row[data-party-id="' + partyId + '"][data-group-id="' + groupId + '"]');
    await expect(assignmentRow(agentId, group.id)).toBeVisible({ timeout: 10_000 });
    await expect(assignmentRow(agentId, group.id)).toHaveAttribute('data-open', 'true');
    // The same party to the same group again: the REAL backend refuses (conflict) and its message is shown.
    await page.click('#btn-admin-pricing-assignment-add');
    await page.selectOption('#prasg-party', agentId);
    await page.selectOption('#prasg-group', group.id);
    await page.click('#btn-admin-pricing-assignment-form-save');
    await expect(page.locator('#pricing-assignment-form-error')).toBeVisible({ timeout: 10_000 });
    expect((await page.locator('#pricing-assignment-form-error').innerText()).trim().length).toBeGreaterThan(0);
    // Invalid start date is caught client-side.
    await page.selectOption('#prasg-group', second.id);
    await page.fill('#prasg-valid-from', 'not-a-date');
    await page.click('#btn-admin-pricing-assignment-form-save');
    await expect(page.locator('#pricing-assignment-form-error')).toContainText('غير صالح');
    // Move the party to another group: a NEW assignment; the previous one is closed by the backend (history kept).
    await page.fill('#prasg-valid-from', '');
    await page.click('#btn-admin-pricing-assignment-form-save');
    await expect(assignmentRow(agentId, second.id)).toBeVisible({ timeout: 10_000 });
    await expect(assignmentRow(agentId, second.id)).toHaveAttribute('data-open', 'true');
    await expect(assignmentRow(agentId, group.id)).toHaveAttribute('data-open', 'false');
    const assignmentsFromBackend = await page.evaluate(async (id) => { const r = await BackendPricingAssignmentApi.list(id); return r.ok ? r.data : null; }, agentId);
    expect(assignmentsFromBackend.length).toBe(2);
    expect(assignmentsFromBackend.filter((a) => a.valid_to === null).length).toBe(1);
    // Filter by party (server-side).
    await page.selectOption('#prasg-party-filter', agentId);
    await expect(page.locator('.admin-pricing-assignment-row')).toHaveCount(2, { timeout: 10_000 });
    const assignRejected = await page.evaluate(async ({ g }) => {
      const noParty = await BackendPricingAssignmentApi.create({ party_id: '00000000-0000-0000-0000-00000000dead', pricing_group_id: g });
      return { status: noParty.status, code: noParty.error && noParty.error.code };
    }, { g: group.id });
    expect(assignRejected).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });

    // ── 3) Service pricing: a Package PICKED from the catalog; the request carries its canonical identity ──
    await openTab(page, 'servicePricing');
    await page.click('#btn-admin-service-pricing-add');
    await page.selectOption('#prsp-group', group.id);
    await page.selectOption('#prsp-service', serviceCode);
    await expect(page.locator('#prsp-package')).toHaveValue(packageUuid);
    await expect(page.locator('#prsp-package-uuid-readonly')).toHaveText(packageUuid);
    await page.selectOption('#prsp-currency', 'YER');
    await page.fill('#prsp-price', '125.5');
    const requestPromise = page.waitForRequest((req) => req.method() === 'POST' && req.url().endsWith('/api/v1/admin/service-pricing'));
    await page.click('#btn-admin-service-pricing-form-save');
    const sent = JSON.parse((await requestPromise).postData() || '{}');
    expect(sent).toMatchObject({ pricing_group_id: group.id, service_code: serviceCode, package_id: packageCode, package_uuid: packageUuid, currency_code: 'YER', retail_price: '125.5' });
    const spRow = (version) => page.locator('.admin-service-pricing-row[data-package-code="' + packageCode + '"][data-version="' + version + '"]');
    await expect(spRow(1)).toBeVisible({ timeout: 10_000 });
    await expect(spRow(1).locator('.sp-price')).toContainText('YER');
    await expect(spRow(1).locator('.sp-package-uuid')).toContainText(packageUuid);
    await expect(spRow(1)).toHaveAttribute('data-open', 'true');
    // A price change is a NEW version; the previous version is closed (history is not rewritten).
    await page.click('#btn-admin-service-pricing-add');
    await page.selectOption('#prsp-group', group.id);
    await page.selectOption('#prsp-service', serviceCode);
    await page.fill('#prsp-price', '150');
    await page.click('#btn-admin-service-pricing-form-save');
    await expect(spRow(2)).toBeVisible({ timeout: 10_000 });
    await expect(spRow(2)).toHaveAttribute('data-open', 'true');
    await expect(spRow(1)).toHaveAttribute('data-open', 'false');
    const pricingFromBackend = await page.evaluate(async (c) => { const r = await BackendServicePricingApi.list({ packageId: c }); return r.ok ? r.data : null; }, packageCode);
    expect(pricingFromBackend.map((p) => p.version).sort()).toEqual([1, 2]);
    expect(pricingFromBackend.find((p) => p.version === 2)).toMatchObject({ pricing_group_id: group.id, service_code: serviceCode, package_id: packageCode, currency_code: 'YER' });
    // Filter by group (server-side).
    await page.selectOption('#prsp-group-filter', second.id);
    await expect(page.locator('.admin-service-pricing-row[data-package-code="' + packageCode + '"]')).toHaveCount(0, { timeout: 10_000 });
    await page.selectOption('#prsp-group-filter', group.id);
    await expect(spRow(2)).toBeVisible({ timeout: 10_000 });

    // Validation: client (empty/zero/non-numeric price) and backend (identity mismatches, inactive group, bad money).
    await page.click('#btn-admin-service-pricing-add');
    await page.fill('#prsp-price', '0');
    await page.click('#btn-admin-service-pricing-form-save');
    await expect(page.locator('#service-pricing-form-error')).toContainText('موجباً');
    await page.fill('#prsp-price', 'abc');
    await page.click('#btn-admin-service-pricing-form-save');
    await expect(page.locator('#service-pricing-form-error')).toContainText('موجباً');
    await page.click('#btn-admin-service-pricing-form-cancel');
    const spRejected = await page.evaluate(async ({ g, s, c, id }) => {
      const base = { pricing_group_id: g, service_code: s, package_id: c, package_uuid: id, currency_code: 'YER', retail_price: '10' };
      const notInCatalog = await BackendServicePricingApi.create({ ...base, package_id: 'no-such-' + c, package_uuid: undefined });
      const uuidMismatch = await BackendServicePricingApi.create({ ...base, package_id: 'other-code' });
      const zeroPrice = await BackendServicePricingApi.create({ ...base, retail_price: '0' });
      const badCurrency = await BackendServicePricingApi.create({ ...base, currency_code: 'EUR' });
      return Object.fromEntries(Object.entries({ notInCatalog, uuidMismatch, zeroPrice, badCurrency }).map(([k, r]) => [k, { status: r.status, code: r.error && r.error.code }]));
    }, { g: group.id, s: serviceCode, c: packageCode, id: packageUuid });
    for (const key of ['notInCatalog', 'uuidMismatch', 'zeroPrice', 'badCurrency']) expect(spRejected[key]).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    // A group that is not active cannot receive prices or assignments (the backend refuses; nothing is written).
    await page.evaluate(async (id) => { await BackendPricingGroupApi.deactivate(id); }, second.id);
    const inactiveGroup = await page.evaluate(async ({ g, s, c, id }) => {
      const r = await BackendServicePricingApi.create({ pricing_group_id: g, service_code: s, package_id: c, package_uuid: id, currency_code: 'YER', retail_price: '10' });
      return { status: r.status, code: r.error && r.error.code, message: describeApiError(r) };
    }, { g: second.id, s: serviceCode, c: packageCode, id: packageUuid });
    expect(inactiveGroup).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });

    // ── 4) No write to the local mock pricing array; nothing stored locally ──
    expect(await page.evaluate(() => (typeof PRICING_RULE_DIRECTORY !== 'undefined' ? JSON.stringify(PRICING_RULE_DIRECTORY) : ''))).toBe(localBefore);
    expect(await page.evaluate((n) => Object.keys(localStorage).some((k) => (localStorage.getItem(k) || '').includes(n)), groupName)).toBe(false);

    // ── 5) Reload: a fresh load starts empty; re-entering refetches from the backend ──
    await page.reload();
    await expect.poll(() => page.evaluate(() => (typeof state !== 'undefined' && !!state.session.accessToken))).toBe(true);
    expect(await page.evaluate(() => PRICING_GROUP_BACKEND_DIRECTORY.length + SERVICE_PRICING_BACKEND_DIRECTORY.length)).toBe(0);
    await openPricingModule(page);
    await expect(groupRow(page, editedName)).toBeVisible({ timeout: 15_000 });
    await openTab(page, 'servicePricing');
    await expect(spRow(2)).toBeVisible({ timeout: 15_000 });

    // ── 6) 403: an identity without pricing permissions is told so; a rejected write is never shown as success ──
    await page.evaluate(async (id) => { await BackendAgentApi.activate(id); }, agentId);
    const agentToken = await page.evaluate(async ({ base, login, password }) => {
      const response = await fetch(base + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login_identifier: login, password }) });
      const body = await response.json();
      return body.data ? body.data.access_token : null;
    }, { base: API_BASE_URL, login: agentLogin, password: agentPassword });
    expect(agentToken).toBeTruthy();
    await page.evaluate((token) => { state.session.accessToken = token; }, agentToken);
    await page.evaluate(() => loadPricingBackendFromBackend());
    await expect(page.locator('#admin-pricing-backend-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#admin-pricing-backend-error')).toContainText('لا تملك صلاحية');
    const forbidden = await page.evaluate(async () => {
      const r = await BackendPricingGroupApi.create({ name: 'forbidden', zone_id: 'SOUTH', tier_rank: 0 });
      return { ok: r.ok, status: r.status };
    });
    expect(forbidden).toMatchObject({ ok: false, status: 403 });

    // ── 7) 401: an invalid token sends the user back to sign-in ──
    await page.evaluate(() => { state.session.accessToken = 'invalid-token'; });
    await page.evaluate(() => loadPricingBackendFromBackend());
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 10_000 });
    expect(await page.evaluate(() => state.session.accessToken)).toBeFalsy();
  });
});
