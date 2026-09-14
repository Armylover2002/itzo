import { FoodTransaction } from '../models/foodTransaction.model.js';
import { resolveDiscountSplitByCoupon } from '../../shared/discountSplit.util.js';
import { loadActiveFeeSettings, calculateRiderEarning } from '../../shared/delivery-fee.util.js';
import { computePlatformNetProfitWithQuickFreeze } from '../utils/quickFinance.util.js';
import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';

export async function getRiderEarning(distanceKm) {
  const feeSettings = await loadActiveFeeSettings();
  return calculateRiderEarning(feeSettings, distanceKm);
}

/**
 * Creates an initial 'pending' transaction when an order is created.
 */
export async function createInitialTransaction(order) {
    const normalizedOrderType = ['food', 'quick', 'mixed'].includes(String(order?.orderType || ''))
        ? String(order.orderType)
        : 'food';
    const restaurantId = order?.restaurantId || null;
    
    // Split logic
    const totalCustomerPaid = order.pricing?.total || 0;
    const riderShare = order.riderEarning || 0;
    // Phase 3A: Segregated calculations for mixed orders
    let restaurantNet = 0;
    let sellerShare = 0;
    let sellerCommission = 0;

    if (order.orderType === 'mixed') {
        const foodSubtotal = (order.items || [])
            .filter(i => i.type === 'food')
            .reduce((sum, i) => sum + (Number(i.price) * Number(i.quantity)), 0);
        
        restaurantNet = foodSubtotal + (order.pricing?.packagingFee || 0);

        // Seller logic (from receivable rules)
        const quickItems = (order.items || []).filter(i => i.type === 'quick');
        // Sum commission and receivable if pre-calculated in Phase 2
        // We'll calculate it here for the ledger based on the items
        sellerCommission = quickItems.reduce((sum, i) => sum + (Number(i.commission) || 0), 0);
        sellerShare = quickItems.reduce((sum, i) => sum + (Number(i.receivable) || 0), 0);
        
        // If items don't have these (unlikely after Ph2), fallback to simple subtotal
        if (sellerShare === 0 && quickItems.length > 0) {
            sellerShare = quickItems.reduce((sum, i) => sum + (Number(i.price) * Number(i.quantity)), 0);
        }
    } else if (normalizedOrderType === 'quick') {
        restaurantNet = 0;
        sellerCommission = Number(order.pricing?.restaurantCommission || 0) || 0;
        const quickSubtotal = Number(order.pricing?.subtotal || 0) || 0;
        sellerShare = Math.max(0, quickSubtotal - sellerCommission);
    } else {
        restaurantNet = (order.pricing?.subtotal || 0) + (order.pricing?.packagingFee || 0);
        sellerShare = 0;
        sellerCommission = 0;
    }

    const restaurantDeliveryFee = Number(order.pricing?.restaurantDeliveryFee || 0) || 0;
    const totalDeliveryFee =
        Number(order.pricing?.totalDeliveryFee ?? order.pricing?.deliveryFee ?? 0) || 0;

    const restaurantCommission = Number(order.pricing?.restaurantCommission || 0) || 0;

    if (restaurantDeliveryFee > 0) {
        restaurantNet = Math.max(0, restaurantNet - restaurantDeliveryFee);
    }

    restaurantNet = Math.max(0, restaurantNet - restaurantCommission);

    const discount = Number(order.pricing?.discount || 0) || 0;
    const couponCode = order.pricing?.couponCode;
    const couponSource = order.pricing?.appliedCoupon?.source;
    let adminDiscountShare = 0;
    let restaurantDiscountShare = 0;
    let discountAdminBearPercentage = 0;
    let discountRestaurantBearPercentage = 0;

    if (discount > 0) {
        const split = await resolveDiscountSplitByCoupon({
            couponCode,
            discount,
            couponSource,
        });
        adminDiscountShare = split.adminDiscountShare;
        restaurantDiscountShare = split.restaurantDiscountShare;
        discountAdminBearPercentage = split.adminBearPercentage;
        discountRestaurantBearPercentage = split.restaurantBearPercentage;
    }

    restaurantNet = Math.max(0, restaurantNet - restaurantDiscountShare);
    const quickDeliveryFee = Number(order.pricing?.quickDeliveryFee || 0) || 0;
    const quickPlatformShare = Number(order.pricing?.quickPlatformShare || 0) || 0;
    const quickRiderBonus = Number(order.pricing?.quickRiderBonus || 0) || 0;
    const quickRiderShare =
      Number(order.pricing?.quickRiderShare ?? order.pricing?.quickRiderBonus ?? 0) || 0;
    // Missing restaurant share on old orders ⇒ 0 (BC). Never fold into restaurantShare at create.
    const quickRestaurantShare = Number(order.pricing?.quickRestaurantShare || 0) || 0;
    const quickSharePcts = {
      platform: Number(order.pricing?.quickSharePcts?.platform || 0) || 0,
      rider: Number(order.pricing?.quickSharePcts?.rider || 0) || 0,
      restaurant: Number(order.pricing?.quickSharePcts?.restaurant || 0) || 0,
    };
    const quickFinanceVersion = String(order.pricing?.quickFinanceVersion || '');
    /**
     * FINANCE FREEZE — Food Quick Charge:
     * Platform gets quickPlatformShare only (never full quickDeliveryFee).
     * Rider share rides on order.riderEarning (via quickRiderBonus).
     * Restaurant Quick Share is snapshotted here but NOT added to restaurantShare
     * until successful delivery (realizeFoodQuickRestaurantShare).
     * riderShare on the order already includes quickRiderBonus — use base rider for P&L.
     */
    const baseRiderShare = Math.max(0, (Number(riderShare) || 0) - quickRiderBonus);
    const taxAmount = Number(order.pricing?.tax || 0) || 0;
    /**
     * FINANCE FREEZE — Food Quick Charge:
     * Platform gets quickPlatformShare only (never full quickDeliveryFee).
     * GST collected from customer is attributed to platform for remittance.
     * Restaurant Quick Share is snapshotted but NOT added to restaurantShare
     * until successful delivery (realizeFoodQuickRestaurantShare).
     * riderShare on the order already includes quickRiderBonus — use base rider for P&L.
     */
    let platformNetProfit = computePlatformNetProfitWithQuickFreeze({
      deliveryFee: totalDeliveryFee,
      platformFee: order.pricing?.platformFee || 0,
      restaurantCommission,
      sellerCommission,
      quickPlatformShare,
      baseRiderShare,
      adminDiscountShare,
    });
    platformNetProfit = Math.max(0, Number(platformNetProfit) || 0) + taxAmount;

    restaurantNet = Math.round((Number(restaurantNet) || 0) * 100) / 100;
    platformNetProfit = Math.round((Number(platformNetProfit) || 0) * 100) / 100;

    const transaction = new FoodTransaction({
        orderId: order._id,
        orderType: normalizedOrderType,

        userId: order.userId,
        restaurantId,
        deliveryPartnerId: order.dispatch?.deliveryPartnerId,
        paymentMethod: order.payment?.method || 'cash',
        status: order.payment?.status === 'paid' ? 'captured' : 'pending',
        payment: {
            method: String(order.payment?.method || 'cash'),
            status: String(order.payment?.status || 'cod_pending'),
            amountDue: Number(order.payment?.amountDue ?? order.pricing?.total ?? 0) || 0,
            razorpay: {
                orderId: String(order.payment?.razorpay?.orderId || ''),
                paymentId: String(order.payment?.razorpay?.paymentId || ''),
                signature: String(order.payment?.razorpay?.signature || ''),
            },
            qr: {
                qrId: String(order.payment?.qr?.qrId || ''),
                imageUrl: String(order.payment?.qr?.imageUrl || ''),
                paymentLinkId: String(order.payment?.qr?.paymentLinkId || ''),
                shortUrl: String(order.payment?.qr?.shortUrl || ''),
                status: String(order.payment?.qr?.status || ''),
                expiresAt: order.payment?.qr?.expiresAt || null,
            }
        },
        pricing: {
            subtotal: Number(order.pricing?.subtotal || 0) || 0,
            tax: Number(order.pricing?.tax || 0) || 0,
            packagingFee: Number(order.pricing?.packagingFee || 0) || 0,
            deliveryFee: Number(order.pricing?.deliveryFee || 0) || 0,
            totalDeliveryFee,
            userDeliveryFee: Number(order.pricing?.userDeliveryFee ?? order.pricing?.deliveryFee ?? 0) || 0,
            restaurantDeliveryFee,
            sponsoredDelivery: Boolean(order.pricing?.sponsoredDelivery),
            sponsoredKm: Number(order.pricing?.sponsoredKm || 0) || 0,
            deliveryDistanceKm:
                order.pricing?.deliveryDistanceKm == null
                    ? null
                    : Number(order.pricing.deliveryDistanceKm) || 0,
            deliverySponsorType: String(order.pricing?.deliverySponsorType || 'USER_FULL'),
            platformFee: Number(order.pricing?.platformFee || 0) || 0,
            discount: Number(order.pricing?.discount || 0) || 0,
            couponCode: order.pricing?.couponCode || order.couponCode || null,
            couponDiscount: Number(order.pricing?.couponDiscount || order.couponDiscount || 0) || 0,
            appliedCoupon: order.pricing?.appliedCoupon || order.appliedCoupon || null,
            referralDiscount: Number(order.pricing?.referralDiscount || order.referralDiscount || 0) || 0,
            restaurantCommissionPercentage: Number(order.pricing?.restaurantCommissionPercentage || 0) || 0,
            restaurantCommission: Number(order.pricing?.restaurantCommission || 0) || 0,
            quickDeliveryFee,
            quickPlatformShare,
            quickRiderBonus,
            quickRiderShare,
            quickRestaurantShare,
            quickSharePcts,
            quickFinanceVersion,
            total: Number(order.pricing?.total || 0) || 0,
            currency: String(order.pricing?.currency || order.currency || 'INR'),
        },
        amounts: {
            totalCustomerPaid,
            // Food economics only at create — Quick Restaurant Share realized post-delivery.
            restaurantShare: Math.max(0, restaurantNet),
            restaurantCommission,
            sellerShare: Math.max(0, sellerShare),
            sellerCommission: Math.max(0, sellerCommission),
            riderShare,
            platformNetProfit,
            taxAmount: order.pricing?.tax || 0,
            adminDiscountShare,
            restaurantDiscountShare,
            discountAdminBearPercentage,
            discountRestaurantBearPercentage,
            quickDeliveryFee,
            quickPlatformShare,
            quickRiderBonus,
            quickRiderShare,
            quickRestaurantShare,
            quickRestaurantShareRealized: false,
            quickSharePcts,
            quickFinanceVersion,
        },
        gateway: {
            razorpayOrderId: order.payment?.razorpay?.orderId,
            qrUrl: order.payment?.qr?.imageUrl
        },
        history: [{
            kind: 'created',
            amount: totalCustomerPaid,
            note: 'Initial transaction created with order'
        }]
    });

    await transaction.save();

    // Link back to the order
    try {
        await mongoose.model('FoodOrder').updateOne(
            { _id: order._id },
            { $set: { transactionId: transaction._id } }
        );
    } catch (err) {
        // Log but don't fail transaction if the backlink fails
    }

    return transaction;
}

