// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * SPA SERVICES ADMIN (real backend) — real browser, real backend, real
 * PostgreSQL. Same webServer array as every other spec in this project
 * (playwright.config.js): the REAL, unmodified backend, migrated and
 * bootstrapped like an operator would, never a faked API response.
 *
 * Covers: Admin login -> Services Admin -> create MANUAL (requires_hold
 * fixed true) -> create PROVIDER -> edit -> lifecycle (activate / deactivate
 * / re-activate) -> reload persistence from the backend (nothing stored
 * locally) -> MANUAL + requires_hold=false is impossible from the UI and is
 * rejected by the real backend (create and update) with its error shown ->
 * 403 for an identity without the service:* permissions.
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

/** The service as the REAL backend reports it (through the SPA's own ApiClient), never read from the DOM. */
async function backendServiceByCode(page, code) {
  return page.evaluate(async (c) => {
    const result = await BackendServiceApi.list();
    if (!result.ok) return { error: result.error };
    return result.data.find((x) => x.code === c) || null;
  }, code);
}

function rowFor(page, code) {
  return page.locator('.admin-service-backend-row[data-service-code="' + code + '"]');
}

test.describe('SPA Services Admin — real backend', () => {
  test('login -> create MANUAL / PROVIDER -> edit -> lifecycle -> reload from backend -> MANUAL+requires_hold=false rejected -> 403', async ({ page }) => {
    const suffix = String(Date.now());
    const manualCode = 'e2e-manual-' + suffix;
    const providerCode = 'e2e-provider-' + suffix;
    const manualName = 'E2E Manual Service ' + suffix;
    const providerName = 'E2E Provider Service ' + suffix;

    await page.goto('/');
    await completeLocalSetupGateIfShown(page);
    await loginWithRealBackend(page, ADMIN_LOGIN_IDENTIFIER, ADMIN_PASSWORD);

    // 2) Open Services Admin (the NEW real-backend module; the local mock "الخدمات" module is a different nav item).
    await page.click('#btn-admin-drawer-open');
    await page.click('.admin-nav-item[data-module-id="servicesBackend"]');
    await expect(page.locator('#btn-admin-service-backend-add')).toBeVisible({ timeout: 10_000 });

    // 3) Create a MANUAL service. requires_hold is shown fixed (no selectable "no").
    await page.click('#btn-admin-service-backend-add');
    await page.fill('#sbf-code', manualCode);
    await page.fill('#sbf-name', manualName);
    await expect(page.locator('#sbf-strategy')).toHaveValue('MANUAL');
    await expect(page.locator('#sbf-requires-hold-fixed')).toHaveAttribute('data-requires-hold', 'true');
    await expect(page.locator('#sbf-requires-hold')).toHaveCount(0);
    await page.click('#btn-admin-service-backend-form-save');

    // 4) It appears from the backend (the list is refetched after the mutation).
    await expect(rowFor(page, manualCode)).toBeVisible({ timeout: 10_000 });
    await expect(rowFor(page, manualCode).locator('.service-backend-strategy')).toHaveText('MANUAL');
    await expect(rowFor(page, manualCode).locator('.service-backend-status')).toHaveAttribute('data-status', 'DRAFT');

    // 5) The backend itself says requires_hold is true for MANUAL.
    const manualFromBackend = await backendServiceByCode(page, manualCode);
    expect(manualFromBackend).toMatchObject({ code: manualCode, name: manualName, fulfillment_strategy: 'MANUAL', requires_hold: true, status: 'DRAFT' });
    await expect(rowFor(page, manualCode).locator('.service-backend-hold')).toHaveAttribute('data-requires-hold', 'true');

    // 6) Create a PROVIDER service (requires_hold is selectable; choose "no").
    await page.click('#btn-admin-service-backend-add');
    await page.fill('#sbf-code', providerCode);
    await page.fill('#sbf-name', providerName);
    await page.selectOption('#sbf-strategy', 'PROVIDER');
    await expect(page.locator('#sbf-requires-hold')).toBeVisible();
    await expect(page.locator('#sbf-requires-hold-fixed')).toHaveCount(0);
    await page.selectOption('#sbf-requires-hold', 'false');
    await page.click('#btn-admin-service-backend-form-save');
    await expect(rowFor(page, providerCode)).toBeVisible({ timeout: 10_000 });
    expect(await backendServiceByCode(page, providerCode)).toMatchObject({ fulfillment_strategy: 'PROVIDER', requires_hold: false, status: 'DRAFT' });

    // 7) Edit the PROVIDER service: the code is read-only, the name changes.
    const editedName = providerName + ' (edited)';
    await rowFor(page, providerCode).locator('.admin-service-backend-edit').click();
    await expect(page.locator('#sbf-code-readonly')).toHaveText(providerCode);
    await expect(page.locator('#sbf-code')).toHaveCount(0);
    await page.fill('#sbf-name', editedName);
    await page.click('#btn-admin-service-backend-form-save');
    await expect(rowFor(page, providerCode)).toContainText(editedName, { timeout: 10_000 });
    expect(await backendServiceByCode(page, providerCode)).toMatchObject({ name: editedName });

    // 8) Lifecycle exactly as the backend allows: DRAFT -> ACTIVE -> INACTIVE -> ACTIVE.
    const toggle = rowFor(page, manualCode).locator('.admin-service-backend-toggle');
    await expect(toggle).toHaveAttribute('data-next-action', 'activate');
    await toggle.click();
    await expect(rowFor(page, manualCode).locator('.service-backend-status')).toHaveAttribute('data-status', 'ACTIVE', { timeout: 10_000 });
    await expect(toggle).toHaveAttribute('data-next-action', 'deactivate');
    await toggle.click();
    await expect(rowFor(page, manualCode).locator('.service-backend-status')).toHaveAttribute('data-status', 'INACTIVE', { timeout: 10_000 });
    await expect(toggle).toHaveAttribute('data-next-action', 'activate');
    await toggle.click();
    await expect(rowFor(page, manualCode).locator('.service-backend-status')).toHaveAttribute('data-status', 'ACTIVE', { timeout: 10_000 });
    expect(await backendServiceByCode(page, manualCode)).toMatchObject({ status: 'ACTIVE' });

    // 9) Reload: the data comes back from the backend; nothing about it is stored locally.
    expect(await page.evaluate((c) => Object.keys(localStorage).some((k) => (localStorage.getItem(k) || '').includes(c)), manualCode)).toBe(false);
    await page.reload();
    // A fresh page load starts with an empty in-memory mirror (nothing was cached locally); re-entering the
    // module (the active module is not persisted by this app) refetches everything from the backend.
    await expect.poll(() => page.evaluate(() => (typeof state !== 'undefined' && !!state.session.accessToken))).toBe(true);
    expect(await page.evaluate(() => SERVICE_BACKEND_DIRECTORY.length)).toBe(0);
    await page.click('#btn-admin-drawer-open');
    await page.click('.admin-nav-item[data-module-id="servicesBackend"]');
    await expect(rowFor(page, manualCode)).toBeVisible({ timeout: 15_000 });
    await expect(rowFor(page, providerCode)).toContainText(editedName);
    await expect(rowFor(page, manualCode).locator('.service-backend-status')).toHaveAttribute('data-status', 'ACTIVE');
    await expect(rowFor(page, manualCode).locator('.service-backend-hold')).toHaveAttribute('data-requires-hold', 'true');

    // 10) The backend's own error is shown when it rejects a form submission (duplicate code).
    await page.click('#btn-admin-service-backend-add');
    await page.fill('#sbf-code', manualCode);
    await page.fill('#sbf-name', 'duplicate attempt');
    await page.click('#btn-admin-service-backend-form-save');
    await expect(page.locator('#service-backend-form-error')).toBeVisible({ timeout: 10_000 });
    const duplicateMessage = (await page.locator('#service-backend-form-error').innerText()).trim();
    expect(duplicateMessage.length).toBeGreaterThan(0);
    await page.click('#btn-admin-service-backend-form-cancel');

    // 11) MANUAL + requires_hold=false: the UI cannot express it, and the REAL backend rejects it (create and update).
    await page.click('#btn-admin-service-backend-add');
    await expect(page.locator('#sbf-strategy')).toHaveValue('MANUAL');
    await expect(page.locator('#sbf-requires-hold')).toHaveCount(0);
    await page.click('#btn-admin-service-backend-form-cancel');

    const rejectedCode = 'e2e-rejected-' + suffix;
    const createRejected = await page.evaluate(async (c) => {
      const result = await BackendServiceApi.create({ code: c, name: 'must be rejected', fulfillment_strategy: 'MANUAL', requires_hold: false });
      return { ok: result.ok, status: result.status, errorCode: result.error && result.error.code, message: describeApiError(result) };
    }, rejectedCode);
    expect(createRejected.ok).toBe(false);
    expect(createRejected.status).toBe(400);
    expect(createRejected.errorCode).toBe('VALIDATION_ERROR');
    expect(createRejected.message.length).toBeGreaterThan(0);
    expect(await backendServiceByCode(page, rejectedCode)).toBeNull();

    const manualId = manualFromBackend.id;
    const updateRejected = await page.evaluate(async (id) => {
      const result = await BackendServiceApi.update(id, { fulfillment_strategy: 'MANUAL', requires_hold: false });
      return { ok: result.ok, status: result.status, errorCode: result.error && result.error.code, message: describeApiError(result) };
    }, manualId);
    expect(updateRejected.ok).toBe(false);
    expect(updateRejected.status).toBe(400);
    expect(updateRejected.errorCode).toBe('VALIDATION_ERROR');
    expect(await backendServiceByCode(page, manualCode)).toMatchObject({ fulfillment_strategy: 'MANUAL', requires_hold: true });

    // 12) 403: an identity without service:* permissions is told so (the backend decides, the SPA shows it).
    const agentLogin = 'e2e-svc-agent-' + suffix;
    const agentPassword = 'e2e-agent-password-' + suffix;
    const created = await page.evaluate(async ({ login, password, tag }) => {
      const result = await BackendAgentApi.create({
        party_type: 'AGENT', account_number: 'SVC-' + tag, display_name: 'E2E Svc Agent ' + tag, phone: '7' + tag.slice(-8),
        zone_code: 'SOUTH', login_identifier: login, password,
      });
      return { ok: result.ok, status: result.status };
    }, { login: agentLogin, password: agentPassword, tag: suffix });
    expect(created.ok).toBe(true);
    const activation = await page.evaluate(async (login) => {
      const agents = await BackendAgentApi.list();
      const agent = agents.data.find((a) => a.display_name && a.display_name.indexOf('E2E Svc Agent') === 0 && a.account_number === 'SVC-' + login.replace('e2e-svc-agent-', ''));
      if (!agent) return { ok: false };
      const result = await BackendAgentApi.activate(agent.id);
      return { ok: result.ok };
    }, agentLogin);
    expect(activation.ok).toBe(true);
    const agentToken = await page.evaluate(async ({ base, login, password }) => {
      const response = await fetch(base + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login_identifier: login, password }) });
      const body = await response.json();
      return body.data ? body.data.access_token : null;
    }, { base: API_BASE_URL, login: agentLogin, password: agentPassword });
    expect(agentToken).toBeTruthy();
    await page.evaluate((token) => { state.session.accessToken = token; }, agentToken);
    await page.evaluate(() => loadServicesBackendFromBackend());
    await expect(page.locator('#admin-services-backend-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#admin-services-backend-error')).toContainText('لا تملك صلاحية');
    // Nothing from the previous (admin) session's data is presented as current while the error shows.
    await expect(page.locator('.admin-service-backend-row')).toHaveCount(0);
  });
});
