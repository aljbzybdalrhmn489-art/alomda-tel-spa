// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * SPA ↔ Backend Integration V1 — real browser, real backend, real
 * PostgreSQL, end-to-end (§22 of the phase directive).
 *
 * The backend server this test talks to (started by playwright.config.js's
 * own `webServer` array) is the REAL, unmodified backend from this same
 * repository — migrated, bootstrapped, and started exactly as an operator
 * would (`npm run migrate` / `npm run bootstrap:admin` / `npm start`),
 * against `DATABASE_URL_TEST` under a dedicated tenant
 * (`e2e-spa-integration`) so it never touches any other test's own data.
 *
 * FIRST-RUN GATE: this app's own pre-existing "Initial Administrator
 * Setup" screen (unrelated to this phase, a LOCAL mock-only onboarding
 * flow — see spa_app-175.html's own `hasAdministratorAccount()` doc
 * comment) blocks the unified login screen until at least one LOCAL mock
 * administrator account exists. This test completes that gate once (a
 * throwaway local account, never used again), logs out of it immediately,
 * and only THEN exercises the real backend login this phase actually
 * built — never conflating the two.
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
  // Lands authenticated as the throwaway LOCAL mock admin — log out of it
  // immediately so the test proceeds through the REAL backend login path.
  // The logout button lives inside the admin drawer, closed by default.
  await page.click('#btn-admin-drawer-open');
  await page.locator('#btn-admin-logout').click();
}

async function loginWithRealBackendAdmin(page) {
  await page.fill('#unified-identifier-input', ADMIN_LOGIN_IDENTIFIER);
  await page.fill('#unified-password-input', ADMIN_PASSWORD);
  await page.click('#btn-unified-login');
  // A real backend login populates state.session.accessToken — proven
  // indirectly by every subsequent Admin API call succeeding (a wrong/
  // missing token would 401 immediately), and directly here via a
  // same-origin-safe read of the app's own in-memory state.
  await expect.poll(() => page.evaluate(() => (typeof state !== 'undefined' && state.session && !!state.session.accessToken))).toBe(true);
}

