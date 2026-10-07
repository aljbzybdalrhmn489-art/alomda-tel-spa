// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * SPA RUNTIME PROFILE (PROD-01…07) — real browser, real backend. The SPA is PRODUCTION unless window.OMDA_RUNTIME_PROFILE is exactly
 * "development" (fail-safe). The static test server serves `/production` exactly as a production deployment would (API base URL
 * only, NO profile global) and `/` with the development profile the older specs rely on.
 *
 * Production: no demo / local account exists, no local login, a failed backend login never falls back to a local account, no local
 * administrator can be created, and no password is ever written to localStorage (stale ones are erased).
 */

const ADMIN_LOGIN_IDENTIFIER = 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password-1';
const DEMO_IDENTIFIER = '710012342'; // a seeded demo agent identifier (source data, not a secret)
const DEMO_PASSWORD = 'demo-password-prod-1'; // what an attacker / misconfigured page might inject

async function submitLogin(page, identifier, password) {
  await page.fill('#unified-identifier-input', identifier);
  await page.fill('#unified-password-input', password);
  await page.click('#btn-unified-login');
}
const profileState = (page) => page.evaluate(() => ({
  profile: OMDA_RUNTIME_PROFILE, localAuth: LOCAL_DEMO_AUTH_ENABLED, demoPassword: DEMO_SEED_PASSWORD, accounts: ACCOUNTS.length,
  accountsWithPassword: ACCOUNTS.filter((a) => a.password).length, authenticated: !!state.session.isAuthenticated, token: !!state.session.accessToken, screen: state.app.currentScreen,
}));
const storageDump = (page) => page.evaluate(() => Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]));

