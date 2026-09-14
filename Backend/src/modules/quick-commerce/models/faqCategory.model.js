import mongoose from 'mongoose';

const faqCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  color: {
    type: String,
    default: 'sky'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

export const FaqCategory = mongoose.model('quick_faq_category', faqCategorySchema);