/**
 * Realize frozen Restaurant Quick Share into existing restaurantShare settlement
 * component after successful delivery. Idempotent — never double-credits.
 * Never writes restaurant wallet. Missing/0 share (old orders) ⇒ no-op.
 */
export async function realizeFoodQuickRestaurantShare(order) {
    const orderId = order?._id || order;
    if (!orderId) return null;

    const share =
        Math.round(
            (Number(
                order?.pricing?.quickRestaurantShare ??
                    order?.amounts?.quickRestaurantShare ??
                    0,
            ) || 0) * 100,
        ) / 100;

    if (!(share > 0)) return null;

    const updated = await FoodTransaction.findOneAndUpdate(
        {
            orderId,
            'amounts.quickRestaurantShareRealized': { $ne: true },
        },
        {
            $inc: { 'amounts.restaurantShare': share },
            $set: {
                'amounts.quickRestaurantShareRealized': true,
                'amounts.quickRestaurantShare': share,
            },
            $push: {
                history: {
                    kind: 'quick_restaurant_share_realized',
                    amount: share,
                    at: new Date(),
                    note: 'Restaurant Quick Share realized after successful delivery (settlement component only)',
                },
            },
        },
        { new: true },
    );

    return updated;
}

/**
 * True when the linked order is delivered and eligible for restaurant payout.
 */
