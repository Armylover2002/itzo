import mongoose from 'mongoose';

const quickVariantSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  price: { type: Number, default: 0 },
  salePrice: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
  sku: { type: String, default: '' },
}, { _id: true });

const quickProductSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', default: null, index: true },
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true },
  image: { type: String, default: '' },
  mainImage: { type: String, default: '' },
  galleryImages: { type: [String], default: [] },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'quick_category', required: true, index: true },
  subcategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'quick_category', default: null, index: true },
  headerId: { type: mongoose.Schema.Types.ObjectId, ref: 'quick_category', default: null, index: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  mrp: { type: Number, required: true, min: 0 },
  unit: { type: String, default: '' },
  weight: { type: String, default: '' },
  brand: { type: String, default: '' },
  sku: { type: String, default: '' },
  stock: { type: Number, default: 0 },
  lowStockAlert: { type: Number, default: 5 },
  salePrice: { type: Number, default: 0 },
  status: { type: String, default: 'active', index: true },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved', index: true },
  approvedAt: { type: Date, default: null },
  isFeatured: { type: Boolean, default: false },
  tags: { type: [String], default: [] },
  variants: { type: [quickVariantSchema], default: [] },
  deliveryTime: { type: String, default: '10 mins' },
  badge: { type: String, default: '' },
  rating: { type: Number, default: 4.2 },
  returnable: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

quickProductSchema.index({ name: 'text' });
quickProductSchema.index({ createdAt: -1 });
quickProductSchema.index({ approvalStatus: 1, isActive: 1, categoryId: 1, subcategoryId: 1 });
quickProductSchema.index({ isActive: 1, status: 1 });

export const QuickProduct = mongoose.model('quick_product', quickProductSchema, 'quick_products');
