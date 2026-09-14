import mongoose from 'mongoose';
import { ValidationError, NotFoundError } from '../../../core/auth/errors.js';
import { logger } from '../../../utils/logger.js';
import { assertMongoConnected } from '../../../config/db.js';
import { SellerReturn } from '../seller/models/sellerReturn.model.js';
import { SellerOrder } from '../seller/models/sellerOrder.model.js';
import { QuickOrder } from '../models/order.model.js';
import { loadReturnPickupContext, resolveReturnPickupCharge } from '../utils/returnPickup.helpers.js';
import { resolveSellerReceivable } from '../utils/sellerReceivable.helpers.js';
import { restoreReturnItemsStockOnce } from '../utils/stock.helpers.js';
import {
  REFUND_STATUSES,
  RETURN_STATUSES,
  extractPayoutDetailsFromReturn,
  sanitizeRefundAuditMetadata,
  serializeReturnForAdmin,
} from '../utils/return.helpers.js';
import { processQuickCommerceReturnRefund, syncParentOrderRefundFromReturn } from './quickRefund.service.js';
import { appendCumulativeReturnItems } from '../utils/returnRefundCalculation.helpers.js';
import {
  LEDGER_TYPES,
  deductOrderPaymentBeforeSettlement,
  getSellerUnsettledCreditSummary,
  getSellersWithNegativeBalance,
  getPendingReturnRecoveries,
  getReturnRecoverySummary,
  recordSellerLedgerEntry,
  reconcileSellerLedgerBalance,
} from './sellerLedger.service.js';

const num = (value) => Number(value || 0);
const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const normalizeQualityCheckRole = (role) => {
  const raw = String(role || '').trim().toUpperCase();
  if (raw === 'SELLER' || raw === 'ADMIN' || raw === 'SYSTEM') return raw;
  if (raw === 'DELIVERY_PARTNER' || raw === 'DELIVERY' || raw === 'RIDER') return 'DELIVERY_PARTNER';
  return 'SYSTEM';
};

const resolveReturnedGrossFromReturn = (returnDoc, sellerOrder = null) => {
  const fromReturn = (Array.isArray(returnDoc?.returnItems) ? returnDoc.returnItems : []).reduce(
    (sum, item) =>
      sum +
      Number(item?.unitPrice ?? item?.price ?? 0) *
        Number(item?.returnedQty ?? item?.quantity ?? 0),
    0,
  );
  if (fromReturn > 0) return roundMoney(fromReturn);

  const fromSellerItems = (Array.isArray(sellerOrder?.items) ? sellerOrder.items : []).reduce(
    (sum, item) => sum + Number(item?.price || 0) * Number(item?.quantity || 0),
    0,
  );
  if (fromSellerItems > 0) return roundMoney(fromSellerItems);

  return roundMoney(Number(sellerOrder?.pricing?.subtotal || returnDoc?.pricing?.subtotal || 0));
};

/**
 * Seller clawback for a return: product earnings only.
 * Packing fee stays with the seller (customer is not refunded packing;
 * admin must not retain packing on return).
 * Excludes customer GST / platform fees — those stay on admin side.
 */
export const computeSellerReturnClawback = async (returnDoc) => {
  if (!returnDoc?.sellerId || !returnDoc?.orderId) return 0;

  const sellerOrder = await SellerOrder.findOne({
    sellerId: returnDoc.sellerId,
    orderId: String(returnDoc.orderId),
  }).lean();

  const returnedGross = resolveReturnedGrossFromReturn(returnDoc, sellerOrder);
  if (returnedGross <= 0) {
    const couponShare = num(returnDoc?.pricing?.couponShare);
    const itemSubtotal = num(returnDoc?.pricing?.subtotal);
    return Math.max(0, roundMoney(itemSubtotal - couponShare));
  }

  if (!sellerOrder) {
    const couponShare = (Array.isArray(returnDoc?.returnItems) ? returnDoc.returnItems : []).reduce(
      (sum, item) => sum + Number(item?.couponShare || 0),
      0,
    );
    return Math.max(0, roundMoney(returnedGross - couponShare));
  }

  const subtotal = Math.max(0, num(sellerOrder.pricing?.subtotal));
  let packingFee = Math.max(0, num(sellerOrder.pricing?.packingFee));
  // Legacy seller orders may omit packingFee even though packing was credited in receivable.
  // Resolve from parent QuickOrder so packing is never clawed into the platform.
  if (packingFee <= 0) {
    const parentOrder = await QuickOrder.findOne({ orderId: String(returnDoc.orderId) })
      .select('pricing.packagingFee pricing.packingFee')
      .lean();
    packingFee = Math.max(
      0,
      num(parentOrder?.pricing?.packagingFee ?? parentOrder?.pricing?.packingFee),
    );
  }
  const receivable = resolveSellerReceivable(sellerOrder.pricing);
  const productEarnings = Number.isFinite(Number(sellerOrder.pricing?.productEarnings))
    ? num(sellerOrder.pricing.productEarnings)
    : roundMoney(Math.max(0, receivable - packingFee));

  const ratio = subtotal > 0 ? Math.min(1, returnedGross / subtotal) : 1;
  const clawProduct = roundMoney(productEarnings * ratio);
  // Packing is never clawed — seller keeps packing fee on the order.
  const clawTotal = Math.max(0, clawProduct);

  if (receivable >= 0) {
    // Leave packing intact on the seller receivable when capping.
    const maxClawable = Math.max(0, roundMoney(receivable - packingFee));
    return Math.max(0, Math.min(maxClawable, clawTotal));
  }
  // Rare negative receivable (heavy seller coupon): still claw product share.
  return clawTotal;
};

