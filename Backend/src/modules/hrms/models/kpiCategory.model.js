import mongoose from 'mongoose';

const kpiCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FoodAdmin'
    }
}, {
    timestamps: true
});

kpiCategorySchema.index({ isActive: 1 });

export const HrmsKpiCategory = mongoose.model('HrmsKpiCategory', kpiCategorySchema);
