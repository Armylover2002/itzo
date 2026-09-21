import { FoodPageContent } from '../models/pageContent.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';

const normalizeKey = (key) => String(key || '').trim().toLowerCase();

const decodeHtmlEntities = (value) => {
    if (value === null || value === undefined) return value;
    let s = String(value);
    if (!s.includes('&')) return s;
    return s
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'");
};

const normalizeFaqs = (faqs = []) => {
    if (!Array.isArray(faqs)) return [];
    return faqs
        .map((item, idx) => ({
            question: decodeHtmlEntities(String(item?.question || '')).trim(),
            answer: decodeHtmlEntities(String(item?.answer || '')).trim(),
            order: Number.isFinite(Number(item?.order)) ? Number(item.order) : idx,
        }))
        .filter((item) => item.question || item.answer)
        .sort((a, b) => a.order - b.order);
};

const normalizeLegalForResponse = (legal) => {
    if (!legal || typeof legal !== 'object') return legal;
    const title = legal.title ?? '';
    const content = decodeHtmlEntities(legal.content ?? '');
    return {
        ...legal,
        title,
        content,
        contactNumber: String(legal.contactNumber ?? '').trim(),
        email: String(legal.email ?? '').trim(),
        faqs: normalizeFaqs(legal.faqs),
    };
};

const normalizeAboutForResponse = (about) => {
    if (!about || typeof about !== 'object') return about;
    return {
        ...about,
        appName: decodeHtmlEntities(about.appName ?? ''),
        version: decodeHtmlEntities(about.version ?? ''),
        description: decodeHtmlEntities(about.description ?? ''),
        logo: decodeHtmlEntities(about.logo ?? '')
    };
};

const getDefaultConsultingData = () => ({
    heroTitle: 'Restaurant Consulting & Licensing Assistance',
    heroSubtitle: 'Get your restaurant compliant and ready to onboard quickly with our expert assistance.',
    heroBannerImage: '',
    heroCtaText: 'Become a Partner',
    applyFormUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfk0WaAX2M7r3JNTHKH9W9t6jss2bmi_eo4NSRbQuWu5d4xoQ/viewform?pli=1',
    applyButtonLabel: 'Apply Here',
    documents: [
        { icon: 'CreditCard', title: 'PAN Card', description: 'Permanent Account Number', requirementExplanation: 'Required for tax identity verification.' },
        { icon: 'User', title: 'Aadhaar Card', description: 'UIDAI Aadhaar Number', requirementExplanation: 'Required for identity and address verification.' },
        { icon: 'ShieldCheck', title: 'FSSAI License', description: 'Food Safety License', requirementExplanation: 'Mandatory license from Food Safety and Standards Authority of India.' },
        { icon: 'Percent', title: 'GST License', description: 'Goods and Services Tax Registration', requirementExplanation: 'Mandatory for restaurants with turnover exceeding threshold.' }
    ],
    contentSections: [
        { heading: 'FSSAI Assistance', description: 'Get professional support in applying for New/Renewal FSSAI state or central licenses.' },
        { heading: 'GST Registration Assistance', description: 'Complete your GST registration without hassles through our verified partner networks.' },
        { heading: 'Restaurant Compliance Guidance', description: 'Ensure your kitchen operations and documentation follow government health department rules.' },
        { heading: 'Licensing Consultation', description: 'Speak with our licensing experts to understand what exact licenses are needed for your specific restaurant type.' }
    ],
    vendors: [],
    terms: [
        'Data sharing consent: By submitting, you agree to share your information with our registered consultants.',
        'Consultant assistance disclaimer: The platform acts as a facilitator and does not guarantee license approval.',
        'Pricing disclaimer: Pricing is decided by third-party consultants and may vary based on your state/city.',
        'Service responsibility disclaimer: ItzoFood is not responsible for any delay in service by compliance consultants.',
        'Support process explanation: Once you submit the form, our partner consultants will contact you within 24-48 business hours.',
        'Legal disclaimer: Obtaining licenses is subject to government approvals and documentation validity.'
    ]
});

