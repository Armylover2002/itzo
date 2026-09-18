
import mongoose from 'mongoose';

const globalSettingsSchema = new mongoose.Schema(
    {
        companyName: { type: String, required: true, default: 'Appzeto' },
        email: { type: String, required: true, default: 'admin@appzeto.com' },
        phone: {
            countryCode: { type: String, default: '+91' },
            number: { type: String, default: '' }
        },
        address: { type: String, default: '' },
        state: { type: String, default: '' },
        pincode: { type: String, default: '' },
        region: { type: String, default: 'India' },
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
        loginBanner: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        sellerLoginBanner: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' },
            active: { type: Boolean, default: true }
        },
        restaurantLoginBanner: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' },
            active: { type: Boolean, default: true }
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
        landingNavbarLogo: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        landingFooterLogo: {
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
        playStoreLink: { type: String, default: '' },
        appStoreLink: { type: String, default: '' },
        socialLinkedinUrl: { type: String, default: '' },
        socialInstagramUrl: { type: String, default: '' },
        socialYoutubeUrl: { type: String, default: '' },
        socialFacebookUrl: { type: String, default: '' },
        socialTwitterUrl: { type: String, default: '' },
        themeColor: { type: String, default: '#0a0a0a' },
        codEnabled: { type: Boolean, default: true },
        onlineEnabled: { type: Boolean, default: true },
        socialLinks: {
            facebook: { type: String, default: '' },
            instagram: { type: String, default: '' },
            twitter: { type: String, default: '' },
            linkedin: { type: String, default: '' },
            youtube: { type: String, default: '' },
        },
        modules: {
            food: { type: Boolean, default: true },
            quickCommerce: { type: Boolean, default: true },
        },
        /**
         * Master kill-switch for the food subscription paywall. Defaults OFF so existing
         * restaurants/delivery partners keep operating exactly as before until admin
         * deliberately turns enforcement on for one or both audiences.
         */
        subscriptionEnforcement: {
            restaurant: { type: Boolean, default: false },
            deliveryPartner: { type: Boolean, default: false },
        }
    },
    { timestamps: true }
);

// We keep the collection name the same if we want to preserve data, 
// or rename it if we want a fresh start. 
// Given the user wants to "move" them, keeping data is likely preferred.
export const GlobalSettings = mongoose.model('GlobalSettings', globalSettingsSchema, 'common_global_settings');
