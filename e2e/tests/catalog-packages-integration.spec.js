// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * SPA PACKAGES ADMIN (real backend) — real browser, real backend, real PostgreSQL (same webServer array as every
 * other spec). Covers: list from the backend, create / edit / activate / deactivate / re-activate, canonical
 * identity (the backend-issued UUID is what the SPA shows and keeps; the SPA never invents one), service
 * association, display order, reload persistence (nothing stored locally), no write to the local mock catalog
 * arrays, validation + conflict responses, 403 for an identity without package:* permissions, and 401.
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

async function openPackagesModule(page) {
  await page.click('#btn-admin-drawer-open');
  await page.click('.admin-nav-item[data-module-id="packagesBackend"]');
  await expect(page.locator('#btn-admin-package-backend-add')).toBeVisible({ timeout: 10_000 });
}

/** The package as the REAL backend reports it (through the SPA's own ApiClient), never read from the DOM. */
async function backendPackageByCode(page, serviceCode, code) {
  return page.evaluate(async ({ s, c }) => {
    const result = await BackendPackageApi.list(s);
    if (!result.ok) return { error: result.error };
    return result.data.find((x) => x.code === c) || null;
  }, { s: serviceCode, c: code });
}

function rowFor(page, code) {
  return page.locator('.admin-package-backend-row[data-package-code="' + code + '"]');
}

