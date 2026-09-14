import mongoose from 'mongoose';
import { ValidationError } from '../../../core/auth/errors.js';
import { logger } from '../../../utils/logger.js';
import { Seller } from '../seller/models/seller.model.js';
import { SellerOrder } from '../seller/models/sellerOrder.model.js';
import { SellerTransaction } from '../seller/models/sellerTransaction.model.js';
import { SellerReturn } from '../seller/models/sellerReturn.model.js';
import { QuickOrder } from '../models/order.model.js';
import { resolveSellerReceivable } from '../utils/sellerReceivable.helpers.js';

const num = (value) => Number(value || 0);

export const LEDGER_TYPES = {
  ORDER_CREDIT: 'ORDER_CREDIT',
  ORDER_PAYMENT: 'Order Payment',
  RETURN_REFUND: 'RETURN_REFUND',
  RETURN_PICKUP_FEE: 'RETURN_PICKUP_FEE',
  COMMISSION: 'COMMISSION',
  SETTLEMENT: 'SETTLEMENT',
  MANUAL_ADJUSTMENT: 'MANUAL_ADJUSTMENT',
  WITHDRAWAL: 'Withdrawal',
  ADJUSTMENT: 'Adjustment',
};

const CREDIT_TYPES = new Set([
  LEDGER_TYPES.ORDER_CREDIT,
  LEDGER_TYPES.ORDER_PAYMENT,
  LEDGER_TYPES.MANUAL_ADJUSTMENT,
  LEDGER_TYPES.ADJUSTMENT,
]);

const DEBIT_TYPES = new Set([
  LEDGER_TYPES.RETURN_REFUND,
  LEDGER_TYPES.RETURN_PICKUP_FEE,
  LEDGER_TYPES.COMMISSION,
  LEDGER_TYPES.WITHDRAWAL,
]);

const buildAuditEntry = ({
  action,
  beforeBalance,
  afterBalance,
  referenceId,
  actorId = null,
  actorRole = 'SYSTEM',
  reason = '',
  metadata = {},
}) => ({
  at: new Date(),
  action,
  beforeBalance,
  afterBalance,
  referenceId,
  actorId: actorId && mongoose.Types.ObjectId.isValid(actorId) ? actorId : undefined,
  actorRole,
  reason,
  metadata,
});

export const resolveSignedLedgerAmount = (txn) => {
  const type = String(txn?.type || '');
  const amount = num(txn?.amount);

  if (type === LEDGER_TYPES.WITHDRAWAL) {
    return amount <= 0 ? amount : -Math.abs(amount);
  }
  if (DEBIT_TYPES.has(type)) {
    return amount <= 0 ? amount : -Math.abs(amount);
  }
  if (type === LEDGER_TYPES.SETTLEMENT) {
    return amount;
  }
  if (CREDIT_TYPES.has(type)) {
    return Math.abs(amount);
  }
  return amount;
};

export const computeSellerLedgerBalanceFromTransactions = async (sellerId) => {
  const txns = await SellerTransaction.find({ sellerId }).select('type amount status').lean();
  return (txns || []).reduce((sum, txn) => {
    if (txn.type === LEDGER_TYPES.WITHDRAWAL && txn.status === 'Rejected') {
      return sum;
    }
    return sum + resolveSignedLedgerAmount(txn);
  }, 0);
};

export const ensureSellerLedgerBalance = async (sellerId) => {
  const seller = await Seller.findById(sellerId).select('finance').lean();
  if (seller?.finance?.ledgerSeeded) {
    return num(seller?.finance?.ledgerBalance);
  }

  return reconcileSellerLedgerBalance(sellerId);
};

export const reconcileSellerLedgerBalance = async (sellerId) => {
  const computed = await computeSellerLedgerBalanceFromTransactions(sellerId);
  await Seller.findByIdAndUpdate(sellerId, {
    $set: {
      'finance.ledgerBalance': computed,
      'finance.ledgerSeeded': true,
      'finance.lastLedgerAt': new Date(),
    },
  });
  return computed;
};

export const getSellerLedgerBalance = async (sellerId) => ensureSellerLedgerBalance(sellerId);

const resolveDirection = (signedAmount) => (signedAmount >= 0 ? 'credit' : 'debit');