test.describe('SPA runtime profile — production is the default and has no local authentication', () => {
  test('PROD-01/02: no demo account or password exists and a demo credential cannot sign in, even if a page injects the demo password', async ({ page }) => {
    await page.addInitScript((p) => { window.OMDA_DEMO_PASSWORD = p; }, DEMO_PASSWORD); // production must ignore it
    await page.goto('/production');
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 15_000 });
    expect(await profileState(page)).toMatchObject({ profile: 'production', localAuth: false, demoPassword: null, accounts: 0, accountsWithPassword: 0, authenticated: false });
    // the seeded identifiers are still in the source as inert data, but nothing can authenticate against them
    expect(await page.evaluate(({ i, p }) => authenticateAccount(i, p).success, { i: DEMO_IDENTIFIER, p: DEMO_PASSWORD })).toBe(false);
    await submitLogin(page, DEMO_IDENTIFIER, DEMO_PASSWORD);
    await expect(page.locator('#login-error')).toBeVisible({ timeout: 15_000 });
    expect(await profileState(page)).toMatchObject({ authenticated: false, token: false, screen: 'login' });
  });

  test('PROD-03: the real backend login works, and the session is a backend session', async ({ page }) => {
    await page.goto('/production');
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 15_000 });
    await submitLogin(page, ADMIN_LOGIN_IDENTIFIER, ADMIN_PASSWORD);
    await expect.poll(() => page.evaluate(() => !!state.session.accessToken)).toBe(true);
    expect(await profileState(page)).toMatchObject({ authenticated: true, token: true, screen: 'adminPanel' });
    expect(await page.evaluate(() => state.session.account.accountId)).toBe('backend:' + ADMIN_LOGIN_IDENTIFIER);
    // a reload restores the REAL session (token), not a local one
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!state.session.accessToken)).toBe(true);
    expect(await profileState(page)).toMatchObject({ authenticated: true, token: true });
  });

  test('PROD-04: a failed backend login (401) and an unreachable backend never fall back to a local account', async ({ page }) => {
    await page.goto('/production');
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 15_000 });
    // Even with a perfectly valid LOCAL administrator injected into memory, production does not consult it.
    await page.evaluate(() => { ACCOUNTS.push({ accountId: 'acc_local_x', loginIdentifier: 'local-admin-x', password: 'local-pass-1234', role: 'administrator', status: 'active', linkedEntityId: null }); });
    await submitLogin(page, 'local-admin-x', 'local-pass-1234'); // backend answers 401 for this identifier
    await expect(page.locator('#login-error')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#login-error')).toContainText('غير صحيحة');
    expect(await profileState(page)).toMatchObject({ authenticated: false, token: false, screen: 'login' });
    // the backend cannot be reached at all: still no local login
    await page.route('**/api/v1/auth/login', (route) => route.abort());
    await submitLogin(page, 'local-admin-x', 'local-pass-1234');
    await expect(page.locator('#login-error')).toBeVisible({ timeout: 15_000 });
    expect(await profileState(page)).toMatchObject({ authenticated: false, token: false, screen: 'login' });
    await page.unroute('**/api/v1/auth/login');
  });

  test('PROD-05: the local "create administrator" setup is not offered and cannot be used', async ({ page }) => {
    await page.goto('/production');
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#btn-admin-setup-create')).toHaveCount(0);
    expect(await page.evaluate(() => hasAdministratorAccount())).toBe(true);
    // even if the setup screen is forced open, creating an administrator is refused
    await page.evaluate(() => { state.app.currentScreen = 'adminSetup'; render(); });
    await expect(page.locator('#btn-admin-setup-create')).toBeVisible();
    await page.fill('#setup-name-input', 'Forced Local Admin');
    await page.fill('#setup-identifier-input', 'forced-local-admin');
    await page.fill('#setup-password-input', 'forced-pass-1234');
    await page.fill('#setup-confirm-password-input', 'forced-pass-1234');
    await page.click('#btn-admin-setup-create');
    expect(await profileState(page)).toMatchObject({ accounts: 0, authenticated: false });
    expect(await page.evaluate(() => state.adminSetup.error)).toContain('غير متاح');
  });

  test('PROD-06: stale local credentials in storage are erased and a real login stores no password', async ({ page }) => {
    await page.addInitScript(() => {
      // what an older development build of the SPA would have left in this browser
      localStorage.setItem('omda_tel_accounts', JSON.stringify([{ accountId: 'acc_stale', loginIdentifier: 'stale-admin', password: 'stale-plaintext-pass', role: 'administrator', status: 'active', linkedEntityId: 'adm_stale' }]));
      localStorage.setItem('omda_tel_administratorDirectory', JSON.stringify([{ id: 'adm_stale', displayName: 'Stale', status: 'active' }]));
      localStorage.setItem('omda_tel_session', JSON.stringify({ isAuthenticated: true, role: 'administrator', account: { accountId: 'acc_stale', loginIdentifier: 'stale-admin', role: 'administrator', status: 'active', linkedEntityId: 'adm_stale' }, accessToken: null }));
    });
    await page.goto('/production');
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 15_000 });
    expect(await profileState(page)).toMatchObject({ authenticated: false, accounts: 0, screen: 'login' }); // the stale local session did not log anyone in
    let dump = await storageDump(page);
    expect(dump.map(([k]) => k)).not.toContain('omda_tel_accounts');
    expect(dump.map(([k]) => k)).not.toContain('omda_tel_administratorDirectory');
    expect(JSON.stringify(dump)).not.toContain('stale-plaintext-pass');
    await submitLogin(page, ADMIN_LOGIN_IDENTIFIER, ADMIN_PASSWORD);
    await expect.poll(() => page.evaluate(() => !!state.session.accessToken)).toBe(true);
    dump = await storageDump(page);
    const all = JSON.stringify(dump);
    expect(all).not.toContain(ADMIN_PASSWORD);
    expect(all).not.toContain('stale-plaintext-pass');
    expect(dump.map(([k]) => k)).not.toContain('omda_tel_accounts');
    expect(/"password"\s*:\s*"[^"]+"/.test(all)).toBe(false);
  });

  test('PROD-08: same-origin topology (the recommended deployment): the SPA calls its own origin, a reverse proxy forwards /api/, and no cross-origin request exists', async ({ page }) => {
    const cross = [];
    const own = [];
    page.on('request', (req) => {
      const u = new URL(req.url());
      if (!u.pathname.startsWith('/api/') && u.pathname !== '/health') return;
      (u.origin === new URL(page.url() === 'about:blank' ? 'http://127.0.0.1:4173' : page.url()).origin ? own : cross).push(req.method() + ' ' + u.pathname);
    });
    await page.goto('/same-origin');
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 15_000 });
    expect(await page.evaluate(() => BACKEND_API_CONFIG.baseUrl)).toBe(''); // the default: same origin
    expect(await profileState(page)).toMatchObject({ profile: 'production', localAuth: false });
    await submitLogin(page, ADMIN_LOGIN_IDENTIFIER, ADMIN_PASSWORD);
    await expect.poll(() => page.evaluate(() => !!state.session.accessToken)).toBe(true);
    // an authenticated read and an authenticated write both work through the proxy on the same origin
    const read = await page.evaluate(async () => (await BackendServiceApi.list()).status);
    expect(read).toBe(200);
    const write = await page.evaluate(async () => (await BackendPackageApi.create({ service_code: 'no-such-service-same-origin', code: 'x', name: 'x' })).status);
    expect(write).toBe(400); // reached the backend's validation (not blocked by the browser)
    expect(own.length).toBeGreaterThan(0);
    expect(cross).toEqual([]); // nothing went to another origin
  });

  test('PROD-07: the development profile keeps the local demo / offline behaviour (opt-in, explicit)', async ({ page }) => {
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => typeof OMDA_RUNTIME_PROFILE !== 'undefined' && OMDA_RUNTIME_PROFILE)).toBe('development');
    const s = await profileState(page);
    expect(s).toMatchObject({ profile: 'development', localAuth: true });
    expect(s.accounts).toBeGreaterThan(0);
    // a fresh development browser still gets the local first-run setup (the older specs create a throwaway one)
    await expect(page.locator('#btn-admin-setup-create, #btn-unified-login').first()).toBeVisible({ timeout: 15_000 });
    // any value other than exactly "development" is production (fail-safe)
    await page.addInitScript(() => { Object.defineProperty(window, 'OMDA_RUNTIME_PROFILE', { configurable: true, get() { return 'Development'; }, set() {} }); });
    await page.goto('/production');
    await expect(page.locator('#btn-unified-login')).toBeVisible({ timeout: 15_000 });
    expect(await profileState(page)).toMatchObject({ profile: 'production', localAuth: false, accounts: 0 });
  });
});
