// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * SEMI-INTEGRATED browser tests (no database): the SPA in a real browser talks over real HTTP to `semi-integrated-server.mts`, which runs the
 * REAL commission-report routes/service, NodeHttpServer and RequestContextFactory over an in-memory reader. See that file's header for what
 * this does and does not prove. Ports: SPA 4173 (static server), backend 4000.
 */
module.exports = defineConfig({
  testDir: './semi-tests',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'node ./spa-static-server.js', port: 4173, reuseExistingServer: false, timeout: 15_000 },
    { command: 'node --experimental-strip-types ./semi-integrated-server.mts', url: 'http://127.0.0.1:4000/health', reuseExistingServer: false, timeout: 30_000 },
  ],
});
