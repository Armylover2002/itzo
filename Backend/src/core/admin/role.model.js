import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
    {
        roleName: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        description: {
            type: String,
            trim: true,
            default: ''
        },
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active'
        },
        isDefault: {
            type: Boolean,
            default: false
        },
        /**
         * Permissions map:
         * {
         *   "food.order_management.orders.pending": { view: true, create: false, edit: true, delete: false },
         *   ...
         * }
         */
        permissions: {
            type: Map,
            of: new mongoose.Schema({
                view: { type: Boolean, default: false },
                create: { type: Boolean, default: false },
                edit: { type: Boolean, default: false },
                delete: { type: Boolean, default: false }
            }, { _id: false }),
            default: {}
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodAdmin'
        }
    },
    {
        timestamps: true,
        collection: 'admin_roles'
    }
);

// Prevent deletion of default roles
roleSchema.pre('deleteOne', { document: true, query: false }, function (next) {
    if (this.isDefault) {
        return next(new Error('Cannot delete system default role'));
    }
    next();
});

export const AdminRole = mongoose.model('AdminRole', roleSchema);
