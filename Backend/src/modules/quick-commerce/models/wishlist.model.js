import mongoose from 'mongoose';

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
    products: {
      type: [mongoose.Schema.Types.Mixed],
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
