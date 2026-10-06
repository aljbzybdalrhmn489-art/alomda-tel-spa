// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * REAL TRANSACTIONS V1 — real browser, real backend, real PostgreSQL.
 *
 * The backend is the REAL, unmodified one, started by e2e/e2e-main.mts (the same startApplication() as
 * src/main.ts, plus an idempotent seed made through the backend's own repositories and the backend's
 * existing `commissionCandidatePolicies` composition override). Nothing is faked: every status code below
 * is read from a real HTTP response.
 *
 * Covers: admin login -> real transaction screen -> create a MANUAL transaction (HTTP 202) -> HELD, no
 * QUEUED/PROCESSING -> locked price from the backend -> ACTIVE wallet hold -> retry with the SAME
 * Idempotency-Key (HTTP 200, same transaction, no second hold) -> the same key with a different payload
 * (409 IDEMPOTENCY_CONFLICT, no automatic retry) -> reload -> open -> HELD -> timeline CREATED -> VALIDATED
 * -> HELD -> unknown service -> insufficient funds (422) -> a role-less Agent reaches the same screen from
 * My Wallet -> honest 400 (no pricing assignment) and a genuine 403 on an admin route.
 *
 * NOT covered here (by design, see the report): the transaction routes themselves never answer 403 (they
 * are ownership-scoped, not permission-scoped), so the genuine 403 is taken from an admin route and passed
 * through the same describeApiError the transaction screen uses.
 */

const ADMIN_LOGIN_IDENTIFIER = 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password-1';
const SERVICE_CODE = 'e2e-tx-manual';
const PACKAGE_CHEAP = 'e2e-pkg-cheap';
const PACKAGE_EXPENSIVE = 'e2e-pkg-expensive';

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

async function openTransactionsModule(page) {
  await page.click('#btn-admin-drawer-open');
  await page.click('.admin-nav-item[data-module-id="transactionsBackend"]');
  await expect(page.locator('#rtx-form')).toBeVisible({ timeout: 10_000 });
}

/**
 * The create form ONLY picks from the server catalog (GET /api/v1/catalog): the seeded service and its two
 * packages are real, ACTIVE catalog packages (package identity), so the scenarios select them from the pickers.
 */
async function fillForm(page, { service, pkg, target = '', formValues = '' }) {
  await expect(page.locator('#rtx-catalog-service')).toBeVisible({ timeout: 10_000 });
  await page.selectOption('#rtx-catalog-service', service);
  await page.selectOption('#rtx-catalog-package', pkg);
  await page.fill('#rtx-target-identifier', target);
  await page.fill('#rtx-form-values', formValues);
}

function isPostTransaction(response) {
  return response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/transactions';
}

/** Submits through the real button and returns the REAL HTTP response of POST /api/v1/transactions. */
async function clickAndCapturePost(page, selector) {
  const [response] = await Promise.all([page.waitForResponse(isPostTransaction), page.click(selector)]);
  return response;
}

async function backendHoldsFor(page, transactionId) {
  return page.evaluate(async (id) => {
    const result = await BackendWalletApi.getHolds('YER');
    return result.ok ? result.data.filter((h) => h.transaction_id === id) : null;
  }, transactionId);
}

async function backendHeld(page) {
  return page.evaluate(async () => {
    const result = await BackendWalletApi.getBalance('YER');
    return result.ok ? Number(result.data.held) : null;
  });
}