export function isOrderDeliveredForSettlement(orderLike) {
    if (!orderLike || typeof orderLike !== 'object') return false;
    const status = String(orderLike.orderStatus || '').trim().toLowerCase();
    if (status === 'delivered') return true;
    const phase = String(
        orderLike.deliveryState?.currentPhase || orderLike.deliveryState?.status || ''
    )
        .trim()
        .toLowerCase();
    return phase === 'delivered';
}

/**
 * Updates transaction status (captured, settled, etc) and appends to history.
 */
export async function updateTransactionStatus(orderId, kind, details = {}) {
    const query = { orderId };
    const transaction = await FoodTransaction.findOne(query);
    if (!transaction) return null;

    if (details.status) transaction.status = details.status;
    if (details.razorpayPaymentId) transaction.gateway.razorpayPaymentId = details.razorpayPaymentId;
    if (details.razorpaySignature) transaction.gateway.razorpaySignature = details.razorpaySignature;

    if (details.markRestaurantSettled === true) {
        transaction.settlement = transaction.settlement || {};
        transaction.settlement.isRestaurantSettled = true;
        const fullShare = Math.round((Number(transaction.amounts?.restaurantShare) || 0) * 100) / 100;
        transaction.settlement.restaurantSettledAmount = fullShare;
        transaction.settlement.restaurantSettledAt =
            details.restaurantSettledAt || new Date();
    }

    transaction.history.push({
        kind,
        amount: details.amount ?? transaction.amounts.totalCustomerPaid,
        at: new Date(),
        note: details.note || `Transaction updated: ${kind}`,
        recordedBy: { role: details.recordedByRole || 'SYSTEM', id: details.recordedById }
    });

    await transaction.save();
    return transaction;
}

