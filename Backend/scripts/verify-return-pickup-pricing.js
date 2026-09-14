/**
 * Smoke test: return pickup rider earning must match order delivery earning for same distance.
 * Usage: node scripts/verify-return-pickup-pricing.js [distanceKm]
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRiderEarningBreakdown } from '../src/modules/quick-commerce/admin/services/billing.service.js';
import { computeReturnPickupPricing } from '../src/modules/quick-commerce/utils/returnPickup.helpers.js';
import { resolveReturnPickupCharge } from '../src/modules/quick-commerce/utils/return.helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const distanceKm = Number(process.argv[2] || 3);

const run = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const orderBreakdown = await getRiderEarningBreakdown(distanceKm);

  const mockLat = 28.6139;
  const mockLng = 77.209;
  const offset = distanceKm / 111;
  const returnBreakdown = await computeReturnPickupPricing({
    customerCoords: { lat: mockLat, lng: mockLng },
    sellerCoords: { lat: mockLat + offset, lng: mockLng },
  });

  const legacyDoc = {
    returnDeliveryCommission: 99,
    calculatedPickupCharge: 0,
    riderEarning: 0,
  };
  const calculatedDoc = {
    calculatedPickupCharge: orderBreakdown.earning,
    riderEarning: orderBreakdown.earning,
    returnDeliveryCommission: 99,
  };

  console.log('\n=== Return Pickup Pricing Verification ===\n');
  console.log(`Distance (order engine): ${distanceKm} km`);
  console.log('Order delivery breakdown:', JSON.stringify(orderBreakdown, null, 2));
  console.log('Return pickup breakdown (haversine):', JSON.stringify(returnBreakdown.pickupPricingBreakdown, null, 2));
  console.log(`Order rider earning: ₹${orderBreakdown.earning}`);
  console.log(`Return pickup earning: ₹${returnBreakdown.riderEarning}`);
  console.log(`Match (same input km): ${orderBreakdown.earning === returnBreakdown.riderEarning ? 'YES' : 'NO'}`);

  console.log('\nBackward compat:');
  console.log(`  legacy only → ₹${resolveReturnPickupCharge(legacyDoc)} (expected 99)`);
  console.log(`  calculated wins → ₹${resolveReturnPickupCharge(calculatedDoc)} (expected ${orderBreakdown.earning})`);

  await mongoose.disconnect();
  process.exit(orderBreakdown.earning === returnBreakdown.riderEarning ? 0 : 1);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
