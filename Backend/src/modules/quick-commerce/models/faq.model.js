import mongoose from 'mongoose';

const faqSchema = new mongoose.Schema({
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'quick_faq_category',
    required: true
  },
  audience: {
    type: String,
    enum: ['customer', 'seller'],
    required: true
  },
  question: {
    type: String,
    required: true,
    trim: true
  },
  answer: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['published', 'draft'],
    default: 'published'
  },
  views: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

faqSchema.index({ audience: 1, status: 1 });

export const Faq = mongoose.model('quick_faq', faqSchema);