/**
 * Repair seller-order finance after older return clawbacks that:
 * - wiped packing into receivable 0, or
 * - zeroed commission (which falsely tanks admin earning while admin coupon remains).
 */
export const healSellerOrderFinanceAfterReturn = async (returnDoc) => {
  if (!returnDoc?.sellerId || !returnDoc?.orderId) {
    return { healed: false, reason: 'missing_ids' };
  }

  const sellerOrder = await SellerOrder.findOne({
    sellerId: returnDoc.sellerId,
    orderId: String(returnDoc.orderId),
  });
  if (!sellerOrder) return { healed: false, reason: 'seller_order_missing' };

  const pricing = sellerOrder.pricing || {};
  const parentOrder = await QuickOrder.findOne({ orderId: String(returnDoc.orderId) })
    .select('pricing.packagingFee pricing.packingFee pricing.subtotal pricing.discount pricing.appliedCoupon')
    .lean();

  let packingFee = Math.max(0, num(pricing.packingFee));
  if (packingFee <= 0) {
    packingFee = Math.max(
      0,
      num(parentOrder?.pricing?.packagingFee ?? parentOrder?.pricing?.packingFee),
    );
  }

  const receivable = resolveSellerReceivable(pricing);
  const commission = Math.max(0, num(pricing.commission));
  const commissionAtSaleStored = Number(pricing.commissionAtSale);
  let commissionAtSale =
    Number.isFinite(commissionAtSaleStored) && commissionAtSaleStored > 0
      ? commissionAtSaleStored
      : commission;

  const clawed = Math.max(0, num(returnDoc?.finance?.sellerReceivableClawed));
  const parentSubtotal = Math.max(0, num(parentOrder?.pricing?.subtotal || pricing.subtotal));
  const couponSource = String(parentOrder?.pricing?.appliedCoupon?.source || '').toLowerCase();
  const rawDiscount = Math.max(
    0,
    num(parentOrder?.pricing?.discount ?? parentOrder?.pricing?.appliedCoupon?.discount),
  );
  const adminDiscount =
    couponSource === 'admin'
      ? rawDiscount >= parentSubtotal && parentSubtotal > 0
        ? Math.max(0, num(returnDoc?.pricing?.couponShare) || roundMoney(parentSubtotal * 0.1))
        : rawDiscount
      : 0;

  if (commissionAtSale <= 0 && parentSubtotal > 0) {
    // Sale: productEarnings ≈ subtotal − commission. Full-return claw ≈ productEarnings.
    // Older bugs sometimes clawed packing too → inferred goes negative; subtract packing once.
    let inferred = roundMoney(parentSubtotal - clawed);
    if (inferred < 0 && packingFee > 0) {
      inferred = roundMoney(parentSubtotal - Math.max(0, clawed - packingFee));
    }
    if (clawed > 0 && inferred >= 0) {
      commissionAtSale = inferred;
    } else if (adminDiscount > 0) {
      commissionAtSale = adminDiscount;
    }
    commissionAtSale = Math.min(Math.max(0, commissionAtSale), parentSubtotal);
  }

  const nextReceivable = roundMoney(Math.max(packingFee, receivable));
  const needsPackingHeal =
    packingFee > 0 &&
    (Math.abs(num(pricing.packingFee) - packingFee) > 0.009 ||
      nextReceivable - receivable > 0.009);
  const needsCommissionHeal =
    commissionAtSale > 0 &&
    (commissionAtSale - commission > 0.009 ||
      !(Number.isFinite(commissionAtSaleStored) && commissionAtSaleStored > 0));
  if (!needsPackingHeal && !needsCommissionHeal) {
    return { healed: false, reason: 'already_ok' };
  }

  sellerOrder.pricing = {
    ...(pricing.toObject?.() || pricing),
    packingFee,
    receivable: nextReceivable,
    commission: commissionAtSale,
    commissionAtSale,
  };
  sellerOrder.markModified('pricing');
  await sellerOrder.save();

  try {
    const { syncSellerDeliveredOrderPaymentCredits } = await import('./sellerLedger.service.js');
    await syncSellerDeliveredOrderPaymentCredits(returnDoc.sellerId);
  } catch (syncErr) {
    logger.warn(
      `[ReturnFinance] Order Payment sync after heal skipped: ${syncErr?.message || syncErr}`,
    );
  }

  logger.info(
    `[ReturnFinance] Healed SellerOrder ${returnDoc.orderId} packing=${packingFee} receivable=${nextReceivable} commission=${commissionAtSale}`,
  );

  return {
    healed: true,
    packingFee,
    receivable: nextReceivable,
    commission: commissionAtSale,
  };
};

