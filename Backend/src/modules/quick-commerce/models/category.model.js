import mongoose from 'mongoose';

const quickCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true },
  image: { type: String, default: '' },
  description: { type: String, default: '' },
  type: { type: String, default: 'header', index: true },
  status: { type: String, default: 'active', index: true },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved', index: true },
  approvedAt: { type: Date, default: null },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'quick_category', default: null, index: true },
  iconId: { type: String, default: '' },
  headerColor: { type: String, default: '#0c831f' },
  accentColor: { type: String, default: '#0c831f' },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

quickCategorySchema.index({ type: 1, approvalStatus: 1, isActive: 1, parentId: 1 });

export const QuickCategory = mongoose.model('quick_category', quickCategorySchema, 'quick_categories');
