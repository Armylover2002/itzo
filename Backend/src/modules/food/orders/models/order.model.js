import mongoose from 'mongoose';

const geoPointSchema = new mongoose.Schema(
    {
        type: { type: String, enum: ['Point'], default: undefined },
        coordinates: { type: [Number], default: undefined }
    },
    { _id: false }
);

const orderItemSchema = new mongoose.Schema(
    {
        itemId: { type: String, required: true, trim: true },
        name: { type: String, required: true, trim: true },
        type: { type: String, enum: ['food', 'quick'], required: true },
        sourceId: { type: String, required: true, trim: true },
        sourceName: { type: String, default: '', trim: true },
        price: { type: Number, required: true, min: 0 },
        quantity: { type: Number, required: true, min: 1 },
        isVeg: { type: Boolean, default: true },
        image: { type: String, default: '' },
        notes: { type: String, default: '' }
    },
    { _id: false }
);

const pickupPointSchema = new mongoose.Schema(
    {
        pickupType: { type: String, enum: ['food', 'quick'], required: true },
        sourceId: { type: String, required: true, trim: true },
        sourceName: { type: String, default: '', trim: true },
        address: { type: String, default: '', trim: true },
        location: {
            type: geoPointSchema,
            default: undefined
        },
        itemIds: { type: [String], default: [] }
    },
    { _id: false }
);

const dispatchLegSchema = new mongoose.Schema(
    {
        legId: { type: String, required: true, trim: true },
        pickupType: { type: String, enum: ['food', 'quick'], required: true },
        sourceId: { type: String, required: true, trim: true },
        sourceName: { type: String, default: '', trim: true },
        deliveryFee: { type: Number, default: 0, min: 0 },
        riderEarning: { type: Number, default: 0, min: 0 },
        deliveryPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodDeliveryPartner', default: null },
        assignedAt: { type: Date, default: null },
        partnerCandidates: [{
            partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodDeliveryPartner' },
            distanceKm: { type: Number, min: 0, default: null }
        }]
    },
    { _id: false }
);

const dispatchPlanSchema = new mongoose.Schema(
    {
        strategy: {
            type: String,
            enum: ['single', 'split', 'express_split'],
            default: 'single'
        },
        combinedPickupEligible: { type: Boolean, default: false },
        pickupDistanceKm: { type: Number, default: null },
        sameDirection: { type: Boolean, default: false },
        reason: { type: String, default: '', trim: true },
        legs: { type: [dispatchLegSchema], default: [] }
    },
    { _id: false }
);

const deliveryAddressSchema = new mongoose.Schema(
    {
        label: { type: String, enum: ['Home', 'Office', 'Other'], default: 'Home' },
        street: { type: String, required: true, trim: true },
        additionalDetails: { type: String, default: '', trim: true },
        city: { type: String, required: true, trim: true },
        state: { type: String, required: true, trim: true },
        zipCode: { type: String, default: '', trim: true },
        phone: { type: String, default: '', trim: true },
        location: {
            type: geoPointSchema,
            default: undefined
        }
    },
    { _id: false }
);

const pricingSchema = new mongoose.Schema(
    {
        subtotal: { type: Number, required: true, min: 0 },
        tax: { type: Number, default: 0, min: 0 },
        packagingFee: { type: Number, default: 0, min: 0 },
        deliveryFee: { type: Number, default: 0, min: 0 },
        totalDeliveryFee: { type: Number, default: 0, min: 0 },
        userDeliveryFee: { type: Number, default: 0, min: 0 },
        restaurantDeliveryFee: { type: Number, default: 0, min: 0 },
        sponsoredDelivery: { type: Boolean, default: false },
        sponsoredKm: { type: Number, default: 0, min: 0 },
        deliveryDistanceKm: { type: Number, default: null, min: 0 },
        deliverySponsorType: { type: String, default: 'USER_FULL', trim: true },
        platformFee: { type: Number, default: 0, min: 0 },
        handlingFee: { type: Number, default: 0, min: 0 },
        tip: { type: Number, default: 0, min: 0 },
        discount: { type: Number, default: 0, min: 0 },
        total: { type: Number, required: true, min: 0 },
        currency: { type: String, default: 'INR' }
    },
    { _id: false }
);

