/**
 * Runtime audit: return pickup dispatch eligibility
 * Usage: node scripts/audit-return-dispatch.js [orderId]
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import mongoose from 'mongoose';
import { SellerReturn } from '../src/modules/quick-commerce/seller/models/sellerReturn.model.js';
import { FoodDeliveryPartner } from '../src/modules/food/delivery/models/deliveryPartner.model.js';
import {
  listNearbyOnlineDeliveryPartners,
  listNearbyOnlineDeliveryPartnersByCoords,
  filterEligiblePartners,
} from '../src/modules/food/orders/services/order-dispatch.service.js';
import { loadReturnPickupContext } from '../src/modules/quick-commerce/utils/returnPickup.helpers.js';

const orderIdArg = process.argv[2] || '';

const auditPartner = async (p, walletFn) => {
  const row = {
    partnerId: String(p._id),
    name: p.name || '',
    online: p.availabilityStatus === 'online',
    accountStatus: p.status,
    lastLat: p.lastLat,
    lastLng: p.lastLng,
    lastLocationAt: p.lastLocationAt,
  };
  try {
    const wallet = await walletFn(p._id);
    row.cashInHand = wallet.cashInHand;
    row.totalCashLimit = wallet.totalCashLimit;
    row.availableCashLimit = wallet.availableCashLimit;
    row.cashLimitHit = wallet.totalCashLimit === 0 || wallet.availableCashLimit <= 0;
  } catch (e) {
    row.walletError = e.message;
    row.cashLimitHit = 'unknown';
  }
  return row;
};

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) throw new Error('MONGO_URI/MONGODB_URI not set');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB\n');

  const returnFilter = orderIdArg
    ? { orderId: orderIdArg }
    : { returnStatus: { $in: ['return_approved', 'return_pickup_assigned', 'return_in_transit'] } };

  const returnDoc = await SellerReturn.findOne(returnFilter).sort({ updatedAt: -1 }).lean();
  if (!returnDoc) {
    console.log('No active return found');
    process.exit(0);
  }

  console.log('=== SellerReturn ===');
  console.log(JSON.stringify({
    _id: returnDoc._id,
    orderId: returnDoc.orderId,
    returnStatus: returnDoc.returnStatus,
    dispatch: returnDoc.dispatch,
    sellerId: returnDoc.sellerId,
  }, null, 2));

  const context = await loadReturnPickupContext(returnDoc);
  console.log('\n=== Return Pickup Context ===');
  console.log(JSON.stringify({
    customerCoords: context.customerCoords,
    sellerCoords: context.sellerCoords,
    sellerName: context.seller?.name,
    sellerLocation: context.seller?.location,
    riderEarning: context.riderEarning,
  }, null, 2));

  const onlinePartners = await FoodDeliveryPartner.find({ availabilityStatus: 'online' }).lean();
  console.log(`\n=== Online Partners (${onlinePartners.length}) ===`);

  const { getDeliveryPartnerWalletEnhanced } = await import('../src/modules/food/delivery/services/deliveryFinance.service.js');

  for (const p of onlinePartners) {
    const row = await auditPartner(p, getDeliveryPartnerWalletEnhanced);
    const staleMs = p.lastLocationAt ? Date.now() - new Date(p.lastLocationAt).getTime() : null;
    row.gpsStale = !p.lastLocationAt || staleMs > 10 * 60 * 1000;
    console.log(JSON.stringify(row));
  }

  console.log('\n=== Dispatch Partner Resolution ===');
  let pool;
  if (context.customerCoords) {
    console.log('Using customerCoords path');
    pool = await listNearbyOnlineDeliveryPartnersByCoords(context.customerCoords, { maxKm: 15, limit: 15 });
  } else {
    console.log('Using sellerId path');
    pool = await listNearbyOnlineDeliveryPartners(returnDoc.sellerId, { maxKm: 15, limit: 15, sourceType: 'quick' });
  }
  console.log('Pool partners:', pool.partners?.length || 0);
  console.log(JSON.stringify(pool.partners?.map((p) => ({ partnerId: String(p.partnerId), distanceKm: p.distanceKm })), null, 2));

  if (!context.customerCoords) {
    console.log('\n=== Null coords fallback (BUG PATH) ===');
    const nullPool = await listNearbyOnlineDeliveryPartners(null, { maxKm: 15, limit: 15, sourceType: 'quick' });
    console.log('Null source pool:', nullPool.partners?.length || 0);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
