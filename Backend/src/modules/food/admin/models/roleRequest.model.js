import mongoose from 'mongoose';

const roleRequestSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodUser',
            required: true,
            index: true
        },
        role: {
            type: String,
            enum: ['RESTAURANT', 'SELLER', 'DELIVERY_BOY'],
            required: true,
            index: true
        },
        status: {
            type: String,
            enum: ['PENDING', 'APPROVED', 'REJECTED'],
            default: 'PENDING',
            index: true
        },
        details: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        }
    },
    {
        timestamps: true,
        collection: 'role_requests'
    }
);

export const RoleRequest = mongoose.models.RoleRequest || mongoose.model('RoleRequest', roleRequestSchema, 'role_requests');