export const adjustSellerOrderReceivableForReturn = async (returnDoc, clawAmountInput = null) => {
  if (!returnDoc?._id || !returnDoc?.sellerId || !returnDoc?.orderId) {
    return { adjusted: false, clawed: 0 };
  }
  if (returnDoc?.finance?.sellerReceivableAdjusted) {
    await healSellerOrderFinanceAfterReturn(returnDoc);
    return {
      adjusted: false,
      alreadyAdjusted: true,
      clawed: num(returnDoc.finance.sellerReceivableClawed),
    };
  }

  const clawAmount =
    clawAmountInput != null ? roundMoney(clawAmountInput) : await computeSellerReturnClawback(returnDoc);

  const claimed = await SellerReturn.findOneAndUpdate(
    {
      _id: returnDoc._id,
      'finance.sellerReceivableAdjusted': { $ne: true },
    },
    {
      $set: {
        'finance.sellerReceivableAdjusted': true,
        'finance.sellerReceivableClawed': Math.max(0, clawAmount),
      },
    },
    { new: true },
  );

  if (!claimed) {
    const current = await SellerReturn.findById(returnDoc._id).lean();
    if (current) await healSellerOrderFinanceAfterReturn(current);
    return {
      adjusted: false,
      alreadyAdjusted: true,
      clawed: num(current?.finance?.sellerReceivableClawed),
    };
  }

  if (clawAmount <= 0) {
    if (returnDoc.finance) {
      returnDoc.finance.sellerReceivableAdjusted = true;
      returnDoc.finance.sellerReceivableClawed = 0;
    }
    return { adjusted: true, clawed: 0 };
  }

  const sellerOrder = await SellerOrder.findOne({
    sellerId: returnDoc.sellerId,
    orderId: String(returnDoc.orderId),
  });
  if (!sellerOrder) {
    return { adjusted: true, clawed: clawAmount, reason: 'seller_order_missing' };
  }

  const pricing = sellerOrder.pricing || {};
  const subtotal = Math.max(0, num(pricing.subtotal));
  let packingFee = Math.max(0, num(pricing.packingFee));
  if (packingFee <= 0) {
    const parentOrder = await QuickOrder.findOne({ orderId: String(returnDoc.orderId) })
      .select('pricing.packagingFee pricing.packingFee')
      .lean();
    packingFee = Math.max(
      0,
      num(parentOrder?.pricing?.packagingFee ?? parentOrder?.pricing?.packingFee),
    );
  }
  const commission = Math.max(0, num(pricing.commission));
  const couponDiscount = num(pricing.couponDiscount);
  const receivable = resolveSellerReceivable(pricing);
  const productEarnings = Number.isFinite(Number(pricing.productEarnings))
    ? num(pricing.productEarnings)
    : roundMoney(Math.max(0, receivable - packingFee));

  const returnedGross = resolveReturnedGrossFromReturn(returnDoc, sellerOrder.toObject?.() || sellerOrder);
  const ratio = subtotal > 0 ? Math.min(1, returnedGross / subtotal) : 1;
  const clawProduct = roundMoney(productEarnings * ratio);
  const maxClawable = Math.max(0, roundMoney(receivable - packingFee));
  const appliedClaw = Math.min(
    Math.max(0, clawAmount),
    Math.max(0, receivable) > 0 ? maxClawable : Math.max(0, clawAmount),
  );

  const nextProductEarnings = roundMoney(productEarnings - clawProduct);
  // Packing fee stays with seller on return (not refunded to customer, not kept by admin).
  const nextPackingFee = packingFee;
  const nextSubtotal = Math.max(0, roundMoney(subtotal - returnedGross));
  // Keep original sale commission / seller-coupon metadata for admin reporting.
  // Zeroing them after return falsely drives admin earning negative (coupon remains, commission vanishes).
  const commissionAtSale = Number.isFinite(Number(pricing.commissionAtSale))
    ? num(pricing.commissionAtSale)
    : commission;
  const nextReceivable = roundMoney(Math.max(packingFee, receivable - appliedClaw));
  const nextTotal = Math.max(0, roundMoney(num(pricing.total) - appliedClaw));

  sellerOrder.pricing = {
    ...(pricing.toObject?.() || pricing),
    subtotal: nextSubtotal,
    commission: commissionAtSale,
    commissionAtSale,
    couponDiscount,
    productEarnings: nextProductEarnings,
    packingFee: nextPackingFee,
    receivable: nextReceivable,
    total: nextTotal,
  };
  sellerOrder.markModified('pricing');
  await sellerOrder.save();

  if (appliedClaw !== clawAmount) {
    await SellerReturn.updateOne(
      { _id: returnDoc._id },
      { $set: { 'finance.sellerReceivableClawed': appliedClaw } },
    );
  }

  if (!returnDoc.finance) returnDoc.finance = {};
  returnDoc.finance.sellerReceivableAdjusted = true;
  returnDoc.finance.sellerReceivableClawed = appliedClaw;

  logger.info(
    `[ReturnFinance] SellerOrder receivable clawed ${appliedClaw} for return ${returnDoc._id}`,
  );

  return { adjusted: true, clawed: appliedClaw };
};

