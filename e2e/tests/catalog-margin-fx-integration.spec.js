// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * SPA MARGIN POLICIES + FX RATES ADMIN (real backend) — real browser, real backend, real PostgreSQL.
 * Both are append-only histories on the backend (margin: new VERSION per change; FX: appended row), so the SPA
 * offers create + read only. Covers: create/read, versioning, server-side filters, validation and the backend's own
 * rejections, no hard-coded values, no local write, reload persistence, 403 and 401.
 *
 * The shared test tenant is seeded with a GLOBAL margin policy and YER<->SAR rates that other specs depend on, so
 * this spec leaves them untouched in effect: its GLOBAL policy repeats the seeded values, and its FX pair is
 * USD -> YEO, which no other flow uses.
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

async function openMarginFxModule(page) {
  await page.click('#btn-admin-drawer-open');
  await page.click('.admin-nav-item[data-module-id="marginFxBackend"]');
  await expect(page.locator('.margin-fx-backend-tab[data-tab-id="margin"]')).toBeVisible({ timeout: 10_000 });
}

async function openTab(page, tabId) {
  await page.click('.margin-fx-backend-tab[data-tab-id="' + tabId + '"]');
  await expect(page.locator('.margin-fx-backend-tab[data-tab-id="' + tabId + '"]')).toHaveAttribute('aria-pressed', 'true');
}

