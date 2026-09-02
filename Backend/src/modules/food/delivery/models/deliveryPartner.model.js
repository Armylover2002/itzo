import mongoose from 'mongoose';
import { actionPerformerSchema } from '../../../../core/models/actionPerformer.schema.js';

const normalizeRatingValue = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(5, Number(numeric.toFixed(1))));
};

const deliveryPartnerSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        phone: {
            type: String,
            required: true,
            trim: true,
            unique: true
        },
        email: { type: String, trim: true },
        countryCode: {
            type: String,
            default: '+91'
        },
        address: {
            type: String
        },
        city: {
            type: String
        },
        state: {
            type: String
        },
        vehicleType: {
            type: String
        },
        vehicleName: {
            type: String
        },
        vehicleNumber: {
            type: String,
            unique: true,
            sparse: true
        },
        panNumber: {
            type: String
        },
        aadharNumber: {
            type: String
        },
        drivingLicenseNumber: {
            type: String,
            trim: true
        },
        profilePhoto: {
            type: String
        },
        fcmTokens: {
            type: [String],
            default: []
        },
        fcmTokenMobile: {
            type: [String],
            default: []
        },
        aadharPhoto: {
            type: String
        },
        panPhoto: {
            type: String
        },
        drivingLicensePhoto: {
            type: String
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        applicationType: {
            type: String,
            enum: ['new', 'reapplied'],
            default: 'new',
            index: true
        },
        reappliedAt: { type: Date },
        reapplicationCount: { type: Number, default: 0 },
        previousRejectionReason: { type: String },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        rejectionReason: { type: String },
        rejectedAt: { type: Date },
        approvedAt: { type: Date },
        approvedBy: { type: actionPerformerSchema, default: null },
        rejectedBy: { type: actionPerformerSchema, default: null },
        bankAccountHolderName: { type: String },
        bankAccountNumber: { type: String },
        bankIfscCode: { type: String },
        bankName: { type: String },
        upiId: { type: String },
        upiQrCode: { type: String },
        availabilityStatus: {
            type: String,
            enum: ['online', 'offline'],
            default: 'offline'
        },
        lastLocation: {
            type: { type: String, enum: ['Point'] },
            coordinates: { type: [Number] }
        },
        lastLat: { type: Number },
        lastLng: { type: Number },
        lastLocationAt: { type: Date },
        referralCode: { type: String, index: true },
        referredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodDeliveryPartner',
            default: null,
            index: true
        },
        referralCount: { type: Number, default: 0, min: 0 },
        rating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5,
            set: normalizeRatingValue
        },
        totalRatings: { type: Number, default: 0, min: 0 },
        isDeleted: {
            type: Boolean,
            default: false
        },
        deletionRequest: {
            status: {
                type: String,
                enum: ['none', 'pending', 'approved', 'rejected'],
                default: 'none',
                index: true
            },
            reason: {
                type: String,
                default: '',
                trim: true
            },
            requestedAt: {
                type: Date,
                default: null
            },
            reviewedAt: {
                type: Date,
                default: null
            }
        }
    },
    {
        collection: 'food_delivery_partners',
        timestamps: true
    }
);

// Indices
deliveryPartnerSchema.index({ lastLocation: '2dsphere' });

export const FoodDeliveryPartner = mongoose.model('FoodDeliveryPartner', deliveryPartnerSchema, 'food_delivery_partners');

