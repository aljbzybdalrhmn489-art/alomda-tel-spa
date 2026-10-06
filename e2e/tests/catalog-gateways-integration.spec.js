// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * SPA GATEWAYS ADMIN (real backend) — real browser, real backend, real PostgreSQL. Gateway routes are exactly
 * POST · GET · GET :id · PATCH :id (no activate/deactivate, no delete), and `status` is an uninterpreted text.
 * Covers: list from the backend, create, edit (code immutable), the single-default rule, reload persistence
 * (nothing stored locally), no write to the local mock GATEWAY_DIRECTORY, validation + conflict responses,
 * 403 and 401.
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

async function openGatewaysModule(page) {
  await page.click('#btn-admin-drawer-open');
  await page.click('.admin-nav-item[data-module-id="gatewaysBackend"]');
  await expect(page.locator('#btn-admin-gateway-backend-add')).toBeVisible({ timeout: 10_000 });
}

async function backendGatewayByCode(page, code) {
  return page.evaluate(async (c) => {
    const result = await BackendGatewayApi.list();
    if (!result.ok) return { error: result.error };
    return result.data.find((x) => x.code === c) || null;
  }, code);
}

function rowFor(page, code) {
  return page.locator('.admin-gateway-backend-row[data-gateway-code="' + code + '"]');
}

