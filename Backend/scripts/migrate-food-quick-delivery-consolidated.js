/**
 * Canonical Food Quick Delivery migration entrypoint (idempotent).
 *
 * Usage: node scripts/migrate-food-quick-delivery-consolidated.js
 *        npm run migrate:food-quick-delivery
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
  console.error('Missing MONGODB_URI / MONGODB_URL / MONGO_URI / DATABASE_URL');
  process.exit(1);
}

async function main() {
  await mongoose.connect(mongoUrl);
  const summary = await runFoodQuickDeliveryMigration(mongoose.connection.db, {
    backfillOrderDeliveryMode: true,
  });
  console.log('[food-quick-delivery] consolidated migration:', JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