/**
 * Returns a human-readable block reason when a refund would leave already-paid
 * restaurant settlement uncovered. Null when refund is safe for the ledger.
 */
export function getRestaurantSettlementRefundBlockReason(
    transaction,
    refundAmount,
    totalAmount
) {
    if (!transaction) return null;

    const settledAmt =
        Math.round((Number(transaction.settlement?.restaurantSettledAmount) || 0) * 100) /
        100;
    const markedSettled = Boolean(transaction.settlement?.isRestaurantSettled);

    if (!(settledAmt > 0.009) && !markedSettled) {
        return null;
    }

    const total = Math.max(
        0,
        Number(totalAmount) || Number(transaction.amounts?.totalCustomerPaid) || 0
    );
    const refund = Math.max(0, Number(refundAmount) || 0);
    const isFull = total <= 0 || refund >= total - 0.009;
    const currentShare =
        Math.round((Number(transaction.amounts?.restaurantShare) || 0) * 100) / 100;

    if (isFull) {
        return (
            `Cannot refund this order: restaurant share of ₹${(settledAmt || currentShare).toFixed(2)} ` +
            'was already settled via withdrawal. Reverse or recover that payout before refunding the customer.'
        );
    }

    const remainRatio = Math.max(0, Math.min(1, (total - refund) / total));
    const projectedShare =
        Math.round(currentShare * remainRatio * 100) / 100;

    if (projectedShare + 0.009 < settledAmt) {
        return (
            `Cannot refund ₹${refund.toFixed(2)}: remaining restaurant share would be ₹${projectedShare.toFixed(2)} ` +
            `but ₹${settledAmt.toFixed(2)} was already settled via withdrawal.`
        );
    }

    return null;
}

/**
 * Throws ValidationError when refund would conflict with settled restaurant share.
 */
export async function assertRestaurantSettlementAllowsRefund(
    orderId,
    refundAmount,
    totalAmount
) {
    if (!orderId) return null;
    const transaction = await FoodTransaction.findOne({ orderId });
    if (!transaction) return null;

    const reason = getRestaurantSettlementRefundBlockReason(
        transaction,
        refundAmount,
        totalAmount
    );
    if (reason) {
        throw new ValidationError(reason);
    }
    return transaction;
}

/**
 * Apply admin refund to settlement ledger.
 * Full refund → status refunded (excluded from restaurant payout).
 * Partial refund → keep captured and scale remaining shares so payouts stay proportional.
 * Blocked when restaurantSettledAmount would exceed remaining share after refund.
 */