const getDefaultLoginGrowthData = () => ({
    restaurant: {
        headline: "Grow Your Restaurant Without Paying Commission",
        subheadline: "Keep More Profit. Get More Orders. Pay Only ₹30/Day.",
        benefits: [
            "₹30 Daily Subscription",
            "Unlimited Orders",
            "0% Commission",
            "Higher Profit Per Order",
            "Direct Customer Relationship",
            "Loyalty Program Opportunities",
            "Own Delivery Staff Supported",
            "Platform Delivery Support Available"
        ],
        savingsExample: {
            orderValue: 500,
            traditionalCommission: "₹120–₹150 Commission",
            itzoCommission: "₹0 Commission",
            keepsRevenueText: "Restaurant Keeps Full Revenue"
        },
        additionalMessaging: {
            monthlyProfit: "₹59,100",
            yearlyProfit: "₹7,19,050"
        },
        consultingServices: [
            "FSSAI Registration",
            "GST Registration",
            "Trade License",
            "Trademark Registration"
        ]
    },
    delivery: {
        headline: "Earn More. Keep 100% Of Your Delivery Earnings.",
        subheadline: "Zero Commission. Unlimited Opportunities.",
        benefits: [
            "₹30 Daily Access",
            "Unlimited Order Opportunities",
            "100% Delivery Fee Retention",
            "100% Customer Tips",
            "Zero Commission",
            "Weekly Settlement"
        ],
        partnerWelfare: [
            "Accident Insurance up to ₹5 Lakhs",
            "Emergency Medical Support",
            "Welfare Fund Support"
        ],
        operationalBenefits: [
            "Hyperlocal Deliveries",
            "Smart Order Allocation",
            "Flexible Working Hours"
        ],
        driverMarketingBanner: "AB COMMISSION KA KHEL KHATAM!",
        ctaText: "Sirf ₹30 Mein Apni Delivery Agency Shuru Karein."
    },
    user: {
        headline: "Order Smarter. Save More.",
        subheadline: "Real Restaurant Prices. No Hidden Charges.",
        benefits: [
            "Actual Restaurant Menu Pricing",
            "No Artificial Menu Markup",
            "Transparent Delivery Charges",
            "Affordable Food Delivery",
            "Hyperlocal Delivery",
            "Better Pricing Than Traditional Apps"
        ],
        comparison: {
            traditionalAppsText: "Menu Price + Markup + Fees",
            itzoFoodText: "Actual Menu Price + Delivery Fee"
        },
        keyAdvantages: [
            "Lower Food Costs",
            "More Restaurant Choices",
            "Transparent Billing",
            "Better Local Economy Support"
        ],
        privacyMessage: "Your Privacy Matters: Female customer contact information remains protected and is never shared directly with delivery partners."
    }
});

export const getPublicPageByKey = async (key, role = 'user') => {
    const k = normalizeKey(key);
    const r = String(role || 'user').toLowerCase();

    const doc = await FoodPageContent.findOne({ key: k, role: r }).lean();
    if (!doc) {
        if (k === 'consulting') return { key: k, role: r, data: getDefaultConsultingData() };
        if (k === 'login_growth') return { key: k, role: r, data: getDefaultLoginGrowthData() };
        return { key: k, role: r, data: null };
    }
    if (k === 'about') return { key: k, role: r, data: normalizeAboutForResponse(doc.about || null) };
    if (k === 'consulting') return { key: k, role: r, data: doc.consulting || getDefaultConsultingData() };
    if (k === 'login_growth') return { key: k, role: r, data: doc.loginGrowth || getDefaultLoginGrowthData() };
    return { key: k, role: r, data: normalizeLegalForResponse(doc.legal || null) };
};

export const getAdminPageByKey = async (key, role = 'user') => getPublicPageByKey(key, role);

export const upsertLegalPage = async (key, payload, updatedBy, role = 'user') => {
    const k = normalizeKey(key);
    const r = String(role || 'user').toLowerCase();
    
    if (!['terms', 'privacy', 'support', 'refund', 'shipping', 'cancellation'].includes(k)) {
        throw new ValidationError('Invalid page key');
    }
    const title = String(payload?.title || '').trim();
    const content = decodeHtmlEntities(String(payload?.content || '')).trim();
    const legal = { title, content };

    if (k === 'support') {
        const contactNumber = String(payload?.contactNumber || '').replace(/\D/g, '').trim();
        if (contactNumber && !/^\d{10}$/.test(contactNumber)) {
            throw new ValidationError('Contact number must be exactly 10 digits');
        }
        legal.contactNumber = contactNumber;
        legal.email = String(payload?.email || '').trim().toLowerCase();
        legal.faqs = normalizeFaqs(payload?.faqs);
    }

    const doc = await FoodPageContent.findOneAndUpdate(
        { key: k, role: r },
        {
            $set: {
                key: k,
                role: r,
                legal,
                about: undefined,
                consulting: undefined,
                updatedBy: updatedBy || null,
                updatedByRole: 'ADMIN'
            }
        },
        { upsert: true, new: true }
    ).lean();

    return { key: k, role: r, data: normalizeLegalForResponse(doc?.legal || null) };
};

