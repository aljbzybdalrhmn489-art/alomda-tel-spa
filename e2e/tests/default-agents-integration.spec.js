// @ts-check
const { test, expect } = require('@playwright/test');
const { queryOne } = require('./db-evidence');

/**
 * DEFAULT AGENT ADMIN (real backend) — real browser, real backend, real PostgreSQL (same webServer array as every other
 * spec). DA-UI-1…10: the admin opens the screen, finds a customer / POS by id, sees its default agent, assigns, changes
 * (the backend closes the old window and opens the new one), unassigns, reads the history, is refused with 403 when the
 * token has no permission, is warned about an inactive agent (and the SPA changes nothing by itself), and the transaction
 * screen offers no agent selector and sends no agent field. The customers / POS are seeded by e2e-main.mts (no HTTP route
 * creates one); they are found by account-number prefix, newest first (read-only SQL).
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

async function openModule(page, moduleId, readySelector) {
  await page.click('#btn-admin-drawer-open');
  await page.click('.admin-nav-item[data-module-id="' + moduleId + '"]');
  await expect(page.locator(readySelector)).toBeVisible({ timeout: 10_000 });
}

/** A seeded customer / POS (newest set), by account-number tag. */
async function seededPartyId(tag) {
  const row = await queryOne("SELECT id FROM parties WHERE account_number LIKE $1 ORDER BY created_at DESC LIMIT 1", ['E2E-DA-' + tag + '-%']);
  expect(row, 'DATABASE_URL_TEST must be set and e2e-main.mts must have seeded the E2E-DA-' + tag + ' party').toBeTruthy();
  return String(row.id);
}

/** A real, ACTIVE agent created through the real Agents API. */
async function createActiveAgent(page, label, suffix) {
  return page.evaluate(async ({ label, suffix }) => {
    const created = await BackendAgentApi.create({
      party_type: 'AGENT', account_number: 'DA-' + label + '-' + suffix, display_name: 'E2E DA Agent ' + label + ' ' + suffix, phone: '7' + label.charCodeAt(0) + suffix.slice(-7),
      zone_code: 'SOUTH', login_identifier: 'e2e-da-' + label + '-' + suffix, password: 'e2e-da-password-' + suffix,
    });
    if (!created.ok) return { ok: false, step: 'create', status: created.status, error: created.error };
    const activated = await BackendAgentApi.activate(created.data.id);
    return { ok: activated.ok, id: created.data.id, name: created.data.display_name, login: 'e2e-da-' + label + '-' + suffix, password: 'e2e-da-password-' + suffix };
  }, { label, suffix });
}

async function lookup(page, partyId) {
  await page.fill('#dag-party-id', partyId);
  await page.click('#btn-dag-lookup');
}

const backendCurrent = (page, partyId) => page.evaluate(async (id) => { const r = await BackendDefaultAgentApi.current(id); return r.ok ? r.data : { status: r.status, code: r.error && r.error.code }; }, partyId);
const backendHistory = (page, partyId) => page.evaluate(async (id) => { const r = await BackendDefaultAgentApi.history(id); return r.ok ? r.data : null; }, partyId);

