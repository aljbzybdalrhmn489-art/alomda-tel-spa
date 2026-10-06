// @ts-check
const { test, expect } = require('@playwright/test');
const { queryOne } = require('./db-evidence');

/**
 * PACKAGE IDENTITY across Service Pricing and Transactions (Catalog Foundation integration, Phase 6).
 * The canonical identity of a Package is its backend-issued UUID. The admin screens PICK a catalog package instead of
 * typing an id; the SPA never invents a UUID; the database records the canonical UUID on the rows written from those
 * picks. The transaction API takes service code + package code, so the transaction form picks from GET /api/v1/catalog
 * (ACTIVE services and packages) and the database derives the UUID. "Manual technical entry" stays available, but is
 * an explicit, non-default mode and cannot create a transaction for an unknown service.
 * (Provider Mapping's picker is covered in spa-backend-integration.spec.js.)
 */

const ADMIN_LOGIN_IDENTIFIER = 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password-1';
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

test.describe('Package identity — pricing and transactions use the canonical catalog package', () => {
  test('service pricing and a transaction created from the catalog picker carry the canonical package UUID', async ({ page }) => {
    const suffix = String(Date.now());
    const serviceCode = 'e2e-id-svc-' + suffix;
    const draftServiceCode = 'e2e-id-draft-' + suffix;
    const packageCode = 'id-pkg-' + suffix;

    await page.goto('/');
    await completeLocalSetupGateIfShown(page);
    await loginWithRealBackend(page, ADMIN_LOGIN_IDENTIFIER, ADMIN_PASSWORD);

    // Real prerequisites through the real APIs: an ACTIVE MANUAL service with an ACTIVE catalog package, priced for the
    // pricing group the E2E admin party is assigned to; and a DRAFT service (must not appear in the transaction catalog).
    const prepared = await page.evaluate(async ({ s, d, p }) => {
      const groups = await BackendPricingGroupApi.list();
      const group = groups.ok ? groups.data.find((g) => g.name === 'E2E Standard') : null;
      const svc = await BackendServiceApi.create({ code: s, name: 'E2E Identity Service', fulfillment_strategy: 'MANUAL', requires_hold: true });
      const svcActive = svc.ok ? await BackendServiceApi.activate(svc.data.id) : { ok: false };
      const pkg = await BackendPackageApi.create({ service_code: s, code: p, name: 'E2E Identity Package' });
      const pkgActive = pkg.ok ? await BackendPackageApi.activate(pkg.data.id) : { ok: false };
      const pricing = group && pkg.ok ? await BackendServicePricingApi.create({ pricing_group_id: group.id, service_code: s, package_id: p, package_uuid: pkg.data.id, currency_code: 'YER', retail_price: '100' }) : { ok: false };
      const draft = await BackendServiceApi.create({ code: d, name: 'E2E Draft Service', fulfillment_strategy: 'PROVIDER', requires_hold: false });
      const draftPkg = draft.ok ? await BackendPackageApi.create({ service_code: d, code: 'draft-pkg', name: 'Draft package' }) : { ok: false };
      if (draftPkg.ok) await BackendPackageApi.activate(draftPkg.data.id);
      return { ok: !!(group && svcActive.ok && pkgActive.ok && pricing.ok && draft.ok && draftPkg.ok), packageId: pkg.ok ? pkg.data.id : null };
    }, { s: serviceCode, d: draftServiceCode, p: packageCode });
    expect(prepared.ok).toBe(true);
    expect(prepared.packageId).toMatch(UUID_RE);

    // Service Pricing created through the API with the picked package's UUID is stored with that exact canonical identity.
    const pricingRow = await queryOne('SELECT package_uuid FROM service_pricing WHERE service_id = $1 AND package_id = $2', [serviceCode, packageCode]);
    if (pricingRow !== undefined) expect(pricingRow && pricingRow.package_uuid).toBe(prepared.packageId);

    // Open the transactions module: the default mode is the catalog picker, not free text.
    await page.click('#btn-admin-drawer-open');
    await page.click('.admin-nav-item[data-module-id="transactionsBackend"]');
    await expect(page.locator('#rtx-catalog-service')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#rtx-entry-mode-toggle')).toHaveAttribute('data-mode', 'catalog');
    await expect(page.locator('#rtx-service-code')).toHaveCount(0);
    await expect(page.locator('#rtx-package-id')).toHaveCount(0);
    await expect(page.locator('#rtx-temp-note')).toHaveCount(0);
    // Only ACTIVE catalog entries are offered: the ACTIVE service is there, the DRAFT one is not.
    await expect(page.locator('#rtx-catalog-service option[value="' + serviceCode + '"]')).toHaveCount(1);
    await expect(page.locator('#rtx-catalog-service option[value="' + draftServiceCode + '"]')).toHaveCount(0);

    // Create a transaction from the picked catalog item.
    await page.selectOption('#rtx-catalog-service', serviceCode);
    await expect(page.locator('#rtx-catalog-package')).toHaveValue(packageCode);
    const request = page.waitForRequest((req) => req.method() === 'POST' && req.url().endsWith('/api/v1/transactions'));
    await page.click('#btn-rtx-submit');
    const sent = JSON.parse((await request).postData() || '{}');
    expect(sent).toMatchObject({ service_id: serviceCode, package_id: packageCode });
    // The SPA never sends a package UUID, a fulfillment strategy, a price or a gateway: the backend owns them.
    for (const key of ['package_uuid', 'fulfillment_strategy', 'requires_hold', 'price', 'gateway_id']) expect(Object.keys(sent)).not.toContain(key);
    await expect(page.locator('#rtx-result')).toHaveAttribute('data-http-status', '202', { timeout: 15_000 });
    const transactionId = await page.locator('#rtx-result').getAttribute('data-transaction-id');
    expect(transactionId).toBeTruthy();
    const txRow = await queryOne('SELECT package_uuid, service_id, package_id FROM transactions WHERE id = $1', [transactionId]);
    if (txRow !== undefined) expect(txRow).toMatchObject({ package_uuid: prepared.packageId, service_id: serviceCode, package_id: packageCode });

    // Manual technical entry is an explicit, non-default mode: it is labelled as such, and an unknown service is refused by the backend.
    await page.click('#rtx-entry-mode-toggle');
    await expect(page.locator('#rtx-entry-mode-toggle')).toHaveAttribute('data-mode', 'manual');
    await expect(page.locator('#rtx-temp-note')).toBeVisible();
    await expect(page.locator('#rtx-catalog-service')).toHaveCount(0);
    await page.fill('#rtx-service-code', 'no-such-service-' + suffix);
    await page.fill('#rtx-package-id', packageCode);
    await page.click('#btn-rtx-submit');
    await expect(page.locator('#rtx-form-error')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#rtx-form-error')).toHaveAttribute('data-http-status', '400');
    // Back to the catalog picker.
    await page.click('#rtx-entry-mode-toggle');
    await expect(page.locator('#rtx-catalog-service')).toBeVisible();

    // The Service Pricing screen offers the package by its catalog identity (the picker carries the UUID that is sent).
    await page.click('#btn-admin-drawer-open');
    await page.click('.admin-nav-item[data-module-id="pricingBackend"]');
    await page.click('.pricing-backend-tab[data-tab-id="servicePricing"]');
    await page.click('#btn-admin-service-pricing-add');
    await page.selectOption('#prsp-service', serviceCode);
    await expect(page.locator('#prsp-package')).toHaveValue(prepared.packageId);
    await expect(page.locator('#prsp-package-uuid-readonly')).toHaveText(prepared.packageId);
    await page.click('#btn-admin-service-pricing-form-cancel');
  });
});