export const recordSellerLedgerEntry = async ({
  sellerId,
  type,
  amount,
  referenceId,
  orderId = '',
  returnId = null,
  reason = '',
  actorId = null,
  actorRole = 'SYSTEM',
  status = 'Settled',
  customer = '',
  settlementState = '',
  metadata = {},
}) => {
  if (!sellerId) throw new ValidationError('sellerId is required for ledger entry');
  if (!type) throw new ValidationError('Ledger type is required');
  if (!referenceId) throw new ValidationError('referenceId is required for idempotent ledger entry');

  const existing = await SellerTransaction.findOne({ sellerId, referenceId }).lean();
  if (existing) {
    return {
      entry: existing,
      alreadyExists: true,
      balanceBefore: existing.balanceBefore,
      balanceAfter: existing.balanceAfter,
    };
  }

  const signedAmount = num(amount);
  const balanceBefore = await ensureSellerLedgerBalance(sellerId);
  const balanceAfter = balanceBefore + signedAmount;

  const audit = buildAuditEntry({
    action: type,
    beforeBalance: balanceBefore,
    afterBalance: balanceAfter,
    referenceId,
    actorId,
    actorRole,
    reason,
    metadata,
  });

  let entry;
  try {
    entry = await SellerTransaction.create({
      sellerId,
      type,
      amount: signedAmount,
      status,
      reference: referenceId,
      referenceId,
      orderId: String(orderId || ''),
      returnId: returnId && mongoose.Types.ObjectId.isValid(returnId) ? returnId : undefined,
      customer,
      direction: resolveDirection(signedAmount),
      balanceBefore,
      balanceAfter,
      actorId: actorId && mongoose.Types.ObjectId.isValid(actorId) ? actorId : undefined,
      actorRole,
      settlementState,
      reason,
      financeAudit: [audit],
      processedAt: status === 'Settled' ? new Date() : null,
    });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicate = await SellerTransaction.findOne({ sellerId, referenceId }).lean();
      if (duplicate) {
        return {
          entry: duplicate,
          alreadyExists: true,
          balanceBefore: duplicate.balanceBefore,
          balanceAfter: duplicate.balanceAfter,
        };
      }
    }
    throw error;
  }

  await Seller.findByIdAndUpdate(sellerId, {
    $set: {
      'finance.ledgerBalance': balanceAfter,
      'finance.ledgerSeeded': true,
      'finance.lastLedgerAt': new Date(),
    },
  });

  return { entry: entry.toObject(), alreadyExists: false, balanceBefore, balanceAfter };
};

export const getSellerUnsettledCreditSummary = async (sellerId) => {
  // Only type/status/amount are needed; projecting them avoids pulling the
  // unbounded financeAudit array on every balance summary read.
  const txns = await SellerTransaction.find({ sellerId })
    .select('type status amount')
    .lean();

  const orderCredits = (txns || [])
    .filter((txn) => txn.type === LEDGER_TYPES.ORDER_PAYMENT || txn.type === LEDGER_TYPES.ORDER_CREDIT)
    .reduce((sum, txn) => sum + Math.abs(num(txn.amount)), 0);

  const settledWithdrawals = (txns || [])
    .filter((txn) => txn.type === LEDGER_TYPES.WITHDRAWAL && txn.status === 'Settled')
    .reduce((sum, txn) => sum + Math.abs(num(txn.amount)), 0);

  const pendingWithdrawals = (txns || [])
    .filter(
      (txn) =>
        txn.type === LEDGER_TYPES.WITHDRAWAL &&
        ['Pending', 'Processing'].includes(String(txn.status || '')),
    )
    .reduce((sum, txn) => sum + Math.abs(num(txn.amount)), 0);

  const returnDebits = (txns || [])
    .filter((txn) =>
      [LEDGER_TYPES.RETURN_REFUND, LEDGER_TYPES.RETURN_PICKUP_FEE, LEDGER_TYPES.COMMISSION].includes(
        txn.type,
      ),
    )
    .reduce((sum, txn) => sum + Math.abs(num(txn.amount)), 0);

  const ledgerBalance = await getSellerLedgerBalance(sellerId);
  const unwithdrawnCredits = Math.max(0, orderCredits - settledWithdrawals - pendingWithdrawals - returnDebits);

  return {
    orderCredits,
    settledWithdrawals,
    pendingWithdrawals,
    returnDebits,
    ledgerBalance,
    unwithdrawnCredits,
  };
};

