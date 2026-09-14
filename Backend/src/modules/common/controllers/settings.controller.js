import { GlobalSettings } from '../models/settings.model.js';
import { sendResponse } from '../../../utils/response.js';
import { uploadImageBufferDetailed } from '../../../services/cloudinary.service.js';
import {
    getGlobalSettingsImagePreset,
    optimizeImageForUpload,
} from '../../../services/imageOptimization.service.js';
import { cleanupUploadedFiles } from '../../../utils/uploadCleanup.js';
import fs from 'fs/promises';
import { config } from '../../../config/env.js';
import { getRedisClient } from '../../../config/redis.js';
import { getCache, setCache, deleteCache } from '../../../utils/cacheManager.js';
import { clearGlobalBrandingCache } from '../services/globalBranding.service.js';
import { clearGlobalPaymentSettingsCache } from '../services/globalPaymentSettings.service.js';

const SETTINGS_CACHE_KEY = 'global_settings_public_v2';
const SETTINGS_CACHE_TTL_MS = 60 * 1000; // 1 minute server-side safety TTL
const SETTINGS_REDIS_KEY = 'common:global_settings:public:v2';

/** Fields required by public clients (branding, modules, payments, contact for footers). */
const PUBLIC_SETTINGS_PROJECTION = {
    companyName: 1,
    email: 1,
    phone: 1,
    address: 1,
    themeColor: 1,
    codEnabled: 1,
    onlineEnabled: 1,
    socialLinks: 1,
    modules: 1,
    adminLogo: 1,
    adminFavicon: 1,
    userLogo: 1,
    userFavicon: 1,
    deliveryLogo: 1,
    deliveryFavicon: 1,
    restaurantLogo: 1,
    restaurantFavicon: 1,
    sellerLogo: 1,
    sellerFavicon: 1,
    loginBanner: 1,
    sellerLoginBanner: 1,
    restaurantLoginBanner: 1,
    updatedAt: 1,
};

const PUBLIC_MEDIA_KEYS = [
    'adminLogo', 'adminFavicon', 'userLogo', 'userFavicon',
    'deliveryLogo', 'deliveryFavicon', 'restaurantLogo', 'restaurantFavicon',
    'sellerLogo', 'sellerFavicon', 'loginBanner',
];

const PUBLIC_BANNER_KEYS = ['sellerLoginBanner', 'restaurantLoginBanner'];

const getRedisCache = async (key) => {
    if (!config.redisEnabled) return null;
    const redis = getRedisClient();
    if (!redis || !redis.isReady) return null;

    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
};

const setRedisCache = async (key, value, ttlMs) => {
    if (!config.redisEnabled) return;
    const redis = getRedisClient();
    if (!redis || !redis.isReady) return;

    const ttlSeconds = Math.max(1, Math.ceil((ttlMs || SETTINGS_CACHE_TTL_MS) / 1000));
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
};

const deleteRedisCache = async (key) => {
    if (!config.redisEnabled) return;
    const redis = getRedisClient();
    if (!redis || !redis.isReady) return;
    await redis.del(key);
};

export const clearGlobalSettingsCache = async () => {
    deleteCache(SETTINGS_CACHE_KEY);
    try {
        await deleteRedisCache(SETTINGS_REDIS_KEY);
    } catch {}
    clearGlobalBrandingCache();
    clearGlobalPaymentSettingsCache();
};

const warmGlobalSettingsCache = async (payload) => {
    if (!payload) return;
    setCache(SETTINGS_CACHE_KEY, payload, SETTINGS_CACHE_TTL_MS);
    try {
        await setRedisCache(SETTINGS_REDIS_KEY, payload, SETTINGS_CACHE_TTL_MS);
    } catch {}
};

const normalizeModules = (modules) => {
    const allowedModules = Object.keys(GlobalSettings.schema.paths)
        .filter(p => p.startsWith('modules.'))
        .map(p => p.replace('modules.', ''));
    const cleanedModules = {};
    allowedModules.forEach(mod => {
        cleanedModules[mod] = (modules && modules[mod] !== undefined)
            ? !!modules[mod]
            : true;
    });
    return cleanedModules;
};

const slimMedia = (media) => {
    if (!media || typeof media !== 'object') return { url: '' };
    return { url: String(media.url || '').trim() };
};

