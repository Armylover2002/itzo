import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../../config/env.js';

const adminSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        password: {
            type: String,
            required: true
        },
        name: { type: String, trim: true, default: '' },
        phone: { type: String, trim: true, default: '' },
        profileImage: { type: String, trim: true, default: '' },
        fcmTokens: {
            type: [String],
            default: []
        },
        fcmTokenMobile: {
            type: [String],
            default: []
        },

        role: {
            type: String,
            default: 'ADMIN'
        },
        employeeId: {
            type: String,
            unique: true,
            sparse: true,
            trim: true
        },
        workType: {
            type: String,
            enum: ['Work From Home', 'Work From Office'],
            default: 'Work From Office'
        },
        adminRoleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'AdminRole'
        },
        zoneId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodZone'
        },
        isActive: {
            type: Boolean,
            default: true
        },
        servicesAccess: {
            type: [String],
            enum: ['food', 'quickCommerce'],
            default: ['food']
        }
    },
    {
        collection: 'common_admins',
        timestamps: true
    }
);

adminSchema.index({ servicesAccess: 1 });

adminSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }

    const salt = await bcrypt.genSalt(config.bcryptSaltRounds);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

adminSchema.methods.comparePassword = function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

export const FoodAdmin = mongoose.model('FoodAdmin', adminSchema, 'common_admins');

