import mongoose from 'mongoose';

const quickCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true },
  image: { type: String, default: '' },
  description: { type: String, default: '' },
  type: { type: String, default: 'header', index: true },
  businessType: { type: String, enum: ['quick_commerce', 'food', 'default'], default: 'quick_commerce', index: true },
  status: { type: String, default: 'active', index: true },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved', index: true },
  approvedAt: { type: Date, default: null },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'quick_category', default: null, index: true },
  iconId: { type: String, default: '' },
  /** Commission % — authoritative only on type: 'header' (Header Category = source of truth). */
  adminCommission: { type: Number, default: 0, min: 0, max: 100 },
  /** GST % — authoritative only on type: 'header'. Existing records default to 0. */
  gst: { type: Number, default: 0, min: 0, max: 100 },
  /**
   * Customer returns — authoritative only on type: 'header'.
   * Products inherit enable/disable + window from their header category.
   */
  returnsEnabled: { type: Boolean, default: true },
  /** Return window in hours (1–720 = 1–30 days). Default 72h (3 days). */
  returnWindowHours: { type: Number, min: 1, max: 720, default: 72 },
  handlingFees: { type: Number, default: 0 },
  headerColor: { type: String, default: '#0c831f' },
  accentColor: { type: String, default: '#0c831f' },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  /**
   * Set to the ancestor category whose deactivation switched this row off, so switching
   * that ancestor back on restores it while leaving individually disabled rows alone.
   */
  deactivatedByParentId: { type: mongoose.Schema.Types.ObjectId, ref: 'quick_category', default: null },
}, { timestamps: true });

quickCategorySchema.index({ type: 1, approvalStatus: 1, isActive: 1, parentId: 1 });

export const QuickCategory = mongoose.model('quick_category', quickCategorySchema, 'quick_categories');