export const ensureReturnRefundSideEffects = async (returnDoc) => {
  if (!returnDoc?._id) return { stockRestored: false, receivableAdjusted: false };
  const refundStatus = String(returnDoc.refundStatus || '').toLowerCase();
  if (refundStatus !== REFUND_STATUSES.COMPLETED && refundStatus !== 'completed') {
    return { stockRestored: false, receivableAdjusted: false };
  }

  let stockRestored = false;
  let receivableAdjusted = false;

  try {
    stockRestored = Boolean(await restoreReturnItemsStockOnce(returnDoc));
  } catch (error) {
    logger.error(
      `[ReturnFinance] Stock restore side-effect failed for ${returnDoc._id}: ${error?.message || error}`,
    );
  }

  try {
    const claw = await computeSellerReturnClawback(returnDoc);
    const result = await adjustSellerOrderReceivableForReturn(returnDoc, claw);
    receivableAdjusted = Boolean(result.adjusted || result.alreadyAdjusted);
    if (result.alreadyAdjusted) {
      await healSellerOrderFinanceAfterReturn(returnDoc);
    }
  } catch (error) {
    logger.error(
      `[ReturnFinance] Receivable side-effect failed for ${returnDoc._id}: ${error?.message || error}`,
    );
  }

  return { stockRestored, receivableAdjusted };
};

export const buildReturnRefundReference = (returnDoc) => {
  const returnId = String(returnDoc?._id || '');
  const method = String(returnDoc?.refundMethod || 'unknown').toLowerCase();
  return `QC-RET-${returnId.slice(-8).toUpperCase()}-${method}`;
};

export const appendReturnRefundAudit = (returnDoc, entry) => {
  if (!returnDoc) return returnDoc;
  if (!Array.isArray(returnDoc.refundAuditLog)) returnDoc.refundAuditLog = [];
  returnDoc.refundAuditLog.push({
    at: new Date(),
    action: entry?.action || '',
    refundStatus: entry?.refundStatus || returnDoc.refundStatus || REFUND_STATUSES.NONE,
    refundMethod: entry?.refundMethod || returnDoc.refundMethod || '',
    amount: num(entry?.amount ?? returnDoc.returnRefundAmount),
    refundTransactionId: entry?.refundTransactionId || returnDoc.refundTransactionId || '',
    refundReference: entry?.refundReference || returnDoc.refundReference || '',
    actorId: entry?.actorId && mongoose.Types.ObjectId.isValid(entry.actorId) ? entry.actorId : undefined,
    actorRole: entry?.actorRole || 'SYSTEM',
    note: entry?.note || '',
    metadata: sanitizeRefundAuditMetadata(entry?.metadata || {}),
  });
  return returnDoc;
};

const resolveReturnPickupFee = async (returnDoc) => {
  const stored = resolveReturnPickupCharge(returnDoc);
  if (stored > 0) return stored;

  const ctx = await loadReturnPickupContext(returnDoc);
  return resolveReturnPickupCharge({
    ...returnDoc?.toObject?.() || returnDoc,
    calculatedPickupCharge: ctx.calculatedPickupCharge,
    riderEarning: ctx.riderEarning,
  });
};