test.describe('REAL TRANSACTIONS V1 — real backend', () => {
  test('create MANUAL (202) -> HELD + hold -> same-key retry (200) -> conflict (409) -> reload -> timeline -> errors -> Agent access', async ({ page }) => {
    const suffix = String(Date.now());
    await page.goto('/');
    await completeLocalSetupGateIfShown(page);
    await loginWithRealBackend(page, ADMIN_LOGIN_IDENTIFIER, ADMIN_PASSWORD);
    await openTransactionsModule(page);

    // The form offers the catalog pickers only: no free-text service/package, no agent selector, no backend-owned field.
    await expect(page.locator('#rtx-catalog-service')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#rtx-service-code, #rtx-package-id, #rtx-entry-mode-toggle, #rtx-temp-note')).toHaveCount(0);
    await expect(page.locator('#rtx-form')).not.toContainText('نموذج تقني مؤقت');
    for (const forbidden of ['fulfillment', 'requires_hold', 'amount', 'gateway', 'commission', 'provider', 'agent']) {
      await expect(page.locator('#rtx-form input[id*="' + forbidden + '"], #rtx-form select[id*="' + forbidden + '"]')).toHaveCount(0);
    }
    await expect(page.locator('#rtx-form select')).toHaveCount(2); // the catalog service + package pickers, nothing else

    // 1) Create a MANUAL transaction. A NEW transaction answers HTTP 202 (not 200).
    const heldBefore = await backendHeld(page);
    await fillForm(page, { service: SERVICE_CODE, pkg: PACKAGE_CHEAP, target: '700' + suffix.slice(-6), formValues: '{"note":"e2e-' + suffix + '"}' });
    const created = await clickAndCapturePost(page, '#btn-rtx-submit');
    expect(created.status()).toBe(202);
    const idempotencyKey = await created.request().headerValue('idempotency-key');
    expect(idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    const result = page.locator('#rtx-result');
    await expect(result).toBeVisible({ timeout: 10_000 });
    await expect(result).toHaveAttribute('data-http-status', '202');
    await expect(result).toHaveAttribute('data-outcome', 'CREATED');
    await expect(result).toHaveAttribute('data-idempotency-key', idempotencyKey);
    const transactionId = (await result.getAttribute('data-transaction-id')) || '';
    expect(transactionId).toMatch(/^[0-9a-f-]{36}$/);
    // HELD (a MANUAL transaction stops there): never QUEUED / PROCESSING.
    await expect(result.locator('.rtx-status')).toHaveAttribute('data-status', 'HELD');
    await expect(result).toContainText('بانتظار التنفيذ اليدوي');
    await expect(result.locator('.rtx-status[data-status="QUEUED"], .rtx-status[data-status="PROCESSING"]')).toHaveCount(0);
    // The locked price comes from the backend response (the seeded pricing rule), never from the form.
    await expect(result.locator('.rtx-result-price')).toHaveText(/^100(\.0+)? YER$/);
    await expect(page.locator('#rtx-current-key')).toHaveAttribute('data-idempotency-key', idempotencyKey);
    const body = await created.json();
    expect(body.data.status).toBe('HELD');
    expect(body.data.transaction_id).toBe(transactionId);
    expect(body.meta.correlationId).toBeTruthy();
    await expect(result).toContainText(body.meta.correlationId);

    // The real backend agrees, and exactly one ACTIVE hold exists for it (held grew by the price).
    expect(await page.evaluate(async (id) => (await BackendTransactionApi.get(id)).data.status, transactionId)).toBe('HELD');
    const holds = await backendHoldsFor(page, transactionId);
    expect(holds).toHaveLength(1);
    expect(holds[0]).toMatchObject({ status: 'ACTIVE', currency: 'YER', wallet_kind: 'MAIN' });
    expect(Number(holds[0].amount)).toBe(100);
    expect((await backendHeld(page)) - heldBefore).toBe(100);

    // 2) The list shows it; opening it shows HELD, the hold and the timeline.
    const row = page.locator('.rtx-row[data-transaction-id="' + transactionId + '"]');
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.click();
    const detail = page.locator('#rtx-detail');
    await expect(detail).toHaveAttribute('data-transaction-id', transactionId);
    await expect(detail.locator('.rtx-status').first()).toHaveAttribute('data-status', 'HELD');
    const hold = page.locator('#rtx-hold');
    await expect(hold).toHaveAttribute('data-state', 'active', { timeout: 10_000 });
    await expect(hold).toContainText('ACTIVE');
    await expect(hold).toContainText('YER');
    await expect(hold).toContainText('100');
    const timelineTargets = async () => page.locator('#rtx-timeline .rtx-timeline-item').evaluateAll((els) => els.map((el) => el.getAttribute('data-to')));
    expect(await timelineTargets()).toEqual(['CREATED', 'VALIDATED', 'HELD']);
    await expect(page.locator('#rtx-timeline .rtx-timeline-item').first()).toHaveAttribute('data-from', 'null');

    // 3) Retry the SAME submission (same Idempotency-Key): HTTP 200, the same transaction, no second hold.
    const replayed = await clickAndCapturePost(page, '#btn-rtx-retry');
    expect(replayed.status()).toBe(200);
    expect(await replayed.request().headerValue('idempotency-key')).toBe(idempotencyKey);
    await expect(page.locator('#rtx-result')).toHaveAttribute('data-http-status', '200');
    await expect(page.locator('#rtx-result')).toHaveAttribute('data-outcome', 'REPLAYED');
    await expect(page.locator('#rtx-result')).toHaveAttribute('data-transaction-id', transactionId);
    expect(await backendHoldsFor(page, transactionId)).toHaveLength(1);
    expect((await backendHeld(page)) - heldBefore).toBe(100);

    // 4) The SAME key with a DIFFERENT payload: 409 IDEMPOTENCY_CONFLICT, shown honestly, never retried automatically.
    await page.evaluate((key) => {
      // Simulates a client bug / key reuse: same key, different package.
      rtx().submission = { key, payload: { serviceCode: 'e2e-tx-manual', packageId: 'e2e-pkg-expensive', targetIdentifier: null, formValues: null } };
    }, idempotencyKey);
    let postCount = 0;
    page.on('request', (r) => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/v1/transactions') postCount += 1; });
    const conflict = await clickAndCapturePost(page, '#btn-rtx-retry');
    expect(conflict.status()).toBe(409);
    const conflictBody = await conflict.json();
    expect(conflictBody.error.code).toBe('IDEMPOTENCY_CONFLICT');
    const formError = page.locator('#rtx-form-error');
    await expect(formError).toBeVisible();
    await expect(formError).toHaveAttribute('data-http-status', '409');
    await expect(formError).toHaveAttribute('data-error-code', 'IDEMPOTENCY_CONFLICT');
    await expect(formError).toContainText('لن تُعاد المحاولة تلقائياً');
    await page.waitForTimeout(1500);
    expect(postCount).toBe(1); // no automatic retry
    expect(await backendHoldsFor(page, transactionId)).toHaveLength(1);

    // 5) Reload: the screen refetches everything from the backend (nothing was stored locally).
    await page.reload();
    await expect.poll(() => page.evaluate(() => (typeof state !== 'undefined' && !!state.session.accessToken))).toBe(true);
    expect(await page.evaluate(() => rtx().list.items.length)).toBe(0);
    await openTransactionsModule(page);
    const rowAfterReload = page.locator('.rtx-row[data-transaction-id="' + transactionId + '"]');
    await expect(rowAfterReload).toBeVisible({ timeout: 10_000 });
    await expect(rowAfterReload.locator('.rtx-status')).toHaveAttribute('data-status', 'HELD');
    await rowAfterReload.click();
    await expect(page.locator('#rtx-detail .rtx-status').first()).toHaveAttribute('data-status', 'HELD', { timeout: 10_000 });
    await expect(page.locator('#rtx-hold')).toHaveAttribute('data-state', 'active', { timeout: 10_000 });
    expect(await timelineTargets()).toEqual(['CREATED', 'VALIDATED', 'HELD']);
    expect(await page.locator('#rtx-timeline .rtx-timeline-item[data-to="QUEUED"], #rtx-timeline .rtx-timeline-item[data-to="PROCESSING"]').count()).toBe(0);
    await page.click('#btn-rtx-detail-close');
    await expect(page.locator('#rtx-detail')).toHaveCount(0);

    // 6) Unknown service: the UI cannot even offer it, but a submission naming one is refused by the backend and its 400 is shown.
    await page.evaluate((s) => {
      rtx().submission = { key: generateIdempotencyKey(), payload: { serviceCode: 'no-such-service-' + s, packageId: 'e2e-pkg-cheap', targetIdentifier: null, formValues: null } };
      render();
    }, suffix);
    const unknown = await clickAndCapturePost(page, '#btn-rtx-retry');
    expect(unknown.status()).toBe(400);
    await expect(page.locator('#rtx-form-error')).toHaveAttribute('data-error-code', 'VALIDATION_ERROR');
    await expect(page.locator('#rtx-form-error')).toContainText('service');
    await expect(page.locator('#rtx-result')).toHaveCount(0);

    // 7) Insufficient funds: 422 INSUFFICIENT_FUNDS shown clearly.
    await fillForm(page, { service: SERVICE_CODE, pkg: PACKAGE_EXPENSIVE });
    const poor = await clickAndCapturePost(page, '#btn-rtx-submit');
    expect(poor.status()).toBe(422);
    expect((await poor.json()).error.code).toBe('INSUFFICIENT_FUNDS');
    await expect(page.locator('#rtx-form-error')).toHaveAttribute('data-http-status', '422');
    await expect(page.locator('#rtx-form-error')).toContainText('الرصيد غير كافٍ');

    // 8) A role-less Agent reaches the same screen from My Wallet. It has no pricing assignment, so the
    //    backend answers an honest 400; and a genuine 403 (admin route) is described by the same handler.
    const agentLogin = 'e2e-tx-agent-' + suffix;
    const agentPassword = 'e2e-agent-password-' + suffix;
    const agentSetup = await page.evaluate(async ({ login, password, tag }) => {
      const created = await BackendAgentApi.create({
        party_type: 'AGENT', account_number: 'TX-' + tag, display_name: 'E2E Tx Agent ' + tag, phone: '7' + tag.slice(-8),
        zone_code: 'SOUTH', login_identifier: login, password,
      });
      if (!created.ok) return { ok: false };
      const agents = await BackendAgentApi.list();
      const agent = agents.data.find((a) => a.account_number === 'TX-' + tag);
      const activated = await BackendAgentApi.activate(agent.id);
      return { ok: activated.ok };
    }, { login: agentLogin, password: agentPassword, tag: suffix });
    expect(agentSetup.ok).toBe(true);
    await page.click('#btn-admin-drawer-open');
    await page.click('#btn-admin-logout');
    await expect(page.locator('#unified-identifier-input')).toBeVisible({ timeout: 10_000 });
    await loginWithRealBackend(page, agentLogin, agentPassword);
    await expect.poll(() => page.evaluate(() => state.app.currentScreen)).toBe('myWalletHome');
    await expect(page.locator('#rtx-form')).toBeVisible({ timeout: 10_000 });
    await fillForm(page, { service: SERVICE_CODE, pkg: PACKAGE_CHEAP });
    const agentPost = await clickAndCapturePost(page, '#btn-rtx-submit');
    expect(agentPost.status()).toBe(400);
    await expect(page.locator('#rtx-form-error')).toContainText('pricing');
    const forbidden = await page.evaluate(async () => {
      const result = await ApiClient.get('/api/v1/admin/services');
      return { status: result.status, message: describeRealTransactionError(result) };
    });
    expect(forbidden.status).toBe(403);
    expect(forbidden.message).toContain('لا تملك صلاحية');
  });
});