test.describe('Default Agent Admin — real backend', () => {
  test('DA-UI-1…10: open -> find -> none -> assign -> current -> change -> scheduled -> unassign -> history -> by-agent -> errors -> inactive warning -> no override -> 403 -> 401', async ({ page }) => {
    const suffix = String(Date.now());
    const c1 = await seededPartyId('C1');
    const c2 = await seededPartyId('C2');
    const c3 = await seededPartyId('C3');
    const p1 = await seededPartyId('P1');

    await page.goto('/');
    await completeLocalSetupGateIfShown(page);
    await loginWithRealBackend(page, ADMIN_LOGIN_IDENTIFIER, ADMIN_PASSWORD);

    const agentA = await createActiveAgent(page, 'A', suffix);
    const agentB = await createActiveAgent(page, 'B', suffix);
    const agentX = await createActiveAgent(page, 'X', suffix);
    expect([agentA.ok, agentB.ok, agentX.ok]).toEqual([true, true, true]);

    // DA-UI-1) The admin opens the Default Agent screen (a real-system module; the local customers module points to it).
    await page.click('#btn-admin-drawer-open');
    await expect(page.locator('.admin-nav-item[data-module-id="defaultAgentsBackend"]')).toContainText('النظام الفعلي');
    await page.click('.admin-nav-item[data-module-id="defaultAgentsBackend"]');
    await expect(page.locator('#dag-intro')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#dag-intro')).toContainText('الإدارة فقط');
    await expect(page.locator('#admin-legacy-local-banner')).toHaveCount(0);

    // DA-UI-2) A customer and a POS are found by id; neither has a default agent yet, and the screen says what that means.
    await lookup(page, c1);
    await expect(page.locator('#dag-none')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#dag-none')).toHaveAttribute('data-party-id', c1);
    await expect(page.locator('#dag-none')).toContainText('NO_DIRECT_AGENT');
    await expect(page.locator('#dag-history-empty')).toBeVisible();
    await lookup(page, p1);
    await expect(page.locator('#dag-none')).toHaveAttribute('data-party-id', p1, { timeout: 10_000 });

    // DA-UI-4) Assign agent A to the customer (the backend decides; the SPA only sends the request).
    await lookup(page, c1);
    await expect(page.locator('#btn-dag-assign')).toBeVisible({ timeout: 10_000 });
    await page.click('#btn-dag-assign');
    await expect(page.locator('#dag-form-party')).toHaveText(c1);
    // Only ACTIVE agents are offered, and no customer / POS id is ever an option.
    const optionValues = await page.locator('#dag-form-agent option').evaluateAll((els) => els.map((e) => e.getAttribute('value')));
    expect(optionValues).toContain(agentA.id);
    expect(optionValues).toContain(agentB.id);
    for (const nonAgent of [c1, c2, c3, p1]) expect(optionValues).not.toContain(nonAgent);
    // Saving without choosing an agent is refused in the form (and nothing was sent).
    await page.click('#btn-dag-assign-save');
    await expect(page.locator('#dag-assign-error')).toContainText('اختر الوكيل');
    expect(await backendHistory(page, c1)).toEqual([]);
    await page.selectOption('#dag-form-agent', agentA.id);
    await page.fill('#dag-form-reason', 'e2e first assignment');
    const assignRequest = page.waitForRequest((req) => req.method() === 'POST' && req.url().endsWith('/api/v1/admin/parties/' + c1 + '/default-agent'));
    await page.click('#btn-dag-assign-save');
    const sent = JSON.parse((await assignRequest).postData() || '{}');
    expect(Object.keys(sent).sort()).toEqual(['agent_id', 'reason']); // no window is computed by the SPA
    expect(sent).toMatchObject({ agent_id: agentA.id, reason: 'e2e first assignment' });

    // DA-UI-3) The current default agent is shown with its real status, since-date and reason.
    await expect(page.locator('#dag-success')).toBeVisible({ timeout: 10_000 });
    const current = page.locator('#dag-current');
    await expect(current).toHaveAttribute('data-agent-id', agentA.id);
    await expect(current.locator('.dag-current-agent')).toContainText(agentA.name);
    await expect(current.locator('.dag-current-status')).toHaveAttribute('data-status', 'ACTIVE');
    await expect(current.locator('.dag-current-reason')).toContainText('e2e first assignment');
    await expect(page.locator('#dag-inactive-warning')).toHaveCount(0);
    expect(await backendCurrent(page, c1)).toMatchObject({ party_id: c1, agent_id: agentA.id, valid_to: null });
    // The hierarchy was never used: the customer still has no parent.
    const parentRow = await queryOne('SELECT parent_id FROM parties WHERE id = $1', [c1]);
    if (parentRow !== undefined) expect(parentRow.parent_id).toBeNull();

    // DA-UI-5) Change to agent B: the previous agent is not offered again, and the BACKEND closes the old window / opens the new one.
    await page.click('#btn-dag-change');
    await expect(page.locator('#dag-form-current-agent')).toContainText(agentA.name);
    const changeOptions = await page.locator('#dag-form-agent option').evaluateAll((els) => els.map((e) => e.getAttribute('value')));
    expect(changeOptions).not.toContain(agentA.id);
    expect(changeOptions).toContain(agentB.id);
    await page.selectOption('#dag-form-agent', agentB.id);
    await page.fill('#dag-form-reason', 'e2e moved to B');
    await page.waitForTimeout(50); // the new window must start after the first one
    await page.click('#btn-dag-assign-save');
    await expect(page.locator('#dag-current')).toHaveAttribute('data-agent-id', agentB.id, { timeout: 10_000 });
    await expect(page.locator('#dag-success')).toContainText('تغيير');
    const afterChange = await backendHistory(page, c1);
    expect(afterChange).toHaveLength(2);
    const [newest, oldest] = afterChange;
    expect(newest).toMatchObject({ agent_id: agentB.id, valid_to: null });
    expect(oldest).toMatchObject({ agent_id: agentA.id });
    expect(oldest.valid_to).toBe(newest.valid_from); // closed exactly when the next one opened

    // DA-UI-7) History: every window with agent / from / to / reason / state; read-only (no edit control inside it).
    const rows = page.locator('.dag-history-row');
    await expect(rows).toHaveCount(2);
    await expect(page.locator('.dag-history-row[data-state="expired"]')).toHaveCount(1);
    await expect(page.locator('.dag-history-row[data-state="current"]')).toHaveCount(1);
    await expect(page.locator('.dag-history-row[data-state="expired"] .dag-history-agent')).toContainText(agentA.name);
    await expect(page.locator('.dag-history-row[data-state="current"] .dag-history-reason')).toContainText('e2e moved to B');
    await expect(page.locator('.dag-history-row[data-state="expired"] .dag-history-to')).not.toHaveText('—');
    await expect(page.locator('#dag-history button, #dag-history input, #dag-history select')).toHaveCount(0);

    // DA-UI-6) Unassign (with confirmation): the OPEN window is closed, nothing is deleted.
    await page.click('#btn-dag-unassign');
    await expect(page.locator('#dag-unassign-confirm')).toBeVisible();
    await expect(page.locator('#dag-unassign-confirm')).toContainText('لا يُحذف');
    await page.click('#btn-dag-unassign-cancel');
    expect(await backendCurrent(page, c1)).toMatchObject({ agent_id: agentB.id }); // cancelling changed nothing
    await page.click('#btn-dag-unassign');
    await page.fill('#dag-unassign-reason', 'e2e left');
    await page.waitForTimeout(50);
    await page.click('#btn-dag-unassign-save');
    await expect(page.locator('#dag-success')).toContainText('إلغاء التعيين', { timeout: 10_000 });
    await expect(page.locator('#dag-none')).toBeVisible();
    await expect(page.locator('#dag-current')).toHaveCount(0);
    expect(await backendCurrent(page, c1)).toMatchObject({ status: 404 });
    const afterUnassign = await backendHistory(page, c1);
    expect(afterUnassign.length).toBe(2); // history kept
    expect(afterUnassign.filter((w) => w.valid_to === null)).toHaveLength(0);

    // By agent: the parties currently assigned to an agent, and a jump to one of them.
    await lookup(page, c2);
    await expect(page.locator('#dag-none')).toHaveAttribute('data-party-id', c2, { timeout: 10_000 });
    await page.click('#btn-dag-assign');
    await page.selectOption('#dag-form-agent', agentB.id);
    await page.click('#btn-dag-assign-save');
    await expect(page.locator('#dag-current')).toHaveAttribute('data-agent-id', agentB.id, { timeout: 10_000 });
    await page.click('.dag-tab[data-tab-id="agent"]');
    await page.selectOption('#dag-agent-select', agentB.id);
    await expect(page.locator('.dag-assigned-row[data-party-id="' + c2 + '"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.dag-assigned-row[data-party-id="' + c1 + '"]')).toHaveCount(0); // unassigned earlier
    await page.click('.dag-assigned-row[data-party-id="' + c2 + '"] .dag-open-party');
    await expect(page.locator('#dag-current')).toHaveAttribute('data-party-id', c2, { timeout: 10_000 });

    // DA-UI-5b) A future-dated change is only SCHEDULED: the current agent stays B until the planned instant.
    await page.click('#btn-dag-change');
    await page.selectOption('#dag-form-agent', agentA.id);
    const future = new Date(Date.now() + 2 * 3600_000);
    const pad = (n) => String(n).padStart(2, '0');
    await page.fill('#dag-form-valid-from', future.getFullYear() + '-' + pad(future.getMonth() + 1) + '-' + pad(future.getDate()) + 'T' + pad(future.getHours()) + ':' + pad(future.getMinutes()));
    await page.click('#btn-dag-assign-save');
    await expect(page.locator('.dag-history-row[data-state="scheduled"]')).toHaveCount(1, { timeout: 10_000 });
    await expect(page.locator('#dag-current')).toHaveAttribute('data-agent-id', agentB.id);
    expect(await backendCurrent(page, c2)).toMatchObject({ agent_id: agentB.id });
    // While a future window is open the backend refuses an unassign (its end would precede its start): shown, nothing changed.
    await page.click('#btn-dag-unassign');
    await page.click('#btn-dag-unassign-save');
    await expect(page.locator('#dag-unassign-error')).toContainText('بيانات غير صالحة', { timeout: 10_000 });
    await page.click('#btn-dag-unassign-cancel');
    expect(await backendCurrent(page, c2)).toMatchObject({ agent_id: agentB.id });
    expect((await backendHistory(page, c2)).length).toBe(2);

    // DA-UI-9) Inactive agent: only a WARNING (the SPA never reassigns); the backend keeps the assignment as it was.
    await lookup(page, c3);
    await expect(page.locator('#dag-none')).toHaveAttribute('data-party-id', c3, { timeout: 10_000 });
    await page.click('#btn-dag-assign');
    await page.selectOption('#dag-form-agent', agentX.id);
    await page.click('#btn-dag-assign-save');
    await expect(page.locator('#dag-current')).toHaveAttribute('data-agent-id', agentX.id, { timeout: 10_000 });
    await expect(page.locator('#dag-inactive-warning')).toHaveCount(0);
    const deactivated = await page.evaluate(async (id) => (await BackendAgentApi.deactivate(id)).ok, agentX.id);
    expect(deactivated).toBe(true);
    await lookup(page, c3);
    await expect(page.locator('#dag-inactive-warning')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#dag-inactive-warning')).toContainText('NO_DIRECT_AGENT');
    await expect(page.locator('#dag-current .dag-current-status')).not.toHaveAttribute('data-status', 'ACTIVE');
    expect(await backendCurrent(page, c3)).toMatchObject({ agent_id: agentX.id, valid_to: null }); // untouched
    // The deactivated agent is no longer offered for a NEW assignment.
    await page.click('#btn-dag-change');
    expect(await page.locator('#dag-form-agent option').evaluateAll((els) => els.map((e) => e.getAttribute('value')))).not.toContain(agentX.id);
    await page.click('#btn-dag-assign-cancel');

    // Error mapping: 400 (not a customer / POS), 404 (unknown), 409 (already assigned to this agent), bad id in the form.
    await lookup(page, agentA.id);
    await expect(page.locator('#dag-lookup-error')).toContainText('بيانات غير صالحة', { timeout: 10_000 });
    await lookup(page, '0192e2e0-ffff-7000-8000-00000000dead');
    await expect(page.locator('#dag-lookup-error')).toContainText('غير موجود', { timeout: 10_000 });
    await lookup(page, 'not-a-uuid');
    await expect(page.locator('#dag-lookup-error')).toContainText('UUID');
    const conflict = await page.evaluate(async ({ party, agent }) => {
      const first = await BackendDefaultAgentApi.assign(party, { agent_id: agent });
      await new Promise((resolve) => setTimeout(resolve, 50));
      const r = await BackendDefaultAgentApi.assign(party, { agent_id: agent }); // already assigned to this very agent
      return { first: first.status, status: r.status, message: describeAdminApiError(r) };
    }, { party: c1, agent: agentA.id });
    expect(conflict.first).toBe(201);
    expect(conflict.status).toBe(409);
    expect(conflict.message).toContain('تعارض');

    // DA-UI-10) The transaction screen has no agent selector and the request carries no agent field.
    await page.click('#btn-admin-drawer-open');
    await page.click('.admin-nav-item[data-module-id="transactionsBackend"]');
    await expect(page.locator('#rtx-catalog-service')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#rtx-form input[id*="agent"], #rtx-form select[id*="agent"], #rtx-form [name*="agent"]')).toHaveCount(0);
    await page.selectOption('#rtx-catalog-service', 'e2e-tx-manual');
    await page.selectOption('#rtx-catalog-package', 'e2e-pkg-cheap');
    const txRequest = page.waitForRequest((req) => req.method() === 'POST' && new URL(req.url()).pathname === '/api/v1/transactions');
    await page.click('#btn-rtx-submit');
    const txBody = JSON.parse((await txRequest).postData() || '{}');
    expect(Object.keys(txBody).sort()).toEqual(['form_values', 'package_id', 'service_id', 'target_identifier']);
    for (const forbidden of ['agent_id', 'agent_party_id', 'default_agent_id', 'executing_agent_id']) expect(Object.keys(txBody)).not.toContain(forbidden);
    // …and the backend refuses a request that names an agent (the SPA cannot even produce one).
    const refused = await page.evaluate(async () => {
      const r = await ApiClient.post('/api/v1/transactions', { service_id: 'e2e-tx-manual', package_id: 'e2e-pkg-cheap', agent_id: '0192e2e0-ffff-7000-8000-00000000dead' }, { headers: { 'Idempotency-Key': generateIdempotencyKey() } });
      return { status: r.status, code: r.error && r.error.code };
    });
    expect(refused).toEqual({ status: 400, code: 'VALIDATION_ERROR' });

    // DA-UI-8) 403: a token without party_agent_assignment:* is told so (the backend decides), reads AND writes are refused.
    const agentToken = await page.evaluate(async ({ base, login, password }) => {
      const response = await fetch(base + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login_identifier: login, password }) });
      const body = await response.json();
      return body.data ? body.data.access_token : null;
    }, { base: API_BASE_URL, login: agentB.login, password: agentB.password });
    expect(agentToken).toBeTruthy();
    await page.click('#btn-admin-drawer-open');
    await page.click('.admin-nav-item[data-module-id="defaultAgentsBackend"]');
    await expect(page.locator('#dag-intro')).toBeVisible({ timeout: 10_000 });
    const adminToken = await page.evaluate(() => state.session.accessToken);
    await page.evaluate((token) => { state.session.accessToken = token; }, agentToken);
    await page.evaluate((id) => lookupDefaultAgentParty(id), c2);
    await expect(page.locator('#dag-lookup-error')).toContainText('لا تملك صلاحية', { timeout: 10_000 });
    const forbiddenWrite = await page.evaluate(async ({ party, agent }) => {
      const r = await BackendDefaultAgentApi.assign(party, { agent_id: agent });
      const u = await BackendDefaultAgentApi.unassign(party, {});
      return { assign: r.status, unassign: u.status, message: describeAdminApiError(r) };
    }, { party: c2, agent: agentA.id });
    expect(forbiddenWrite).toMatchObject({ assign: 403, unassign: 403 });
    expect(forbiddenWrite.message).toContain('لا تملك صلاحية');
    await page.evaluate((token) => { state.session.accessToken = token; }, adminToken);
    expect(await backendCurrent(page, c2)).toMatchObject({ agent_id: agentB.id }); // the refused calls changed nothing

    // 401: an invalid token sends the user back to sign-in with no stale agent data.
    await page.evaluate(() => { state.session.accessToken = 'invalid-token'; });
    await page.evaluate((id) => lookupDefaultAgentParty(id), c2);
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 10_000 });
    expect(await page.evaluate(() => state.session.accessToken)).toBeFalsy();
  });
});
