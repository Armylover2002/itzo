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

const vendorSchema = new mongoose.Schema(
    {
        name: { type: String, default: '' },
        logo: { type: String, default: '' },
        description: { type: String, default: '' },
        contactDetails: { type: String, default: '' },
        services: { type: String, default: '' },
        pricingInfo: { type: String, default: '' },
        status: { type: String, default: 'active', enum: ['active', 'inactive'] }
    }
);

const documentItemSchema = new mongoose.Schema(
    {
        icon: { type: String, default: '' },
        title: { type: String, default: '' },
        description: { type: String, default: '' },
        requirementExplanation: { type: String, default: '' }
    },
    { _id: false }
);

const consultingContentSectionSchema = new mongoose.Schema(
    {
        heading: { type: String, default: '' },
        description: { type: String, default: '' }
    },
    { _id: false }
);

const consultingPageSchema = new mongoose.Schema(
    {
        heroTitle: { type: String, default: 'Restaurant Consulting & Licensing Assistance' },
        heroSubtitle: { type: String, default: 'Get your restaurant compliant and ready to onboard quickly with our expert assistance.' },
        heroBannerImage: { type: String, default: '' },
        heroCtaText: { type: String, default: 'Become a Partner' },

        applyFormUrl: { type: String, default: 'https://docs.google.com/forms/d/e/1FAIpQLSfk0WaAX2M7r3JNTHKH9W9t6jss2bmi_eo4NSRbQuWu5d4xoQ/viewform?pli=1' },
        applyButtonLabel: { type: String, default: 'Apply Here' },

        documents: {
            type: [documentItemSchema],
            default: [
                { icon: 'CreditCard', title: 'PAN Card', description: 'Permanent Account Number', requirementExplanation: 'Required for tax identity verification.' },
                { icon: 'User', title: 'Aadhaar Card', description: 'UIDAI Aadhaar Number', requirementExplanation: 'Required for identity and address verification.' },
                { icon: 'ShieldCheck', title: 'FSSAI License', description: 'Food Safety License', requirementExplanation: 'Mandatory license from Food Safety and Standards Authority of India.' },
                { icon: 'Percent', title: 'GST License', description: 'Goods and Services Tax Registration', requirementExplanation: 'Mandatory for restaurants with turnover exceeding threshold.' }
            ]
        },

        contentSections: {
            type: [consultingContentSectionSchema],
            default: [
                { heading: 'FSSAI Assistance', description: 'Get professional support in applying for New/Renewal FSSAI state or central licenses.' },
                { heading: 'GST Registration Assistance', description: 'Complete your GST registration without hassles through our verified partner networks.' },
                { heading: 'Restaurant Compliance Guidance', description: 'Ensure your kitchen operations and documentation follow government health department rules.' },
                { heading: 'Licensing Consultation', description: 'Speak with our licensing experts to understand what exact licenses are needed for your specific restaurant type.' }
            ]
        },

        vendors: {
            type: [vendorSchema],
            default: []
        },

        terms: {
            type: [String],
            default: [
                'Data sharing consent: By submitting, you agree to share your information with our registered consultants.',
                'Consultant assistance disclaimer: The platform acts as a facilitator and does not guarantee license approval.',
                'Pricing disclaimer: Pricing is decided by third-party consultants and may vary based on your state/city.',
                'Service responsibility disclaimer: ItzoFood is not responsible for any delay in service by compliance consultants.',
                'Support process explanation: Once you submit the form, our partner consultants will contact you within 24-48 business hours.',
                'Legal disclaimer: Obtaining licenses is subject to government approvals and documentation validity.'
            ]
        }
    },
    { _id: false }
);

const pageContentSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            index: true,
            enum: ['terms', 'privacy', 'support', 'refund', 'shipping', 'cancellation', 'about', 'consulting']
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
        consulting: { type: consultingPageSchema, default: undefined },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
        updatedByRole: { type: String, default: 'ADMIN' }
    },
    { collection: 'food_page_contents', timestamps: true }
);

// Composite unique index for key + role
pageContentSchema.index({ key: 1, role: 1 }, { unique: true });

export const FoodPageContent = mongoose.model('FoodPageContent', pageContentSchema, 'food_page_contents');

