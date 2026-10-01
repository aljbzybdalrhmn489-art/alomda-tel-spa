// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * REAL OPERATIONS V1 — PHASE 2 — Employee workflow (claim -> start -> complete), real browser, real backend,
 * real PostgreSQL. The backend is the real, unmodified application (e2e/e2e-main.mts), seeded with TWO Employees:
 * A serves service type 'e2e-ops', B serves a different one (so dispatch never offers A's requests to B). Nothing is
 * faked or intercepted: every status below is read from a real HTTP response or from the backend.
 *
 * Happy path: admin dispatches -> A sees the PENDING offer -> claim (ASSIGNED, assigned to A) -> reload ->
 * start (IN_PROGRESS) -> reload -> complete (COMPLETED) -> reload.
 * Errors: second claim 409; wrong employee claim / start / complete 403; start before claim 403 (the backend checks
 * the assignee first; an unclaimed request has none); complete before start 409; start twice 409.
 *
 * NOT covered (later phases): transaction-linked completion, settlement/capture, expiry/redispatch (worker).
 */

const ADMIN_LOGIN_IDENTIFIER = 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password-1';
const EMPLOYEE_A = { login: 'e2e-employee', password: 'e2e-employee-password-1' };
const EMPLOYEE_B = { login: 'e2e-employee-b', password: 'e2e-employee-b-password-1' };
const SERVICE_TYPE = 'e2e-ops';

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

async function loginEmployee(page, employee) {
  await loginWithRealBackend(page, employee.login, employee.password);
  await expect.poll(() => page.evaluate(() => state.app.currentScreen)).toBe('realEmployeeWorkspace');
  await expect(page.locator('#rops-employee-party')).not.toHaveText('', { timeout: 10_000 });
}

async function logoutAdmin(page) {
  await page.click('#btn-admin-drawer-open');
  await page.click('#btn-admin-logout');
  await expect(page.locator('#unified-identifier-input')).toBeVisible({ timeout: 10_000 });
}

async function logoutEmployee(page) {
  await page.click('#btn-real-employee-logout');
  await expect(page.locator('#unified-identifier-input')).toBeVisible({ timeout: 10_000 });
}

/** A real DISPATCHABLE request, created by the signed-in admin through the API wrapper (creation has no UI in this phase). */
async function createRequest(page, tag) {
  const created = await page.evaluate(async ({ type, target }) => {
    const result = await BackendOperationsApi.createServiceRequest({ service_type: type, target_identifier: target });
    return { status: result.status, id: result.ok ? result.data.id : null, state: result.ok ? result.data.status : null };
  }, { type: SERVICE_TYPE, target: tag });
  expect(created.status).toBe(201);
  expect(created.state).toBe('DISPATCHABLE');
  return created.id;
}

const myRequest = (page, id) => page.locator('.rops-myreq-row[data-request-id="' + id + '"]');
const offerRow = (page, requestId) => page.locator('.rops-offer-row[data-request-id="' + requestId + '"]');

/** The request as the BACKEND reports it (employee-visible: owner / assignee). */
async function backendRequest(page, id) {
  return page.evaluate(async (requestId) => {
    const result = await BackendOperationsApi.getServiceRequest(requestId);
    return result.ok ? { status: result.data.status, assigned: result.data.assigned_employee_party_id } : { error: result.status };
  }, id);
}

async function callApi(page, call, id) {
  return page.evaluate(async ({ name, arg }) => {
    const result = await BackendOperationsApi[name](arg);
    return { status: result.status, code: result.error ? result.error.code : null };
  }, { name: call, arg: id });
}

test.describe('REAL OPERATIONS V1 (phase 2) — Employee workflow, real backend', () => {
  test('happy path: dispatch -> offer -> claim (ASSIGNED) -> reload -> start (IN_PROGRESS) -> reload -> complete (COMPLETED) -> reload', async ({ page }) => {
    const suffix = String(Date.now());
    await page.goto('/');
    await completeLocalSetupGateIfShown(page);
    await loginWithRealBackend(page, ADMIN_LOGIN_IDENTIFIER, ADMIN_PASSWORD);
    const requestId = await createRequest(page, 'E2E-HAPPY-' + suffix);

    // The admin dispatches through the real UI; the backend chooses the employee.
    await page.click('#btn-admin-drawer-open');
    await page.click('.admin-nav-item[data-module-id="operationsBackend"]');
    const adminRow = page.locator('.rops-req-row[data-request-id="' + requestId + '"]');
    await expect(adminRow).toBeVisible({ timeout: 10_000 });
    await adminRow.locator('.rops-dispatch').click();
    await expect(adminRow).toHaveAttribute('data-status', 'OFFERED', { timeout: 10_000 });
    await logoutAdmin(page);

    // Employee A sees the PENDING offer.
    await loginEmployee(page, EMPLOYEE_A);
    const employeePartyId = (await page.locator('#rops-employee-party').innerText()).trim();
    const offer = offerRow(page, requestId);
    await expect(offer).toBeVisible({ timeout: 10_000 });
    await expect(offer.locator('.rops-offer-state')).toHaveText('PENDING');
    await expect(offer).toContainText('expires_at');
    await expect(offer).toContainText('offered_at');
    await expect(myRequest(page, requestId)).toHaveCount(0); // not mine yet

    // CLAIM: nothing changes before the backend answers; afterwards the request is ASSIGNED to this employee.
    await offer.locator('.rops-claim').click();
    await expect(page.locator('#rops-employee-notice')).toHaveAttribute('data-kind', 'success', { timeout: 10_000 });
    await expect(page.locator('#rops-employee-notice')).toContainText('ASSIGNED');
    await expect(myRequest(page, requestId)).toHaveAttribute('data-status', 'ASSIGNED', { timeout: 10_000 });
    await expect(offerRow(page, requestId)).toHaveCount(0, { timeout: 10_000 });
    expect(await backendRequest(page, requestId)).toEqual({ status: 'ASSIGNED', assigned: employeePartyId });
    // ASSIGNED offers Start only (no Complete, no Cancel).
    await expect(myRequest(page, requestId).locator('.rops-start')).toHaveCount(1);
    await expect(myRequest(page, requestId).locator('.rops-complete')).toHaveCount(0);

    // Reload: the state comes back from the backend.
    await page.reload();
    await expect(myRequest(page, requestId)).toHaveAttribute('data-status', 'ASSIGNED', { timeout: 15_000 });

    // START
    await myRequest(page, requestId).locator('.rops-start').click();
    await expect(myRequest(page, requestId)).toHaveAttribute('data-status', 'IN_PROGRESS', { timeout: 10_000 });
    await expect(page.locator('#rops-employee-notice')).toContainText('IN_PROGRESS');
    expect(await backendRequest(page, requestId)).toEqual({ status: 'IN_PROGRESS', assigned: employeePartyId });
    await expect(myRequest(page, requestId).locator('.rops-start')).toHaveCount(0);
    await expect(myRequest(page, requestId).locator('.rops-complete')).toHaveCount(1);
    await page.reload();
    await expect(myRequest(page, requestId)).toHaveAttribute('data-status', 'IN_PROGRESS', { timeout: 15_000 });

    // COMPLETE (the SPA does nothing financial; the request has no linked transaction here)
    await myRequest(page, requestId).locator('.rops-complete').click();
    // The backend's answer says COMPLETED. NOTE (contract): GET /operations/my/service-requests lists only ASSIGNED and
    // IN_PROGRESS requests, so a COMPLETED request leaves that list; its state is verified through the backend itself.
    await expect(page.locator('#rops-employee-notice')).toContainText('COMPLETED', { timeout: 10_000 });
    await expect(page.locator('#rops-employee-notice')).toHaveAttribute('data-kind', 'success');
    await expect(myRequest(page, requestId)).toHaveCount(0, { timeout: 10_000 });
    expect(await backendRequest(page, requestId)).toEqual({ status: 'COMPLETED', assigned: employeePartyId });
    await expect(page.locator('#rops-myreq-note')).toContainText('ASSIGNED');
    await page.reload();
    await expect(page.locator('#rops-employee-party')).toHaveText(employeePartyId, { timeout: 15_000 });
    await expect(page.locator('#rops-my-requests')).not.toContainText('جارٍ التحميل');
    await expect(myRequest(page, requestId)).toHaveCount(0); // not an active request any more...
    expect(await backendRequest(page, requestId)).toEqual({ status: 'COMPLETED', assigned: employeePartyId }); // ...and still COMPLETED on the backend after the reload
    expect(await callApi(page, 'startServiceRequest', requestId)).toEqual({ status: 409, code: 'CONFLICT' }); // nothing can move a COMPLETED request
  });

  test('errors: second claim 409, wrong employee claim/start/complete 403, start before claim 403, complete before start 409, start twice 409', async ({ page }) => {
    const suffix = String(Date.now());
    await page.goto('/');
    await completeLocalSetupGateIfShown(page);
    await loginWithRealBackend(page, ADMIN_LOGIN_IDENTIFIER, ADMIN_PASSWORD);
    const requestClaimed = await createRequest(page, 'E2E-ERR-A-' + suffix);
    const requestUnclaimed = await createRequest(page, 'E2E-ERR-B-' + suffix);
    for (const id of [requestClaimed, requestUnclaimed]) {
      const dispatched = await page.evaluate(async (requestId) => {
        const result = await BackendOperationsApi.dispatchServiceRequest(requestId);
        return { status: result.status, offered: result.ok ? result.data.offered : null };
      }, id);
      expect(dispatched).toEqual({ status: 200, offered: true });
    }
    await logoutAdmin(page);

    // Employee A: the two offers; claim the first through the UI.
    await loginEmployee(page, EMPLOYEE_A);
    await expect(offerRow(page, requestClaimed)).toBeVisible({ timeout: 10_000 });
    await expect(offerRow(page, requestUnclaimed)).toBeVisible({ timeout: 10_000 });
    const claimedOfferId = (await offerRow(page, requestClaimed).getAttribute('data-offer-id')) || '';
    const unclaimedOfferId = (await offerRow(page, requestUnclaimed).getAttribute('data-offer-id')) || '';
    await offerRow(page, requestClaimed).locator('.rops-claim').click();
    await expect(myRequest(page, requestClaimed)).toHaveAttribute('data-status', 'ASSIGNED', { timeout: 10_000 });

    // A) Second claim of the same offer: a real 409. The UI never treats it as success and refetches.
    expect(await callApi(page, 'claimOffer', claimedOfferId)).toEqual({ status: 409, code: 'CONFLICT' });
    await page.evaluate((offerId) => claimRealEmployeeOffer(offerId), claimedOfferId);
    await expect(page.locator('#rops-employee-notice')).toHaveAttribute('data-kind', 'error', { timeout: 10_000 });
    await expect(page.locator('#rops-employee-notice')).toContainText('تم استلامه أو تغيّرت حالة الطلب');
    await expect(myRequest(page, requestClaimed)).toHaveAttribute('data-status', 'ASSIGNED'); // the real current state

    // E) Start before claim: the request is unclaimed (no assignee), so the backend answers 403, not 409.
    expect(await callApi(page, 'startServiceRequest', requestUnclaimed)).toEqual({ status: 403, code: 'FORBIDDEN' });
    // F) Complete before start (assigned to A, still ASSIGNED): 409; and through the UI path.
    expect(await callApi(page, 'completeServiceRequest', requestClaimed)).toEqual({ status: 409, code: 'CONFLICT' });
    await page.evaluate((id) => completeRealEmployeeRequest(id), requestClaimed);
    await expect(page.locator('#rops-employee-notice')).toHaveAttribute('data-kind', 'error', { timeout: 10_000 });
    await expect(page.locator('#rops-employee-notice')).toContainText('تغيّرت حالة الطلب');
    // Start (UI), then start again: 409.
    await myRequest(page, requestClaimed).locator('.rops-start').click();
    await expect(myRequest(page, requestClaimed)).toHaveAttribute('data-status', 'IN_PROGRESS', { timeout: 10_000 });
    expect(await callApi(page, 'startServiceRequest', requestClaimed)).toEqual({ status: 409, code: 'CONFLICT' });
    await logoutEmployee(page);

    // Employee B (a different, real employee): everything of A's is refused with 403 — never 404, never hidden.
    await loginEmployee(page, EMPLOYEE_B);
    expect(await callApi(page, 'claimOffer', unclaimedOfferId)).toEqual({ status: 403, code: 'FORBIDDEN' }); // B) wrong employee claim
    await page.evaluate((offerId) => claimRealEmployeeOffer(offerId), unclaimedOfferId);
    await expect(page.locator('#rops-employee-notice')).toHaveAttribute('data-kind', 'error', { timeout: 10_000 });
    await expect(page.locator('#rops-employee-notice')).toContainText('ليس مخصصاً لهذا الموظف');
    expect(await callApi(page, 'startServiceRequest', requestClaimed)).toEqual({ status: 403, code: 'FORBIDDEN' }); // C) wrong employee start
    expect(await callApi(page, 'completeServiceRequest', requestClaimed)).toEqual({ status: 403, code: 'FORBIDDEN' }); // D) wrong employee complete
    await page.evaluate((id) => completeRealEmployeeRequest(id), requestClaimed);
    await expect(page.locator('#rops-employee-notice')).toContainText('غير مسند إلى هذا الموظف', { timeout: 10_000 });
    await expect(page.locator('.rops-myreq-row')).toHaveCount(0); // B has nothing assigned and sees nothing of A's
    await logoutEmployee(page);

    // A finishes the request that was refused to B, and the unclaimed one is untouched by the refused calls.
    await loginEmployee(page, EMPLOYEE_A);
    await expect(myRequest(page, requestClaimed)).toHaveAttribute('data-status', 'IN_PROGRESS', { timeout: 10_000 });
    await myRequest(page, requestClaimed).locator('.rops-complete').click();
    await expect(page.locator('#rops-employee-notice')).toContainText('COMPLETED', { timeout: 10_000 });
    await expect(myRequest(page, requestClaimed)).toHaveCount(0, { timeout: 10_000 }); // COMPLETED requests leave the active list
    expect(await backendRequest(page, requestClaimed)).toMatchObject({ status: 'COMPLETED' });
    await expect(offerRow(page, requestUnclaimed)).toBeVisible(); // still PENDING for A
    expect(await callApi(page, 'completeServiceRequest', requestClaimed)).toEqual({ status: 409, code: 'CONFLICT' }); // already COMPLETED
  });
});
