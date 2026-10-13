// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * PRODUCTION admin navigation shows ONLY modules the server really owns (the "...Backend" modules and the Provider admin). Local demo modules
 * (fake figures kept in the browser) are not listed and cannot be rendered even if the active-module state names one. The development profile
 * (served at "/") keeps them, labelled. Mock API (no database): this proves the SPA rule, not the backend.
 */
const API = 'http://127.0.0.1:4000';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' };
const LOCAL_ONLY = ['dashboard', 'agents', 'customers', 'telecomCompanies', 'wifi', 'games', 'services', 'operations', 'commissions', 'reports', 'usersPermissions', 'systemSettings', 'auditLog', 'support', 'customerTopupReview'];

async function installAdminBackend(page) {
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
    const json = (status, body) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (path === '/api/v1/auth/login') return json(200, { data: { access_token: 'a', refresh_token: 'r' }, meta: {} });
    if (path === '/api/v1/auth/me') return json(200, { data: { party_id: '99999999-9999-4999-8999-999999999999', roles: ['SYSTEM_ADMIN'], employee_profile: null }, meta: {} });
    return json(200, { data: [], meta: {} });
  });
}

async function loginAdmin(page, url) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await installAdminBackend(page);
  await page.goto(url);
  await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 15_000 });
  await page.fill('#unified-identifier-input', 'admin');
  await page.fill('#unified-password-input', 'mock-password-not-a-secret');
  await page.click('#btn-unified-login');
  await expect(page.locator('#btn-admin-drawer-open')).toBeVisible({ timeout: 15_000 });
  await page.click('#btn-admin-drawer-open');
  return errors;
}

test.describe('Admin navigation per runtime profile', () => {
  test('PROD-09: production lists only server-backed modules; no local demo module is reachable or rendered', async ({ page }) => {
    const errors = await loginAdmin(page, '/production');
    const ids = await page.locator('.admin-nav-item').evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-module-id')));
    expect(ids.length).toBeGreaterThan(5);
    for (const id of ids) expect(id === 'providers' || /Backend$/.test(String(id)), `unexpected module ${id}`).toBe(true);
    for (const id of LOCAL_ONLY) expect(ids).not.toContain(id);

    // forcing a local module into the active-module state still renders a server-backed one (never the local screen)
    await page.evaluate(() => { state.admin.navigation.activeModule = 'wifi'; render(); });
    expect(await page.evaluate(() => getSafeActiveAdminModuleId())).not.toBe('wifi');
    expect(await page.evaluate(() => isAdminModuleBackedByServer(getSafeActiveAdminModuleId()))).toBe(true);
    await expect(page.locator('#admin-legacy-local-banner')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('DEV-09: the development profile keeps the local demo modules, unchanged (rule evaluated in the page, no login needed)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof getAdminNavItemsForAccount === 'function');
    const ids = await page.evaluate(() => getAdminNavItemsForAccount({ role: 'administrator' }).map((i) => i.id));
    for (const id of ['dashboard', 'agents', 'wifi', 'reports', 'agentsBackend']) expect(ids).toContain(id);
    const production = await (async () => { await page.goto('/production'); await page.waitForFunction(() => typeof getAdminNavItemsForAccount === 'function'); return page.evaluate(() => getAdminNavItemsForAccount({ role: 'administrator' }).map((i) => i.id)); })();
    expect(production).not.toContain('dashboard');
    expect(production).toContain('agentsBackend');
  });
});
