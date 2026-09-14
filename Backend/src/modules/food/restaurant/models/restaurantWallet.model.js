import mongoose from 'mongoose';
import { embeddedWalletTransactionSchema } from '../../../../core/payments/models/embeddedWalletTransaction.schema.js';

/**
 * RestaurantWallet — ancillary balances for a restaurant (NOT order payout ledger).
 *
 * ORDER EARNINGS SOURCE OF TRUTH: `food_transactions` (`amounts.restaurantShare`,
 * `settlement.*`). Delivered/captured orders never credit this collection.
 * Withdrawable order payout is computed in `restaurantFinance.service.js` from
 * unsettled `food_transactions`, not from `balance`.
 *
 * This document is created (upsert) when:
 * - Restaurant registers or is approved (zero-balance row)
 * - Referral rewards are credited (admin approval)
 * - Subscription wallet top-up / daily-pass flows run
 * - Withdrawal request or admin approval locks/settles shares
 *
 * Field roles:
 * - `balance` / `referralEarnings` — referral rewards only (debited when a
 *   withdrawal consumes referral balance). NOT order earnings.
 * - `subscriptionBalance` — daily pass / subscription fees (separate product wallet)
 * - `lockedAmount` — reserved for legacy lock/unlock helpers; order payouts do not
 *   use this field (soft-lock is pending rows in `food_restaurant_withdrawals`)
 * - `totalSettled` — cumulative amount paid via withdrawals (order share from
 *   food_transactions + referral debits). Order-share settlement does NOT
 *   reduce `balance`.
 * - `totalEarnings` — lifetime referral (and universal `creditWallet` credits only);
 *   excludes order share from food_transactions
 * - `transactions` — embedded audit for referral/subscription/settlement metadata;
 *   not a per-order delivery credit log
 *
 * Collection: `food_restaurant_wallets`
 */
const restaurantWalletSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodRestaurant',
            required: true,
            unique: true
        },
        /** Referral reward balance only — never credited from delivered orders. */
        balance: { type: Number, default: 0 },
        /** Subscription wallet balance for daily passes and future fees */
        subscriptionBalance: { type: Number, default: 0, min: 0 },
        /**
         * Legacy lock field. Restaurant order withdrawals soft-lock via
         * pending/processing `food_restaurant_withdrawals`, not this counter.
         */
        lockedAmount: { type: Number, default: 0, min: 0 },
        /** Lifetime referral (and creditWallet) earnings — excludes order share */
        totalEarnings: { type: Number, default: 0, min: 0 },
        /** Referral rewards available for withdrawal (included in payout math) */
        referralEarnings: { type: Number, default: 0, min: 0 },
        /** Cumulative amount paid via withdrawals (order share + referral). Order share does not reduce balance. */
        totalSettled: { type: Number, default: 0, min: 0 },
        /**
         * Embedded audit history (referral credits/debits, order-share settlement
         * markers with balanceUnaffected, etc.). Not per-order delivery credits.
         */
        transactions: { type: [embeddedWalletTransactionSchema], default: [] }
    },
    { collection: 'food_restaurant_wallets', timestamps: true }
);

export const FoodRestaurantWallet = mongoose.model('FoodRestaurantWallet', restaurantWalletSchema, 'food_restaurant_wallets');

/**
 * Ensure a zero-balance restaurant wallet row exists (idempotent upsert).
 * Does not credit order earnings — those live in food_transactions.
 */
export async function ensureRestaurantWallet(restaurantId, { session = null } = {}) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        return null;
    }
    const rid =
        restaurantId instanceof mongoose.Types.ObjectId
            ? restaurantId
            : new mongoose.Types.ObjectId(String(restaurantId));

    const options = {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
    };
    if (session) options.session = session;

    return FoodRestaurantWallet.findOneAndUpdate(
        { restaurantId: rid },
        {
            $setOnInsert: {
                restaurantId: rid,
                balance: 0,
                subscriptionBalance: 0,
                lockedAmount: 0,
                totalEarnings: 0,
                referralEarnings: 0,
                totalSettled: 0,
                transactions: [],
            },
        },
        options
    );
}