export async function applyRefundToTransaction(
    orderId,
    refundAmount,
    totalAmount,
    details = {}
) {
    const transaction = await FoodTransaction.findOne({ orderId });
    if (!transaction) return null;

    const blockReason = getRestaurantSettlementRefundBlockReason(
        transaction,
        refundAmount,
        totalAmount
    );
    if (blockReason && !details.allowAfterRestaurantSettlement) {
        throw new ValidationError(blockReason);
    }

    const total = Math.max(
        0,
        Number(totalAmount) || Number(transaction.amounts?.totalCustomerPaid) || 0
    );
    const refund = Math.max(0, Number(refundAmount) || 0);
    const isFull = total <= 0 || refund >= total - 0.009;
    const settledAmt =
        Math.round((Number(transaction.settlement?.restaurantSettledAmount) || 0) * 100) /
        100;

    if (isFull) {
        transaction.status = 'refunded';
        transaction.history.push({
            kind: 'refunded',
            amount: refund || total,
            at: new Date(),
            note:
                details.note ||
                `Full refund of ₹${(refund || total).toFixed(2)} processed by admin`,
            recordedBy: {
                role: details.recordedByRole || 'ADMIN',
                id: details.recordedById,
            },
        });
        await transaction.save();
        return transaction;
    }

    const remainRatio = Math.max(0, Math.min(1, (total - refund) / total));
    const amounts = transaction.amounts || {};
    amounts.restaurantShare =
        Math.round((Number(amounts.restaurantShare) || 0) * remainRatio * 100) / 100;
    amounts.riderShare =
        Math.round((Number(amounts.riderShare) || 0) * remainRatio * 100) / 100;
    amounts.platformNetProfit =
        Math.round((Number(amounts.platformNetProfit) || 0) * remainRatio * 100) / 100;
    amounts.sellerShare =
        Math.round((Number(amounts.sellerShare) || 0) * remainRatio * 100) / 100;
    amounts.sellerCommission =
        Math.round((Number(amounts.sellerCommission) || 0) * remainRatio * 100) / 100;
    amounts.restaurantCommission =
        Math.round((Number(amounts.restaurantCommission) || 0) * remainRatio * 100) / 100;
    amounts.taxAmount =
        Math.round((Number(amounts.taxAmount) || 0) * remainRatio * 100) / 100;
    amounts.adminDiscountShare =
        Math.round((Number(amounts.adminDiscountShare) || 0) * remainRatio * 100) / 100;
    amounts.restaurantDiscountShare =
        Math.round((Number(amounts.restaurantDiscountShare) || 0) * remainRatio * 100) / 100;
    transaction.amounts = amounts;

    // Keep settled amount consistent if share was scaled (override path only)
    if (
        details.allowAfterRestaurantSettlement &&
        settledAmt > 0 &&
        amounts.restaurantShare + 0.009 < settledAmt
    ) {
        transaction.settlement = transaction.settlement || {};
        transaction.settlement.restaurantSettledAmount = amounts.restaurantShare;
        if (amounts.restaurantShare <= 0.009) {
            transaction.settlement.isRestaurantSettled = true;
            transaction.settlement.restaurantSettledAt =
                transaction.settlement.restaurantSettledAt || new Date();
        }
    }

    // Remain payout-eligible for the unrefunded portion.
    if (['pending', 'authorized'].includes(String(transaction.status || ''))) {
        transaction.status = 'captured';
    }

    transaction.history.push({
        kind: 'partial_refund',
        amount: refund,
        at: new Date(),
        note:
            details.note ||
            `Partial refund of ₹${refund.toFixed(2)} — settlement shares scaled to remaining ${(
                remainRatio * 100
            ).toFixed(1)}%`,
        recordedBy: {
            role: details.recordedByRole || 'ADMIN',
            id: details.recordedById,
        },
    });

    await transaction.save();
    return transaction;
}

/**
 * Updates the rider in the transaction when an order is accepted.
 */
export async function updateTransactionRider(orderId, riderId) {
    const query = { orderId };
    return await FoodTransaction.findOneAndUpdate(
        query,
        { $set: { deliveryPartnerId: riderId } },
        { new: true }
    );
}

/**
 * Marks restaurant as settled in the finance record.
 */
