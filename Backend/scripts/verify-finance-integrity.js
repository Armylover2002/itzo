/**
 * Finance integrity check + index sync.
 *
 * Read-only except for creating the finance indexes the app relies on (the app connects
 * with autoIndex disabled, so declaring an index in a schema does not create it).
 *
 * Run: npm run verify:finance
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { connectDB } from '../src/config/db.js';
import { FoodOrder } from '../src/modules/food/orders/models/order.model.js';
import { FoodTransaction } from '../src/modules/food/orders/models/foodTransaction.model.js';
import { SellerTransaction } from '../src/modules/quick-commerce/seller/models/sellerTransaction.model.js';
import { ProcessedWebhookEvent } from '../src/core/payments/models/processedWebhookEvent.model.js';

const findings = [];
const report = (severity, label, count, detail = '') => {
  findings.push({ severity, label, count });
  const tag = count === 0 ? 'OK  ' : severity === 'critical' ? 'DRIFT' : 'WARN ';
  console.log(`${tag} ${label}: ${count}${detail ? '  ' + detail : ''}`);
};

const run = async () => {
  await connectDB();

  console.log('\n— Indexes —');
  for (const [name, Model] of [
    ['SellerTransaction', SellerTransaction],
    ['ProcessedWebhookEvent', ProcessedWebhookEvent],
  ]) {
    try {
      await Model.syncIndexes();
      console.log(`OK   ${name} indexes in sync`);
    } catch (err) {
      console.log(`FAIL ${name} index sync: ${err.message}`);
      console.log('     (usually means existing duplicate rows must be merged first)');
    }
  }

  console.log('\n— Order / finance-record drift —');

  // A paid order with no finance record cannot be reconciled or refunded reliably.
  const paidNoTxn = await FoodOrder.aggregate([
    { $match: { 'payment.status': 'paid' } },
    { $lookup: { from: 'food_transactions', localField: '_id', foreignField: 'orderId', as: 'txn' } },
    { $match: { txn: { $size: 0 } } },
    { $group: { _id: '$orderType', n: { $sum: 1 } } },
  ]);
  const paidNoTxnTotal = paidNoTxn.reduce((s, r) => s + r.n, 0);
  report('critical', 'paid orders with no finance record', paidNoTxnTotal,
    paidNoTxn.map(r => `${r._id || 'food'}=${r.n}`).join(' '));

  // Order says refunded but the finance record disagrees.
  const refundedMismatch = await FoodOrder.aggregate([
    { $match: { 'payment.status': 'refunded' } },
    { $lookup: { from: 'food_transactions', localField: '_id', foreignField: 'orderId', as: 'txn' } },
    { $match: { 'txn.0': { $exists: true }, 'txn.0.status': { $nin: ['refunded', 'cancelled'] } } },
    { $count: 'n' },
  ]);
  report('critical', 'orders refunded but finance record not', refundedMismatch[0]?.n || 0);

  // Refund recorded with no gateway/refund id — nothing to reconcile against.
  const refundNoId = await FoodOrder.countDocuments({
    'payment.refund.status': 'processed',
    $or: [{ 'payment.refund.refundId': '' }, { 'payment.refund.refundId': null }],
  });
  report('warn', 'processed refunds with no refund id', refundNoId);

  // Refunded more than the order was worth.
  const overRefunded = await FoodOrder.aggregate([
    { $match: { 'payment.refund.amount': { $gt: 0 } } },
    { $project: { orderId: 1, refunded: '$payment.refund.amount', total: '$pricing.total' } },
    { $match: { $expr: { $gt: ['$refunded', { $add: ['$total', 0.01] }] } } },
    { $limit: 20 },
  ]);
  report('critical', 'orders refunded beyond their total', overRefunded.length,
    overRefunded.map(o => o.orderId).join(' '));

  console.log('\n— Delivered-order settlement —');

  // Delivered orders that owe a payout but were never settled (the queue path that used
  // to be dead). These are real money still owed to riders / the platform.
  const unsettled = await FoodOrder.countDocuments({
    orderStatus: 'delivered',
    $or: [{ riderEarning: { $gt: 0 } }, { platformProfit: { $gt: 0 } }],
    $and: [{ $or: [{ settlementCreditedAt: null }, { settlementCreditedAt: { $exists: false } }] }],
  });
  report('warn', 'delivered orders never settled', unsettled,
    unsettled > 0 ? '(rider/platform payouts still owed)' : '');

  console.log('\n— Quick-commerce seller ledger —');

  const dupeEarnings = await SellerTransaction.aggregate([
    { $match: { type: 'Order Payment', orderId: { $nin: [null, ''] } } },
    { $group: { _id: { sellerId: '$sellerId', orderId: '$orderId' }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $count: 'n' },
  ]);
  report('critical', 'duplicate seller earning rows', dupeEarnings[0]?.n || 0);

  console.log('\n— Webhook idempotency —');
  const eventCount = await ProcessedWebhookEvent.countDocuments({});
  console.log(`INFO recorded webhook deliveries: ${eventCount}`);

  const drift = findings.filter(f => f.severity === 'critical' && f.count > 0);
  console.log(
    drift.length === 0
      ? '\nNo critical drift detected.'
      : `\n${drift.length} critical drift categories need repair.`,
  );

  await mongoose.disconnect();
  process.exit(drift.length === 0 ? 0 : 1);
};

run().catch(e => { console.error('FATAL', e); process.exit(1); });
