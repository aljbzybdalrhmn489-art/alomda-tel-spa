// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * PHASE: AGENT + WALLET/BALANCE + EXISTING TRANSACTION V1 — real browser,
 * real backend, real PostgreSQL, end-to-end (Owner Execution Order §17
 * minimum flow).
 *
 * Same backend server (webServer array in playwright.config.js) every
 * other spec in this project already exercises — migrated, bootstrapped
 * (bootstrap:admin now also seeds the Agent Admin permission catalog,
 * see backend/src/app/bootstrap-admin-service.ts), started for real.
 *
 * Covers: Login (Admin) -> Agent Admin -> Create Agent -> Read/List ->
 * reload persistence -> Activate Agent -> logout -> Agent authenticated
 * access (real login as the just-created Agent) -> Read Wallet Balance
 * (honest "no wallet position yet") -> logout -> no secret/password
 * leakage anywhere on the page.
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

test.describe('PHASE: AGENT + WALLET/BALANCE + EXISTING TRANSACTION V1 — Agent Admin + My Wallet, real backend', () => {
  test('full scenario: login (admin) -> create Agent -> reload persistence -> activate -> logout -> login as Agent -> My Wallet (honest no-position state) -> logout -> no secret leakage', async ({ page }) => {
    await page.goto('/');
    await completeLocalSetupGateIfShown(page);
    await loginWithRealBackend(page, ADMIN_LOGIN_IDENTIFIER, ADMIN_PASSWORD);

    // Enter the NEW, additive Agent Admin (real backend) module.
    await page.click('#btn-admin-drawer-open');
    await page.click('.admin-nav-item[data-module-id="agentsBackend"]');
    await expect(page.locator('#btn-admin-agent-backend-add')).toBeVisible({ timeout: 10_000 });

    // 1) Create an Agent — real backend call (Party + UserAccount + Credential).
    const suffix = String(Date.now());
    const agentDisplayName = 'E2E Agent ' + suffix;
    const agentLoginIdentifier = 'e2e-agent-' + suffix;
    const agentPassword = 'e2e-agent-password-' + suffix;
    await page.click('#btn-admin-agent-backend-add');
    await page.fill('#abf-display-name', agentDisplayName);
    await page.fill('#abf-account-number', 'AG-' + suffix);
    await page.fill('#abf-phone', '73' + suffix.slice(-7));
    await page.fill('#abf-login-identifier', agentLoginIdentifier);
    await page.fill('#abf-password', agentPassword);
    const createResponsePromise = page.waitForResponse((res) => res.url().includes('/api/v1/admin/agents') && res.request().method() === 'POST');
    await page.click('#btn-admin-agent-backend-form-save');
    const createResponse = await createResponsePromise;
    const createdAgentId = (await createResponse.json()).data.id;
    await expect(page.getByText(agentDisplayName)).toBeVisible({ timeout: 10_000 });

    // 2) Reload — PostgreSQL is the source of truth, not localStorage.
    await page.reload();
    await completeLocalSetupGateIfShown(page);
    if (await page.locator('#unified-identifier-input').count() > 0) {
      await loginWithRealBackend(page, ADMIN_LOGIN_IDENTIFIER, ADMIN_PASSWORD);
    }
    await page.click('#btn-admin-drawer-open');
    await page.click('.admin-nav-item[data-module-id="agentsBackend"]');
    await expect(page.getByText(agentDisplayName)).toBeVisible({ timeout: 10_000 });

    // 3) Activate the Agent — required before it can log in (DISABLED at
    // creation). Targeted precisely by the created agent's own id — the
    // shared E2E tenant accumulates agents across runs, so `.first()` on
    // the sorted list is not reliably THIS agent.
    await page.locator('.admin-agent-backend-toggle[data-agent-id="' + createdAgentId + '"]').click();
    const agentRow = page.locator('.admin-agent-backend-toggle[data-agent-id="' + createdAgentId + '"]').locator('xpath=..');
    await expect(agentRow).toContainText('نشط (مُفعّل)', { timeout: 10_000 });

    // 4) Logout of the Admin session.
    await page.click('#btn-admin-drawer-open');
    await page.click('#btn-admin-logout');
    await expect(page.locator('#unified-identifier-input')).toBeVisible({ timeout: 10_000 });

    // 5) Agent authenticated access — real login as the just-activated Agent.
    // A plain, role-less real identity lands on "My Wallet", never the Admin Panel.
    await loginWithRealBackend(page, agentLoginIdentifier, agentPassword);
    await expect.poll(() => page.evaluate(() => (typeof state !== 'undefined' ? state.app.currentScreen : null))).toBe('myWalletHome');

    // 6) Read Wallet Balance — a fresh Agent has no wallet position yet,
    // so the honest answer is the "no position" empty state, never a
    // fabricated zero and never an error.
    await expect(page.getByText('لا يوجد رصيد مُنشأ لهذه العملة بعد')).toBeVisible({ timeout: 10_000 });

    // No password/secret anywhere on the final page content.
    const finalContent = await page.content();
    expect(finalContent).not.toContain(agentPassword);
    expect(finalContent).not.toContain(ADMIN_PASSWORD);

    // 7) Logout from My Wallet.
    await page.click('#btn-my-wallet-logout');
    await expect(page.locator('#unified-identifier-input')).toBeVisible({ timeout: 10_000 });

    // 8) A genuinely unauthenticated attempt at the Agent Admin API is refused.
    const unauthedStatus = await page.evaluate(async (base) => {
      const res = await fetch(base + '/api/v1/admin/agents');
      return res.status;
    }, process.env.E2E_API_BASE_URL || 'http://127.0.0.1:4000');
    expect(unauthedStatus).toBe(401);
  });
});
