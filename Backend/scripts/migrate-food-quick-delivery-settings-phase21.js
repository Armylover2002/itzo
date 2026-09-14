/**
 * Backward-compatible wrapper (Phase 2.1 entrypoint).
 * Runs the consolidated Food Quick Delivery migration (idempotent).
 *
 * Usage: node scripts/migrate-food-quick-delivery-settings-phase21.js
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
  console.log('[phase-2.1] consolidated migration:', {
    feeSettingsSeeded: summary.feeSettingsSeeded,
    feeSettingsKeysFilled: summary.feeSettingsKeysFilled,
    restaurantsUpdated: summary.restaurantsUpdated,
    zonesUpdated: summary.zonesUpdated,
    ordersBackfilledBasic: summary.ordersBackfilledBasic,
  });
  console.log('[phase-2.1] done — Quick remains OFF until Admin enables Global + Restaurant + Zone');
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