export const deductOrderPaymentBeforeSettlement = async ({
  sellerId,
  orderId,
  returnId,
  deductAmount,
  actorId = null,
  actorRole = 'SYSTEM',
  reason = 'Return deducted before seller settlement',
}) => {
  const amount = Math.max(0, num(deductAmount));
  if (!amount) return { deducted: 0, alreadyApplied: false };

  const referenceId = `return_pre_settlement:${returnId}`;
  const existing = await SellerTransaction.findOne({ sellerId, referenceId }).lean();
  if (existing) {
    return { deducted: Math.abs(num(existing.amount)), alreadyApplied: true, entry: existing };
  }

  const orderPayment = await SellerTransaction.findOne({
    sellerId,
    type: LEDGER_TYPES.ORDER_PAYMENT,
    orderId: String(orderId || ''),
  });

  if (!orderPayment) {
    return { deducted: 0, alreadyApplied: false, reason: 'order_payment_not_found' };
  }

  const currentAmount = Math.max(0, num(orderPayment.amount));
  const deductible = Math.min(amount, currentAmount);
  if (!deductible) {
    return { deducted: 0, alreadyApplied: false, reason: 'no_unsettled_order_credit' };
  }

  const audit = buildAuditEntry({
    action: 'RETURN_PRE_SETTLEMENT_DEDUCT',
    beforeBalance: await ensureSellerLedgerBalance(sellerId),
    afterBalance: null,
    referenceId,
    actorId,
    actorRole,
    reason,
    metadata: { orderId, returnId: String(returnId || ''), deductible, previousOrderAmount: currentAmount },
  });

  const nextOrderAmount = currentAmount - deductible;
  orderPayment.amount = nextOrderAmount;
  orderPayment.financeAudit = Array.isArray(orderPayment.financeAudit) ? orderPayment.financeAudit : [];
  orderPayment.financeAudit.push({
    ...audit,
    afterBalance: null,
  });
  orderPayment.settlementState = 'unsettled';
  await orderPayment.save();

  const syncedBalance = await computeSellerLedgerBalanceFromTransactions(sellerId);
  await Seller.findByIdAndUpdate(sellerId, {
    $set: {
      'finance.ledgerBalance': syncedBalance,
      'finance.ledgerSeeded': true,
      'finance.lastLedgerAt': new Date(),
    },
  });

  const marker = await recordSellerLedgerEntry({
    sellerId,
    type: LEDGER_TYPES.RETURN_REFUND,
    amount: 0,
    referenceId,
    orderId,
    returnId,
    reason,
    actorId,
    actorRole,
    status: 'Settled',
    settlementState: 'unsettled',
    metadata: {
      mode: 'pre_settlement',
      preSettlementDeducted: deductible,
      orderPaymentId: String(orderPayment._id),
    },
  });

  return {
    deducted: deductible,
    alreadyApplied: marker.alreadyExists,
    entry: marker.entry,
    orderPaymentAmount: nextOrderAmount,
    balanceAfter: syncedBalance,
  };
};

export const getSellerWithdrawableBalance = async (sellerId) => {
  const summary = await getSellerUnsettledCreditSummary(sellerId);
  const ledgerBalance = summary.ledgerBalance;
  return {
    ledgerBalance,
    pendingWithdrawals: summary.pendingWithdrawals,
    withdrawable: Math.max(0, ledgerBalance),
    hasNegativeBalance: ledgerBalance < 0,
    negativeBalance: ledgerBalance < 0 ? ledgerBalance : 0,
    unwithdrawnCredits: summary.unwithdrawnCredits,
  };
};

/**
 * Keep SellerTransaction "Order Payment" credits aligned with current SellerOrder.receivable
 * (incl. packing after returns). Without this, UI can show order-based balance while
 * withdrawal validation reads a clawed/stale ledger of ₹0.
 */
