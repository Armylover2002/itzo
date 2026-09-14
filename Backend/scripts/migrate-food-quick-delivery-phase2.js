/**
 * Backward-compatible wrapper (Phase-2 entrypoint).
 * Runs the consolidated Food Quick Delivery migration (idempotent).
 *
 * Usage:
 *   node Backend/scripts/migrate-food-quick-delivery-phase2.js
 *   npm run migrate:food-quick-delivery-phase2
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { runFoodQuickDeliveryMigration } from './lib/foodQuickDeliveryMigrate.core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoUrl =
  process.env.MONGODB_URI ||
  process.env.MONGODB_URL ||
  process.env.MONGO_URI ||
  process.env.DATABASE_URL;

if (!mongoUrl) {
  console.error('Missing MONGODB_URI');
  process.exit(1);
}

async function main() {
  await mongoose.connect(mongoUrl);
  const summary = await runFoodQuickDeliveryMigration(mongoose.connection.db, {
    backfillOrderDeliveryMode: true,
  });
  console.log(
    JSON.stringify(
      {
        feeSettingsUpdated: summary.feeSettingsSeeded + summary.feeSettingsKeysFilled,
        restaurantsUpdated: summary.restaurantsUpdated,
        zonesUpdated: summary.zonesUpdated,
        ordersBackfilledBasic: summary.ordersBackfilledBasic,
        note: summary.note,
        via: 'consolidated-core',
      },
      null,
      2,
    ),
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