export async function settleRestaurant(orderId, adminId) {
    return await updateTransactionStatus(orderId, 'settled', {
        status: 'captured', // Ensure it's marked as captured if it was pending cash
        markRestaurantSettled: true,
        note: 'Restaurant payout settled by admin',
        recordedByRole: 'ADMIN',
        recordedById: adminId
    });
}

/**
 * Consumes restaurant payout eligibility for an approved withdrawal (FIFO).
 * Partially settles delivered, unsettled captured txs until the
 * withdrawal amount is covered (never marks more than `remaining` settled).
 * Leftover amount reduces referral earnings.
 * Throws if unsettled earnings + referral cannot fully cover the amount.
 *
 * Dual-ledger (Option A):
 * - Order share: settle flags on `food_transactions` + bump wallet `totalSettled`
 *   (+ embedded history). Does NOT debit `wallet.balance` — order earnings never
 *   lived on that field.
 * - Referral: debit `referralEarnings` and `balance`, bump `totalSettled`.
 *
 * Race-safe: runs in a Mongo transaction and locks the restaurant wallet first
 * so concurrent admin approvals cannot double-consume the same shares.
 */
export async function settleRestaurantSharesForWithdrawal(
    restaurantId,
    amount,
    meta = {}
) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
        throw new Error('Invalid restaurant ID for withdrawal settlement');
    }

    const target = Math.round((Number(amount) || 0) * 100) / 100;
    if (!(target > 0)) {
        throw new Error('Withdrawal amount must be greater than zero');
    }

    const rid = new mongoose.Types.ObjectId(restaurantId);
    const { FoodRestaurantWallet } = await import(
        '../../restaurant/models/restaurantWallet.model.js'
    );
    const { FoodRestaurantWithdrawal } = await import(
        '../../restaurant/models/foodRestaurantWithdrawal.model.js'
    );

    const withdrawalOid =
        meta.withdrawalId && mongoose.Types.ObjectId.isValid(String(meta.withdrawalId))
            ? new mongoose.Types.ObjectId(String(meta.withdrawalId))
            : null;

    const session = await mongoose.startSession();
    let settleResult = null;

    try {
        await session.withTransaction(async () => {
            // Serialize concurrent settles for this restaurant (document lock)
            await FoodRestaurantWallet.findOneAndUpdate(
                { restaurantId: rid },
                {
                    $setOnInsert: {
                        restaurantId: rid,
                        balance: 0,
                        referralEarnings: 0,
                        totalSettled: 0,
                    },
                },
                { upsert: true, session, new: true }
            );

            // Idempotent retry: settle already committed for this withdrawal
            if (withdrawalOid) {
                const withdrawal = await FoodRestaurantWithdrawal.findById(withdrawalOid)
                    .session(session)
                    .lean();
                if (withdrawal?.ledgerSettled) {
                    settleResult = {
                        settledOrderShare: 0,
                        settledCount: 0,
                        referralDebited: 0,
                        settledTransactionIds: [],
                        alreadyProcessed: true,
                    };
                    return;
                }
            }

            const unsettled = await FoodTransaction.find({
                restaurantId: rid,
                status: { $in: ['captured'] },
                'settlement.isRestaurantSettled': { $ne: true },
            })
                .session(session)
                .populate('orderId', 'orderStatus deliveryState')
                .sort({ createdAt: 1 });

            const wallet = await FoodRestaurantWallet.findOne({ restaurantId: rid }).session(
                session
            );
            const referralBal = Math.max(0, Number(wallet?.referralEarnings || 0));

            let openOrderShare = 0;
            for (const tx of unsettled) {
                if (!isOrderDeliveredForSettlement(tx.orderId)) continue;
                const share =
                    Math.round((Number(tx.amounts?.restaurantShare) || 0) * 100) / 100;
                const alreadySettled =
                    Math.round((Number(tx.settlement?.restaurantSettledAmount) || 0) * 100) /
                    100;
                openOrderShare += Math.max(
                    0,
                    Math.round((share - alreadySettled) * 100) / 100
                );
            }
            openOrderShare = Math.round(openOrderShare * 100) / 100;
            const coverable = Math.round((openOrderShare + referralBal) * 100) / 100;
            if (coverable + 0.009 < target) {
                throw new Error(
                    `Insufficient unsettled earnings to cover withdrawal. Available ₹${coverable}, required ₹${target}`
                );
            }

            let remaining = target;
            const now = new Date();
            const settledIds = [];
            let settledOrderShare = 0;

            for (const tx of unsettled) {
                if (remaining <= 0) break;
                if (!isOrderDeliveredForSettlement(tx.orderId)) continue;

                const share =
                    Math.round((Number(tx.amounts?.restaurantShare) || 0) * 100) / 100;
                if (!(share > 0)) continue;

                const alreadySettled =
                    Math.round((Number(tx.settlement?.restaurantSettledAmount) || 0) * 100) /
                    100;
                const openShare = Math.round((share - alreadySettled) * 100) / 100;

                if (!(openShare > 0)) {
                    await FoodTransaction.updateOne(
                        {
                            _id: tx._id,
                            'settlement.isRestaurantSettled': { $ne: true },
                        },
                        {
                            $set: {
                                'settlement.isRestaurantSettled': true,
                                'settlement.restaurantSettledAt': now,
                            },
                        },
                        { session }
                    );
                    continue;
                }

                const consume = Math.min(openShare, remaining);
                const newSettled = Math.round((alreadySettled + consume) * 100) / 100;
                const fullySettled = newSettled >= share;

                const settledAmountMatch =
                    alreadySettled === 0
                        ? {
                              $or: [
                                  { 'settlement.restaurantSettledAmount': 0 },
                                  { 'settlement.restaurantSettledAmount': { $exists: false } },
                                  { 'settlement.restaurantSettledAmount': null },
                              ],
                          }
                        : { 'settlement.restaurantSettledAmount': alreadySettled };

                const updated = await FoodTransaction.findOneAndUpdate(
                    {
                        _id: tx._id,
                        status: 'captured',
                        'settlement.isRestaurantSettled': { $ne: true },
                        ...settledAmountMatch,
                    },
                    {
                        $set: {
                            'settlement.restaurantSettledAmount': newSettled,
                            ...(fullySettled
                                ? {
                                      'settlement.isRestaurantSettled': true,
                                      'settlement.restaurantSettledAt': now,
                                  }
                                : {}),
                        },
                        $push: {
                            history: {
                                kind: 'settled',
                                amount: consume,
                                at: now,
                                note:
                                    meta.note ||
                                    `Settled via restaurant withdrawal approval${
                                        meta.withdrawalId ? ` (${meta.withdrawalId})` : ''
                                    }${consume < openShare ? ' (partial)' : ''}`,
                                recordedBy: {
                                    role: meta.recordedByRole || 'ADMIN',
                                    id: meta.recordedById,
                                },
                            },
                        },
                    },
                    { session, new: true }
                );

                if (!updated) {
                    throw new Error(
                        'Settlement conflict on order share — please retry the approval'
                    );
                }

                settledIds.push(tx._id);
                settledOrderShare = Math.round((settledOrderShare + consume) * 100) / 100;
                remaining = Math.round((remaining - consume) * 100) / 100;
            }

            let referralDebited = 0;
            if (remaining > 0) {
                const liveReferral = Math.max(0, Number(wallet?.referralEarnings || 0));
                referralDebited = Math.min(liveReferral, remaining);
                if (referralDebited > 0) {
                    const walletUpdated = await FoodRestaurantWallet.findOneAndUpdate(
                        {
                            restaurantId: rid,
                            referralEarnings: { $gte: referralDebited },
                        },
                        [
                            {
                                $set: {
                                    referralEarnings: {
                                        $round: [
                                            {
                                                $subtract: [
                                                    '$referralEarnings',
                                                    referralDebited,
                                                ],
                                            },
                                            2,
                                        ],
                                    },
                                    balance: {
                                        $max: [
                                            0,
                                            {
                                                $round: [
                                                    {
                                                        $subtract: [
                                                            { $ifNull: ['$balance', 0] },
                                                            referralDebited,
                                                        ],
                                                    },
                                                    2,
                                                ],
                                            },
                                        ],
                                    },
                                    totalSettled: {
                                        $round: [
                                            {
                                                $add: [
                                                    { $ifNull: ['$totalSettled', 0] },
                                                    referralDebited,
                                                ],
                                            },
                                            2,
                                        ],
                                    },
                                    transactions: {
                                        $concatArrays: [
                                            [
                                                {
                                                    type: 'debit',
                                                    amount: referralDebited,
                                                    openingBalance: { $ifNull: ['$balance', 0] },
                                                    closingBalance: {
                                                        $max: [
                                                            0,
                                                            {
                                                                $round: [
                                                                    {
                                                                        $subtract: [
                                                                            {
                                                                                $ifNull: [
                                                                                    '$balance',
                                                                                    0,
                                                                                ],
                                                                            },
                                                                            referralDebited,
                                                                        ],
                                                                    },
                                                                    2,
                                                                ],
                                                            },
                                                        ],
                                                    },
                                                    category: 'settlement_payout',
                                                    description:
                                                        meta.note ||
                                                        'Restaurant withdrawal (referral earnings)',
                                                    status: 'completed',
                                                    withdrawalId: meta.withdrawalId
                                                        ? String(meta.withdrawalId)
                                                        : null,
                                                    metadata: {
                                                        source: 'restaurant_withdrawal_referral',
                                                        referralDebited,
                                                        balanceDebited: true,
                                                    },
                                                    createdAt: now,
                                                    updatedAt: now,
                                                },
                                            ],
                                            { $ifNull: ['$transactions', []] },
                                        ],
                                    },
                                },
                            },
                        ],
                        { session, new: true }
                    );

                    if (!walletUpdated) {
                        throw new Error(
                            'Insufficient referral earnings to cover withdrawal remainder'
                        );
                    }
                    remaining = Math.round((remaining - referralDebited) * 100) / 100;
                }
            }

            if (remaining > 0.009) {
                const covered =
                    Math.round((settledOrderShare + referralDebited) * 100) / 100;
                throw new Error(
                    `Insufficient unsettled earnings to cover withdrawal. Covered ₹${covered}, required ₹${target}`
                );
            }

            // Order-share portion: totalSettled + audit history only.
            // Do not debit wallet.balance — order earnings live in food_transactions.
            if (settledOrderShare > 0) {
                await FoodRestaurantWallet.findOneAndUpdate(
                    { restaurantId: rid },
                    [
                        {
                            $set: {
                                totalSettled: {
                                    $round: [
                                        {
                                            $add: [
                                                { $ifNull: ['$totalSettled', 0] },
                                                settledOrderShare,
                                            ],
                                        },
                                        2,
                                    ],
                                },
                                transactions: {
                                    $concatArrays: [
                                        [
                                            {
                                                type: 'debit',
                                                amount: settledOrderShare,
                                                openingBalance: { $ifNull: ['$balance', 0] },
                                                // Balance unchanged: order share never sat on wallet.balance
                                                closingBalance: { $ifNull: ['$balance', 0] },
                                                category: 'settlement_payout',
                                                description:
                                                    meta.note ||
                                                    'Restaurant withdrawal (order earnings via food_transactions)',
                                                status: 'completed',
                                                withdrawalId: meta.withdrawalId
                                                    ? String(meta.withdrawalId)
                                                    : null,
                                                metadata: {
                                                    source: 'restaurant_withdrawal_order_share',
                                                    settledOrderShare,
                                                    balanceUnaffected: true,
                                                    ledger: 'food_transactions',
                                                    settledTransactionIds: settledIds.map(String),
                                                },
                                                createdAt: now,
                                                updatedAt: now,
                                            },
                                        ],
                                        { $ifNull: ['$transactions', []] },
                                    ],
                                },
                            },
                        },
                    ],
                    { upsert: true, session }
                );
            }

            if (withdrawalOid) {
                const marked = await FoodRestaurantWithdrawal.findOneAndUpdate(
                    {
                        _id: withdrawalOid,
                        ledgerSettled: { $ne: true },
                    },
                    { $set: { ledgerSettled: true } },
                    { session, new: true }
                );
                if (!marked) {
                    // Another concurrent settle for the same withdrawal won the race
                    throw new Error(
                        'Settlement already applied for this withdrawal — please retry approval'
                    );
                }
            }

            settleResult = {
                settledOrderShare,
                settledCount: settledIds.length,
                referralDebited,
                settledTransactionIds: settledIds,
            };
        });
    } finally {
        await session.endSession();
    }

    return settleResult;
}