export const syncSellerDeliveredOrderPaymentCredits = async (sellerId) => {
  if (!sellerId) return { synced: 0, balance: 0 };

  const orders = await SellerOrder.find({ sellerId, status: 'delivered' })
    .select('orderId parentOrderId customer pricing deliveredAt updatedAt createdAt')
    .lean();

  if (!orders.length) {
    const balance = await reconcileSellerLedgerBalance(sellerId);
    return { synced: 0, balance };
  }

  const parentIds = [
    ...new Set(
      orders
        .map((o) => (o?.parentOrderId ? String(o.parentOrderId) : ''))
        .filter(Boolean),
    ),
  ];
  const parents = parentIds.length
    ? await QuickOrder.find({ _id: { $in: parentIds } })
        .select('_id pricing.subtotal pricing.packagingFee pricing.packingFee')
        .lean()
    : [];
  const parentMap = new Map(parents.map((p) => [String(p._id), p]));

  const resolveReceivable = (sellerOrderDoc) => {
    const baseReceivable = resolveSellerReceivable(sellerOrderDoc?.pricing);
    const packingFeeStored = Math.max(0, num(sellerOrderDoc?.pricing?.packingFee));
    if (packingFeeStored > 0) return Math.max(0, baseReceivable);

    const parent = sellerOrderDoc?.parentOrderId
      ? parentMap.get(String(sellerOrderDoc.parentOrderId))
      : null;
    const parentPackingFee = Math.max(
      0,
      num(parent?.pricing?.packagingFee ?? parent?.pricing?.packingFee),
    );
    const parentSubtotal = Math.max(0, num(parent?.pricing?.subtotal));
    const sellerSubtotal = Math.max(0, num(sellerOrderDoc?.pricing?.subtotal));
    const allocatedPackingFee =
      parentSubtotal > 0
        ? Number(((parentPackingFee * sellerSubtotal) / parentSubtotal).toFixed(2))
        : parentPackingFee;
    return Math.max(0, baseReceivable + allocatedPackingFee);
  };

  const ops = [];
  for (const order of orders) {
    const orderId = String(order?.orderId || '').trim();
    if (!orderId) continue;
    const receivable = resolveReceivable(order);
    ops.push({
      updateOne: {
        filter: { sellerId, type: LEDGER_TYPES.ORDER_PAYMENT, orderId },
        update: {
          $set: {
            amount: receivable,
            status: 'Settled',
            reference: orderId,
            customer: order?.customer?.name || 'Customer',
          },
          $setOnInsert: {
            sellerId,
            type: LEDGER_TYPES.ORDER_PAYMENT,
            orderId,
            reason: 'Synced from delivered seller order receivable',
            createdAt:
              order?.deliveredAt || order?.updatedAt || order?.createdAt || new Date(),
          },
        },
        upsert: true,
        setDefaultsOnInsert: true,
      },
    });
  }

  if (ops.length) {
    await SellerTransaction.bulkWrite(ops, { ordered: false });
  }

  const balance = await reconcileSellerLedgerBalance(sellerId);
  logger.info(
    `[SellerLedger] Synced ${ops.length} Order Payment credit(s) for seller ${sellerId}; ledger=${balance}`,
  );
  return { synced: ops.length, balance };
};

/**
 * Canonical seller withdrawable / settled balance — same rules as earnings UI:
 * delivered receivables + return pickup/refund ledger adjustments − withdrawals.
 */
