// Read-only evidence helper for specs: one SELECT against the E2E test database (DATABASE_URL_TEST), through the
// backend's own `pg` dependency. Returns `undefined` when no test database URL is configured (the assertion is then
// skipped by the caller), never touches any other database, and never writes.
const path = require('node:path');

async function queryOne(sql, params) {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) return undefined;
  const pg = require(path.resolve(__dirname, '..', '..', 'backend', 'node_modules', 'pg'));
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const result = await client.query(sql, params);
    await client.query('ROLLBACK');
    return result.rows[0] || null;
  } finally {
    await client.end();
  }
}

module.exports = { queryOne };