export const applyReturnSellerFinance = async (
  returnDoc,
  { actorId = null, actorRole = 'SYSTEM', reason = 'Return seller finance adjustment' } = {},
) => {
  if (!returnDoc) throw new ValidationError('Return document is required');

  if (returnDoc?.finance?.sellerLedgerApplied) {
    await ensureReturnRefundSideEffects(returnDoc);
    return {
      alreadyApplied: true,
      finance: returnDoc.finance,
    };
  }

  const sellerId = returnDoc.sellerId;
  const orderId = String(returnDoc.orderId || '');
  const returnId = returnDoc._id;
  // Debit seller for product earnings only (packing stays with seller; GST funded by admin).
  const sellerClawAmount = await computeSellerReturnClawback(returnDoc);
  const refundAmount = Math.max(0, sellerClawAmount);
  if (refundAmount < 0) {
    throw new ValidationError('Return refund amount cannot be negative');
  }
  const pickupFee = await resolveReturnPickupFee(returnDoc);

  await reconcileSellerLedgerBalance(sellerId);

  const summary = await getSellerUnsettledCreditSummary(sellerId);
  let preSettlementDeducted = 0;
  let postSettlementDebited = 0;
  let settlementMode = '';

  if (refundAmount > 0) {
    const preSettlementAttempt = Math.min(refundAmount, summary.unwithdrawnCredits);
    if (preSettlementAttempt > 0) {
      const preResult = await deductOrderPaymentBeforeSettlement({
        sellerId,
        orderId,
        returnId,
        deductAmount: preSettlementAttempt,
        actorId,
        actorRole,
        reason,
      });
      preSettlementDeducted = num(preResult.deducted);
    }

    const remaining = Math.max(0, refundAmount - preSettlementDeducted);
    if (remaining > 0) {
      const postResult = await recordSellerLedgerEntry({
        sellerId,
        type: LEDGER_TYPES.RETURN_REFUND,
        amount: -remaining,
        referenceId: `return_refund_post:${returnId}`,
        orderId,
        returnId,
        reason: `${reason} (post-settlement recovery)`,
        actorId,
        actorRole,
        status: 'Settled',
        settlementState: 'settled',
        metadata: {
          mode: 'post_settlement',
          refundAmount: remaining,
          customerRefundAmount: num(returnDoc.returnRefundAmount),
          sellerClawAmount: refundAmount,
        },
      });
      postSettlementDebited = Math.abs(num(postResult.entry?.amount));
    }

    if (preSettlementDeducted > 0 && postSettlementDebited > 0) settlementMode = 'mixed';
    else if (preSettlementDeducted > 0) settlementMode = 'pre_settlement';
    else if (postSettlementDebited > 0) settlementMode = 'post_settlement';
  }

  // Pickup rider is paid by the platform. Do not debit seller for new returns.
  const pickupFeeDebited = 0;
  const adminPickupFeeCharged = Math.max(0, Number(pickupFee || 0));

  const financeSnapshot = {
    sellerLedgerApplied: true,
    sellerLedgerAppliedAt: new Date(),
    settlementMode,
    preSettlementDeducted,
    postSettlementDebited,
    pickupFeeDebited,
    adminPickupFeeCharged,
    sellerReceivableAdjusted: false,
    sellerReceivableClawed: 0,
    stockRestoredAt: returnDoc?.finance?.stockRestoredAt || null,
  };

  const persisted = await SellerReturn.findOneAndUpdate(
    {
      _id: returnId,
      'finance.sellerLedgerApplied': { $ne: true },
    },
    { $set: { finance: financeSnapshot } },
    { new: true },
  );

  if (!persisted) {
    const current = await SellerReturn.findById(returnId);
    if (current) await ensureReturnRefundSideEffects(current);
    return {
      alreadyApplied: true,
      finance: current?.finance || financeSnapshot,
      preSettlementDeducted,
      postSettlementDebited,
      pickupFeeDebited,
    };
  }

  returnDoc.finance = persisted.finance;

  await adjustSellerOrderReceivableForReturn(returnDoc, refundAmount);
  try {
    await restoreReturnItemsStockOnce(returnDoc);
  } catch (stockErr) {
    logger.error(
      `[ReturnFinance] Stock restore failed after finance for ${returnId}: ${stockErr?.message || stockErr}`,
    );
  }

  // Reload finance flags after side effects
  const freshFinance = await SellerReturn.findById(returnId).select('finance').lean();
  if (freshFinance?.finance) returnDoc.finance = freshFinance.finance;

  logger.info(
    `[ReturnFinance] Applied seller finance for return ${returnId}: claw=${refundAmount}, pre=${preSettlementDeducted}, post=${postSettlementDebited}, pickup=${pickupFeeDebited}`,
  );

  return {
    alreadyApplied: false,
    finance: returnDoc.finance,
    preSettlementDeducted,
    postSettlementDebited,
    pickupFeeDebited,
    sellerClawAmount: refundAmount,
  };
};

