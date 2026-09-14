import mongoose from 'mongoose';

const deliverySponsorRuleSchema = new mongoose.Schema(
    {
        minOrderAmount: { type: Number, required: true, min: 0 },
        maxOrderAmount: { type: Number, min: 0, default: null },
        maxDistanceKm: { type: Number, required: true, min: 0 },
        sponsorType: {
            type: String,
            enum: ['USER_FULL', 'RESTAURANT_FULL', 'SPLIT'],
            required: true
        },
        sponsoredKm: { type: Number, min: 0, default: null }
    },
    { _id: false }
);

const deliveryDistanceSlabSchema = new mongoose.Schema(
    {
        fromKm: { type: Number, required: true, min: 0 },
        toKm: { type: Number, required: true, min: 0 },
        deliveryFee: { type: Number, required: true, min: 0 }
    },
    { _id: false }
);

const deliveryFeeRangeSchema = new mongoose.Schema(
    {
        min: { type: Number, required: true, min: 0 },
        max: { type: Number, required: true, min: 0 },
        fee: { type: Number, required: true, min: 0 },
        deliveryBoyPerKm: { type: Number, min: 0, default: 0 },
        deliveryBoyBasePay: { type: Number, min: 0, default: 0 }
    },
    { _id: false }
);

/**
 * Food Quick Delivery fee settings (ADR-FOOD-QUICK-001).
 *
 * Admin-editable business: enabled, charge, shares, maxDistanceKm (customer
 * eligibility), maxEtaMinutes (quote eligibility only).
 *
 * Internal (defaults / ops DB): maxRadiusKm (rider search ≠ maxDistanceKm),
 * etaBufferMinutes, minOrderValue (ADR MOV; UI-hidden; default 0), dispatch*,
 * sla*. Preserve on Admin FE save via mergeQuickDeliveryForAdminSave.
 */
const quickDeliverySettingsSchema = new mongoose.Schema(
    {
        enabled: { type: Boolean, default: false },
        charge: { type: Number, min: 0, default: 30 },
        platformSharePct: { type: Number, min: 0, max: 100, default: 70 },
        riderSharePct: { type: Number, min: 0, max: 100, default: 30 },
        /** Restaurant Quick Share % — default 0 (Platform+Rider historical split). */
        restaurantSharePct: { type: Number, min: 0, max: 100, default: 0 },
        /** Customer path eligibility cap (km). */
        maxDistanceKm: { type: Number, min: 0, default: 8 },
        /** Rider dispatch search radius (km). Not the same as maxDistanceKm. */
        maxRadiusKm: { type: Number, min: 0, default: 20 },
        /** Max Quick promise minutes — eligibility/quote only, not dispatch. */
        maxEtaMinutes: { type: Number, min: 0, default: 30 },
        /** Platform kitchen prep fallback when restaurant.kitchenPrepMinutes unset. */
        defaultKitchenPrepMinutes: { type: Number, min: 1, max: 90, default: 12 },
        etaBufferMinutes: { type: Number, min: 0, default: 5 },
        /** Engineering: static assignment minutes until live provider. */
        riderAssignmentMinutes: { type: Number, min: 0, default: 3 },
        /** Engineering: pickup handover minutes. */
        pickupMinutes: { type: Number, min: 0, default: 2 },
        /** Engineering: fallback rider speed (km/h). */
        avgRiderSpeedKmh: { type: Number, min: 1, default: 22 },
        /** Engineering: travel minutes when distance unknown. */
        fallbackTravelMinutes: { type: Number, min: 0, default: 12 },
        /** ADR Quick MOV; not Admin UI; default 0 = off. */
        minOrderValue: { type: Number, min: 0, default: 0 },
        dispatchStartRadiusKm: { type: Number, min: 0, default: 8 },
        dispatchTimeoutSec: { type: Number, min: 1, default: 45 },
        maxDispatchWaves: { type: Number, min: 1, default: 3 },
        slaCompensationPct: { type: Number, min: 0, max: 100, default: 100 },
        slaCompensationMode: {
            type: String,
            enum: ['wallet', 'refund'],
            default: 'wallet',
        },
    },
    { _id: false }
);

const feeSettingsSchema = new mongoose.Schema(
    {
        // Legacy alias kept so quick/mixed flows that still read `deliveryFee`
        // continue to work without changing their execution path.
        deliveryFee: { type: Number, min: 0 },
        baseDistanceKm: { type: Number, min: 0 },
        baseDeliveryFee: { type: Number, min: 0 },
        perKmCharge: { type: Number, min: 0 },
        sponsorRules: { type: [deliverySponsorRuleSchema], default: [] },
        deliveryDistanceSlabs: { type: [deliveryDistanceSlabSchema], default: [] },
        deliveryFeeRanges: { type: [deliveryFeeRangeSchema], default: [] },
        platformFee: { type: Number, min: 0 },
        packagingFee: { type: Number, min: 0 },
        gstRate: { type: Number, min: 0, max: 100 },
        mixedOrderDistanceLimit: { type: Number, min: 0, default: 2 },
        mixedOrderAngleLimit: { type: Number, min: 0, default: 35 },
        /** Global Quick Delivery control + knobs. Missing/undefined ⇒ treat enabled as false. */
        quickDelivery: {
            type: quickDeliverySettingsSchema,
            default: () => ({ enabled: false }),
        },
        isActive: { type: Boolean, default: true, index: true }
    },
    { collection: 'food_fee_settings', timestamps: true }
);

feeSettingsSchema.index({ isActive: 1, createdAt: -1 });

export const FoodFeeSettings = mongoose.model('FoodFeeSettings', feeSettingsSchema, 'food_fee_settings');