const slimBanner = (banner) => {
    if (!banner || typeof banner !== 'object') return { url: '', active: true };
    return {
        url: String(banner.url || '').trim(),
        active: banner.active !== false,
    };
};

/** Full payload for authenticated admin GET/update responses. */
const buildSettingsPayload = (settings) => {
    const rawSettings = settings.toObject ? settings.toObject() : { ...settings };

    delete rawSettings._id;
    delete rawSettings.__v;
    delete rawSettings.createdAt;

    const imageKeys = [
        ...PUBLIC_MEDIA_KEYS,
        ...PUBLIC_BANNER_KEYS,
    ];
    imageKeys.forEach(k => {
        if (rawSettings[k]) delete rawSettings[k].publicId;
    });

    rawSettings.modules = normalizeModules(rawSettings.modules);
    return rawSettings;
};

/**
 * Lightweight public payload — only fields consumed by frontend panels.
 * Keeps flat logo/banner keys for backward compatibility with existing clients.
 * Omits state/pincode/region and Cloudinary publicIds.
 */
const buildPublicSettingsPayload = (settings) => {
    const raw = settings.toObject ? settings.toObject() : { ...settings };

    const payload = {
        companyName: raw.companyName || 'Appzeto',
        themeColor: raw.themeColor || '#0a0a0a',
        email: raw.email || '',
        phone: {
            countryCode: raw.phone?.countryCode || '+91',
            number: raw.phone?.number || '',
        },
        address: raw.address || '',
        modules: normalizeModules(raw.modules),
        socialLinks: {
            facebook: raw.socialLinks?.facebook || '',
            instagram: raw.socialLinks?.instagram || '',
            twitter: raw.socialLinks?.twitter || '',
            linkedin: raw.socialLinks?.linkedin || '',
            youtube: raw.socialLinks?.youtube || '',
        },
        codEnabled: raw.codEnabled !== false,
        onlineEnabled: raw.onlineEnabled !== false,
        updatedAt: raw.updatedAt || null,
    };

    PUBLIC_MEDIA_KEYS.forEach((key) => {
        payload[key] = slimMedia(raw[key]);
    });
    PUBLIC_BANNER_KEYS.forEach((key) => {
        payload[key] = slimBanner(raw[key]);
    });

    return payload;
};

export async function getGlobalSettings(req, res, next) {
    try {
        const isPublicRoute = req.path === '/public' || req.originalUrl?.includes('/public');
        if (isPublicRoute) {
            let cached = null;
            try {
                cached = await getRedisCache(SETTINGS_REDIS_KEY);
            } catch {}
            if (!cached) {
                cached = getCache(SETTINGS_CACHE_KEY);
            }
            if (cached) {
                res.set('Cache-Control', 'public, max-age=60, must-revalidate');
                return sendResponse(res, 200, 'Global settings fetched successfully', cached);
            }

            let settings = await GlobalSettings.findOne()
                .select(PUBLIC_SETTINGS_PROJECTION)
                .lean();

            if (!settings) {
                const created = await GlobalSettings.create({
                    companyName: 'Appzeto',
                    email: 'admin@appzeto.com',
                });
                settings = created.toObject ? created.toObject() : created;
            }

            const payload = buildPublicSettingsPayload(settings);
            setCache(SETTINGS_CACHE_KEY, payload, SETTINGS_CACHE_TTL_MS);
            try {
                await setRedisCache(SETTINGS_REDIS_KEY, payload, SETTINGS_CACHE_TTL_MS);
            } catch {}
            res.set('Cache-Control', 'public, max-age=60, must-revalidate');
            return sendResponse(res, 200, 'Global settings fetched successfully', payload);
        }

        let settings = await GlobalSettings.findOne();
        if (!settings) {
            settings = await GlobalSettings.create({
                companyName: 'Appzeto',
                email: 'admin@appzeto.com',
            });
        }

        const payload = buildSettingsPayload(settings);
        return sendResponse(res, 200, 'Global settings fetched successfully', payload);
    } catch (error) {
        next(error);
    }
}