const paymentSchema = new mongoose.Schema(
    {
        method: {
            type: String,
            enum: ['cash', 'razorpay', 'razorpay_qr', 'wallet'],
            required: true
        },
        status: {
            type: String,
            enum: [
                'cod_pending',
                'created',
                'authorized',
                'paid',
                'failed',
                'refunded',
                'pending_qr',
                'cancelled'
            ],
            default: 'cod_pending'
        },
        amountDue: { type: Number, min: 0 },
        razorpay: {
            orderId: { type: String },
            paymentId: { type: String },
            signature: { type: String }
        },
        qr: {
            qrId: { type: String },
            imageUrl: { type: String },
            paymentLinkId: { type: String },
            shortUrl: { type: String },
            status: { type: String },
            expiresAt: { type: Date }
        },
        // ✅ NEW: Added refund object to track refund status without breaking existing flow
        refund: {
            status: { 
                type: String, 
                enum: ['none', 'pending', 'processed', 'failed'], 
                default: 'none' 
            },
            amount: { type: Number, default: 0 },
            refundId: { type: String, default: '' },
            requestedMethod: {
                type: String,
                enum: ['wallet', 'gateway'],
                default: undefined
            },
            processedMethod: {
                type: String,
                enum: ['wallet', 'gateway'],
                default: undefined
            },
            requestedAt: { type: Date, default: null },
            requestedByUser: { type: Boolean, default: false },
            reason: { type: String, default: '' },
            processedAt: { type: Date }
        }
    },
    { _id: false }
);

const dispatchSchema = new mongoose.Schema(
    {
        modeAtCreation: { type: String, enum: ['auto', 'manual'], default: 'manual' },
        status: {
            type: String,
            enum: ['unassigned', 'assigned', 'accepted', 'rejected', 'cancelled'],
            default: 'unassigned'
        },
        deliveryPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodDeliveryPartner', default: null },
        assignedAt: { type: Date },
        acceptedAt: { type: Date },
        /** List of partners who were offered this order (to avoid repeats and track timeouts) */
        offeredTo: [{
            partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodDeliveryPartner' },
            at: { type: Date, default: Date.now },
            action: { type: String, enum: ['offered', 'rejected', 'timeout'], default: 'offered' }
        }]
    },
    { _id: false }
);

