import dns from 'dns';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch { /* */ }

const returnId = process.argv[2] || '6a3bca702326deeb4924af32';

await mongoose.connect(process.env.MONGODB_URI, { family: 4, serverSelectionTimeoutMS: 20000 });
const db = mongoose.connection.db;
const ret = await db.collection('quick_seller_returns').findOne({ _id: new mongoose.Types.ObjectId(returnId) });
const order = await db.collection('food_orders').findOne({ orderId: ret.orderId });
const sellerOrder = await db.collection('quick_seller_orders').findOne({ orderId: ret.orderId });
const partnerId = ret.dispatch?.deliveryPartnerId;
const riderTx = await db.collection('transactions').find({
  entityType: 'deliveryBoy',
  entityId: partnerId,
  'metadata.returnId': returnId,
}).toArray();
const custTx = await db.collection('transactions').find({
  $or: [{ 'metadata.returnId': returnId }, { reference: ret.refundReference }],
}).toArray();
const sellerTx = await db.collection('quick_seller_transactions').find({
  returnId: new mongoose.Types.ObjectId(returnId),
}).toArray();
const wallet = await db.collection('fooddeliverywallets').findOne({ deliveryPartnerId: partnerId });

const out = {
  orderPricing: order?.pricing,
  orderPayment: order?.payment,
  returnItems: ret.returnItems,
  refundPricing: ret.refundPricing || ret.pricing,
  finance: ret.finance,
  dispatch: ret.dispatch,
  deliveryState: ret.deliveryState,
  qualityCheck: ret.qualityCheck,
  pickupPricingBreakdown: ret.pickupPricingBreakdown,
  calculatedPickupCharge: ret.calculatedPickupCharge,
  riderEarning: ret.riderEarning,
  pickupDistanceKm: ret.pickupDistanceKm,
  refundAuditLog: ret.refundAuditLog,
  returnHistoryActions: (ret.returnHistory || []).map((h) => ({ action: h.action, to: h.toStatus })),
  riderTxns: riderTx.map((t) => ({
    _id: t._id, amount: t.amount, category: t.category, description: t.description, metadata: t.metadata,
  })),
  customerTxns: custTx,
  sellerTxns: sellerTx,
  riderWallet: wallet ? {
    totalEarnings: wallet.totalEarnings,
    balance: wallet.balance,
    totalDeliveries: wallet.totalDeliveries,
  } : null,
  sellerOrder: sellerOrder ? { status: sellerOrder.status, pricing: sellerOrder.pricing } : null,
};
console.log(JSON.stringify(out, null, 2));
await mongoose.disconnect();