export async function updateGlobalSettings(req, res, next) {
    try {
        let data = {};
        if (req.body.data) {
            try {
                data = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
            } catch (e) {
                console.error("Error parsing settings data:", e);
                data = req.body;
            }
        } else {
            data = req.body;
        }
        
        const { 
            companyName, email, phoneCountryCode, phoneNumber, address, state, pincode, region, 
            adminLogoUrl, adminFaviconUrl, userLogoUrl, userFaviconUrl, deliveryLogoUrl, deliveryFaviconUrl, restaurantLogoUrl, restaurantFaviconUrl, sellerLogoUrl, sellerFaviconUrl, loginBannerUrl,
            sellerLoginBannerUrl, restaurantLoginBannerUrl,
            sellerLoginBannerActive, restaurantLoginBannerActive,
            themeColor, codEnabled, onlineEnabled, modules,
            facebook, instagram, twitter, linkedin, youtube,
            socialLinks, subscriptionEnforcement
        } = data;
        
        console.log("Updating global settings with data:", data);

        // Validation
        if (companyName !== undefined && (!companyName || companyName.trim().length < 2 || companyName.trim().length > 50)) {
            return res.status(400).json({ success: false, message: 'Company name must be between 2 and 50 characters' });
        }
        
        if (email && (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
            return res.status(400).json({ success: false, message: 'Invalid email address' });
        }
        
        if (phoneNumber && !/^\d{7,15}$/.test(phoneNumber.trim())) {
            return res.status(400).json({ success: false, message: 'Invalid phone number (7-15 digits required)' });
        }

        let settings = await GlobalSettings.findOne();
        if (!settings) {
            settings = new GlobalSettings();
        }

        if (companyName) settings.companyName = companyName;
        if (email) settings.email = email;
        if (phoneCountryCode || phoneNumber) {
            settings.phone = {
                countryCode: phoneCountryCode || settings.phone?.countryCode || '+91',
                number: phoneNumber || settings.phone?.number || ''
            };
        }
        if (address !== undefined) settings.address = address;
        if (state !== undefined) settings.state = state;
        if (pincode !== undefined) settings.pincode = pincode;
        if (region) settings.region = region;

        // Update URLs if provided
        const mediaFields = [
            'adminLogo', 'adminFavicon', 'userLogo', 'userFavicon', 
            'deliveryLogo', 'deliveryFavicon', 'restaurantLogo', 'restaurantFavicon', 
            'sellerLogo', 'sellerFavicon', 'loginBanner', 'sellerLoginBanner', 'restaurantLoginBanner'
        ];
        mediaFields.forEach(field => {
            const urlKey = `${field}Url`;
            if (data[urlKey] !== undefined) {
                settings[field] = {
                    url: String(data[urlKey] || '').trim(),
                    publicId: settings[field]?.publicId || '',
                    active: settings[field]?.active !== undefined ? settings[field].active : true
                };
                settings.markModified(field);
            }
        });

        if (sellerLoginBannerActive !== undefined) {
            settings.sellerLoginBanner = {
                url: settings.sellerLoginBanner?.url || '',
                publicId: settings.sellerLoginBanner?.publicId || '',
                active: !!sellerLoginBannerActive
            };
            settings.markModified('sellerLoginBanner');
        }
        if (restaurantLoginBannerActive !== undefined) {
            settings.restaurantLoginBanner = {
                url: settings.restaurantLoginBanner?.url || '',
                publicId: settings.restaurantLoginBanner?.publicId || '',
                active: !!restaurantLoginBannerActive
            };
            settings.markModified('restaurantLoginBanner');
        }

        if (themeColor !== undefined) {
            settings.themeColor = themeColor;
        }
        if (codEnabled !== undefined) {
            settings.codEnabled = !!codEnabled;
        }
        if (onlineEnabled !== undefined) {
            settings.onlineEnabled = !!onlineEnabled;
        }

        const incomingSocial = socialLinks || {};
        const hasSocialUpdate = ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube'].some(
            (key) => data[key] !== undefined || incomingSocial[key] !== undefined
        );
        if (hasSocialUpdate) {
            settings.socialLinks = {
                facebook: String(data.facebook ?? incomingSocial.facebook ?? settings.socialLinks?.facebook ?? '').trim(),
                instagram: String(data.instagram ?? incomingSocial.instagram ?? settings.socialLinks?.instagram ?? '').trim(),
                twitter: String(data.twitter ?? incomingSocial.twitter ?? settings.socialLinks?.twitter ?? '').trim(),
                linkedin: String(data.linkedin ?? incomingSocial.linkedin ?? settings.socialLinks?.linkedin ?? '').trim(),
                youtube: String(data.youtube ?? incomingSocial.youtube ?? settings.socialLinks?.youtube ?? '').trim(),
            };
            settings.markModified('socialLinks');
        }

        // Strictly define modules and ensure persistence
        const incomingModules = modules || data.modules || {};
        const currentModules = settings.modules || {};
        
        // Dynamically rebuild the modules object using the schema keys (single source of truth)
        const allowedModules = Object.keys(GlobalSettings.schema.paths)
            .filter(p => p.startsWith('modules.'))
            .map(p => p.replace('modules.', ''));
            
        settings.modules = {};
        allowedModules.forEach(mod => {
            settings.modules[mod] = incomingModules[mod] !== undefined 
                ? !!incomingModules[mod] 
                : (currentModules[mod] !== undefined ? !!currentModules[mod] : true);
        });
        
        // Use markModified to ensure the modules object is fully replaced in DB
        settings.markModified('modules');

        // Subscription enforcement master toggle — only touch keys explicitly sent.
        const incomingEnforcement = subscriptionEnforcement || data.subscriptionEnforcement;
        if (incomingEnforcement && typeof incomingEnforcement === 'object') {
            const currentEnforcement = settings.subscriptionEnforcement || {};
            settings.subscriptionEnforcement = {
                restaurant: incomingEnforcement.restaurant !== undefined
                    ? !!incomingEnforcement.restaurant
                    : !!currentEnforcement.restaurant,
                deliveryPartner: incomingEnforcement.deliveryPartner !== undefined
                    ? !!incomingEnforcement.deliveryPartner
                    : !!currentEnforcement.deliveryPartner,
            };
            settings.markModified('subscriptionEnforcement');
        }

        // Handle file uploads
        if (req.files) {
            const mediaUploadFields = [
                { name: 'adminLogo', folder: 'business/logos/admin' },
                { name: 'adminFavicon', folder: 'business/favicons/admin' },
                { name: 'userLogo', folder: 'business/logos/user' },
                { name: 'userFavicon', folder: 'business/favicons/user' },
                { name: 'deliveryLogo', folder: 'business/logos/delivery' },
                { name: 'deliveryFavicon', folder: 'business/favicons/delivery' },
                { name: 'restaurantLogo', folder: 'business/logos/restaurant' },
                { name: 'restaurantFavicon', folder: 'business/favicons/restaurant' },
                { name: 'sellerLogo', folder: 'business/logos/seller' },
                { name: 'sellerFavicon', folder: 'business/favicons/seller' },
                { name: 'loginBanner', folder: 'business/banners/login' },
                { name: 'sellerLoginBanner', folder: 'business/banners/seller_login' },
                { name: 'restaurantLoginBanner', folder: 'business/banners/restaurant_login' }
            ];

            for (const field of mediaUploadFields) {
                const uploadedFile = req.files[field.name] && req.files[field.name][0];
                if (!uploadedFile) continue;

                const sourcePath = uploadedFile.path || null;
                if (!sourcePath) continue;

                try {
                    const optimizedBuffer = await optimizeImageForUpload(
                        sourcePath,
                        getGlobalSettingsImagePreset(field.name),
                    );
                    const result = await uploadImageBufferDetailed(optimizedBuffer, field.folder);
                    settings[field.name] = {
                        url: result.secure_url,
                        publicId: result.public_id,
                        active: settings[field.name]?.active !== undefined ? settings[field.name].active : true
                    };
                    settings.markModified(field.name);
                } finally {
                    await fs.unlink(sourcePath).catch(() => {});
                }
            }
        }

        await settings.save();
        const payload = buildSettingsPayload(settings);
        const publicPayload = buildPublicSettingsPayload(settings);
        await clearGlobalSettingsCache();
        await warmGlobalSettingsCache(publicPayload);
        return sendResponse(res, 200, 'Global settings updated successfully', payload);
    } catch (error) {
        await cleanupUploadedFiles(req.files);

        const message = String(error?.message || '');
        if (
            message.includes('Unsupported or invalid image file')
            || message.includes('Only image files are allowed')
            || message.includes('Unable to optimize image below 10 MB')
            || message.includes('Input image exceeds pixel limit')
        ) {
            return res.status(400).json({ success: false, message });
        }

        next(error);
    }
}