test.describe('SPA Margin + FX Admin — real backend', () => {
  test('margin policies (versions) and FX rates (append-only) -> validation -> no local write -> reload -> 403 -> 401', async ({ page }) => {
    const suffix = String(Date.now());
    // Unique per run: the shared test database keeps every FX row ever appended (history is append-only).
    const rateText = '3.' + suffix.slice(-8);
    const serviceCode = 'e2e-mg-svc-' + suffix;
    const agentLogin = 'e2e-mg-agent-' + suffix;
    const agentPassword = 'e2e-agent-password-' + suffix;

    await page.goto('/');
    await completeLocalSetupGateIfShown(page);
    await loginWithRealBackend(page, ADMIN_LOGIN_IDENTIFIER, ADMIN_PASSWORD);

    const prepared = await page.evaluate(async ({ s, tag, login, password }) => {
      const svc = await BackendServiceApi.create({ code: s, name: 'E2E Margin Service ' + tag, fulfillment_strategy: 'PROVIDER', requires_hold: false });
      const agent = await BackendAgentApi.create({
        party_type: 'AGENT', account_number: 'MG-' + tag, display_name: 'E2E Margin Agent ' + tag, phone: '7' + tag.slice(-8),
        zone_code: 'SOUTH', login_identifier: login, password,
      });
      const activated = agent.ok ? await BackendAgentApi.activate(agent.data.id) : { ok: false };
      return { svc: svc.ok, agent: agent.ok && activated.ok };
    }, { s: serviceCode, tag: suffix, login: agentLogin, password: agentPassword });
    expect(prepared).toEqual({ svc: true, agent: true });

    const localBefore = await page.evaluate(() => JSON.stringify([
      typeof PRICING_RULE_DIRECTORY !== 'undefined' ? PRICING_RULE_DIRECTORY : null,
      typeof CURRENCY_DIRECTORY !== 'undefined' ? CURRENCY_DIRECTORY : null,
    ]));

    await openMarginFxModule(page);

    // ── 1) Margin policies: the seeded GLOBAL policy is read from the backend; a SERVICE policy is created ──
    await expect(page.locator('.admin-margin-policy-row[data-scope="GLOBAL"]').first()).toBeVisible({ timeout: 10_000 });
    const seededGlobal = await page.evaluate(async () => { const r = await BackendMarginPolicyApi.list({ scope: 'GLOBAL' }); return r.ok ? r.data.find((p) => p.valid_to === null) : null; });
    expect(seededGlobal).toBeTruthy();
    await expect(page.locator('.admin-margin-policy-row[data-scope="GLOBAL"][data-open="true"] .margin-fixed').first()).toHaveAttribute('data-currency', 'SAR');

    await page.click('#btn-admin-margin-policy-add');
    await page.selectOption('#mrg-scope', 'SERVICE');
    await page.selectOption('#mrg-service', serviceCode);
    await expect(page.locator('#mrg-fixed-currency-readonly')).toHaveText('SAR');
    await page.fill('#mrg-fixed', '0.5000');
    await page.fill('#mrg-percentage', '0.0300');
    await page.click('#btn-admin-margin-policy-form-save');
    const serviceMarginRow = (version) => page.locator('.admin-margin-policy-row[data-scope="SERVICE"][data-service-code="' + serviceCode + '"][data-version="' + version + '"]');
    await page.selectOption('#mrg-service-filter', serviceCode);
    await expect(serviceMarginRow(1)).toBeVisible({ timeout: 10_000 });
    await expect(serviceMarginRow(1).locator('.margin-fixed')).toContainText('0.5000');
    await expect(serviceMarginRow(1).locator('.margin-percentage')).toHaveText('0.0300');
    await expect(serviceMarginRow(1)).toHaveAttribute('data-open', 'true');

    // A change is a NEW version; the previous one is closed (history is not rewritten).
    await page.click('#btn-admin-margin-policy-add');
    await page.selectOption('#mrg-scope', 'SERVICE');
    await page.selectOption('#mrg-service', serviceCode);
    await page.fill('#mrg-fixed', '0.7500');
    await page.fill('#mrg-percentage', '0.0400');
    await page.click('#btn-admin-margin-policy-form-save');
    await expect(serviceMarginRow(2)).toBeVisible({ timeout: 10_000 });
    await expect(serviceMarginRow(2)).toHaveAttribute('data-open', 'true');
    await expect(serviceMarginRow(1)).toHaveAttribute('data-open', 'false');
    const marginsFromBackend = await page.evaluate(async (s) => { const r = await BackendMarginPolicyApi.list({ scope: 'SERVICE', serviceCode: s }); return r.ok ? r.data : null; }, serviceCode);
    expect(marginsFromBackend.map((p) => p.version).sort()).toEqual([1, 2]);
    expect(marginsFromBackend.find((p) => p.version === 2)).toMatchObject({ scope: 'SERVICE', service_code: serviceCode, fixed_minimum_amount: '0.7500', fixed_minimum_currency: 'SAR', percentage_minimum: '0.0400', valid_to: null });

    // A GLOBAL policy repeating the seeded values (no change in effect for the other specs): a new version appears.
    await page.selectOption('#mrg-service-filter', '');
    await page.selectOption('#mrg-scope-filter', 'GLOBAL');
    await expect(page.locator('.admin-margin-policy-row[data-scope="SERVICE"]')).toHaveCount(0, { timeout: 10_000 });
    await page.click('#btn-admin-margin-policy-add');
    await page.fill('#mrg-fixed', seededGlobal.fixed_minimum_amount);
    await page.fill('#mrg-percentage', seededGlobal.percentage_minimum);
    await page.click('#btn-admin-margin-policy-form-save');
    await expect(page.locator('.admin-margin-policy-row[data-scope="GLOBAL"][data-version="' + (seededGlobal.version + 1) + '"]')).toBeVisible({ timeout: 10_000 });

    // Validation: client (missing, non-numeric) and backend rejections (shown as the backend's own text).
    await page.click('#btn-admin-margin-policy-add');
    await page.click('#btn-admin-margin-policy-form-save');
    await expect(page.locator('#margin-policy-form-error')).toBeVisible();
    await page.fill('#mrg-fixed', 'abc');
    await page.fill('#mrg-percentage', '0.01');
    await page.click('#btn-admin-margin-policy-form-save');
    await expect(page.locator('#margin-policy-form-error')).toContainText('غير سالبة');
    // Backend: a start date that is not later than the current version is refused and its message is shown.
    await page.selectOption('#mrg-scope', 'SERVICE');
    await page.selectOption('#mrg-service', serviceCode);
    await page.fill('#mrg-fixed', '0.1000');
    await page.fill('#mrg-percentage', '0.0100');
    await page.fill('#mrg-valid-from', '2000-01-01T00:00:00Z');
    await page.click('#btn-admin-margin-policy-form-save');
    await expect(page.locator('#margin-policy-form-error')).toBeVisible({ timeout: 10_000 });
    expect((await page.locator('#margin-policy-form-error').innerText()).trim().length).toBeGreaterThan(0);
    await expect(page.locator('#btn-admin-margin-policy-form-save')).toBeEnabled();
    await page.click('#btn-admin-margin-policy-form-cancel');
    const marginRejected = await page.evaluate(async (s) => {
      const negative = await BackendMarginPolicyApi.create({ scope: 'SERVICE', service_code: s, fixed_minimum_amount: '-1', percentage_minimum: '0.01' });
      const serviceMissing = await BackendMarginPolicyApi.create({ scope: 'SERVICE', fixed_minimum_amount: '1', percentage_minimum: '0.01' });
      const globalWithService = await BackendMarginPolicyApi.create({ scope: 'GLOBAL', service_code: s, fixed_minimum_amount: '1', percentage_minimum: '0.01' });
      const unknownService = await BackendMarginPolicyApi.create({ scope: 'SERVICE', service_code: 'no-such-' + s, fixed_minimum_amount: '1', percentage_minimum: '0.01' });
      const badScope = await BackendMarginPolicyApi.create({ scope: 'REGION', fixed_minimum_amount: '1', percentage_minimum: '0.01' });
      return Object.fromEntries(Object.entries({ negative, serviceMissing, globalWithService, unknownService, badScope }).map(([k, r]) => [k, { status: r.status, code: r.error && r.error.code }]));
    }, serviceCode);
    for (const key of Object.keys(marginRejected)) expect(marginRejected[key].status).toBe(400);
    expect(marginRejected.serviceMissing.code).toBe('VALIDATION_ERROR');
    expect(marginRejected.globalWithService.code).toBe('VALIDATION_ERROR');
    expect(marginRejected.unknownService.code).toBe('VALIDATION_ERROR');

    // ── 2) FX rates: append-only; the pair USD -> YEO is used so no other flow is affected ──
    await openTab(page, 'fx');
    await expect(page.locator('.admin-fx-rate-row[data-from="YER"][data-to="SAR"]').first()).toBeVisible({ timeout: 10_000 });
    const fxCountBefore = await page.evaluate(async () => { const r = await BackendFxRateApi.list({ from: 'USD', to: 'YEO' }); return r.ok ? r.data.length : -1; });
    await page.click('#btn-admin-fx-rate-add');
    await page.selectOption('#fx-from', 'USD');
    await page.selectOption('#fx-to', 'YEO');
    await page.fill('#fx-rate', rateText);
    await page.fill('#fx-source', 'e2e-' + suffix);
    await page.click('#btn-admin-fx-rate-form-save');
    await page.selectOption('#fx-from-filter', 'USD');
    await page.selectOption('#fx-to-filter', 'YEO');
    await expect(page.locator('.admin-fx-rate-row[data-from="USD"][data-to="YEO"]')).toHaveCount(fxCountBefore + 1, { timeout: 10_000 });
    await expect(page.locator('.admin-fx-rate-row[data-from="USD"][data-to="YEO"][data-rate="' + rateText + '"]')).toHaveCount(1);
    const fxFromBackend = await page.evaluate(async () => { const r = await BackendFxRateApi.list({ from: 'USD', to: 'YEO' }); return r.ok ? r.data : null; });
    expect(fxFromBackend.find((x) => x.rate === rateText)).toMatchObject({ from_currency: 'USD', to_currency: 'YEO', source: 'e2e-' + suffix });
    // The filter is server-side: the seeded pair is not in this view.
    await expect(page.locator('.admin-fx-rate-row[data-from="YER"]')).toHaveCount(0);

    // FX validation: client (same currency, non-positive, > 8 decimals) and backend rejections.
    await page.click('#btn-admin-fx-rate-add');
    await page.selectOption('#fx-from', 'USD');
    await page.selectOption('#fx-to', 'USD');
    await page.fill('#fx-rate', '1');
    await page.click('#btn-admin-fx-rate-form-save');
    await expect(page.locator('#fx-rate-form-error')).toContainText('تختلف');
    await page.selectOption('#fx-to', 'YEO');
    await page.fill('#fx-rate', '0');
    await page.click('#btn-admin-fx-rate-form-save');
    await expect(page.locator('#fx-rate-form-error')).toContainText('موجباً');
    await page.fill('#fx-rate', '1.123456789');
    await page.click('#btn-admin-fx-rate-form-save');
    await expect(page.locator('#fx-rate-form-error')).toContainText('8');
    await page.click('#btn-admin-fx-rate-form-cancel');
    const fxRejected = await page.evaluate(async () => {
      const same = await BackendFxRateApi.create({ from_currency: 'USD', to_currency: 'USD', rate: '1' });
      const zero = await BackendFxRateApi.create({ from_currency: 'USD', to_currency: 'YEO', rate: '0' });
      const tooPrecise = await BackendFxRateApi.create({ from_currency: 'USD', to_currency: 'YEO', rate: '1.123456789' });
      const badCurrency = await BackendFxRateApi.create({ from_currency: 'EUR', to_currency: 'YEO', rate: '1' });
      return Object.fromEntries(Object.entries({ same, zero, tooPrecise, badCurrency }).map(([k, r]) => [k, { status: r.status, code: r.error && r.error.code }]));
    });
    for (const key of Object.keys(fxRejected)) expect(fxRejected[key]).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    expect(await page.evaluate(async () => { const r = await BackendFxRateApi.list({ from: 'USD', to: 'YEO' }); return r.data.length; })).toBe(fxCountBefore + 1);

    // ── 3) No write reached the local mock arrays; nothing about these records is stored locally ──
    expect(await page.evaluate(() => JSON.stringify([
      typeof PRICING_RULE_DIRECTORY !== 'undefined' ? PRICING_RULE_DIRECTORY : null,
      typeof CURRENCY_DIRECTORY !== 'undefined' ? CURRENCY_DIRECTORY : null,
    ]))).toBe(localBefore);
    expect(await page.evaluate((c) => Object.keys(localStorage).some((k) => (localStorage.getItem(k) || '').includes(c)), serviceCode)).toBe(false);

    // ── 4) Reload: a fresh load starts empty; re-entering refetches from the backend ──
    await page.reload();
    await expect.poll(() => page.evaluate(() => (typeof state !== 'undefined' && !!state.session.accessToken))).toBe(true);
    expect(await page.evaluate(() => MARGIN_POLICY_BACKEND_DIRECTORY.length + FX_RATE_BACKEND_DIRECTORY.length)).toBe(0);
    await openMarginFxModule(page);
    await page.selectOption('#mrg-service-filter', serviceCode);
    await expect(serviceMarginRow(2)).toBeVisible({ timeout: 15_000 });
    await openTab(page, 'fx');
    await expect(page.locator('.admin-fx-rate-row[data-rate="' + rateText + '"]')).toHaveCount(1, { timeout: 15_000 });

    // ── 5) 403 and 401 ──
    const agentToken = await page.evaluate(async ({ base, login, password }) => {
      const response = await fetch(base + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login_identifier: login, password }) });
      const body = await response.json();
      return body.data ? body.data.access_token : null;
    }, { base: API_BASE_URL, login: agentLogin, password: agentPassword });
    expect(agentToken).toBeTruthy();
    await page.evaluate((token) => { state.session.accessToken = token; }, agentToken);
    await page.evaluate(() => loadMarginFxBackendFromBackend());
    await expect(page.locator('#admin-margin-fx-backend-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#admin-margin-fx-backend-error')).toContainText('لا تملك صلاحية');
    const forbidden = await page.evaluate(async () => {
      const m = await BackendMarginPolicyApi.create({ scope: 'GLOBAL', fixed_minimum_amount: '1', percentage_minimum: '0.01' });
      const f = await BackendFxRateApi.create({ from_currency: 'USD', to_currency: 'YEO', rate: '1' });
      return { margin: m.status, fx: f.status };
    });
    expect(forbidden).toEqual({ margin: 403, fx: 403 });
    await page.evaluate(() => { state.session.accessToken = 'invalid-token'; state.session.refreshToken = null; });
    await page.evaluate(() => loadMarginFxBackendFromBackend());
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 10_000 });
    expect(await page.evaluate(() => state.session.accessToken)).toBeFalsy();
  });
});