test.describe('SPA ↔ Backend Integration V1 — Provider Admin, real backend', () => {
  test('full scenario: login → Provider CRUD/lifecycle → ProviderAccount + secretRef → ProviderMapping → reload persistence → logout → 401 → no secret leakage', async ({ page }) => {
    await page.goto('/');

    await completeLocalSetupGateIfShown(page);
    await loginWithRealBackendAdmin(page);

    // Enter Provider Admin — triggers loadProvidersFromBackend() (§9).
    // The nav item lives inside the admin drawer, closed by default on
    // every fresh session (including this one, right after the real
    // backend login above).
    await page.click('#btn-admin-drawer-open');
    await page.click('.admin-nav-item[data-module-id="providers"]');
    await expect(page.locator('#btn-admin-provider-add')).toBeVisible({ timeout: 10_000 });

    // 1) Create a Provider — real backend call.
    const providerName = 'E2E Provider ' + Date.now();
    await page.click('#btn-admin-provider-add');
    await page.fill('#provf-name', providerName);
    await page.click('#btn-admin-provider-form-save');
    await expect(page.getByText(providerName)).toBeVisible({ timeout: 10_000 });

    // 2) Reload — the provider must still be there because PostgreSQL is
    // the source of truth, not localStorage/in-memory cache (§16/§19.15).
    // The access token itself IS persisted (this app's own existing
    // `state.session` persistence, see freshSessionState()'s own doc
    // comment) so the session survives the reload without a second
    // login — but `state.admin.navigation.activeModule` is NOT part of
    // what gets persisted, so the reload always lands back on the
    // Dashboard module; the Providers nav item is clicked again either
    // way, which is what actually re-triggers loadProvidersFromBackend().
    await page.reload();
    await completeLocalSetupGateIfShown(page); // no-op if a session already persisted
    if (await page.locator('#unified-identifier-input').count() > 0) {
      await loginWithRealBackendAdmin(page);
    }
    await page.click('#btn-admin-drawer-open');
    await page.click('.admin-nav-item[data-module-id="providers"]');
    await expect(page.getByText(providerName)).toBeVisible({ timeout: 10_000 });

    // 3) Edit the Provider.
    await page.locator('.admin-provider-edit').first().click();
    await page.fill('#provf-name', providerName + ' (edited)');
    await page.click('#btn-admin-provider-form-save');
    await expect(page.getByText(providerName + ' (edited)')).toBeVisible({ timeout: 10_000 });

    // 4) Activate — this deployment has NO registered concrete adapter
    // (§12: no real Provider integration in this phase), so the
    // Readiness Gate legitimately refuses. The honest failure must be
    // shown, never a fake success (§8/§30).
    await page.locator('.admin-provider-toggle').first().click();
    // describeApiError() passes non-401/403 backend messages through
    // verbatim (English, from the real backend's own AppError) — the
    // honest V1 Readiness Gate refusal text, not an Arabic translation.
    await expect(page.getByText(/Readiness Gate|not registered/i)).toBeVisible({ timeout: 10_000 });

    // 5) Create a ProviderAccount for this provider.
    await page.locator('.admin-provider-accounts').first().click();
    await expect(page.locator('#btn-admin-provider-account-add')).toBeVisible({ timeout: 10_000 });
    const accountIdentifier = 'E2E-ACC-' + Date.now();
    await page.click('#btn-admin-provider-account-add');
    await page.fill('#pacf-name', 'E2E Account');
    await page.fill('#pacf-identifier', accountIdentifier);
    await page.click('#btn-admin-provider-account-form-save');
    await expect(page.getByText(accountIdentifier)).toBeVisible({ timeout: 10_000 });

    // 6) Configure secretRef (§9/§10) — the raw value must NEVER appear
    // anywhere on the page afterward.
    const secretValue = 'vault-ref-e2e-' + Date.now();
    await page.locator('.admin-provider-account-secret').first().click();
    await page.fill('#pacf-secret-ref', secretValue);
    await page.click('#btn-admin-secret-ref-save');
    // Wait for the save to finish and the dialog to close BEFORE asserting: while the dialog is still open (save in
    // flight) the typed value is legitimately present in its own input, so asserting immediately raced the backend.
    await expect(page.locator('#pacf-secret-ref')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.locator('body')).not.toContainText(secretValue);
    // The account row now shows the "configured" indicator (secret_configured: true), never the value.
    const pageContentAfterSecret = await page.content();
    expect(pageContentAfterSecret).not.toContain(secretValue);

    // 7) Create a ProviderMapping (§9's own new, additive screen).
    await page.click('#btn-admin-provider-mappings');
    await expect(page.locator('#provider-mappings-package-id-input')).toBeVisible({ timeout: 10_000 });
    const packageId = 'e2e-pkg-' + Date.now();
    await page.fill('#provider-mappings-package-id-input', packageId);
    await page.click('#btn-admin-provider-mappings-load');
    await expect(page.locator('#btn-admin-provider-mapping-add')).toBeVisible({ timeout: 10_000 });
    await page.click('#btn-admin-provider-mapping-add');
    await page.fill('#pmf-service', 'e2e-service');
    await page.fill('#pmf-gateway', 'gw-e2e');
    await page.fill('#pmf-product-code', 'E2E-PRODUCT-1');
    await page.fill('#pmf-cost', '5.0000');
    await page.fill('#pmf-currency', 'YER');
    await page.click('#btn-admin-provider-mapping-form-save');
    await expect(page.getByText('E2E-PRODUCT-1')).toBeVisible({ timeout: 10_000 });

    // No secret anywhere on the final page state.
    expect(await page.content()).not.toContain(secretValue);

    // 8) Logout, then verify an unauthenticated attempt at a protected
    // API call is genuinely refused (401) — proven directly against the
    // real backend from inside the browser's own origin, not asserted.
    await page.click('#btn-admin-drawer-open');
    await page.click('#btn-admin-logout');
    await expect(page.locator('#unified-identifier-input')).toBeVisible({ timeout: 10_000 });
    const unauthedStatus = await page.evaluate(async (base) => {
      const res = await fetch(base + '/api/v1/admin/providers');
      return res.status;
    }, process.env.E2E_API_BASE_URL || 'http://127.0.0.1:4000');
    expect(unauthedStatus).toBe(401);
  });

  test('wrong credentials against the real backend fall through to this app\'s own existing mock accounts, never a fake real-backend success', async ({ page }) => {
    await page.goto('/');
    await completeLocalSetupGateIfShown(page);
    await page.fill('#unified-identifier-input', ADMIN_LOGIN_IDENTIFIER);
    await page.fill('#unified-password-input', 'definitely-the-wrong-password');
    await page.click('#btn-unified-login');
    // Neither the real admin (wrong password) nor any mock account uses
    // this identifier — the ONLY honest outcome is a login error, never
    // a silently-granted session of either kind.
    await expect(page.locator('#unified-identifier-input')).toBeVisible({ timeout: 10_000 });
    const accessToken = await page.evaluate(() => (typeof state !== 'undefined' && state.session ? state.session.accessToken : null));
    expect(accessToken).toBeFalsy();
  });
});