export const executeReturnCustomerRefund = async (
  returnDoc,
  order,
  { actorId = null, actorRole = 'ADMIN', note = '', payoutDetails = {} } = {},
) => {
  if (!returnDoc) throw new ValidationError('Return document is required');
  if (!order) throw new NotFoundError('Parent order not found');

  if (returnDoc.refundStatus === REFUND_STATUSES.COMPLETED && returnDoc.refundTransactionId) {
    return {
      alreadyProcessed: true,
      processed: true,
      pending: false,
      refundResult: {
        processed: true,
        alreadyProcessed: true,
        method: returnDoc.refundMethod,
        amount: num(returnDoc.returnRefundAmount),
        refundTransactionId: returnDoc.refundTransactionId,
        refundReference: returnDoc.refundReference,
      },
    };
  }

  if (!returnDoc.refundReference) {
    returnDoc.refundReference = buildReturnRefundReference(returnDoc);
  }

  if (returnDoc.refundStatus === REFUND_STATUSES.PROCESSING) {
    const recoveryResult = await processQuickCommerceReturnRefund(returnDoc, order, { payoutDetails });
    if (recoveryResult?.alreadyProcessed && recoveryResult?.processed) {
      returnDoc.refundStatus = REFUND_STATUSES.COMPLETED;
      returnDoc.refundTransactionId = recoveryResult.refundTransactionId || returnDoc.refundTransactionId;
      returnDoc.returnStatus = RETURN_STATUSES.REFUND_COMPLETED;
      appendCumulativeReturnItems(returnDoc, order);
      appendReturnRefundAudit(returnDoc, {
        action: 'REFUND_COMPLETED',
        refundStatus: REFUND_STATUSES.COMPLETED,
        refundTransactionId: returnDoc.refundTransactionId,
        refundReference: returnDoc.refundReference,
        actorId,
        actorRole,
        note: 'Recovered wallet refund after prior processing interruption',
        metadata: { method: recoveryResult.method, amount: recoveryResult.amount },
      });
      await returnDoc.save();
      await syncParentOrderRefundFromReturn(order, returnDoc);
      return {
        alreadyProcessed: true,
        processed: true,
        pending: false,
        refundResult: recoveryResult,
      };
    }
  }

  const lockedReturn = await SellerReturn.findOneAndUpdate(
    {
      _id: returnDoc._id,
      refundStatus: { $nin: [REFUND_STATUSES.COMPLETED, REFUND_STATUSES.PROCESSING] },
    },
    { $set: { refundStatus: REFUND_STATUSES.PROCESSING } },
    { new: true },
  );

  if (!lockedReturn) {
    const current = await SellerReturn.findById(returnDoc._id).lean();
    if (current?.refundStatus === REFUND_STATUSES.COMPLETED) {
      return {
        alreadyProcessed: true,
        processed: true,
        pending: false,
        refundResult: {
          processed: true,
          alreadyProcessed: true,
          method: current.refundMethod,
          amount: num(current.returnRefundAmount),
          refundTransactionId: current.refundTransactionId,
          refundReference: current.refundReference,
        },
      };
    }
    throw new ValidationError('Refund is already being processed for this return');
  }

  returnDoc.refundStatus = REFUND_STATUSES.PROCESSING;
  appendReturnRefundAudit(returnDoc, {
    action: 'REFUND_PROCESSING',
    refundStatus: REFUND_STATUSES.PROCESSING,
    actorId,
    actorRole,
    note: note || 'Refund processing started',
  });
  await returnDoc.save();

  const refundResult = await processQuickCommerceReturnRefund(returnDoc, order, { payoutDetails });

  if (refundResult?.pending) {
    returnDoc.refundStatus = REFUND_STATUSES.PENDING;
    returnDoc.refundTransactionId = refundResult.refundTransactionId || returnDoc.refundTransactionId;
    appendReturnRefundAudit(returnDoc, {
      action: 'REFUND_QUEUED',
      refundStatus: REFUND_STATUSES.PENDING,
      refundTransactionId: returnDoc.refundTransactionId,
      refundReference: returnDoc.refundReference,
      actorId,
      actorRole,
      note: refundResult.message || 'Refund queued for admin payout',
      metadata: { payoutDetails },
    });
    await returnDoc.save();
    await syncParentOrderRefundFromReturn(order, returnDoc);

    return { alreadyProcessed: false, processed: false, pending: true, refundResult };
  }

  if (!refundResult?.processed) {
    returnDoc.refundStatus = REFUND_STATUSES.FAILED;
    appendReturnRefundAudit(returnDoc, {
      action: 'REFUND_FAILED',
      refundStatus: REFUND_STATUSES.FAILED,
      actorId,
      actorRole,
      note: refundResult?.message || 'Refund failed',
      metadata: { reason: refundResult?.reason || 'unknown' },
    });
    await returnDoc.save();
    await syncParentOrderRefundFromReturn(order, returnDoc);
    return { alreadyProcessed: false, processed: false, pending: false, refundResult };
  }

  returnDoc.refundStatus = REFUND_STATUSES.COMPLETED;
  returnDoc.refundTransactionId = refundResult.refundTransactionId || returnDoc.refundTransactionId;
  returnDoc.returnStatus = RETURN_STATUSES.REFUND_COMPLETED;
  appendCumulativeReturnItems(returnDoc, order);
  appendReturnRefundAudit(returnDoc, {
    action: 'REFUND_COMPLETED',
    refundStatus: REFUND_STATUSES.COMPLETED,
    refundTransactionId: returnDoc.refundTransactionId,
    refundReference: returnDoc.refundReference,
    actorId,
    actorRole,
    note: refundResult.message || note || 'Refund completed',
    metadata: { method: refundResult.method, amount: refundResult.amount },
  });
  await returnDoc.save();
  await syncParentOrderRefundFromReturn(order, returnDoc);
  await ensureReturnRefundSideEffects(returnDoc);

  return { alreadyProcessed: false, processed: true, pending: false, refundResult };
};

