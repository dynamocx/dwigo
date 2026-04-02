/**
 * Apply pending SQL files from server/migrations (lexical order).
 * Records applied filenames in schema_migrations.
 *
 * Usage: DATABASE_URL=... node scripts/run-migrations.js
 * Or:    npm run migrate
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !databaseUrl.trim()) {
    console.error('FATAL: DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT NOW()
    );
  `);

  const migrationsDir = path.join(__dirname, '../migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory; nothing to do.');
    await pool.end();
    return;
  }

  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  const { rows: appliedRows } = await pool.query('SELECT filename FROM schema_migrations');
  const done = new Set(appliedRows.map((r) => r.filename));

  for (const file of files) {
    if (done.has(file)) {
      console.log('[migrate] skip (already applied):', file);
      continue;
    }

    const fullPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(fullPath, 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log('[migrate] applied:', file);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[migrate] FAILED:', file, err.message);
      process.exitCode = 1;
      client.release();
      await pool.end();
      process.exit(1);
    } finally {
      client.release();
    }
  }

  await pool.end();
  console.log('[migrate] done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
