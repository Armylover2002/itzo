/**
 * Full financial reconciliation audit for one completed quick commerce return.
 * Usage: node scripts/audit-return-finance.js [returnId|orderId]
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';
import mongoose from 'mongoose';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  /* ignore */
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { SellerReturn } from '../src/modules/quick-commerce/seller/models/sellerReturn.model.js';
import { QuickOrder } from '../src/modules/quick-commerce/models/order.model.js';
import { SellerOrder } from '../src/modules/quick-commerce/seller/models/sellerOrder.model.js';
import { SellerTransaction } from '../src/modules/quick-commerce/seller/models/sellerTransaction.model.js';
import { Transaction } from '../src/core/payments/models/transaction.model.js';
import { FoodDeliveryWallet } from '../src/modules/food/delivery/models/deliveryWallet.model.js';
import { getRiderEarningBreakdown } from '../src/modules/quick-commerce/admin/services/billing.service.js';
import {
  serializeReturnForCustomer,
  serializeReturnForSeller,
  serializeReturnForAdmin,
  resolveReturnPickupCharge,
} from '../src/modules/quick-commerce/utils/return.helpers.js';
import { loadReturnPickupContext } from '../src/modules/quick-commerce/utils/returnPickup.helpers.js';
import {
  resolveCustomerPaidAmount,
  roundMoney,
} from '../src/modules/quick-commerce/utils/returnRefundCalculation.helpers.js';
import { reconcileSellerLedgerBalance } from '../src/modules/quick-commerce/services/sellerLedger.service.js';

const arg = String(process.argv[2] || '6a3bca702326deeb4924af32').trim();
const num = (v) => roundMoney(Number(v || 0));
const eq = (a, b, tol = 0.01) => Math.abs(num(a) - num(b)) <= tol;

const issues = [];
const warnings = [];
const passes = [];

