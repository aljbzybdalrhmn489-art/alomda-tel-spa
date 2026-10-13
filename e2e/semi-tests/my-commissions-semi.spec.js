// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * My Commissions — SPA ⇄ REAL HTTP routes/service (in-memory reader, no database). See ../semi-integrated-server.mts.
 * Seed (current UTC month): Agent A = YER accrued 30+50+20, YER expected 40, SAR accrued 0.16+0.13; Agent B = YER accrued 999777.
 */
const API = 'http://127.0.0.1:4000';

async function loginAs(page, identifier) {
  await page.goto('/production');
  await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 15_000 });
  await page.fill('#unified-identifier-input', identifier);
  await page.fill('#unified-password-input', 'semi-password-not-a-secret');
  await page.click('#btn-unified-login');
  await expect(page.locator('#my-commissions-panel')).toBeVisible({ timeout: 15_000 });
}

test.describe('My Commissions — SPA against the real report routes (in-memory data)', () => {
  test('SI-1: Agent A sees exact per-currency totals computed by the real service; Agent B\'s amount never appears', async ({ page }) => {
    await loginAs(page, '700000001');
    const yer = page.locator('.my-comm-total[data-currency="YER"]');
    await expect(yer.locator('.my-comm-total-accrued')).toHaveText('100.0000');
    await expect(yer.locator('.my-comm-total-expected')).toHaveText('40.0000');
    await expect(page.locator('.my-comm-total[data-currency="SAR"] .my-comm-total-accrued')).toHaveText('0.2900');
    await expect(page.locator('#my-commissions-panel')).not.toContainText('999777');
    await expect(page.locator('#my-comm-note')).toContainText('not implemented');
  });

  test('SI-2: drilling into the YER bucket lists the agent\'s own facts (accrued and expected) from the real items route', async ({ page }) => {
    await loginAs(page, '700000001');
    await page.locator('.my-comm-bucket[data-currency="YER"]').first().click();
    await expect(page.locator('.my-comm-item')).toHaveCount(4);
    await expect(page.locator('.my-comm-item .my-comm-status[data-status="EXPECTED"]')).toHaveCount(1);
    await expect(page.locator('#my-commissions-panel')).not.toContainText('999777');
  });

  test('SI-3: Agent B (another login) sees only their own amount and none of Agent A\'s', async ({ page }) => {
    await loginAs(page, '700000002');
    await expect(page.locator('.my-comm-total[data-currency="YER"] .my-comm-total-accrued')).toHaveText('999777.0000');
    await expect(page.locator('.my-comm-total[data-currency="SAR"]')).toHaveCount(0);
  });

  test('SI-4: a customer party (not an agent) is refused by the real route and the panel shows the error instead of any figures', async ({ page }) => {
    await loginAs(page, '700000003');
    await expect(page.locator('#my-comm-error')).toBeVisible();
    await expect(page.locator('.my-comm-total')).toHaveCount(0);
  });

  test('SI-6: logging out and signing in as another agent on the SAME page shows nothing of the previous agent (DOM, state and storage)', async ({ page }) => {
    await loginAs(page, '700000001');
    await expect(page.locator('.my-comm-total[data-currency="YER"] .my-comm-total-accrued')).toHaveText('100.0000');
    await page.locator('.my-comm-bucket[data-currency="YER"]').first().click();
    await expect(page.locator('.my-comm-item')).toHaveCount(4);
    await page.click('#btn-my-wallet-logout');
    await expect(page.locator('#btn-unified-login')).toBeVisible();
    const afterLogout = await page.evaluate(() => ({ html: document.body.innerText, s: JSON.stringify({ c: state.session.myCommissions && state.session.myCommissions.summary, d: state.session.myCommissions && state.session.myCommissions.drill && state.session.myCommissions.drill.items }), storage: JSON.stringify(Object.assign({}, window.localStorage)) }));
    expect(afterLogout.html).not.toContain('100.0000');
    expect(afterLogout.s).toBe('{"c":null,"d":[]}');
    expect(afterLogout.storage).not.toContain('100.0000');

    await page.fill('#unified-identifier-input', '700000002');
    await page.fill('#unified-password-input', 'semi-password-not-a-secret');
    await page.click('#btn-unified-login');
    await expect(page.locator('.my-comm-total[data-currency="YER"] .my-comm-total-accrued')).toHaveText('999777.0000');
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).not.toContain('100.0000');
    expect(body).not.toContain('0.2900');
    await expect(page.locator('.my-comm-item')).toHaveCount(0);
  });

  test('SI-7: the agent home (wallet + commissions) is RTL and has no horizontal overflow on a phone, a tablet and a large screen', async ({ page }) => {
    for (const viewport of [{ width: 360, height: 640 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await loginAs(page, '700000001');
      await expect(page.locator('.my-comm-total[data-currency="YER"]')).toBeVisible();
      const m = await page.evaluate(() => ({ dir: document.documentElement.getAttribute('dir') || getComputedStyle(document.body).direction, over: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
      expect(m.dir, JSON.stringify(viewport)).toBe('rtl');
      expect(m.over, `horizontal overflow at ${viewport.width}px`).toBeLessThanOrEqual(1);
      await page.click('#btn-my-wallet-logout');
      await expect(page.locator('#btn-unified-login')).toBeVisible();
    }
  });

  test('SI-5: at the HTTP level — forged agent_id is ignored, no token is 401, a bad query is 400, the removed admin review route is 404', async ({ request }) => {
    const login = await request.post(`${API}/api/v1/auth/login`, { data: { login_identifier: '700000001', password: 'semi-password-not-a-secret' } });
    expect(login.status()).toBe(200);
    const auth = { headers: { authorization: 'Bearer ' + (await login.json()).data.access_token } };
    const q = 'granularity=month&from=2000-01&to=2000-01';
    const month = new Date().toISOString().slice(0, 7);
    const forged = await request.get(`${API}/api/v1/commissions/summary?granularity=month&from=${month}&to=${month}&agent_id=22222222-2222-4222-8222-222222222222`, auth);
    expect(forged.status()).toBe(200);
    const body = await forged.json();
    expect(JSON.stringify(body)).not.toContain('999777');
    expect(body.data.agent.id).toBe('11111111-1111-4111-8111-111111111111');
    expect((await request.get(`${API}/api/v1/commissions/summary?${q}`)).status()).toBe(401);
    expect((await request.get(`${API}/api/v1/commissions/summary?${q}`, { headers: { authorization: 'Bearer not-a-token' } })).status()).toBe(401);
    expect((await request.get(`${API}/api/v1/commissions/summary?granularity=year&from=a&to=b`, auth)).status()).toBe(400);
    expect((await request.get(`${API}/api/v1/admin/commissions/review/agents`, auth)).status()).toBe(404);
  });
});
