// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * MOCK-API browser tests (no database, no backend process). Only the SPA static server is started; every /api/v1 call the SPA makes is
 * intercepted inside the browser (page.route) and answered by the test itself. These tests prove the SPA's own behaviour (rendering,
 * request construction, escaping, state handling) against the backend's documented response shapes. They do NOT prove the backend — that
 * remains the job of the database-backed suite (playwright.config.js), which needs an isolated DATABASE_URL_TEST.
 */
module.exports = defineConfig({
  testDir: './mock-tests',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [{ command: 'node ./spa-static-server.js', port: 4173, reuseExistingServer: false, timeout: 15_000 }],
});
