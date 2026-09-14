import mongoose from 'mongoose';

const userAddressSchema = new mongoose.Schema(
    {
        label: {
            type: String,
            enum: ['Home', 'Office', 'Other', 'Current Location'],
            default: 'Home',
            index: true
        },
        type: {
            type: String,
            enum: ['saved', 'current'],
            default: 'saved'
        },
        // Full human-readable / reverse-geocoded address (formatted string).
        address: {
            type: String,
            default: '',
            trim: true
        },
        /** Google Places place_id when address was selected via Places API */
        placeId: {
            type: String,
            default: '',
            trim: true
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
            required: false,
            trim: true
        },
        alternatePhone: {
            type: String,
            default: '',
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
            // default: 'USER'
        },
        walletBalance: {
            type: Number,
            default: 0,
            min: 0
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
        isBlocked: {
            type: Boolean,
            default: false
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        accountStatus: {
            type: String,
            enum: ['active', 'deleted'],
            default: 'active'
        },
        addresses: {
            type: [userAddressSchema],
            default: []
        }
    },
    {
        collection: 'users',
        timestamps: true
    }
);


userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ 'addresses.location': '2dsphere' });
userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ role: 1, isActive: 1, createdAt: -1 });

export const FoodUser = mongoose.model('FoodUser', userSchema, 'common_users');

