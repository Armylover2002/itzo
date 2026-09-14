import mongoose from 'mongoose';
import { embeddedWalletTransactionSchema } from '../../../../core/payments/models/embeddedWalletTransaction.schema.js';

/**
 * DeliveryWallet — tracks the financial balance for each delivery partner.
 * Credited when deliveries are completed; debited when settlements are processed.
 * Embedded `transactions` complements the universal `transactions` collection.
 */
const deliveryWalletSchema = new mongoose.Schema(
    {
        deliveryPartnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodDeliveryPartner',
            required: true,
            unique: true,
            index: true
        },
        balance: { type: Number, default: 0 },
        /** Subscription wallet balance for daily passes and future fees */
        subscriptionBalance: { type: Number, default: 0, min: 0 },
        /** Amount locked for pending settlements */
        lockedAmount: { type: Number, default: 0, min: 0 },
        /** Cash collected from COD orders but not yet deposited to company */
        cashInHand: { type: Number, default: 0, min: 0 },
        /** Lifetime earnings from deliveries (excluding bonus) */
        totalEarnings: { type: Number, default: 0, min: 0 },
        /** Total bonus amount received from admin/offers */
        totalBonus: { type: Number, default: 0, min: 0 },
        /** Total amount already settled/paid out to delivery boy */
        totalSettled: { type: Number, default: 0, min: 0 },
        /** Total number of completed deliveries */
        totalDeliveries: { type: Number, default: 0, min: 0 },
        /** Per-document balance mutation history (same wallet document) */
        transactions: { type: [embeddedWalletTransactionSchema], default: [] }
    },
    { collection: 'food_delivery_wallets', timestamps: true }
);

export const FoodDeliveryWallet = mongoose.model('FoodDeliveryWallet', deliveryWalletSchema, 'food_delivery_wallets');

/**
 * Ensure a zero-balance delivery wallet row exists (idempotent upsert).
 */
export async function ensureDeliveryWallet(deliveryPartnerId, { session = null } = {}) {
    if (!deliveryPartnerId || !mongoose.Types.ObjectId.isValid(String(deliveryPartnerId))) {
        return null;
    }
    const pid =
        deliveryPartnerId instanceof mongoose.Types.ObjectId
            ? deliveryPartnerId
            : new mongoose.Types.ObjectId(String(deliveryPartnerId));

    const options = {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
    };
    if (session) options.session = session;

    return FoodDeliveryWallet.findOneAndUpdate(
        { deliveryPartnerId: pid },
        {
            $setOnInsert: {
                deliveryPartnerId: pid,
                balance: 0,
                subscriptionBalance: 0,
                lockedAmount: 0,
                cashInHand: 0,
                totalEarnings: 0,
                totalBonus: 0,
                totalSettled: 0,
                totalDeliveries: 0,
                transactions: [],
            },
        },
        options
    );
}