export const passReturnQualityCheckAndRefund = async ({
  returnId,
  actorId = null,
  actorRole = 'SELLER',
  notes = '',
  force = false,
}) => {
  assertMongoConnected();

  const returnDoc = await SellerReturn.findById(returnId);
  if (!returnDoc) throw new NotFoundError('Return request not found');

  if (returnDoc.qualityCheck?.status === 'passed' && returnDoc.refundStatus === REFUND_STATUSES.COMPLETED) {
    return {
      alreadyProcessed: true,
      qualityPassed: true,
      return: serializeReturnForAdmin(returnDoc.toObject()),
    };
  }

  if (
    returnDoc.qualityCheck?.status === 'passed' &&
    returnDoc.refundStatus === REFUND_STATUSES.PENDING
  ) {
    return {
      alreadyProcessed: true,
      qualityPassed: true,
      refundQueued: true,
      return: serializeReturnForAdmin(returnDoc.toObject()),
      message: 'Quality check already passed — refund is pending payout',
    };
  }

  if (!force && returnDoc.returnStatus !== RETURN_STATUSES.RETURNED) {
    throw new ValidationError('Quality check refund requires return status to be returned');
  }

  returnDoc.qualityCheck = {
    ...(returnDoc.qualityCheck?.toObject?.() || returnDoc.qualityCheck || {}),
    status: 'passed',
    notes: String(notes || '').trim(),
    checkedAt: new Date(),
    checkedByRole: normalizeQualityCheckRole(actorRole),
    checkedById: actorId && mongoose.Types.ObjectId.isValid(actorId) ? actorId : null,
  };
  if (!returnDoc.refundReference) {
    returnDoc.refundReference = buildReturnRefundReference(returnDoc);
  }
  await returnDoc.save();

  const order = await QuickOrder.findOne({
    orderId: returnDoc.orderId,
    orderType: { $in: ['quick', 'mixed'] },
  });
  if (!order) throw new NotFoundError('Parent order not found');

  const method = String(returnDoc.refundMethod || '').toLowerCase();
  const payoutDetails = extractPayoutDetailsFromReturn(returnDoc);

  const refundExecution = await executeReturnCustomerRefund(returnDoc, order, {
    actorId,
    actorRole,
    note:
      notes ||
      (method === 'wallet'
        ? 'Automatic wallet refund after quality pass'
        : 'Refund queued after quality pass'),
    payoutDetails,
  });

  if (refundExecution.processed && method === 'wallet') {
    await applyReturnSellerFinance(returnDoc, {
      actorId,
      actorRole,
      reason: 'Return wallet refund finance',
    });
  }

  const fresh = await SellerReturn.findById(returnId).lean();
  const serialized = serializeReturnForAdmin(fresh || returnDoc.toObject());

  return {
    qualityPassed: true,
    autoRefundTriggered: method === 'wallet' && Boolean(refundExecution.processed),
    refundQueued: Boolean(refundExecution.pending),
    refund: refundExecution,
    return: serialized,
    message: refundExecution.pending
      ? 'Quality check passed — refund is now pending payout'
      : refundExecution.processed
        ? 'Quality check passed and wallet refund completed'
        : refundExecution.refundResult?.message || 'Quality check passed',
  };
};