export const computeSellerSettledWithdrawBalance = async (sellerId) => {
  await syncSellerDeliveredOrderPaymentCredits(sellerId);

  const [transactions, orders, clawedAgg] = await Promise.all([
    SellerTransaction.find({ sellerId }).select('type status amount orderId reference').lean(),
    SellerOrder.find({ sellerId, status: 'delivered' })
      .select('orderId parentOrderId pricing')
      .lean(),
    mongoose.Types.ObjectId.isValid(String(sellerId))
      ? SellerReturn.aggregate([
          {
            $match: {
              sellerId: new mongoose.Types.ObjectId(String(sellerId)),
              'finance.sellerReceivableAdjusted': true,
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: { $ifNull: ['$finance.sellerReceivableClawed', 0] } },
            },
          },
        ]).catch(() => [])
      : Promise.resolve([]),
  ]);

  const parentIds = [
    ...new Set(
      (orders || [])
        .map((o) => (o?.parentOrderId ? String(o.parentOrderId) : ''))
        .filter(Boolean),
    ),
  ];
  const parents = parentIds.length
    ? await QuickOrder.find({ _id: { $in: parentIds } })
        .select('_id pricing.subtotal pricing.packagingFee pricing.packingFee')
        .lean()
    : [];
  const parentMap = new Map(parents.map((p) => [String(p._id), p]));

  const resolveReceivable = (sellerOrderDoc) => {
    const baseReceivable = resolveSellerReceivable(sellerOrderDoc?.pricing);
    const packingFeeStored = Math.max(0, num(sellerOrderDoc?.pricing?.packingFee));
    if (packingFeeStored > 0) return num(baseReceivable);
    const parent = sellerOrderDoc?.parentOrderId
      ? parentMap.get(String(sellerOrderDoc.parentOrderId))
      : null;
    const parentPackingFee = Math.max(
      0,
      num(parent?.pricing?.packagingFee ?? parent?.pricing?.packingFee),
    );
    const parentSubtotal = Math.max(0, num(parent?.pricing?.subtotal));
    const sellerSubtotal = Math.max(0, num(sellerOrderDoc?.pricing?.subtotal));
    const allocated =
      parentSubtotal > 0
        ? Number(((parentPackingFee * sellerSubtotal) / parentSubtotal).toFixed(2))
        : parentPackingFee;
    return num(baseReceivable) + num(allocated);
  };

  const orderNetEarnings = (orders || []).reduce(
    (sum, o) => sum + num(resolveReceivable(o)),
    0,
  );
  const returnPickupFeeTotal = (transactions || [])
    .filter((item) => String(item.type || '') === LEDGER_TYPES.RETURN_PICKUP_FEE)
    .reduce((sum, item) => sum + num(item.amount), 0);
  const legacyReturnRefundTotal = (transactions || [])
    .filter((item) => String(item.type || '') === LEDGER_TYPES.RETURN_REFUND)
    .reduce((sum, item) => sum + num(item.amount), 0);
  const clawedReceivableTotal = num(clawedAgg?.[0]?.total);
  const returnRefundForBalance = clawedReceivableTotal > 0 ? 0 : legacyReturnRefundTotal;

  const totalNetEarnings = Math.max(
    0,
    orderNetEarnings + returnPickupFeeTotal + returnRefundForBalance,
  );
  const totalWithdrawn = (transactions || [])
    .filter((item) => item.type === LEDGER_TYPES.WITHDRAWAL && item.status === 'Settled')
    .reduce((sum, item) => sum + Math.abs(num(item.amount)), 0);
  const pendingPayouts = (transactions || [])
    .filter(
      (item) =>
        item.type === LEDGER_TYPES.WITHDRAWAL &&
        ['Pending', 'Processing'].includes(String(item.status || '')),
    )
    .reduce((sum, item) => sum + Math.abs(num(item.amount)), 0);

  const settledBalance = Math.max(0, totalNetEarnings - totalWithdrawn - pendingPayouts);

  return {
    orderNetEarnings,
    returnPickupFeeTotal,
    totalNetEarnings,
    totalWithdrawn,
    pendingPayouts,
    settledBalance,
    available: settledBalance,
  };
};

export const recoverNegativeBalanceOnSettlement = async ({
  sellerId,
  withdrawalId,
  withdrawalAmount,
  actorId = null,
  actorRole = 'ADMIN',
}) => {
  const payoutAmount = Math.max(0, num(withdrawalAmount));
  const ledgerBalance = await getSellerLedgerBalance(sellerId);
  if (ledgerBalance >= 0 || payoutAmount <= 0) {
    return {
      recovered: 0,
      netPayout: payoutAmount,
      alreadyRecovered: false,
      ledgerBalance,
    };
  }

  const referenceId = `settlement_recovery:${withdrawalId}`;
  const existing = await SellerTransaction.findOne({ sellerId, referenceId }).lean();
  if (existing) {
    const recovered = Math.abs(num(existing.amount));
    return {
      recovered,
      netPayout: Math.max(0, payoutAmount - recovered),
      alreadyRecovered: true,
      entry: existing,
    };
  }

  const recoverable = Math.min(payoutAmount, Math.abs(ledgerBalance));
  if (!recoverable) {
    return { recovered: 0, netPayout: payoutAmount, alreadyRecovered: false, ledgerBalance };
  }

  const result = await recordSellerLedgerEntry({
    sellerId,
    type: LEDGER_TYPES.SETTLEMENT,
    amount: recoverable,
    referenceId,
    reason: 'Automatic negative balance recovery during settlement',
    actorId,
    actorRole,
    status: 'Settled',
    settlementState: 'recovered',
    metadata: { withdrawalId: String(withdrawalId || ''), recovered: recoverable },
  });

  logger.info(
    `[SellerLedger] Recovered ${recoverable} from negative balance for seller ${sellerId} on withdrawal ${withdrawalId}`,
  );

  return {
    recovered: recoverable,
    netPayout: Math.max(0, payoutAmount - recoverable),
    alreadyRecovered: result.alreadyExists,
    entry: result.entry,
    balanceAfter: result.balanceAfter,
  };
};

