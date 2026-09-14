import mongoose from 'mongoose';
import { Settlement } from './models/settlement.model.js';
import { debitWallet } from './wallet.service.js';
import { logger } from '../../utils/logger.js';

/**
 * Legacy generic settlement batch API (`settlements` collection).
 *
 * FOOD RESTAURANTS — DO NOT USE for payouts.
 * Canonical restaurant payout flow:
 *   POST /food/restaurant/withdraw
 *   PATCH /food/admin/withdrawals/:id  → settleRestaurantSharesForWithdrawal
 *   (food_restaurant_withdrawals + food_transactions settlement flags)
 *
 * Creating/processing entityType=restaurant via this service is rejected.
 * Delivery-boy usage is legacy; prefer /food/delivery/wallet/withdraw +
 * /food/admin/delivery/withdrawals when possible.
 */

export const RESTAURANT_SETTLEMENT_DEPRECATED_MESSAGE =
    'Restaurant settlements via /food/payments/admin/settlements are deprecated. ' +
    'Use restaurant withdrawals: POST /food/restaurant/withdraw and ' +
    'PATCH /food/admin/withdrawals/:id (food_transactions ledger).';

export const RESTAURANT_PAYOUT_SUCCESSORS = {
    restaurantWithdraw: '/api/v1/food/restaurant/withdraw',
    restaurantWithdrawals: '/api/v1/food/restaurant/withdrawals',
    adminWithdrawals: '/api/v1/food/admin/withdrawals',
    finance: '/api/v1/food/restaurant/finance',
};

function throwRestaurantSettlementDeprecated() {
    const err = new Error(RESTAURANT_SETTLEMENT_DEPRECATED_MESSAGE);
    err.statusCode = 410;
    err.code = 'RESTAURANT_SETTLEMENT_DEPRECATED';
    err.useInstead = RESTAURANT_PAYOUT_SUCCESSORS;
    throw err;
}

/**
 * Create a settlement (payout request) for a delivery partner (legacy).
 * Restaurant entityType is blocked — use food restaurant withdrawals instead.
 */
export async function createSettlement({ entityType, entityId, amount, notes = '', periodStart, periodEnd }) {
    if (!['restaurant', 'deliveryBoy'].includes(entityType)) {
        throw new Error('Settlements only for restaurant or deliveryBoy');
    }

    if (entityType === 'restaurant') {
        throwRestaurantSettlementDeprecated();
    }

    const settlement = await Settlement.create({
        entityType,
        entityId: new mongoose.Types.ObjectId(entityId),
        amount: Number(amount),
        currency: 'INR',
        status: 'pending',
        notes,
        periodStart: periodStart || null,
        periodEnd: periodEnd || null
    });

    logger.info(`Settlement created: ${settlement._id} for ${entityType}:${entityId} amount=${amount}`);
    return settlement.toObject();
}

/**
 * Process a settlement — debit entity wallet + mark as processed.
 * Restaurant settlements are blocked (use withdrawal approval flow).
 */
export async function processSettlement(settlementId, { processedBy, payoutRef = '' } = {}) {
    const settlement = await Settlement.findById(settlementId);
    if (!settlement) throw new Error('Settlement not found');
    if (settlement.status === 'processed') return settlement.toObject();
    if (settlement.status === 'failed') throw new Error('Cannot process a failed settlement');

    if (settlement.entityType === 'restaurant') {
        throwRestaurantSettlementDeprecated();
    }

    try {
        // Debit the entity's wallet
        const { transaction } = await debitWallet({
            entityType: settlement.entityType,
            entityId: String(settlement.entityId),
            amount: settlement.amount,
            description: `Settlement payout #${settlement._id.toString().slice(-6)}`,
            category: 'settlement_payout',
            metadata: { settlementId: settlement._id }
        });

        settlement.status = 'processed';
        settlement.processedAt = new Date();
        settlement.processedBy = processedBy ? new mongoose.Types.ObjectId(processedBy) : null;
        settlement.payoutRef = payoutRef;
        if (transaction?._id) {
            settlement.transactionIds.push(transaction._id);
        }
        await settlement.save();

        // Update totalSettled on the entity wallet
        const { Model, filter } = resolveWalletForSettlement(settlement.entityType, settlement.entityId);
        await Model.updateOne(filter, { $inc: { totalSettled: settlement.amount } });

        logger.info(`Settlement processed: ${settlementId} payoutRef=${payoutRef}`);
        return settlement.toObject();
    } catch (err) {
        if (err?.code === 'RESTAURANT_SETTLEMENT_DEPRECATED') throw err;
        settlement.status = 'failed';
        settlement.metadata = { error: err.message };
        await settlement.save();
        throw err;
    }
}

function resolveWalletForSettlement(entityType, entityId) {
    const id = new mongoose.Types.ObjectId(entityId);
    if (entityType === 'restaurant') {
        return {
            Model: mongoose.model('FoodRestaurantWallet'),
            filter: { restaurantId: id }
        };
    }
    if (entityType === 'deliveryBoy') {
        return {
            Model: mongoose.model('FoodDeliveryWallet'),
            filter: { deliveryPartnerId: id }
        };
    }
    throw new Error(`Unsupported settlement entity: ${entityType}`);
}

/**
 * List settlements with filters (legacy collection; restaurant payouts live elsewhere).
 */
export async function listSettlements({ entityType, entityId, status, page = 1, limit = 20 } = {}) {
    const filter = {};
    if (entityType) filter.entityType = entityType;
    if (entityId) filter.entityId = new mongoose.Types.ObjectId(entityId);
    if (status) filter.status = status;

    const skip = (Math.max(1, page) - 1) * limit;
    const [docs, total] = await Promise.all([
        Settlement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Settlement.countDocuments(filter)
    ]);

    return {
        settlements: docs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
        note:
            'Legacy settlements collection. Food restaurant payouts use food_restaurant_withdrawals + food_transactions.',
        restaurantPayoutUseInstead: RESTAURANT_PAYOUT_SUCCESSORS,
    };
}

/**
 * Get settlement by ID.
 */
export async function getSettlementById(settlementId) {
    return Settlement.findById(settlementId).lean();
}
