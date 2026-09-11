import mongoose from 'mongoose';

/**
 * One document per restaurant — covers the whole "opt in to Dining" lifecycle
 * in a single record: the request/approval audit trail (status,
 * requestedAt/reviewedAt/reviewedBy/rejectionReason) AND, once approved, the
 * restaurant's own dining configuration (slots, capacity, commission
 * override). Kept as one doc instead of a separate request-history table —
 * status + reviewedAt/reviewedBy is enough audit trail, the same way
 * FoodRestaurant.status/approvedAt/approvedBy already works.
 */
const daySlotSchema = new mongoose.Schema(
    {
        day: { type: String, required: true, trim: true }, // "Sunday".."Saturday"
        isOpen: { type: Boolean, default: false },
        openingTime: { type: String, trim: true, default: '' }, // "HH:mm"
        closingTime: { type: String, trim: true, default: '' }, // "HH:mm"
        slotDurationMinutes: { type: Number, default: 60, min: 15 },
        capacityPerSlot: { type: Number, default: 0, min: 0 }, // max guests per slot
    },
    { _id: false },
);

const diningProfileSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodRestaurant',
            required: true,
            unique: true,
            index: true,
        },

        // --- Request / approval workflow ---
        status: {
            type: String,
            enum: ['not_requested', 'pending', 'approved', 'rejected'],
            default: 'not_requested',
            index: true,
        },
        requestedAt: { type: Date, default: null },
        reviewedAt: { type: Date, default: null },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodAdmin', default: null },
        rejectionReason: { type: String, trim: true, default: '' },

        // Restaurant's own on/off switch — only meaningful once status === 'approved'.
        // Lets a restaurant temporarily pause taking dining bookings without losing
        // its approval or configuration.
        isDiningEnabled: { type: Boolean, default: false },

        // --- Restaurant-configured dining details (set after approval) ---
        categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DiningCategory' }],
        description: { type: String, trim: true, default: '' },
        ambienceImages: { type: [String], default: [] },
        avgCostForTwo: { type: Number, default: 0, min: 0 },
        slots: { type: [daySlotSchema], default: [] },

        // Per-restaurant commission override. When override is false, the
        // platform-wide DiningSettings.defaultCommission applies instead.
        commission: {
            override: { type: Boolean, default: false },
            type: { type: String, enum: ['percentage', 'amount'], default: 'percentage' },
            value: { type: Number, default: 0, min: 0 },
        },
    },
    { collection: 'dining_profiles', timestamps: true },
);

diningProfileSchema.index({ status: 1, isDiningEnabled: 1 });

export const DiningProfile = mongoose.model('DiningProfile', diningProfileSchema, 'dining_profiles');
