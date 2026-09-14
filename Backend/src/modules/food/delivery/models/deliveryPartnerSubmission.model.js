import mongoose from 'mongoose';
import { actionPerformerSchema } from '../../../../core/models/actionPerformer.schema.js';

const submissionSnapshotSchema = new mongoose.Schema(
    {
        name: { type: String, trim: true, default: '' },
        phone: { type: String, trim: true, default: '' },
        email: { type: String, trim: true, default: '' },
        countryCode: { type: String, trim: true, default: '+91' },
        address: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        vehicleType: { type: String, default: '' },
        vehicleName: { type: String, default: '' },
        vehicleNumber: { type: String, default: '' },
        panNumber: { type: String, default: '' },
        aadharNumber: { type: String, default: '' },
        drivingLicenseNumber: { type: String, default: '' },
        profilePhoto: { type: String, default: '' },
        aadharPhoto: { type: String, default: '' },
        panPhoto: { type: String, default: '' },
        drivingLicensePhoto: { type: String, default: '' },
        vehicleImage: { type: String, default: '' },
        // Bank/UPI: optional legacy/post-approval fields. New onboarding snapshots omit these when empty.
        bankAccountHolderName: { type: String, default: '' },
        bankAccountNumber: { type: String, default: '' },
        bankIfscCode: { type: String, default: '' },
        bankName: { type: String, default: '' },
        upiId: { type: String, default: '' },
        upiQrCode: { type: String, default: '' },
        driverVehicles: { type: mongoose.Schema.Types.Mixed, default: [] },
        activeVehicleId: { type: String, default: null }
    },
    { _id: false }
);

/**
 * Immutable onboarding submission history.
 * Never overwrite — always insert a new document for each submit/resubmit.
 */
const deliveryPartnerSubmissionSchema = new mongoose.Schema(
    {
        partnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodDeliveryPartner',
            required: true,
            index: true
        },
        submissionNumber: {
            type: Number,
            required: true,
            min: 1
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
            index: true
        },
        submissionType: {
            type: String,
            enum: ['initial', 'edit_existing', 'new_onboarding'],
            required: true,
            index: true
        },
        previousSubmissionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodDeliveryPartnerSubmission',
            default: null
        },
        submittedAt: {
            type: Date,
            default: Date.now,
            index: true
        },
        reviewedAt: {
            type: Date,
            default: null
        },
        approvedBy: {
            type: actionPerformerSchema,
            default: null
        },
        rejectedBy: {
            type: actionPerformerSchema,
            default: null
        },
        rejectionReason: {
            type: String,
            trim: true,
            default: null
        },
        snapshot: {
            type: submissionSnapshotSchema,
            required: true
        }
    },
    {
        collection: 'food_delivery_partner_submissions',
        timestamps: true
    }
);

deliveryPartnerSubmissionSchema.index(
    { partnerId: 1, submissionNumber: 1 },
    { unique: true }
);
deliveryPartnerSubmissionSchema.index({ partnerId: 1, status: 1, submittedAt: -1 });
deliveryPartnerSubmissionSchema.index({ status: 1, submittedAt: -1 });

export const FoodDeliveryPartnerSubmission = mongoose.model(
    'FoodDeliveryPartnerSubmission',
    deliveryPartnerSubmissionSchema,
    'food_delivery_partner_submissions'
);
