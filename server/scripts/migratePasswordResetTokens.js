#!/usr/bin/env node
/**
 * One-time migration: create password_reset_tokens table for forgot-password flow.
 * Run: node scripts/migratePasswordResetTokens.js
 * (from server/ or project root, with DATABASE_URL or .env set)
 */

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
  console.log('[migratePasswordResetTokens] checking for password_reset_tokens table…');

  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'password_reset_tokens'`
  );
  if (rows.length > 0) {
    console.log('[migratePasswordResetTokens] table already exists, nothing to do.');
    process.exit(0);
    return;
  }

  await pool.query(`
    CREATE TABLE password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
    CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
  `);
  console.log('[migratePasswordResetTokens] created password_reset_tokens table and indexes.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[migratePasswordResetTokens] error:', err);
  process.exit(1);
});