export const upsertAboutPage = async (payload, updatedBy) => {
    const appName = decodeHtmlEntities(String(payload?.appName || '')).trim() || 'Appzeto Food';
    const version = decodeHtmlEntities(String(payload?.version || '')).trim() || '1.0.0';
    const description = decodeHtmlEntities(String(payload?.description || '')).trim();
    const logo = decodeHtmlEntities(String(payload?.logo || '')).trim();
    const features = Array.isArray(payload?.features) ? payload.features : [];
    const stats = Array.isArray(payload?.stats) ? payload.stats : [];

    const normalizedFeatures = features.map((f, idx) => ({
        icon: String(f?.icon || 'Heart'),
        title: String(f?.title || ''),
        description: String(f?.description || ''),
        color: String(f?.color || ''),
        bgColor: String(f?.bgColor || ''),
        order: Number.isFinite(Number(f?.order)) ? Number(f.order) : idx
    }));

    const doc = await FoodPageContent.findOneAndUpdate(
        { key: 'about', role: 'all' },
        {
            $set: {
                key: 'about',
                role: 'all',
                about: { appName, version, description, logo, features: normalizedFeatures, stats },
                legal: undefined,
                consulting: undefined,
                updatedBy: updatedBy || null,
                updatedByRole: 'ADMIN'
            }
        },
        { upsert: true, new: true }
    ).lean();

    return { key: 'about', role: 'all', data: normalizeAboutForResponse(doc?.about || null) };
};

export const upsertConsultingPage = async (payload, updatedBy, role = 'user') => {
    const r = String(role || 'user').toLowerCase();

    const heroTitle = String(payload?.heroTitle || 'Restaurant Consulting & Licensing Assistance').trim();
    const heroSubtitle = String(payload?.heroSubtitle || '').trim();
    const heroBannerImage = String(payload?.heroBannerImage || '').trim();
    const heroCtaText = String(payload?.heroCtaText || 'Become a Partner').trim();

    const applyFormUrl = String(payload?.applyFormUrl || 'https://docs.google.com/forms/d/e/1FAIpQLSfk0WaAX2M7r3JNTHKH9W9t6jss2bmi_eo4NSRbQuWu5d4xoQ/viewform?pli=1').trim();
    const applyButtonLabel = String(payload?.applyButtonLabel || 'Apply Here').trim();

    const documents = Array.isArray(payload?.documents) ? payload.documents.map(d => ({
        icon: String(d?.icon || ''),
        title: String(d?.title || ''),
        description: String(d?.description || ''),
        requirementExplanation: String(d?.requirementExplanation || '')
    })) : [];

    const contentSections = Array.isArray(payload?.contentSections) ? payload.contentSections.map(c => ({
        heading: String(c?.heading || ''),
        description: String(c?.description || '')
    })) : [];

    const vendors = Array.isArray(payload?.vendors) ? payload.vendors.map(v => ({
        name: String(v?.name || ''),
        logo: String(v?.logo || ''),
        description: String(v?.description || ''),
        contactDetails: String(v?.contactDetails || ''),
        services: String(v?.services || ''),
        pricingInfo: String(v?.pricingInfo || ''),
        status: String(v?.status || 'active')
    })) : [];

    const terms = Array.isArray(payload?.terms) ? payload.terms.map(t => String(t || '')) : [];

    const doc = await FoodPageContent.findOneAndUpdate(
        { key: 'consulting', role: r },
        {
            $set: {
                key: 'consulting',
                role: r,
                consulting: {
                    heroTitle,
                    heroSubtitle,
                    heroBannerImage,
                    heroCtaText,
                    applyFormUrl,
                    applyButtonLabel,
                    documents,
                    contentSections,
                    vendors,
                    terms
                },
                legal: undefined,
                about: undefined,
                updatedBy: updatedBy || null,
                updatedByRole: 'ADMIN'
            }
        },
        { upsert: true, new: true }
    ).lean();

    return { key: 'consulting', role: r, data: doc?.consulting || null };
};

export const upsertLoginGrowthPage = async (payload, updatedBy) => {
    const restaurant = payload?.restaurant || {};
    const delivery = payload?.delivery || {};
    const user = payload?.user || {};

    const doc = await FoodPageContent.findOneAndUpdate(
        { key: 'login_growth', role: 'all' },
        {
            $set: {
                key: 'login_growth',
                role: 'all',
                loginGrowth: { restaurant, delivery, user },
                legal: undefined,
                about: undefined,
                consulting: undefined,
                updatedBy: updatedBy || null,
                updatedByRole: 'ADMIN'
            }
        },
        { upsert: true, new: true }
    ).lean();

    return { key: 'login_growth', role: 'all', data: doc?.loginGrowth || null };
};

