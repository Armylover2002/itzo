import mongoose from 'mongoose';

const userAddressSchema = new mongoose.Schema(
    {
        label: {
            type: String,
            enum: ['Home', 'Office', 'Other'],
            default: 'Home',
            index: true
        },
        street: {
            type: String,
            required: true,
            trim: true
        },
        additionalDetails: {
            type: String,
            default: '',
            trim: true
        },
        city: {
            type: String,
            required: true,
            trim: true
        },
        state: {
            type: String,
            required: true,
            trim: true
        },
        zipCode: {
            type: String,
            default: '',
            trim: true
        },
        phone: {
            type: String,
            default: '',
            trim: true
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: {
                // [lng, lat]
                type: [Number],
                default: undefined,
                validate: {
                    validator: (v) =>
                        v === undefined ||
                        (Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n))),
                    message: 'location.coordinates must be [lng, lat]'
                }
            }
        },
        isDefault: {
            type: Boolean,
            default: false,
            index: true
        }
    },
    { _id: true, timestamps: true }
);

const userSchema = new mongoose.Schema(
    {
        phone: {
            type: String,
            required: true,
            trim: true
        },
        countryCode: {
            type: String,
            default: '+91'
        },
        name: {
            type: String
        },
        email: {
            type: String
        },
        profileImage: {
            type: String,
            default: ''
        },
        fcmTokens: {
            type: [String],
            default: []
        },
        fcmTokenMobile: {
            type: [String],
            default: []
        },
        dateOfBirth: {
            type: Date,
            default: null
        },
        anniversary: {
            type: Date,
            default: null
        },
        gender: {
            type: String,
            enum: ['male', 'female', 'other', 'prefer-not-to-say', ''],
            default: ''
        },
        referralCode: {
            type: String
        },
        referredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodUser',
            default: null,
            index: true
        },
        referralCount: {
            type: Number,
            default: 0,
            min: 0
        },
        isVerified: {
            type: Boolean,
            default: false
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        isCodAllowed: {
            type: Boolean,
            default: true,
            index: true
        },
        role: {
            type: String,
            default: 'USER'
        },
        walletBalance: {
            type: Number,
            default: 0,
            min: 0
        },
        address: {
            street: { type: String, trim: true },
            city: { type: String, trim: true },
            state: { type: String, trim: true },
            zipCode: { type: String, trim: true },
            country: { type: String, default: 'India', trim: true },
            coordinates: {
                lat: { type: Number },
                lng: { type: Number }
            }
        },
        aadhaarNumber: { type: String, trim: true },
        aadhaarFront: { type: String },
        aadhaarBack: { type: String },
        panNumber: { type: String, trim: true },
        panCardImage: { type: String },
        termsAccepted: { type: Boolean, default: false },
        registrationStep: {
            type: Number,
            default: 1
        },
        isContactSynced: {
            type: Boolean,
            default: false
        },
        contactPermissionStatus: {
            type: String,
            enum: ['PENDING', 'ALLOWED', 'DENIED', 'SKIPPED'],
            default: 'PENDING'
        },
        otp: {
            type: String,
            select: false
        },
        otpExpires: {
            type: Date,
            select: false
        },
        profileImagePublicId: {
            type: String,
            default: null
        },
        isBlocked: {
            type: Boolean,
            default: false
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        addresses: {
            type: [userAddressSchema],
            default: []
        },

        deletionRequest: {
            status: {
                type: String,
                enum: ['none', 'pending', 'approved', 'rejected', 'recovery_pending'],
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
        collection: 'users',
        timestamps: true
    }
);

userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ 'addresses.location': '2dsphere' });

export const FoodUser = mongoose.model('FoodUser', userSchema, 'common_users');

