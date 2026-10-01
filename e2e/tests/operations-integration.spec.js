// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * REAL OPERATIONS V1 — PHASE 1 — real browser, real backend, real PostgreSQL.
 *
 * Backend: the real, unmodified application started by e2e/e2e-main.mts (which also seeds an EMPLOYEE
 * identity through the backend repositories: no HTTP route creates one). Nothing is faked.
 *
 * Covers: admin login -> "العمليات — النظام الفعلي" -> requests (scope=all), employees, groups loaded from the
 * backend -> employee operational profile CRUD/archive (and a real 400) -> group + member management ->
 * Dispatch on a DISPATCHABLE request (the backend picks the employee; request becomes OFFERED) -> a second
 * dispatch is a real 409 shown honestly -> Cancel through the confirm box (CANCELLED) -> logout -> the Employee
 * logs in with NO role and lands on the real Employee Workspace (not My Wallet) -> sees the offer made by the
 * backend, changes availability (backend answer) -> reload stays on the workspace -> a genuine 403 on admin routes.
 *
 * NOT covered (later phases): claim/start/complete UI, transaction-linked completion/cancellation, settlement.
 */

const ADMIN_LOGIN_IDENTIFIER = 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password-1';
const EMPLOYEE_LOGIN = 'e2e-employee';
const EMPLOYEE_PASSWORD = 'e2e-employee-password-1';
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

const requestRow = (page, id) => page.locator('.rops-req-row[data-request-id="' + id + '"]');

