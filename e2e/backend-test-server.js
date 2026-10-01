// SPA ↔ Backend Integration V1 — E2E backend bootstrap + server.
//
// Runs the REAL, unmodified backend (migrations → bootstrap:admin →
// src/main.ts) against DATABASE_URL_TEST, under a dedicated tenant id
// (TENANT_ID, set by playwright.config.js) so it never touches any
// other test's own data. Nothing here is a second implementation of
// anything the backend already does — this script only sequences the
// same three commands an operator would run by hand
// (`npm run migrate`, `npm run bootstrap:admin`, `npm start`), so the
// E2E run proves the SPA against the exact same backend every other
// verification in this project already exercises.
const { spawnSync, spawn } = require('node:child_process');
const path = require('node:path');

const backendDir = path.resolve(__dirname, '..', 'backend');

function runStep(args) {
  const result = spawnSync('node', ['--experimental-strip-types', ...args], {
    cwd: backendDir,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.stderr.write('backend-test-server: setup step failed: ' + args.join(' ') + '\n');
    process.exit(result.status || 1);
  }
}

if (!process.env.DATABASE_URL) {
  process.stderr.write('backend-test-server: DATABASE_URL is not set — the E2E run needs DATABASE_URL_TEST passed through playwright.config.js.\n');
  process.exit(2);
}

runStep(['src/infrastructure/db/migrate-cli.ts']);
runStep(['src/app/bootstrap-admin-cli.ts']);

// REAL TRANSACTIONS V1: the app is started through e2e-main.mts — the SAME startApplication() as src/main.ts,
// plus an idempotent E2E seed and the backend's existing commissionCandidatePolicies composition override.
const server = spawn('node', ['--experimental-strip-types', path.resolve(__dirname, 'e2e-main.mts')], {
  cwd: backendDir,
  env: process.env,
  stdio: 'inherit',
});
server.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGTERM', () => server.kill('SIGTERM'));
process.on('SIGINT', () => server.kill('SIGINT'));