const deliveryStateSchema = new mongoose.Schema(
    {
        currentPhase: {
            type: String,
            enum: [
                'en_route_to_pickup',
                'at_pickup',
                'en_route_to_delivery',
                'at_drop',
                'delivered',
                'completed'
            ],
            default: 'en_route_to_pickup'
        },
        status: { type: String, default: '' },
        reachedPickupAt: { type: Date, default: null },
        reachedDropAt: { type: Date, default: null },
        pickedUpAt: { type: Date, default: null },
        deliveredAt: { type: Date, default: null }
    },
    { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
    {
        at: { type: Date, default: Date.now },
        byRole: { type: String, enum: ['USER', 'RESTAURANT', 'SELLER', 'DELIVERY_PARTNER', 'ADMIN', 'SYSTEM'] },
        byId: { type: mongoose.Schema.Types.ObjectId },
        from: { type: String },
        to: { type: String },
        note: { type: String, default: '' }
    },
    { _id: false }
);

const orderEntityRatingSchema = new mongoose.Schema(
    {
        rating: { type: Number, min: 1, max: 5 },
        comment: { type: String, default: '', trim: true },
        ratedAt: { type: Date, default: Date.now }
    },
    { _id: false }
);

const orderRatingsSchema = new mongoose.Schema(
    {
        restaurant: { type: orderEntityRatingSchema, default: undefined },
        deliveryPartner: { type: orderEntityRatingSchema, default: undefined }
    },
    { _id: false }
);

const deliveryVerificationSchema = new mongoose.Schema(
    {
        dropOtp: {
            required: { type: Boolean, default: false },
            verified: { type: Boolean, default: false }
        }
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        orderType: {
            type: String,
            enum: ['food', 'quick','mixed'],
            default: 'food',
            index: true
        },
        orderId: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        sessionId: {
            type: String,
            default: '',
            trim: true,
            index: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodUser',
            default: null
        },
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodRestaurant',
            required() {
                return this.orderType === 'food';
            },
            default: null
        },
        zoneId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodZone',
            index: true
        },
        transactionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodTransaction',
            index: true
        },
        items: {
            type: [orderItemSchema],
            required: true,
            validate: (v) => Array.isArray(v) && v.length > 0
        },
        pickupPoints: {
            type: [pickupPointSchema],
            default: []
        },
        deliveryAddress: {
            type: deliveryAddressSchema,
            required() {
                return this.orderType === 'food' || this.orderType === 'quick' || this.orderType === 'mixed';
            }
        },
        pricing: {
            type: pricingSchema,
            required: true
        },
        couponCode: {
            type: String,
            default: null,
            trim: true
        },
        /**
         * Denormalized payment snapshot for fast reads & legacy clients.
         * Authoritative audit trail: collection `food_order_payments` (FoodOrderPayment model).
         */
        payment: {
            type: paymentSchema,
            required: true
        },
        orderStatus: {
            type: String,
            enum: [
                'placed',
                'created',
                'scheduled',
                'confirmed',
                'preparing',
                'ready_for_pickup',
                'picked_up',
                'delivered',
                'cancelled_by_user',
                'cancelled_by_restaurant',
                'cancelled_by_admin'
            ],
            default: 'created'
        },
        dispatch: {
            type: dispatchSchema,
            default: () => ({})
        },
        dispatchPlan: {
            type: dispatchPlanSchema,
            default: () => ({})
        },
        deliveryState: {
            type: deliveryStateSchema,
            default: () => ({})
        },
        statusHistory: {
            type: [statusHistorySchema],
            default: []
        },
        ratings: {
            type: orderRatingsSchema,
            default: () => ({})
        },
        note: { type: String, default: '', trim: true },
        sendCutlery: { type: Boolean, default: true },
        deliveryFleet: { type: String, default: 'standard', trim: true },
        scheduledAt: { type: Date, default: null },
        riderEarning: { type: Number, default: 0, min: 0 },
        platformProfit: { type: Number, default: 0, min: 0 },
        /** Plain 4-digit OTP for handover; cleared after successful verify (never expose to partner in API responses). */
        deliveryOtp: { type: String, default: '', select: false },
        deliveryVerification: {
            type: deliveryVerificationSchema,
            default: () => ({})
        },
        /** Latest rider location for this specific order (GeoJSON Point) */
        lastRiderLocation: {
            type: geoPointSchema,
            default: undefined
        }
    },
    {
        collection: 'food_orders',
        timestamps: true
    }
);

orderSchema.index({ 'deliveryAddress.location': '2dsphere' });
orderSchema.index({ lastRiderLocation: '2dsphere' });
orderSchema.index({ orderType: 1, sessionId: 1, createdAt: -1 });
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, orderStatus: 1, createdAt: -1 });
orderSchema.index({ 'dispatch.deliveryPartnerId': 1, orderStatus: 1 });
orderSchema.index({ 'dispatch.status': 1, orderStatus: 1 });
orderSchema.index({ 'payment.status': 1, createdAt: -1 });
orderSchema.index({ 'payment.method': 1, createdAt: -1 });

export const FoodOrder = mongoose.model('FoodOrder', orderSchema, 'food_orders');

const settingsSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true, trim: true },
        dispatchMode: { type: String, enum: ['auto', 'manual'], default: 'manual' },
        updatedBy: {
            role: { type: String },
            adminId: { type: mongoose.Schema.Types.ObjectId },
            at: { type: Date }
        }
    },
    { collection: 'food_settings', timestamps: true }
);

export const FoodSettings = mongoose.model('FoodSettings', settingsSchema, 'food_settings');
