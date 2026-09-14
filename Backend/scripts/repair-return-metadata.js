/**
 * One-off repair: sync pickup distance metadata + parent order payment.refund
 * for an existing return. Reuses production helpers (no duplicate logic).
 *
 * Usage: node Backend/scripts/repair-return-metadata.js <returnId>
 */
import dns from 'dns';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  /* ignore */
}

const returnId = process.argv[2];
if (!returnId) {
  console.error('Usage: node repair-return-metadata.js <returnId>');
  process.exit(1);
}

const { assertMongoConnected } = await import('../src/config/db.js');
const { SellerReturn } = await import('../src/modules/quick-commerce/seller/models/sellerReturn.model.js');
const { QuickOrder } = await import('../src/modules/quick-commerce/models/order.model.js');
const { applyReturnPickupPricingToDoc } = await import(
  '../src/modules/quick-commerce/utils/returnPickup.helpers.js'
);
const { syncParentOrderRefundFromReturn } = await import(
  '../src/modules/quick-commerce/services/quickRefund.service.js'
);
const { maskAccountNumber, sanitizeRefundAuditMetadata } = await import(
  '../src/modules/quick-commerce/utils/return.helpers.js'
);

await mongoose.connect(process.env.MONGODB_URI, { family: 4, serverSelectionTimeoutMS: 20000 });
assertMongoConnected();

const returnDoc = await SellerReturn.findById(returnId);
if (!returnDoc) {
  console.error('Return not found:', returnId);
  process.exit(1);
}

await applyReturnPickupPricingToDoc(returnDoc);

if (Array.isArray(returnDoc.refundAuditLog)) {
  returnDoc.refundAuditLog = returnDoc.refundAuditLog.map((entry) => ({
    ...entry,
    metadata: sanitizeRefundAuditMetadata(entry?.metadata || {}),
  }));
}

const order = await QuickOrder.findOne({
  orderId: returnDoc.orderId,
  orderType: { $in: ['quick', 'mixed'] },
});

await returnDoc.save();

if (order) {
  await syncParentOrderRefundFromReturn(order, returnDoc);
}

const refreshed = await SellerReturn.findById(returnId).lean();
const refreshedOrder = order
  ? await QuickOrder.findOne({
      orderId: returnDoc.orderId,
      orderType: { $in: ['quick', 'mixed'] },
    }).lean()
  : null;

const auditPayout = (refreshed.refundAuditLog || []).find((e) => e?.metadata?.payoutDetails)?.metadata
  ?.payoutDetails;

console.log(
  JSON.stringify(
    {
      returnId,
      pickupDistanceKm: refreshed.pickupDistanceKm,
      breakdownDistanceKm: refreshed.pickupPricingBreakdown?.distanceKm,
      calculatedPickupCharge: refreshed.calculatedPickupCharge,
      riderEarning: refreshed.riderEarning,
      refundStatus: refreshed.refundStatus,
      orderPaymentRefund: refreshedOrder?.payment?.refund,
      auditAccountMasked: auditPayout?.accountNumber
        ? maskAccountNumber(auditPayout.accountNumber) === auditPayout.accountNumber
        : null,
    },
    null,
    2,
  ),
);

await mongoose.disconnect();
