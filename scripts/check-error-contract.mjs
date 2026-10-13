// Checks that BACKEND_API_CONTRACT_v1.0.md section 1.1 and backend/src/shared/errors/error-code.ts agree.
//   node scripts/check-error-contract.mjs
// For EVERY code the backend defines: the contract must list it, with the same HTTP status and (unless the contract marks it with the warning sign)
// the same retryable flag. It also reports contract codes the backend does not define yet (planned codes) so a drift is visible, but only a code
// present in the backend and missing / different in the contract fails the check. Read-only.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'backend/src/shared/errors/error-code.ts'), 'utf8');
const contract = readFileSync(join(root, 'BACKEND_API_CONTRACT_v1.0.md'), 'utf8');

const block = (name) => {
  const m = new RegExp(`export const ${name}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`).exec(source);
  if (!m) throw new Error(`cannot find ${name} in error-code.ts`);
  return Object.fromEntries([...m[1].matchAll(/^\s*([A-Z_]+):\s*(\d+|true|false),/gm)].map((x) => [x[1], x[2]]));
};
const status = block('ERROR_HTTP_STATUS');
const retryable = block('ERROR_RETRYABLE');

const rows = new Map();
for (const line of contract.split('\n')) {
  const m = /^\|\s*`([A-Z_]+)`\s*\|\s*(\d{3})\s*\|\s*(✅|❌|⚠️)\s*\|/.exec(line);
  if (m) rows.set(m[1], { status: m[2], retry: m[3] });
}

const problems = [];
for (const code of Object.keys(status)) {
  const row = rows.get(code);
  if (!row) { problems.push(`${code}: defined in the backend but missing from the contract table`); continue; }
  if (row.status !== status[code]) problems.push(`${code}: HTTP status backend=${status[code]} contract=${row.status}`);
  if (row.retry !== '⚠️') {
    const contractRetry = row.retry === '✅' ? 'true' : 'false';
    if (contractRetry !== retryable[code]) problems.push(`${code}: retryable backend=${retryable[code]} contract=${contractRetry}`);
  }
}
const planned = [...rows.keys()].filter((c) => !(c in status));
console.log(`backend codes: ${Object.keys(status).length}; contract rows: ${rows.size}; planned (contract only): ${planned.length}`);
if (problems.length > 0) { console.error(problems.join('\n')); console.error(`error contract: ${problems.length} mismatch(es)`); process.exit(1); }
console.log('error contract: backend and contract agree for every backend code');
