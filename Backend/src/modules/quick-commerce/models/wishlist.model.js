import mongoose from 'mongoose';

const wishlistItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'quick_product',
      required: true,
    },
    // '' means "the whole product" (no variant picked, or a variant-less
    // product). A non-empty value lets the same product be wishlisted once
    // per variant — liking one variant never touches another variant's entry.
    variantId: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false },
);

const quickWishlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodUser',
      default: null,
    },
    sessionId: {
      type: String,
      default: '',
      trim: true,
    },
    items: {
      type: [wishlistItemSchema],
      default: [],
    },
  },
  { timestamps: true }
);

quickWishlistSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { userId: { $exists: true, $ne: null } },
  }
);

quickWishlistSchema.index(
  { sessionId: 1 },
  {
    unique: true,
    partialFilterExpression: { sessionId: { $exists: true, $type: 'string', $ne: '' } },
  }
);

export const QuickWishlist = mongoose.model('quick_wishlist', quickWishlistSchema, 'quick_wishlists');
