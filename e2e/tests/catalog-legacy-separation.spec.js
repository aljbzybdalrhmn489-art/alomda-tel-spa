// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * LEGACY / DEMO LOCAL ADMIN MODULES vs the real-backend modules (Catalog Foundation integration, Phase 5).
 * The local modules are kept (other screens read their arrays) but are labelled and bannered so a local edit can never
 * be mistaken for a backend edit, and they never call the backend; the real modules carry no such banner.
 */

const ADMIN_LOGIN_IDENTIFIER = 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password-1';

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

async function openModule(page, moduleId) {
  const item = page.locator('.admin-nav-item[data-module-id="' + moduleId + '"]');
  if (!(await item.isVisible())) await page.click('#btn-admin-drawer-open');
  await item.click();
}

const LEGACY = {
  services: ['servicesBackend'],
  agents: ['agentsBackend'],
  operations: ['operationsBackend'],
  commissions: ['pricingBackend', 'gatewaysBackend', 'marginFxBackend'],
  games: ['packagesBackend'],
  telecomCompanies: ['packagesBackend'],
};
const REAL_MODULES = ['packagesBackend', 'gatewaysBackend', 'pricingBackend', 'marginFxBackend', 'servicesBackend', 'agentsBackend', 'providers'];

test.describe('Legacy local admin modules are separated from the real ones', () => {
  test('banner + label on every local module with a real replacement; no backend call from them; none on real modules', async ({ page }) => {
    await page.goto('/');
    await completeLocalSetupGateIfShown(page);
    await loginWithRealBackend(page, ADMIN_LOGIN_IDENTIFIER, ADMIN_PASSWORD);

    // The nav shows the explicit "local (demo)" tag on legacy items and the "real system" tag on the real ones.
    await page.click('#btn-admin-drawer-open');
    for (const id of Object.keys(LEGACY)) {
      await expect(page.locator('.admin-nav-item[data-module-id="' + id + '"]')).toContainText('محلي');
    }
    for (const id of ['packagesBackend', 'gatewaysBackend', 'pricingBackend', 'marginFxBackend']) {
      await expect(page.locator('.admin-nav-item[data-module-id="' + id + '"]')).toContainText('النظام الفعلي');
    }

    // Visiting and clicking around the legacy modules never reaches the backend admin API.
    const adminCalls = [];
    page.on('request', (req) => { if (req.url().includes('/api/v1/')) adminCalls.push(req.method() + ' ' + req.url()); });
    for (const [id, replacements] of Object.entries(LEGACY)) {
      await openModule(page, id);
      const banner = page.locator('#admin-legacy-local-banner');
      await expect(banner).toBeVisible({ timeout: 10_000 });
      await expect(banner).toHaveAttribute('data-module-id', id);
      await expect(banner).toContainText('ذاكرة المتصفح فقط');
      for (const real of replacements) {
        const realLabel = await page.evaluate((m) => findAdminNavItemById(m).label, real);
        await expect(banner.locator('.admin-legacy-local-replacements')).toContainText(realLabel);
      }
    }
    expect(adminCalls).toEqual([]);

    // The real modules carry no legacy banner.
    for (const id of REAL_MODULES) {
      await openModule(page, id);
      await page.waitForTimeout(300);
      await expect(page.locator('#admin-legacy-local-banner')).toHaveCount(0);
    }
  });
});
