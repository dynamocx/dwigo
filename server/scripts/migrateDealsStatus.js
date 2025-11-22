#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const dotenv = require('dotenv');
const pool = require('../config/database');

const envCandidates = [
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
];

envCandidates.some((candidate) => {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    return true;
  }
  return false;
});

async function main() {
  console.log('[migrateDealsStatus] normalizing legacy deals…');

  try {
    const { rowCount: addedColumns } = await pool.query(`
      ALTER TABLE deals
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public',
      ADD COLUMN IF NOT EXISTS source_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS source_reference VARCHAR(255),
      ADD COLUMN IF NOT EXISTS source_details JSONB,
      ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,2),
      ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS inventory_remaining INTEGER;
    `);

    console.log(`[migrateDealsStatus] ensure columns added (notice rowCount=${addedColumns})`);

    const { rowCount: updatedStatus } = await pool.query(`
      UPDATE deals
      SET status = CASE
        WHEN (is_active IS NOT NULL AND is_active = false) THEN 'archived'
        ELSE COALESCE(status, 'active')
      END,
      visibility = COALESCE(visibility, 'public'),
      last_seen_at = COALESCE(last_seen_at, updated_at)
      WHERE status IS NULL OR visibility IS NULL OR last_seen_at IS NULL;
    `);

    console.log(`[migrateDealsStatus] updated ${updatedStatus} existing rows with status/visibility defaults.`);
  } catch (error) {
    console.error('[migrateDealsStatus] failed', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();