test.describe('REAL OPERATIONS V1 (phase 1) — real backend', () => {
  test('admin real operations (requests/employees/groups/dispatch/cancel/409) + employee detection and workspace foundation + 403', async ({ page }) => {
    const suffix = String(Date.now());
    await page.goto('/');
    await completeLocalSetupGateIfShown(page);
    await loginWithRealBackend(page, ADMIN_LOGIN_IDENTIFIER, ADMIN_PASSWORD);

    // Two real DISPATCHABLE requests (created through the real API wrapper; creating requests has no UI in this phase).
    const created = await page.evaluate(async ({ type, tag }) => {
      const out = [];
      for (const n of ['A', 'B']) {
        const result = await BackendOperationsApi.createServiceRequest({ service_type: type, target_identifier: 'E2E-' + tag + '-' + n });
        out.push({ status: result.status, id: result.ok ? result.data.id : null, state: result.ok ? result.data.status : null });
      }
      return out;
    }, { type: SERVICE_TYPE, tag: suffix });
    expect(created.map((c) => c.status)).toEqual([201, 201]);
    expect(created.map((c) => c.state)).toEqual(['DISPATCHABLE', 'DISPATCHABLE']);
    const [requestA, requestB] = created.map((c) => c.id);

    // 1) The real module, separate from the local mock "العمليات".
    await page.click('#btn-admin-drawer-open');
    await page.click('.admin-nav-item[data-module-id="operationsBackend"]');
    await expect(page.locator('#rops-panel')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#rops-real-note')).toContainText('منفصلة عن وحدة');
    await expect(requestRow(page, requestA)).toBeVisible({ timeout: 10_000 });
    // Status is the backend value verbatim; actions follow the state.
    await expect(requestRow(page, requestA)).toHaveAttribute('data-status', 'DISPATCHABLE');
    await expect(requestRow(page, requestA).locator('.rops-dispatch')).toHaveCount(1);
    await expect(requestRow(page, requestA).locator('.rops-cancel')).toHaveCount(1);
    await expect(requestRow(page, requestA)).toContainText('service_type: ' + SERVICE_TYPE);
    // Detail comes from GET /:id.
    await requestRow(page, requestA).locator('.rops-open').click();
    await expect(page.locator('#rops-detail')).toHaveAttribute('data-request-id', requestA);
    await expect(page.locator('#rops-detail')).toContainText('E2E-' + suffix + '-A');
    await page.click('#btn-rops-detail-close');

    // 2) Employee operational profiles (NOT employee accounts) and a real 400.
    await page.click('.rops-tab[data-tab="employees"]');
    const employeeRow = page.locator('.rops-emp-row', { hasText: SERVICE_TYPE });
    await expect(employeeRow.first()).toBeVisible({ timeout: 10_000 });
    const employeePartyId = (await employeeRow.first().getAttribute('data-party-id')) || '';
    expect(employeePartyId).toMatch(/^[0-9a-f-]{36}$/);
    await expect(page.locator('#btn-rops-emp-add')).toContainText('إضافة ملف تشغيلي');
    // The admin's own party is not an EMPLOYEE: the backend refuses and the message is shown.
    const adminPartyId = await page.evaluate(async () => (await BackendAuthApi.me()).data.party_id);
    await page.click('#btn-rops-emp-add');
    await expect(page.locator('#rops-emp-form')).toContainText('لا ينشئ هذا الإجراء حساب موظف');
    await page.fill('#rops-emp-party-id', adminPartyId);
    await page.fill('#rops-emp-types', SERVICE_TYPE);
    await page.click('#btn-rops-emp-save');
    await expect(page.locator('#rops-emp-form-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#rops-emp-form-error')).toContainText('بيانات غير صالحة');
    await page.click('#btn-rops-emp-cancel');
    // Edit (backend persists), then archive / unarchive (and restore).
    await employeeRow.first().locator('.rops-emp-edit').click();
    await expect(page.locator('#rops-emp-party-readonly')).toHaveText(employeePartyId);
    await page.fill('#rops-emp-max', '999');
    await page.click('#btn-rops-emp-save');
    await expect(page.locator('.rops-emp-row[data-party-id="' + employeePartyId + '"]')).toContainText('999', { timeout: 10_000 });
    await page.locator('.rops-emp-row[data-party-id="' + employeePartyId + '"] .rops-emp-edit').click();
    await page.fill('#rops-emp-max', '1000');
    await page.click('#btn-rops-emp-save');
    await expect(page.locator('.rops-emp-row[data-party-id="' + employeePartyId + '"]')).toContainText('1000', { timeout: 10_000 });
    await page.locator('.rops-emp-row[data-party-id="' + employeePartyId + '"] .rops-emp-archive').click();
    await expect(page.locator('.rops-emp-row[data-party-id="' + employeePartyId + '"]')).toHaveAttribute('data-archived', 'true', { timeout: 10_000 });
    await page.locator('.rops-emp-row[data-party-id="' + employeePartyId + '"] .rops-emp-unarchive').click();
    await expect(page.locator('.rops-emp-row[data-party-id="' + employeePartyId + '"]')).toHaveAttribute('data-archived', 'false', { timeout: 10_000 });

    // 3) Groups: create, add and remove a member (party_id only: the backend returns no names).
    await page.click('.rops-tab[data-tab="groups"]');
    await expect(page.locator('#rops-member-form')).toBeVisible({ timeout: 10_000 });
    const groupName = 'E2E Group ' + suffix;
    await page.fill('#rops-group-name', groupName);
    await page.click('#btn-rops-group-save');
    const groupRow = page.locator('.rops-group-row', { hasText: groupName });
    await expect(groupRow).toBeVisible({ timeout: 10_000 });
    const groupId = (await groupRow.getAttribute('data-group-id')) || '';
    await page.selectOption('#rops-member-group', groupId);
    await page.fill('#rops-member-party', employeePartyId);
    await page.click('#btn-rops-member-add');
    await expect(page.locator('#rops-group-notice')).toContainText('تمت إضافة العضو', { timeout: 10_000 });
    await page.click('#btn-rops-member-remove');
    await expect(page.locator('#rops-group-notice')).toContainText('تمت إزالة العضو', { timeout: 10_000 });

    // 4) Dispatch (the backend chooses the employee): OFFERED. A second dispatch is a REAL 409, never hidden.
    await page.click('.rops-tab[data-tab="requests"]');
    await expect(requestRow(page, requestA)).toBeVisible({ timeout: 10_000 });
    await requestRow(page, requestA).locator('.rops-dispatch').click();
    await expect(page.locator('#rops-notice')).toContainText('تم عرض الطلب على موظف مؤهل', { timeout: 10_000 });
    await expect(requestRow(page, requestA)).toHaveAttribute('data-status', 'OFFERED', { timeout: 10_000 });
    await expect(requestRow(page, requestA).locator('.rops-dispatch')).toHaveCount(0);
    expect(await page.evaluate(async (id) => (await BackendOperationsApi.getServiceRequest(id)).data.status, requestA)).toBe('OFFERED');
    const conflict = await page.evaluate(async (id) => {
      const result = await BackendOperationsApi.dispatchServiceRequest(id);
      return { status: result.status, code: result.error && result.error.code };
    }, requestA);
    expect(conflict).toEqual({ status: 409, code: 'CONFLICT' });
    await page.evaluate((id) => dispatchRealOpsRequest(id), requestA); // the same conflict through the UI path
    await expect(page.locator('#rops-notice')).toContainText('تغيّرت حالة العنصر أو حدث تعارض', { timeout: 10_000 });

    // 5) Cancel through the confirm box (the owner/admin path): CANCELLED, from the backend.
    await requestRow(page, requestB).locator('.rops-cancel').click();
    await expect(page.locator('#rops-cancel-box')).toBeVisible({ timeout: 10_000 });
    await page.fill('#rops-cancel-reason', 'e2e cancel ' + suffix);
    await page.click('#btn-rops-cancel-confirm');
    await expect(requestRow(page, requestB)).toHaveAttribute('data-status', 'CANCELLED', { timeout: 10_000 });
    await expect(requestRow(page, requestB).locator('.rops-cancel')).toHaveCount(0);
    const recancel = await page.evaluate(async (id) => {
      const result = await BackendOperationsApi.cancelServiceRequest(id, null);
      return { status: result.status, code: result.error && result.error.code };
    }, requestB);
    expect(recancel).toEqual({ status: 409, code: 'CONFLICT' });

    // 6) The Employee: a role-less identity with an operational profile reaches the real Employee Workspace.
    await page.click('#btn-admin-drawer-open');
    await page.click('#btn-admin-logout');
    await expect(page.locator('#unified-identifier-input')).toBeVisible({ timeout: 10_000 });
    await loginWithRealBackend(page, EMPLOYEE_LOGIN, EMPLOYEE_PASSWORD);
    await expect.poll(() => page.evaluate(() => state.app.currentScreen)).toBe('realEmployeeWorkspace');
    expect(await page.evaluate(() => state.session.role)).toBe('employeeBackend');
    await expect(page.locator('#rops-employee-party')).toHaveText(employeePartyId);
    await expect(page.locator('#rops-availability')).toHaveAttribute('data-availability', 'ONLINE');
    // The offer the backend made (no local dispatch, no local timer).
    await expect(page.locator('.rops-offer-row', { hasText: requestA })).toBeVisible({ timeout: 10_000 });
    // Availability is the backend's own answer.
    await page.click('.rops-availability[data-availability="OFFLINE"]');
    await expect(page.locator('#rops-availability')).toHaveAttribute('data-availability', 'OFFLINE', { timeout: 10_000 });
    await page.click('.rops-availability[data-availability="ONLINE"]');
    await expect(page.locator('#rops-availability')).toHaveAttribute('data-availability', 'ONLINE', { timeout: 10_000 });

    // 7) Reload: the identity is asked again and the Employee Workspace is restored.
    await page.reload();
    await expect(page.locator('#rops-employee-party')).toHaveText(employeePartyId, { timeout: 15_000 });
    expect(await page.evaluate(() => state.app.currentScreen)).toBe('realEmployeeWorkspace');
    await expect(page.locator('.rops-offer-row', { hasText: requestA })).toBeVisible({ timeout: 10_000 });

    // 8) A genuine 403: the employee holds no operation:* permission.
    const forbidden = await page.evaluate(async () => {
      const list = await BackendOperationsApi.listServiceRequests('all');
      const employees = await BackendOperationsApi.listEmployees();
      return { listStatus: list.status, employeesStatus: employees.status, message: describeRealOperationsError(list) };
    });
    expect(forbidden.listStatus).toBe(403);
    expect(forbidden.employeesStatus).toBe(403);
    expect(forbidden.message).toContain('لا تملك صلاحية');
  });
});
