import mongoose from 'mongoose';

const featureSchema = new mongoose.Schema(
    {
        icon: { type: String, default: 'Heart' },
        title: { type: String, default: '' },
        description: { type: String, default: '' },
        color: { type: String, default: '' },
        bgColor: { type: String, default: '' },
        order: { type: Number, default: 0 }
    },
    { _id: false }
);

const faqItemSchema = new mongoose.Schema(
    {
        question: { type: String, default: '' },
        answer: { type: String, default: '' },
        order: { type: Number, default: 0 }
    },
    { _id: false }
);

const legalPageSchema = new mongoose.Schema(
    {
        title: { type: String, default: '' },
        content: { type: String, default: '' },
        contactNumber: { type: String, default: '' },
        email: { type: String, default: '' },
        faqs: { type: [faqItemSchema], default: [] }
    },
    { _id: false }
);

const aboutPageSchema = new mongoose.Schema(
    {
        appName: { type: String, default: 'Appzeto Food' },
        version: { type: String, default: '1.0.0' },
        description: { type: String, default: '' },
        logo: { type: String, default: '' },
        features: { type: [featureSchema], default: [] },
        stats: { type: Array, default: [] }
    },
    { _id: false }
);

const pageContentSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            index: true,
            enum: ['terms', 'privacy', 'support', 'refund', 'shipping', 'cancellation', 'about']
        },
        role: {
            type: String,
            required: true,
            default: 'user',
            enum: ['user', 'restaurant', 'delivery', 'seller', 'all'],
            index: true
        },
        legal: { type: legalPageSchema, default: undefined },
        about: { type: aboutPageSchema, default: undefined },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
        updatedByRole: { type: String, default: 'ADMIN' }
    },
    { collection: 'food_page_contents', timestamps: true }
);

// Composite unique index for key + role
pageContentSchema.index({ key: 1, role: 1 }, { unique: true });

export const FoodPageContent = mongoose.model('FoodPageContent', pageContentSchema, 'food_page_contents');

