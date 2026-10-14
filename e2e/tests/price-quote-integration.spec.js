// @ts-check
const { test, expect } = require('@playwright/test');
const { queryOne } = require('./db-evidence.js');

/**
 * Price QUOTE - real browser -> REAL backend -> REAL PostgreSQL. The bootstrap administrator's own party carries the seeded pricing rule
 * (e2e-main.mts: package e2e-pkg-cheap = 100 YER). The price the form SHOWS is read from the real quote route; the transaction the user then
 * creates is read straight from PostgreSQL, and its locked price must equal what was shown. Looking at the quote must create nothing.
 */
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password-1';
const SERVICE_CODE = 'e2e-tx-manual';
const PACKAGE_CHEAP = 'e2e-pkg-cheap';

test.describe('Price quote - real backend + real PostgreSQL', () => {
  test.skip(!process.env.DATABASE_URL_TEST, 'needs the isolated DATABASE_URL_TEST');

  test('PQI-1: the shown quote equals the price locked by the transaction created afterwards; the quote itself creates nothing', async ({ page }) => {
    await page.goto('/');
    const setup = page.locator('#btn-admin-setup-create');
    if (await setup.count() > 0) {
      await page.fill('#setup-name-input', 'Throwaway Local Setup');
      await page.fill('#setup-identifier-input', 'local-setup-' + Date.now());
      await page.fill('#setup-password-input', 'throwaway-local-1');
      await page.fill('#setup-confirm-password-input', 'throwaway-local-1');
      await setup.click();
      await page.click('#btn-admin-drawer-open');
      await page.locator('#btn-admin-logout').click();
    }
    await page.fill('#unified-identifier-input', 'admin');
    await page.fill('#unified-password-input', ADMIN_PASSWORD);
    await page.click('#btn-unified-login');
    await expect.poll(() => page.evaluate(() => (typeof state !== 'undefined' && state.session && !!state.session.accessToken))).toBe(true);
    await page.click('#btn-admin-drawer-open');
    await page.click('.admin-nav-item[data-module-id="transactionsBackend"]');
    await expect(page.locator('#rtx-form')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#rtx-catalog-service')).toBeVisible({ timeout: 10_000 });

    const countBefore = await queryOne(`SELECT count(*)::int AS n FROM transactions WHERE tenant_id = 'e2e-spa-integration' AND service_id = $1`, [SERVICE_CODE]);
    await page.selectOption('#rtx-catalog-service', SERVICE_CODE);
    await page.selectOption('#rtx-catalog-package', PACKAGE_CHEAP); // the default selection may already have been quoted: assert the rendered result, not a request
    await expect(page.locator('#rtx-quote[data-state="ok"]')).toBeVisible();
    await expect(page.locator('#rtx-quote-price')).toHaveText('100 YER');
    const shown = await page.locator('#rtx-quote-price').innerText();
    const countAfterQuote = await queryOne(`SELECT count(*)::int AS n FROM transactions WHERE tenant_id = 'e2e-spa-integration' AND service_id = $1`, [SERVICE_CODE]);
    expect(countAfterQuote.n).toBe(countBefore.n);

    await page.fill('#rtx-target-identifier', '700' + String(Date.now()).slice(-6));
    const [created] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/v1/transactions'),
      page.click('#btn-rtx-submit'),
    ]);
    expect(created.status()).toBe(202);
    const id = (await created.json()).data.transaction_id;
    const row = await queryOne(`SELECT locked_customer_price::text AS p, locked_currency AS c FROM transactions WHERE tenant_id = 'e2e-spa-integration' AND id = $1`, [id]);
    expect(`${Number(row.p)} ${row.c}`).toBe(shown);
  });
});