const fail = (section, msg) => issues.push({ section, msg });
const warn = (section, msg) => warnings.push({ section, msg });
const pass = (section, msg) => passes.push({ section, msg });

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(mongoUri, {
    family: 4,
    serverSelectionTimeoutMS: 20000,
    readPreference: 'primary',
  });
  console.log('Connected to MongoDB\n');

  let returnDoc = null;
  if (mongoose.Types.ObjectId.isValid(arg)) {
    returnDoc = await SellerReturn.findById(arg).lean();
  }
  if (!returnDoc) {
    returnDoc = await SellerReturn.findOne({ orderId: arg }).sort({ updatedAt: -1 }).lean();
  }
  if (!returnDoc) {
    returnDoc = await SellerReturn.findOne({
      returnStatus: 'refund_completed',
      refundStatus: 'completed',
    }).sort({ updatedAt: -1 }).lean();
  }
  if (!returnDoc) {
    console.error('No return document found');
    process.exit(1);
  }

  const returnId = String(returnDoc._id);
  const orderId = returnDoc.orderId;
  const sellerId = returnDoc.sellerId;
  const partnerId = returnDoc.dispatch?.deliveryPartnerId;

  console.log('=== AUDIT TARGET ===');
  console.log(JSON.stringify({
    returnId,
    orderId,
    returnStatus: returnDoc.returnStatus,
    refundStatus: returnDoc.refundStatus,
    refundMethod: returnDoc.refundMethod,
    returnRefundAmount: returnDoc.returnRefundAmount,
  }, null, 2));

  const order = await QuickOrder.findOne({
    orderId,
    orderType: { $in: ['quick', 'mixed'] },
  }).lean();
  const sellerOrders = await SellerOrder.find({ orderId }).lean();
  const sellerTxns = await SellerTransaction.find({
    $or: [{ returnId }, { orderId }, { referenceId: { $regex: returnId.slice(-8), $options: 'i' } }],
  }).sort({ createdAt: 1 }).lean();
  const sellerTxnsByReturn = await SellerTransaction.find({
    $or: [
      { returnId: new mongoose.Types.ObjectId(returnId) },
      { referenceId: `return_pickup_fee:${returnId}` },
      { referenceId: `return_refund_post:${returnId}` },
      { referenceId: { $regex: returnId, $options: 'i' } },
    ],
  }).sort({ createdAt: 1 }).lean();

  const riderWalletTxns = partnerId
    ? await Transaction.find({
        entityType: 'deliveryBoy',
        entityId: partnerId,
        $or: [
          { 'metadata.returnId': returnId },
          { description: { $regex: orderId, $options: 'i' } },
        ],
      }).sort({ createdAt: 1 }).lean()
    : [];

  const customerRefundTxns = await Transaction.find({
    $or: [
      { 'metadata.returnId': returnId },
      { reference: returnDoc.refundReference },
      { description: { $regex: orderId, $options: 'i' } },
    ],
  }).sort({ createdAt: 1 }).lean();

  const riderWallet = partnerId
    ? await FoodDeliveryWallet.findOne({ deliveryPartnerId: partnerId }).lean()
    : null;

  const pickupCtx = await loadReturnPickupContext(returnDoc);
  const engineBreakdown = await getRiderEarningBreakdown(
    num(returnDoc.pickupDistanceKm || pickupCtx.pickupDistanceKm),
  );
  const resolvedPickupCharge = resolveReturnPickupCharge(returnDoc);

  const customerPaid = order ? resolveCustomerPaidAmount(order) : 0;
  const pricing = returnDoc.refundPricing || returnDoc.pricing || {};
  const finalRefund = num(returnDoc.returnRefundAmount);
  const retainedDelivery = num(pricing.deliveryFeeRetained);
  const retainedPlatform = num(pricing.platformFeeRetained);
  const pickupFee = num(returnDoc.finance?.pickupFeeDebited);
  const totalRefunded = num(pricing.totalRefundedAmount ?? finalRefund);
  const remainingRefundable = num(pricing.remainingRefundableAmount);

  // --- Refund math ---
  const refundSide = num(totalRefunded + retainedDelivery + retainedPlatform + remainingRefundable);
  if (order && eq(customerPaid, refundSide)) {
    pass('RefundCalc', `Customer paid ₹${customerPaid} = refunded+retained+remaining ₹${refundSide}`);
  } else if (order) {
    fail('RefundCalc', `Customer paid ₹${customerPaid} != reconciled ₹${refundSide} (diff ₹${num(customerPaid - refundSide)})`);
  } else {
    warn('RefundCalc', 'Parent QuickOrder not found');
  }

  // --- Rider pickup charge ---
  if (resolvedPickupCharge > 0 && engineBreakdown.earning > 0) {
    if (eq(resolvedPickupCharge, engineBreakdown.earning)) {
      pass('RiderPricing', `Pickup charge ₹${resolvedPickupCharge} matches engine ₹${engineBreakdown.earning} at ${engineBreakdown.distanceKm}km`);
    } else if (num(returnDoc.returnDeliveryCommission) > 0 && eq(resolvedPickupCharge, returnDoc.returnDeliveryCommission)) {
      warn('RiderPricing', `Using legacy commission ₹${resolvedPickupCharge}, engine would be ₹${engineBreakdown.earning}`);
    } else {
      fail('RiderPricing', `Pickup charge ₹${resolvedPickupCharge} != engine ₹${engineBreakdown.earning}`);
    }
  }

  const riderEarningDoc = num(returnDoc.riderEarning || returnDoc.calculatedPickupCharge);
  if (riderEarningDoc > 0 && !eq(riderEarningDoc, resolvedPickupCharge)) {
    fail('RiderPricing', `riderEarning ₹${riderEarningDoc} != resolved pickup ₹${resolvedPickupCharge}`);
  } else if (riderEarningDoc > 0) {
    pass('RiderPricing', `riderEarning matches resolved pickup ₹${resolvedPickupCharge}`);
  }

  const riderCredits = riderWalletTxns.filter((t) => num(t.amount) > 0 && String(t.category || '').includes('earning'));
  const riderCreditSum = riderCredits.reduce((s, t) => s + num(t.amount), 0);
  const riderCreditForReturn = riderCredits.filter((t) => String(t.metadata?.returnId || '') === returnId);
  if (resolvedPickupCharge > 0) {
    if (riderCreditForReturn.length === 0) {
      fail('RiderWallet', 'No wallet credit transaction for this returnId');
    } else if (riderCreditForReturn.length > 1) {
      fail('RiderWallet', `Duplicate wallet credits: ${riderCreditForReturn.length}`);
    } else if (!eq(riderCreditForReturn[0].amount, resolvedPickupCharge)) {
      fail('RiderWallet', `Wallet credit ₹${riderCreditForReturn[0].amount} != pickup ₹${resolvedPickupCharge}`);
    } else {
      pass('RiderWallet', `Single wallet credit ₹${riderCreditForReturn[0].amount}`);
    }
  }

  // --- Seller ledger ---
  if (!returnDoc.finance?.sellerLedgerApplied) {
    fail('SellerLedger', 'finance.sellerLedgerApplied is false');
  } else {
    pass('SellerLedger', 'sellerLedgerApplied=true');
  }

  const pickupFeeTxns = sellerTxnsByReturn.filter((t) => String(t.type || '').toLowerCase().includes('pickup') || String(t.referenceId || '').includes('pickup_fee'));
  const refundTxns = sellerTxnsByReturn.filter((t) => String(t.type || '').toLowerCase().includes('refund') || String(t.referenceId || '').includes('return_refund'));

  const pickupDebited = num(returnDoc.finance?.pickupFeeDebited);
  if (pickupDebited > 0) {
    if (!eq(pickupDebited, resolvedPickupCharge)) {
      fail('SellerLedger', `pickupFeeDebited ₹${pickupDebited} != pickup charge ₹${resolvedPickupCharge}`);
    }
    const pickupTxnSum = pickupFeeTxns.reduce((s, t) => s + Math.abs(num(t.amount)), 0);
    if (pickupFeeTxns.length === 0) {
      fail('SellerLedger', 'No SellerTransaction for pickup fee');
    } else if (pickupFeeTxns.length > 1) {
      warn('SellerLedger', `Multiple pickup fee txns: ${pickupFeeTxns.length}`);
    } else if (!eq(pickupTxnSum, pickupDebited)) {
      fail('SellerLedger', `Pickup txn sum ₹${pickupTxnSum} != finance.pickupFeeDebited ₹${pickupDebited}`);
    } else {
      pass('SellerLedger', `Pickup fee debit ₹${pickupDebited} matches ledger`);
    }
  }

  const preDeduct = num(returnDoc.finance?.preSettlementDeducted);
  const postDebit = num(returnDoc.finance?.postSettlementDebited);
  const refundLedgerTotal = preDeduct + postDebit;
  if (finalRefund > 0 && !eq(refundLedgerTotal, finalRefund)) {
    fail('SellerLedger', `Refund debits ₹${refundLedgerTotal} != returnRefundAmount ₹${finalRefund}`);
  } else if (finalRefund > 0) {
    pass('SellerLedger', `Refund debits ₹${refundLedgerTotal} = returnRefundAmount`);
  }

  // --- Customer refund ---
  if (returnDoc.refundStatus !== 'completed') {
    fail('CustomerRefund', `refundStatus=${returnDoc.refundStatus}`);
  } else {
    pass('CustomerRefund', `refundStatus=completed, method=${returnDoc.refundMethod}`);
  }

  if (returnDoc.refundMethod === 'wallet') {
    const walletRefunds = customerRefundTxns.filter((t) => num(t.amount) > 0);
    if (walletRefunds.length === 0) warn('CustomerRefund', 'No customer wallet credit txn found');
    else if (!eq(walletRefunds.reduce((s, t) => s + num(t.amount), 0), finalRefund)) {
      warn('CustomerRefund', 'Wallet refund amount may not match');
    } else pass('CustomerRefund', 'Wallet refund txn matches');
  } else if (['bank', 'upi'].includes(returnDoc.refundMethod)) {
    if (!returnDoc.refundReference) warn('CustomerRefund', 'Missing refundReference');
    else pass('CustomerRefund', `refundReference=${returnDoc.refundReference}`);
  }

  const auditActions = (returnDoc.refundAuditLog || []).map((e) => e.action);
  if (!auditActions.length) warn('AuditLog', 'Empty refundAuditLog');
  else pass('AuditLog', `Actions: ${auditActions.join(' → ')}`);

  // --- Dispatch ---
  const d = returnDoc.dispatch || {};
  if (d.status === 'completed' && returnDoc.returnStatus === 'refund_completed') {
    pass('Dispatch', 'dispatch.status=completed, returnStatus=refund_completed');
  } else if (returnDoc.returnStatus === 'refund_completed' && d.status !== 'completed') {
    warn('Dispatch', `return completed but dispatch.status=${d.status}`);
  }
  if (d.offeredTo?.length > 0) {
    warn('Security', `DB still has offeredTo[${d.offeredTo.length}] — customer API strips it`);
  }

  // --- Quality ---
  if (returnDoc.qualityCheck?.status === 'passed') pass('Quality', 'qualityCheck.status=passed');
  else fail('Quality', `qualityCheck.status=${returnDoc.qualityCheck?.status}`);

  // --- Serializers ---
  const cust = serializeReturnForCustomer(returnDoc);
  const sell = serializeReturnForSeller(returnDoc);
  const admin = serializeReturnForAdmin(returnDoc);
  const custPickup = num(cust.pickupCharge);
  const adminPickup = num(admin.calculatedPickupCharge || admin.returnPickupCharge);
  if (!eq(custPickup, resolvedPickupCharge)) {
    fail('Serializer', `Customer pickupCharge ₹${custPickup} != resolved ₹${resolvedPickupCharge}`);
  } else pass('Serializer', 'Customer pickupCharge matches');
  if (!eq(adminPickup, resolvedPickupCharge)) {
    warn('Serializer', `Admin pickup ₹${adminPickup} != resolved ₹${resolvedPickupCharge}`);
  }
  if (!eq(cust.returnRefundAmount, sell.returnRefundAmount) || !eq(cust.returnRefundAmount, admin.returnRefundAmount)) {
    fail('Serializer', 'returnRefundAmount mismatch across serializers');
  } else {
    pass('Serializer', `returnRefundAmount ₹${cust.returnRefundAmount} consistent`);
  }

  // --- Timeline ---
  const lastStep = cust.timelineSteps?.[cust.timelineSteps.length - 1];
  if (returnDoc.refundStatus === 'completed' && lastStep?.status !== 'completed') {
    fail('Timeline', `Last step status=${lastStep?.status}, expected completed`);
  } else if (returnDoc.refundStatus === 'completed') {
    pass('Timeline', 'Refund completed step is completed');
  }

  let ledgerBalance = null;
  try {
    ledgerBalance = await reconcileSellerLedgerBalance(sellerId);
  } catch (e) {
    warn('SellerLedger', `Balance reconcile: ${e.message}`);
  }

  console.log('\n=== DOCUMENT SNAPSHOTS ===\n');
  console.log('SellerReturn.finance:', JSON.stringify(returnDoc.finance, null, 2));
  console.log('SellerReturn.pricing:', JSON.stringify(returnDoc.refundPricing || returnDoc.pricing, null, 2));
  console.log('Pickup:', {
    calculatedPickupCharge: returnDoc.calculatedPickupCharge,
    riderEarning: returnDoc.riderEarning,
    pickupDistanceKm: returnDoc.pickupDistanceKm,
    resolved: resolvedPickupCharge,
    engine: engineBreakdown.earning,
    financeDebited: pickupDebited,
  });
  console.log('SellerTransactions (return-linked):', sellerTxnsByReturn.map((t) => ({
    type: t.type, amount: t.amount, referenceId: t.referenceId, status: t.status,
  })));
  console.log('Rider wallet credits:', riderCreditForReturn.map((t) => ({
    amount: t.amount, category: t.category, returnId: t.metadata?.returnId,
  })));
  console.log('Customer refund txns:', customerRefundTxns.map((t) => ({
    amount: t.amount, category: t.category, entityType: t.entityType,
  })));
  console.log('refundAuditLog:', auditActions);
  console.log('Ledger balance:', ledgerBalance);

  const overall = issues.length ? 'FAIL' : warnings.length ? 'WARNING' : 'PASS';

  console.log('\n=== AUDIT SUMMARY ===');
  console.log(`Overall: ${overall}`);
  console.log(`Passes: ${passes.length}, Warnings: ${warnings.length}, Failures: ${issues.length}`);
  if (issues.length) {
    console.log('\nFAILURES:');
    issues.forEach((i) => console.log(`  [${i.section}] ${i.msg}`));
  }
  if (warnings.length) {
    console.log('\nWARNINGS:');
    warnings.forEach((w) => console.log(`  [${w.section}] ${w.msg}`));
  }

  await mongoose.disconnect();
  process.exit(issues.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
