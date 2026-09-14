import mongoose from 'mongoose';

const quickHeroConfigSchema = new mongoose.Schema({
  pageType: { type: String, enum: ['home', 'header'], default: 'home', index: true },
  headerId: { type: mongoose.Schema.Types.ObjectId, ref: 'quick_category', default: null, index: true },
  banners: {
    items: [{
      imageUrl: { type: String, default: '' },
      title: { type: String, default: '' },
      subtitle: { type: String, default: '' },
      linkType: { type: String, default: 'none' },
      linkValue: { type: String, default: '' },
      status: { type: String, default: 'active' },
    }],
  },
  categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'quick_category' }],
}, { timestamps: true });

quickHeroConfigSchema.index({ pageType: 1, headerId: 1 });

export const QuickHeroConfig = mongoose.model('quick_hero_config', quickHeroConfigSchema, 'quick_hero_configs');
