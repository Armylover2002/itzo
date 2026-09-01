import mongoose from 'mongoose';

const globalSettingsSchema = new mongoose.Schema(
    {
        companyName: { type: String, required: true, default: 'Appzeto' },
        email: { type: String, required: true, default: 'admin@appzeto.com' },
        customerSupportEmail: { type: String, default: 'support@itzofood.com' },
        partnershipEmail: { type: String, default: 'partners@itzofood.com' },
        helpAndSupportEmail: { type: String, default: 'support@itzofood.com' },
        phone: {
            countryCode: { type: String, default: '+91' },
            number: { type: String, default: '' }
        },
        address: { type: String, default: '' },
        state: { type: String, default: '' },
        pincode: { type: String, default: '' },
        region: { type: String, default: 'India' },
        legalName: { type: String, default: '' },
        gstin: { type: String, default: '' },
        fssai: { type: String, default: '' },
        panNumber: { type: String, default: '' },
        cinNumber: { type: String, default: '' },
        adminLogo: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        adminFavicon: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        userLogo: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        userFavicon: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        userLoginBanner1: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        userLoginBanner2: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        userLoginBanner3: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        userLoginBanner4: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        userLoginBanner5: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        userLoginVideo: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        deliveryLogo: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        deliveryFavicon: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        restaurantLogo: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        restaurantFavicon: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        sellerLogo: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        sellerFavicon: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        landingHeroTitle: { type: String, default: 'ItzoFood' },
        landingHeroSubtitle: { type: String, default: 'Discover up to 30% off on your favorite meals & drinks in your city' },
        landingVideo: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        landingPoster: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        socialLinkedinUrl: { type: String, default: '' },
        socialInstagramUrl: { type: String, default: '' },
        socialYoutubeUrl: { type: String, default: '' },
        socialFacebookUrl: { type: String, default: '' },
        socialTwitterUrl: { type: String, default: '' },
        playStoreLink: { type: String, default: '' },
        appStoreLink: { type: String, default: '' },
        landingPizzaImage: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        landingTomatoImage: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        landingQrCodeImage: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        landingAppStoreBadge: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        landingPlayStoreBadge: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        landingFooterLogo: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        landingNavbarLogo: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        benefitsSectionEnabled: { type: Boolean, default: false },
        benefitsImage: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        benefitsImageAlt: { type: String, default: '' },
        benefitsImageLink: { type: String, default: '' },
        enableFemaleContactProtection: { type: Boolean, default: true },
        companySupportNumber: { type: String, default: '+919999999999' },
        companyWhatsappNumber: { type: String, default: '+919999999999' },
        privacyMessage: { type: String, default: 'For privacy and safety reasons, customer contact information is protected. Please contact ItzoFood Support.' },
        themeColor: { type: String, default: '#0a0a0a' },
        modules: {
            food: { type: Boolean, default: true },

            quickCommerce: { type: Boolean, default: true },

        },
        /**
         * Master switch for the subscription / daily-pass gate, per partner type.
         * true  (default) => existing flow: partner needs an active plan or day pass
         *                    to go online and to receive orders.
         * false           => partner manages their own online status freely, no
         *                    subscription required and the subscription UI is hidden.
         */
        subscriptionEnforcement: {
            deliveryPartner: { type: Boolean, default: true },
            restaurant: { type: Boolean, default: true }
        },
        contactsViewPassword: { type: String, default: 'admin123' }
    },
    { timestamps: true }
);

// We keep the collection name the same if we want to preserve data, 
// or rename it if we want a fresh start. 
// Given the user wants to "move" them, keeping data is likely preferred.
export const GlobalSettings = mongoose.model('GlobalSettings', globalSettingsSchema, 'common_global_settings');