export const getSellerLedgerEntries = async ({
  sellerId,
  page = 1,
  limit = 50,
  type = '',
} = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const filter = { sellerId };
  if (type) filter.type = type;

  const [items, total] = await Promise.all([
    SellerTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    SellerTransaction.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    currentBalance: await getSellerLedgerBalance(sellerId),
  };
};

export const getSellersWithNegativeBalance = async ({ limit = 100 } = {}) => {
  const sellers = await Seller.find({ 'finance.ledgerSeeded': true, 'finance.ledgerBalance': { $lt: 0 } })
    .select('name shopName phone finance')
    .sort({ 'finance.ledgerBalance': 1 })
    .limit(Math.min(500, Math.max(1, Number(limit) || 100)))
    .lean();

  return sellers.map((seller) => ({
    sellerId: String(seller._id),
    name: seller.name || '',
    shopName: seller.shopName || '',
    phone: seller.phone || '',
    ledgerBalance: num(seller?.finance?.ledgerBalance),
    lastLedgerAt: seller?.finance?.lastLedgerAt || null,
  }));
};

export const getPendingReturnRecoveries = async ({ limit = 100 } = {}) => {
  const items = await SellerTransaction.find({
    type: { $in: [LEDGER_TYPES.RETURN_REFUND, LEDGER_TYPES.RETURN_PICKUP_FEE] },
    settlementState: { $in: ['', 'settled'] },
    amount: { $lt: 0 },
  })
    .sort({ createdAt: -1 })
    .limit(Math.min(500, Math.max(1, Number(limit) || 100)))
    .populate('sellerId', 'name shopName phone')
    .lean();

  return items.map((item) => ({
    id: String(item._id),
    sellerId: String(item.sellerId?._id || item.sellerId || ''),
    sellerName: item.sellerId?.shopName || item.sellerId?.name || 'Seller',
    type: item.type,
    amount: Math.abs(num(item.amount)),
    orderId: item.orderId || '',
    returnId: item.returnId ? String(item.returnId) : '',
    referenceId: item.referenceId || '',
    createdAt: item.createdAt,
    balanceAfter: item.balanceAfter,
  }));
};

export const getReturnRecoverySummary = async () => {
  const [refundAgg, pickupAgg, negativeCount] = await Promise.all([
    SellerTransaction.aggregate([
      { $match: { type: LEDGER_TYPES.RETURN_REFUND } },
      {
        $group: {
          _id: '$settlementState',
          total: { $sum: { $abs: '$amount' } },
          count: { $sum: 1 },
        },
      },
    ]),
    SellerTransaction.aggregate([
      { $match: { type: LEDGER_TYPES.RETURN_PICKUP_FEE } },
      {
        $group: {
          _id: null,
          total: { $sum: { $abs: '$amount' } },
          count: { $sum: 1 },
        },
      },
    ]),
    Seller.countDocuments({ 'finance.ledgerSeeded': true, 'finance.ledgerBalance': { $lt: 0 } }),
  ]);

  const bySettlementState = (refundAgg || []).reduce((acc, row) => {
    acc[row._id || 'unknown'] = { total: num(row.total), count: num(row.count) };
    return acc;
  }, {});

  return {
    returnRefunds: bySettlementState,
    returnPickupFees: {
      total: num(pickupAgg?.[0]?.total),
      count: num(pickupAgg?.[0]?.count),
    },
    sellersWithNegativeBalance: negativeCount,
  };
};