test.describe('SPA Gateways Admin — real backend', () => {
  test('list -> create -> edit -> default rule -> reload -> validation/conflict -> no local write -> 403 -> 401', async ({ page }) => {
    const suffix = String(Date.now());
    const code = 'gw-' + suffix;
    const name = 'E2E Gateway ' + suffix;

    await page.goto('/');
    await completeLocalSetupGateIfShown(page);
    await loginWithRealBackend(page, ADMIN_LOGIN_IDENTIFIER, ADMIN_PASSWORD);

    const localBefore = await page.evaluate(() => (typeof GATEWAY_DIRECTORY !== 'undefined' ? JSON.stringify(GATEWAY_DIRECTORY) : ''));

    // 1) The module lists from the backend: the seeded default E2E gateway is there, flagged as default.
    await openGatewaysModule(page);
    await expect(rowFor(page, 'e2e-gw')).toBeVisible({ timeout: 10_000 });
    await expect(rowFor(page, 'e2e-gw').locator('.gateway-backend-default')).toHaveAttribute('data-is-default', 'true');
    // There is no activate/deactivate control anywhere (the backend has none).
    await expect(page.locator('.admin-gateway-backend-toggle')).toHaveCount(0);

    // 2) Create (not default). status is free text.
    await page.click('#btn-admin-gateway-backend-add');
    await page.fill('#gwb-code', code);
    await page.fill('#gwb-name', name);
    await page.selectOption('#gwb-type', 'NORTH');
    await page.selectOption('#gwb-currency', 'SAR');
    await page.fill('#gwb-status', 'ACTIVE');
    await page.click('#btn-admin-gateway-backend-form-save');
    await expect(rowFor(page, code)).toBeVisible({ timeout: 10_000 });
    expect(await backendGatewayByCode(page, code)).toMatchObject({ code, name, gateway_type: 'NORTH', default_currency_code: 'SAR', status: 'ACTIVE', is_default: false });
    await expect(rowFor(page, code).locator('.gateway-backend-type')).toHaveText('NORTH');
    await expect(rowFor(page, code).locator('.gateway-backend-currency')).toHaveText('SAR');
    await expect(rowFor(page, code).locator('.gateway-backend-default')).toHaveAttribute('data-is-default', 'false');

    // 3) Edit: the code is read-only; name, type, currency and status change.
    const editedName = name + ' (edited)';
    await rowFor(page, code).locator('.admin-gateway-backend-edit').click();
    await expect(page.locator('#gwb-code-readonly')).toHaveText(code);
    await expect(page.locator('#gwb-code')).toHaveCount(0);
    await page.fill('#gwb-name', editedName);
    await page.selectOption('#gwb-type', 'SOUTH');
    await page.selectOption('#gwb-currency', 'YER');
    await page.fill('#gwb-status', 'SUSPENDED-TEXT');
    await page.click('#btn-admin-gateway-backend-form-save');
    await expect(rowFor(page, code)).toContainText(editedName, { timeout: 10_000 });
    expect(await backendGatewayByCode(page, code)).toMatchObject({ name: editedName, gateway_type: 'SOUTH', default_currency_code: 'YER', status: 'SUSPENDED-TEXT' });

    // 4) Only one default gateway per tenant: making a second one default is refused by the REAL backend,
    //    its message is shown, and the existing default stays default.
    await rowFor(page, code).locator('.admin-gateway-backend-edit').click();
    await page.selectOption('#gwb-is-default', 'true');
    await page.click('#btn-admin-gateway-backend-form-save');
    await expect(page.locator('#gateway-backend-form-error')).toBeVisible({ timeout: 10_000 });
    expect((await page.locator('#gateway-backend-form-error').innerText()).trim().length).toBeGreaterThan(0);
    await page.click('#btn-admin-gateway-backend-form-cancel');
    expect(await backendGatewayByCode(page, 'e2e-gw')).toMatchObject({ is_default: true });
    expect(await backendGatewayByCode(page, code)).toMatchObject({ is_default: false });

    // 5) Validation (client) and the backend's own rejections; nothing is created by a failed submit.
    await page.click('#btn-admin-gateway-backend-add');
    await page.fill('#gwb-code', 'gw-invalid-' + suffix);
    await page.fill('#gwb-name', 'invalid');
    await page.click('#btn-admin-gateway-backend-form-save'); // status missing
    await expect(page.locator('#gateway-backend-form-error')).toBeVisible();
    // Duplicate code: the REAL backend rejects it and its message is shown.
    await page.fill('#gwb-code', code);
    await page.fill('#gwb-status', 'ACTIVE');
    await page.click('#btn-admin-gateway-backend-form-save');
    await expect(page.locator('#gateway-backend-form-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#btn-admin-gateway-backend-form-save')).toBeEnabled();
    await page.click('#btn-admin-gateway-backend-form-cancel');
    expect(await backendGatewayByCode(page, 'gw-invalid-' + suffix)).toBeNull();
    const rejected = await page.evaluate(async (c) => {
      const dup = await BackendGatewayApi.create({ code: c, name: 'dup', gateway_type: 'NEUTRAL', default_currency_code: 'YER', status: 'x' });
      const badType = await BackendGatewayApi.create({ code: 'bt-' + c, name: 'x', gateway_type: 'WEST', default_currency_code: 'YER', status: 'x' });
      const badCurrency = await BackendGatewayApi.create({ code: 'bc-' + c, name: 'x', gateway_type: 'NEUTRAL', default_currency_code: 'EUR', status: 'x' });
      return {
        dup: { status: dup.status, code: dup.error && dup.error.code },
        badType: { status: badType.status, code: badType.error && badType.error.code },
        badCurrency: { status: badCurrency.status, code: badCurrency.error && badCurrency.error.code },
      };
    }, code);
    expect([400, 409]).toContain(rejected.dup.status);
    expect(rejected.badType).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    expect(rejected.badCurrency).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });

    // 6) No write reached the local mock gateway array, and nothing about the gateway is stored locally.
    expect(await page.evaluate(() => (typeof GATEWAY_DIRECTORY !== 'undefined' ? JSON.stringify(GATEWAY_DIRECTORY) : ''))).toBe(localBefore);
    expect(await page.evaluate((c) => Object.keys(localStorage).some((k) => (localStorage.getItem(k) || '').includes(c)), code)).toBe(false);

    // 7) Reload: a fresh load starts empty; re-entering the module refetches from the backend.
    await page.reload();
    await expect.poll(() => page.evaluate(() => (typeof state !== 'undefined' && !!state.session.accessToken))).toBe(true);
    expect(await page.evaluate(() => GATEWAY_BACKEND_DIRECTORY.length)).toBe(0);
    await openGatewaysModule(page);
    await expect(rowFor(page, code)).toContainText(editedName, { timeout: 15_000 });
    await expect(rowFor(page, code).locator('.gateway-backend-status')).toHaveAttribute('data-status', 'SUSPENDED-TEXT');

    // 8) 403: an identity without gateway:* permissions is told so; a rejected write is never shown as success.
    const agentLogin = 'e2e-gw-agent-' + suffix;
    const agentPassword = 'e2e-agent-password-' + suffix;
    const created = await page.evaluate(async ({ login, password, tag }) => {
      const result = await BackendAgentApi.create({
        party_type: 'AGENT', account_number: 'GW-' + tag, display_name: 'E2E Gw Agent ' + tag, phone: '7' + tag.slice(-8),
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
    await page.evaluate((token) => { state.session.accessToken = token; }, agentToken);
    await page.evaluate(() => loadGatewaysBackendFromBackend());
    await expect(page.locator('#admin-gateways-backend-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#admin-gateways-backend-error')).toContainText('لا تملك صلاحية');
    await expect(page.locator('.admin-gateway-backend-row')).toHaveCount(0);
    const forbiddenWrite = await page.evaluate(async () => {
      const r = await BackendGatewayApi.create({ code: 'forbidden', name: 'f', gateway_type: 'NEUTRAL', default_currency_code: 'YER', status: 'x' });
      return { ok: r.ok, status: r.status, message: describeApiError(r) };
    });
    expect(forbiddenWrite).toMatchObject({ ok: false, status: 403 });

    // 9) 401: an invalid token sends the user back to sign-in (global reaction).
    await page.evaluate(() => { state.session.accessToken = 'invalid-token'; });
    await page.evaluate(() => loadGatewaysBackendFromBackend());
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 10_000 });
    expect(await page.evaluate(() => state.session.accessToken)).toBeFalsy();
  });
});
