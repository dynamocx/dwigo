#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const dotenv = require('dotenv');

const { promotePendingIngestedDeals } = require('../services/dealPromotion');

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

const parseLimit = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
};

async function main() {
  const args = process.argv.slice(2);
  const limitArgIndex = args.findIndex((arg) => arg === '--limit' || arg === '-l');
  const limitValue =
    limitArgIndex >= 0 && args[limitArgIndex + 1] ? args[limitArgIndex + 1] : args[0];
  const limit = parseLimit(limitValue);

  console.log(`[promoteIngestedDeals] promoting up to ${limit} pending ingested deals...`);

  try {
    const stats = await promotePendingIngestedDeals({ limit });
    console.log('[promoteIngestedDeals] completed', stats);
  } catch (error) {
    console.error('[promoteIngestedDeals] failed', error);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

void main();