test.describe('SPA Packages Admin — real backend', () => {
  test('list -> create -> edit -> lifecycle -> identity -> reload -> validation/conflict -> no local write -> 403 -> 401', async ({ page }) => {
    const suffix = String(Date.now());
    const serviceCode = 'e2e-pkg-svc-' + suffix;
    const otherServiceCode = 'e2e-pkg-svc2-' + suffix;
    const code = 'pkg-' + suffix;
    const name = 'E2E Package ' + suffix;

    await page.goto('/');
    await completeLocalSetupGateIfShown(page);
    await loginWithRealBackend(page, ADMIN_LOGIN_IDENTIFIER, ADMIN_PASSWORD);

    // Two real services to associate packages with (created through the real Services API).
    for (const c of [serviceCode, otherServiceCode]) {
      const created = await page.evaluate(async (svc) => {
        const r = await BackendServiceApi.create({ code: svc, name: 'E2E Service ' + svc, fulfillment_strategy: 'PROVIDER', requires_hold: false });
        return { ok: r.ok, status: r.status };
      }, c);
      expect(created.ok).toBe(true);
    }

    const localBefore = await page.evaluate(() => ({
      telecom: typeof TELECOM_PACKAGE_DIRECTORY !== 'undefined' ? JSON.stringify(TELECOM_PACKAGE_DIRECTORY).length : -1,
      catalog: typeof CATALOG_PACKAGES !== 'undefined' ? JSON.stringify(CATALOG_PACKAGES).length : -1,
    }));

    // 1) The module lists from the backend. Fresh services have no packages yet.
    await openPackagesModule(page);
    await page.selectOption('#pkgb-service-filter', serviceCode);
    await expect(page.locator('#admin-packages-backend-empty')).toBeVisible({ timeout: 10_000 });

    // 2) Create: service chosen from the real Services list, code, name, display order.
    await page.click('#btn-admin-package-backend-add');
    await expect(page.locator('#pkgb-service')).toHaveValue(serviceCode);
    await page.fill('#pkgb-code', code);
    await page.fill('#pkgb-name', name);
    await page.fill('#pkgb-display-order', '7');
    await page.click('#btn-admin-package-backend-form-save');
    await expect(rowFor(page, code)).toBeVisible({ timeout: 10_000 });
    await expect(rowFor(page, code)).toHaveAttribute('data-service-code', serviceCode);
    await expect(rowFor(page, code).locator('.package-backend-status')).toHaveAttribute('data-status', 'DRAFT');
    await expect(rowFor(page, code).locator('.package-backend-order')).toHaveAttribute('data-display-order', '7');

    // 3) Canonical identity: the UUID shown is the backend's own, and is what a Package pick would use.
    const fromBackend = await backendPackageByCode(page, serviceCode, code);
    expect(fromBackend).toMatchObject({ service_code: serviceCode, code, name, status: 'DRAFT', display_order: 7 });
    expect(fromBackend.id).toMatch(UUID_RE);
    await expect(rowFor(page, code)).toHaveAttribute('data-package-id', fromBackend.id);
    await expect(rowFor(page, code).locator('.package-backend-uuid')).toContainText(fromBackend.id);
    expect(await page.evaluate((id) => findPackageBackendById(id).serviceCode, fromBackend.id)).toBe(serviceCode);

    // 4) Edit: service/code/UUID are read-only identity; name and display order change.
    const editedName = name + ' (edited)';
    await rowFor(page, code).locator('.admin-package-backend-edit').click();
    await expect(page.locator('#pkgb-code-readonly')).toHaveText(code);
    await expect(page.locator('#pkgb-service-readonly')).toHaveText(serviceCode);
    await expect(page.locator('#pkgb-uuid-readonly')).toHaveText(fromBackend.id);
    await expect(page.locator('#pkgb-code')).toHaveCount(0);
    await expect(page.locator('#pkgb-service')).toHaveCount(0);
    await page.fill('#pkgb-name', editedName);
    await page.fill('#pkgb-display-order', '3');
    await page.click('#btn-admin-package-backend-form-save');
    await expect(rowFor(page, code)).toContainText(editedName, { timeout: 10_000 });
    expect(await backendPackageByCode(page, serviceCode, code)).toMatchObject({ id: fromBackend.id, name: editedName, display_order: 3 });

    // 5) Lifecycle exactly as the backend allows: DRAFT -> ACTIVE -> INACTIVE -> ACTIVE.
    const toggle = rowFor(page, code).locator('.admin-package-backend-toggle');
    await expect(toggle).toHaveAttribute('data-next-action', 'activate');
    await toggle.click();
    await expect(rowFor(page, code).locator('.package-backend-status')).toHaveAttribute('data-status', 'ACTIVE', { timeout: 10_000 });
    await expect(toggle).toHaveAttribute('data-next-action', 'deactivate');
    await toggle.click();
    await expect(rowFor(page, code).locator('.package-backend-status')).toHaveAttribute('data-status', 'INACTIVE', { timeout: 10_000 });
    await toggle.click();
    await expect(rowFor(page, code).locator('.package-backend-status')).toHaveAttribute('data-status', 'ACTIVE', { timeout: 10_000 });
    expect(await backendPackageByCode(page, serviceCode, code)).toMatchObject({ status: 'ACTIVE' });

    // 6) Service association: the same code under another service is a different, independent package.
    await page.click('#btn-admin-package-backend-add');
    await page.selectOption('#pkgb-service', otherServiceCode);
    await page.fill('#pkgb-code', code);
    await page.fill('#pkgb-name', 'Same code, other service');
    await page.click('#btn-admin-package-backend-form-save');
    await expect.poll(async () => (await backendPackageByCode(page, otherServiceCode, code)) !== null, { timeout: 10_000 }).toBe(true);
    const other = await backendPackageByCode(page, otherServiceCode, code);
    expect(other.id).toMatch(UUID_RE);
    expect(other.id).not.toBe(fromBackend.id);
    // The list is filtered by the selected service (server-side filter).
    await page.selectOption('#pkgb-service-filter', serviceCode);
    await expect(rowFor(page, code)).toHaveAttribute('data-service-code', serviceCode, { timeout: 10_000 });
    await expect(page.locator('.admin-package-backend-row')).toHaveCount(1);

    // 7) Validation (client) and conflict/validation (backend) feedback; nothing is created by a failed submit.
    await page.click('#btn-admin-package-backend-add');
    await page.fill('#pkgb-code', 'pkg-invalid-' + suffix);
    await page.fill('#pkgb-name', '');
    await page.click('#btn-admin-package-backend-form-save');
    await expect(page.locator('#package-backend-form-error')).toBeVisible();
    await page.fill('#pkgb-name', 'invalid order');
    await page.fill('#pkgb-display-order', '-1');
    await page.click('#btn-admin-package-backend-form-save');
    await expect(page.locator('#package-backend-form-error')).toContainText('غير سالب');
    expect(await backendPackageByCode(page, serviceCode, 'pkg-invalid-' + suffix)).toBeNull();
    // Duplicate code under the same service: the REAL backend rejects it and its message is shown.
    await page.fill('#pkgb-code', code);
    await page.fill('#pkgb-display-order', '');
    await page.click('#btn-admin-package-backend-form-save');
    await expect(page.locator('#package-backend-form-error')).toBeVisible({ timeout: 10_000 });
    expect((await page.locator('#package-backend-form-error').innerText()).trim().length).toBeGreaterThan(0);
    await page.click('#btn-admin-package-backend-form-cancel');
    const rejected = await page.evaluate(async ({ s, c }) => {
      const dup = await BackendPackageApi.create({ service_code: s, code: c, name: 'dup' });
      const badOrder = await BackendPackageApi.create({ service_code: s, code: 'x-' + c, name: 'x', display_order: -1 });
      const badService = await BackendPackageApi.create({ service_code: 'no-such-service-' + c, code: 'y', name: 'y' });
      return {
        dup: { status: dup.status, code: dup.error && dup.error.code },
        badOrder: { status: badOrder.status, code: badOrder.error && badOrder.error.code },
        badService: { status: badService.status, code: badService.error && badService.error.code },
      };
    }, { s: serviceCode, c: code });
    expect([400, 409]).toContain(rejected.dup.status);
    expect(rejected.badOrder).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    expect(rejected.badService).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });

    // 8) No write reached the local mock catalog arrays, and nothing about the package is stored locally.
    const localAfter = await page.evaluate(() => ({
      telecom: typeof TELECOM_PACKAGE_DIRECTORY !== 'undefined' ? JSON.stringify(TELECOM_PACKAGE_DIRECTORY).length : -1,
      catalog: typeof CATALOG_PACKAGES !== 'undefined' ? JSON.stringify(CATALOG_PACKAGES).length : -1,
    }));
    expect(localAfter).toEqual(localBefore);
    expect(await page.evaluate((c) => Object.keys(localStorage).some((k) => (localStorage.getItem(k) || '').includes(c)), code)).toBe(false);

    // 9) Reload: a fresh load starts empty; re-entering the module refetches everything from the backend.
    await page.reload();
    await expect.poll(() => page.evaluate(() => (typeof state !== 'undefined' && !!state.session.accessToken))).toBe(true);
    expect(await page.evaluate(() => PACKAGE_BACKEND_DIRECTORY.length)).toBe(0);
    await openPackagesModule(page);
    await page.selectOption('#pkgb-service-filter', serviceCode);
    await expect(rowFor(page, code)).toContainText(editedName, { timeout: 15_000 });
    await expect(rowFor(page, code).locator('.package-backend-status')).toHaveAttribute('data-status', 'ACTIVE');
    await expect(rowFor(page, code)).toHaveAttribute('data-package-id', fromBackend.id);

    // 10) 403: an identity without package:* permissions is told so (the backend decides, the SPA shows it).
    const agentLogin = 'e2e-pkg-agent-' + suffix;
    const agentPassword = 'e2e-agent-password-' + suffix;
    const created = await page.evaluate(async ({ login, password, tag }) => {
      const result = await BackendAgentApi.create({
        party_type: 'AGENT', account_number: 'PKG-' + tag, display_name: 'E2E Pkg Agent ' + tag, phone: '7' + tag.slice(-8),
        zone_code: 'SOUTH', login_identifier: login, password,
      });
      if (!result.ok) return { ok: false };
      const activated = await BackendAgentApi.activate(result.data.id);
      return { ok: activated.ok };
    }, { login: agentLogin, password: agentPassword, tag: suffix });
    expect(created.ok).toBe(true);
    const agentToken = await page.evaluate(async ({ base, login, password }) => {
      const response = await fetch(base + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login_identifier: login, password }) });
      const body = await response.json();
      return body.data ? body.data.access_token : null;
    }, { base: API_BASE_URL, login: agentLogin, password: agentPassword });
    expect(agentToken).toBeTruthy();
    const adminToken = await page.evaluate(() => state.session.accessToken);
    await page.evaluate((token) => { state.session.accessToken = token; }, agentToken);
    await page.evaluate(() => loadPackagesBackendFromBackend());
    await expect(page.locator('#admin-packages-backend-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#admin-packages-backend-error')).toContainText('لا تملك صلاحية');
    await expect(page.locator('.admin-package-backend-row')).toHaveCount(0);
    // A rejected write is also surfaced by the backend, never reported as success.
    const forbiddenWrite = await page.evaluate(async (s) => {
      const r = await BackendPackageApi.create({ service_code: s, code: 'forbidden', name: 'forbidden' });
      return { ok: r.ok, status: r.status, message: describeApiError(r) };
    }, serviceCode);
    expect(forbiddenWrite).toMatchObject({ ok: false, status: 403 });
    expect(forbiddenWrite.message).toContain('لا تملك صلاحية');

    // 11) 401: an invalid/expired token sends the user back to sign-in (global reaction), with no stale package data.
    await page.evaluate(() => { state.session.accessToken = 'invalid-token'; });
    await page.evaluate(() => loadPackagesBackendFromBackend());
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 10_000 });
    expect(await page.evaluate(() => state.session.accessToken)).toBeFalsy();
    void adminToken;
  });
});