export const getPendingReturnCustomerPayouts = async ({ limit = 100 } = {}) => {
  const items = await SellerReturn.find({
    refundStatus: REFUND_STATUSES.PENDING,
    refundMethod: { $in: ['upi', 'bank'] },
    returnStatus: { $ne: RETURN_STATUSES.CANCELLED },
  })
    .sort({ updatedAt: -1 })
    .limit(Math.min(500, Math.max(1, Number(limit) || 100)))
    .lean();

  return items.map((row) => ({
    returnId: String(row._id),
    orderId: row.orderId,
    sellerId: String(row.sellerId || ''),
    refundMethod: row.refundMethod,
    refundStatus: row.refundStatus,
    amount: num(row.returnRefundAmount),
    refundTransactionId: row.refundTransactionId || '',
    refundReference: row.refundReference || buildReturnRefundReference(row),
    customer: row.customer || {},
    updatedAt: row.updatedAt,
  }));
};

export const getReturnFinanceReport = async () => {
  assertMongoConnected();

  const [negativeBalanceSellers, pendingRecoveries, recoverySummary, pendingPayouts] =
    await Promise.all([
      getSellersWithNegativeBalance(),
      getPendingReturnRecoveries(),
      getReturnRecoverySummary(),
      getPendingReturnCustomerPayouts(),
    ]);

  return {
    negativeBalanceSellers,
    pendingRecoveries,
    pendingPayouts,
    recoverySummary,
    generatedAt: new Date(),
  };
};

export const getSellerFinanceBalanceReport = async (sellerId) => {
  const { getSellerWithdrawableBalance, getSellerLedgerEntries } = await import('./sellerLedger.service.js');
  const [balance, ledger] = await Promise.all([
    getSellerWithdrawableBalance(sellerId),
    getSellerLedgerEntries({ sellerId, limit: 100 }),
  ]);
  return { balance, ledger };
};

export const confirmPendingReturnPayout = async ({
  returnId,
  actorId = null,
  actorRole = 'ADMIN',
  payoutReference = '',
  note = '',
}) => {
  assertMongoConnected();

  const returnDoc = await SellerReturn.findById(returnId);
  if (!returnDoc) throw new NotFoundError('Return request not found');

  if (returnDoc.refundStatus === REFUND_STATUSES.COMPLETED) {
    const order = await QuickOrder.findOne({
      orderId: returnDoc.orderId,
      orderType: { $in: ['quick', 'mixed'] },
    });
    if (order) await syncParentOrderRefundFromReturn(order, returnDoc);
    return { alreadyProcessed: true, return: returnDoc.toObject() };
  }

  if (returnDoc.refundStatus !== REFUND_STATUSES.PENDING) {
    throw new ValidationError('Only pending UPI/Bank return refunds can be confirmed');
  }

  const order = await QuickOrder.findOne({
    orderId: returnDoc.orderId,
    orderType: { $in: ['quick', 'mixed'] },
  });
  if (!order) throw new NotFoundError('Parent order not found');

  returnDoc.refundStatus = REFUND_STATUSES.COMPLETED;
  returnDoc.returnStatus = RETURN_STATUSES.REFUND_COMPLETED;
  appendCumulativeReturnItems(returnDoc, order);
  if (payoutReference) returnDoc.refundReference = String(payoutReference).trim();
  if (!returnDoc.refundReference) returnDoc.refundReference = buildReturnRefundReference(returnDoc);

  appendReturnRefundAudit(returnDoc, {
    action: 'REFUND_PAYOUT_CONFIRMED',
    refundStatus: REFUND_STATUSES.COMPLETED,
    refundReference: returnDoc.refundReference,
    actorId,
    actorRole,
    note: note || 'Admin confirmed UPI/Bank payout',
    metadata: { payoutReference },
  });
  await returnDoc.save();
  await syncParentOrderRefundFromReturn(order, returnDoc);

  await applyReturnSellerFinance(returnDoc, {
    actorId,
    actorRole,
    reason: 'Return refund after admin payout confirmation',
  });
  await ensureReturnRefundSideEffects(returnDoc);

  return { alreadyProcessed: false, return: returnDoc.toObject() };
};
