// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const { generateKeyPairSync } = require('node:crypto');

/**
 * SPA ↔ Backend Integration V1 — Playwright config.
 *
 * Both the SPA static file server AND the real backend API server are
 * started by Playwright's own `webServer` array (resource lifecycle,
 * §25: one process per server, started once, torn down once — never a
 * duplicate backend pool spun up per test file). `PW_TEST_BASE_URL` is
 * NOT used for the API — the SPA is configured to call the backend via
 * `window.OMDA_API_BASE_URL`, injected by the test file itself before
 * navigation, exactly the environment-configuration seam
 * `spa_app-175.html`'s own BACKEND INTEGRATION LAYER documents (§23).
 */
// E2E-only Ed25519 keypair, GENERATED AT RUN TIME (never stored in source). It is created once per
// `playwright test` invocation and cached in process.env so the config's re-evaluation inside worker
// processes sees the same pair. It is only ever handed to the disposable backend started below
// (tenant `e2e-spa-integration`, test database) — never a production secret. To use a specific pair, export
// E2E_AUTH_SIGNING_PRIVATE_KEY and E2E_AUTH_VERIFICATION_PUBLIC_KEYS before running.
if (!process.env.E2E_AUTH_SIGNING_PRIVATE_KEY || !process.env.E2E_AUTH_VERIFICATION_PUBLIC_KEYS) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  process.env.E2E_AUTH_SIGNING_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  process.env.E2E_AUTH_VERIFICATION_PUBLIC_KEYS = publicKey.export({ type: 'spki', format: 'pem' }).toString();
}

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'node ./spa-static-server.js',
      port: 4173,
      reuseExistingServer: false,
      timeout: 15_000,
    },
    {
      command: 'node ./backend-test-server.js',
      port: 4000,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        HTTP_PORT: '4000',
        HTTP_HOST: '127.0.0.1',
        TENANT_ID: 'e2e-spa-integration',
        CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:4173',
        DATABASE_URL: process.env.DATABASE_URL_TEST || '',
        BOOTSTRAP_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password-1',
        AUTH_SIGNING_PRIVATE_KEY: process.env.E2E_AUTH_SIGNING_PRIVATE_KEY,
        AUTH_VERIFICATION_PUBLIC_KEYS: process.env.E2E_AUTH_VERIFICATION_PUBLIC_KEYS,
        AUTH_LOCKOUT_MAX_FAILED_ATTEMPTS: '5',
        AUTH_LOCKOUT_DURATION_MS: '60000',
        AUTH_SESSION_LIFETIME_MS: '86400000',
        AUTH_ACCESS_TOKEN_TTL_MS: process.env.E2E_ACCESS_TTL_MS || '900000', // a short value (e.g. 2000) lets session-renewal-integration.spec.js watch real expiry
      },
    },
  ],
});
