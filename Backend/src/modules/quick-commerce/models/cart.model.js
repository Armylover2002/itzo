import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'quick_product', required: true },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  variantName: { type: String, default: '', trim: true },
  variantKey: { type: String, default: '', trim: true },
  variantSku: { type: String, default: '', trim: true },
  unitPrice: { type: Number, min: 0, default: 0 },
}, { _id: false });

const quickCartSchema = new mongoose.Schema({
  // Seller is derived from cart line products at runtime (ONE CART = ONE SELLER policy).
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodUser', default: null },
  sessionId: { type: String, default: '', trim: true },
  items: { type: [cartItemSchema], default: [] },
}, { timestamps: true });

quickCartSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { userId: { $exists: true, $ne: null } },
  }
);

quickCartSchema.index(
  { sessionId: 1 },
  {
    unique: true,
    partialFilterExpression: { sessionId: { $exists: true, $type: 'string', $ne: '' } },
  }
);

export const QuickCart = mongoose.model('quick_cart', quickCartSchema, 'quick_carts');
