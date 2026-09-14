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
        email: { 
            type: String, 
            trim: true,
            lowercase: true,
            sparse: true,
            unique: true
        },
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
            sparse: true,
            trim: true,
            uppercase: true
        },
        panNumber: {
            type: String,
            trim: true,
            uppercase: true,
            sparse: true,
            unique: true,
            match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN number format']
        },
        aadharNumber: {
            type: String,
            trim: true,
            sparse: true,
            unique: true,
            match: [/^\d{12}$/, 'Invalid Aadhaar number format']
        },
        drivingLicenseNumber: {
            type: String,
            trim: true,
            uppercase: true,
            sparse: true,
            unique: true
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
        vehicleImage: {
            type: String
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
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
        accountStatus: {
            type: String,
            enum: ['active', 'deleted'],
            default: 'active'
        },
        driverVehicles: [{
            id: { type: String, trim: true },
            vehicleName: { type: String, trim: true },
            vehicleNumber: { type: String, trim: true, uppercase: true },
            vehicleCode: { type: String, trim: true },
            model: { type: String, trim: true, default: '' },
            vehiclePhoto: { type: String, trim: true, default: '' },
            rcPhoto: { type: String, trim: true, default: '' },
            insurancePhoto: { type: String, trim: true, default: '' },
            fitnessPhoto: { type: String, trim: true, default: '' },
            pollutionPhoto: { type: String, trim: true, default: '' },
            permitPhoto: { type: String, trim: true, default: '' },
            status: { type: String, enum: ['active', 'inactive', 'pending', 'draft', 'rejected'], default: 'active' },
            isDefault: { type: Boolean, default: false },
        }],
        activeVehicleId: { type: String, trim: true, default: null },
        /** Points at the latest onboarding submission (history lives in submissions collection). */
        latestSubmissionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodDeliveryPartnerSubmission',
            default: null,
            index: true
        },
        currentSubmissionNumber: {
            type: Number,
            default: 0,
            min: 0
        },
    },
    {
        collection: 'food_delivery_partners',
        timestamps: true
    }
);

// Indices
deliveryPartnerSchema.index({ lastLocation: '2dsphere' });
deliveryPartnerSchema.index({ 'driverVehicles.vehicleNumber': 1 }, { unique: true, sparse: true });

export const FoodDeliveryPartner = mongoose.model('FoodDeliveryPartner', deliveryPartnerSchema, 'food_delivery_partners');

