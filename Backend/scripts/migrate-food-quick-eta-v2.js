/**
 * Backward-compatible wrapper (ETA v2 keys entrypoint).
 * Runs the consolidated Food Quick Delivery migration (idempotent).
 * Still safe for envs that only ever ran this script name.
 *
 * Usage: node scripts/migrate-food-quick-eta-v2.js
 *        npm run migrate:food-quick-eta-v2
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { runFoodQuickDeliveryMigration } from './lib/foodQuickDeliveryMigrate.core.js';

dotenv.config();

const mongoUrl =
  process.env.MONGODB_URL ||
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL ||
  process.env.MONGO_URI;

if (!mongoUrl) {
  console.error('Missing MONGODB_URL / MONGODB_URI / DATABASE_URL');
  process.exit(1);
}

async function migrate() {
  await mongoose.connect(mongoUrl);
  const summary = await runFoodQuickDeliveryMigration(mongoose.connection.db, {
    backfillOrderDeliveryMode: true,
  });
  console.log('[quick-eta-v2] food_fee_settings updated:', {
    seeded: summary.feeSettingsSeeded,
    keysFilled: summary.feeSettingsKeysFilled,
    scanned: summary.feeSettingsScanned,
  });
  console.log(
    '[quick-eta-v2] restaurants.kitchenPrepMinutes left unset (platform defaultKitchenPrepMinutes applies at runtime)',
  );
  console.log('[quick-eta-v2] estimatedDeliveryTime* untouched');
  console.log('[quick-eta-v2] done');
  await mongoose.disconnect();
}

migrate().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
