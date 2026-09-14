import mongoose from 'mongoose';

const quickReviewSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'quick_product',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FoodUser',
    required: true,
    index: true,
  },
  userName: {
    type: String,
    required: true,
  },
  userAvatar: {
    type: String,
    default: '',
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true,
  },
}, { timestamps: true });

// Product review lists filter by productId+status and sort by createdAt desc;
// the trailing createdAt lets the index satisfy the sort (avoids in-memory sort).
quickReviewSchema.index({ productId: 1, status: 1, createdAt: -1 });

export const QuickReview = mongoose.model('quick_review', quickReviewSchema, 'quick_reviews');
