/**
 * PHASE D — Drop plan for Dining Mongo collections
 *
 * DO NOT execute until:
 *   1. Phase A/B code cleanup is deployed
 *   2. Phase C migration has been applied
 *   3. No application process still imports Dining models
 *
 * Collections (Dining-only):
 *   - food_dining_restaurants
 *   - food_dining_categories
 *   - food_dining_banners
 *
 * Usage (inspect only by default):
 *   node scripts/plan-drop-dining-collections.js
 *
 * Execute drops:
 *   CONFIRM_DROP=YES node scripts/plan-drop-dining-collections.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const CONFIRM_DROP = String(process.env.CONFIRM_DROP || '').toUpperCase() === 'YES';
const mongoUrl =
  process.env.MONGODB_URL || process.env.MONGODB_URI || process.env.DATABASE_URL;

const COLLECTIONS = [
  'food_dining_restaurants',
  'food_dining_categories',
  'food_dining_banners',
];

async function main() {
  if (!mongoUrl) {
    console.error('Missing MONGODB_URL / MONGODB_URI / DATABASE_URL');
    process.exit(1);
  }

  console.log('=== Dining collection DROP PLAN (Phase D) ===');
  console.log(`Mode: ${CONFIRM_DROP ? 'DROP' : 'INSPECT ONLY'}`);
  console.log('');
  console.log('Manual mongosh equivalents (run only after go-live of Dining removal):');
  for (const name of COLLECTIONS) {
    console.log(`  db.${name}.drop()`);
  }
  console.log('');

  await mongoose.connect(mongoUrl);
  const db = mongoose.connection.db;

  try {
    const existing = await db.listCollections().toArray();
    const names = new Set(existing.map((c) => c.name));

    for (const name of COLLECTIONS) {
      if (!names.has(name)) {
        console.log(`[skip] ${name} — not present`);
        continue;
      }
      const count = await db.collection(name).countDocuments();
      console.log(`[found] ${name} — ${count} document(s)`);
      if (CONFIRM_DROP) {
        await db.collection(name).drop();
        console.log(`[dropped] ${name}`);
      }
    }
  } finally {
    await mongoose.disconnect();
  }

  if (!CONFIRM_DROP) {
    console.log('');
    console.log('No collections dropped. Re-run with CONFIRM_DROP=YES to execute.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
