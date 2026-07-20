import { FoodRestaurant } from '../models/restaurant.model.js';
import { FoodRestaurantWallet } from '../models/restaurantWallet.model.js';
import { FoodReferralSettings } from '../../admin/models/referralSettings.model.js';
import { FoodReferralLog } from '../../admin/models/referralLog.model.js';
import { FoodRestaurantOutletTimings } from '../models/outletTimings.model.js';
import { uploadImageBuffer } from '../../../../services/cloudinary.service.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import mongoose from 'mongoose';
import { FoodZone } from '../../admin/models/zone.model.js';
import { FoodOffer } from '../../admin/models/offer.model.js';
import { getRestaurantDiningSnapshot, submitRestaurantDiningRequest } from '../../dining/services/dining.service.js';
import { 
    notifyAdminsSafely, 
    notifyOwnerSafely 
} from '../../../../core/notifications/firebase.service.js';
import { isPointInPolygon } from '../../../../utils/geo.js';
import { ensureDailyPassEligibility, activateDailyPass, checkRestaurantEligibilityReadOnly } from '../../subscriptions/services/wallet.service.js';
import { logger } from '../../../../utils/logger.js';


const normalizeName = (value) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ');

const normalizePhone = (value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(-15);
    return {
        digits: digits || '',
        last10: digits ? digits.slice(-10) : ''
    };
};

const normalizeRatingValue = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(5, Number(numeric.toFixed(1))));
};

const normalizeTotalRatingsValue = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.floor(numeric));
};

const toUrl = (v) => (v && (typeof v === 'string' ? v : v.url)) ? (typeof v === 'string' ? v : v.url) : '';

const normalizeRestaurantTime = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const toHHMM = (hour, minute) => {
        const h = Number(hour);
        const m = Number(minute);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
        if (h < 0 || h > 23 || m < 0 || m > 59) return '';
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // HH:mm / H:mm
    const hhmm = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmm) return toHHMM(hhmm[1], hhmm[2]);

    // hh:mm AM/PM
    const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
    if (ampm) {
        let hour = Number(ampm[1]);
        const minute = Number(ampm[2]);
        const period = ampm[3].toUpperCase();
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) return '';
        if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return '';
        if (period === 'AM') hour = hour === 12 ? 0 : hour;
        if (period === 'PM') hour = hour === 12 ? 12 : hour + 12;
        return toHHMM(hour, minute);
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        return toHHMM(parsed.getHours(), parsed.getMinutes());
    }

    return '';
};

const timeToMinutes = (value) => {
    const normalized = normalizeRestaurantTime(value);
    if (!normalized) return null;
    const [h, m] = normalized.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
};

const parseEstimatedDeliveryMinutes = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const matches = raw.match(/\d+/g);
    if (!matches || !matches.length) return null;
    const numbers = matches.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n >= 0);
    if (!numbers.length) return null;
    return Math.round(numbers[numbers.length - 1]);
};

const toRestaurantProfile = (doc) => {
    if (!doc) return null;
    const loc = doc.location && typeof doc.location === 'object' ? doc.location : null;
    const location =
        (loc?.formattedAddress ||
            loc?.address ||
            loc?.addressLine1 ||
            loc?.addressLine2 ||
            loc?.area ||
            loc?.city ||
            loc?.state ||
            loc?.pincode ||
            loc?.landmark ||
            doc.addressLine1 ||
            doc.addressLine2 ||
            doc.area ||
            doc.city ||
            doc.state ||
            doc.pincode ||
            doc.landmark)
            ? {
                type: loc?.type || 'Point',
                coordinates: Array.isArray(loc?.coordinates) ? loc.coordinates : undefined,
                latitude: typeof loc?.latitude === 'number' ? loc.latitude : (Array.isArray(loc?.coordinates) ? loc.coordinates[1] : undefined),
                longitude: typeof loc?.longitude === 'number' ? loc.longitude : (Array.isArray(loc?.coordinates) ? loc.coordinates[0] : undefined),
                formattedAddress: loc?.formattedAddress || loc?.address || '',
                address: loc?.address || loc?.formattedAddress || '',
                addressLine1: loc?.addressLine1 || doc.addressLine1 || '',
                addressLine2: loc?.addressLine2 || doc.addressLine2 || '',
                area: loc?.area || doc.area || '',
                city: loc?.city || doc.city || '',
                state: loc?.state || doc.state || '',
                pincode: loc?.pincode || doc.pincode || '',
                landmark: loc?.landmark || doc.landmark || ''
            }
            : null;

    const menuImages = Array.isArray(doc.menuImages)
        ? doc.menuImages.map((m) => toUrl(m)).filter(Boolean).map((url) => ({ url, publicId: null }))
        : [];
    const coverImages = Array.isArray(doc.coverImages)
        ? doc.coverImages.map((m) => toUrl(m)).filter(Boolean).map((url) => ({ url, publicId: null }))
        : [];

    return {
        id: doc._id,
        _id: doc._id,
        restaurantId: doc.restaurantId || undefined,
        name: doc.restaurantName || '',
        restaurantName: doc.restaurantName || '',
        zoneId: doc.zoneId ? String(doc.zoneId) : '',
        cuisines: Array.isArray(doc.cuisines) ? doc.cuisines : [],
        location,
        ownerName: doc.ownerName || '',
        ownerEmail: doc.ownerEmail || '',
        ownerPhone: doc.ownerPhone || '',
        primaryContactNumber: doc.primaryContactNumber || '',
        panNumber: doc.panNumber || doc.pan || '',
        nameOnPan: doc.nameOnPan || '',
        panImage: (doc.panImage || doc.pan_image) ? { url: (doc.panImage || doc.pan_image) } : null,
        gstRegistered: Boolean(doc.gstRegistered),
        gstNumber: doc.gstNumber || doc.gst || '',
        gstLegalName: doc.gstLegalName || '',
        gstAddress: doc.gstAddress || '',
        gstImage: (doc.gstImage || doc.gst_image) ? { url: (doc.gstImage || doc.gst_image) } : null,
        fssaiNumber: doc.fssaiNumber || doc.fssai || '',
        fssaiExpiry: doc.fssaiExpiry || doc.fssai_expiry || null,
        fssaiImage: (doc.fssaiImage || doc.fssai_image) ? { url: (doc.fssaiImage || doc.fssai_image) } : null,
        accountNumber: doc.accountNumber || '',
        ifscCode: doc.ifscCode || '',
        accountHolderName: doc.accountHolderName || '',
        accountType: doc.accountType || '',
        upiId: doc.upiId || '',
        upiQrImage: doc.upiQrImage ? { url: doc.upiQrImage } : null,
        pureVegRestaurant: Boolean(doc.pureVegRestaurant),
        zoneId: doc.zoneId ? String(doc.zoneId?._id || doc.zoneId) : '',
        zoneName: doc.zoneId?.name || doc.zoneId?.zoneName || doc.zoneId?.serviceLocation || '',
        profileImage: doc.profileImage ? { url: doc.profileImage } : null,
        menuImages,
        coverImages,
        openingTime: normalizeRestaurantTime(doc.openingTime) || null,
        closingTime: normalizeRestaurantTime(doc.closingTime) || null,
        openDays: Array.isArray(doc.openDays) ? doc.openDays : [],
        estimatedDeliveryTime: doc.estimatedDeliveryTime || '',
        featuredDish: doc.featuredDish || '',
        featuredPrice: doc.featuredPrice ?? null,
        offer: doc.offer || '',
        estimatedDeliveryTimeMinutes:
            Number.isFinite(Number(doc.estimatedDeliveryTimeMinutes))
                ? Number(doc.estimatedDeliveryTimeMinutes)
                : null,
        diningSettings: {
            isEnabled: doc.diningSettings?.isEnabled !== false,
            maxGuests: Math.max(1, parseInt(doc.diningSettings?.maxGuests, 10) || 6),
            diningType: String(doc.diningSettings?.diningType || 'family-dining').trim() || 'family-dining'
        },
        diningCategoryIds: Array.isArray(doc.diningCategoryIds) ? doc.diningCategoryIds.map((id) => String(id)) : [],
        diningCategories: Array.isArray(doc.diningCategories) ? doc.diningCategories : [],
        diningPrimaryCategoryId: doc.diningPrimaryCategoryId || null,
        pendingDiningRequest: doc.pendingDiningRequest || null,
        isAcceptingOrders: doc.isAcceptingOrders !== false,
        status: doc.status || null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        rating: normalizeRatingValue(doc.rating),
        totalRatings: normalizeTotalRatingsValue(doc.totalRatings),
        businessType: doc.businessType || 'Fixed Restaurant',
        liveTrackingEnabled: Boolean(doc.liveTrackingEnabled),
        lastLocationUpdate: doc.lastLocationUpdate || null,
        locationSource: doc.locationSource || null,
        currentLocation: doc.currentLocation && typeof doc.currentLocation === 'object'
            ? {
                type: doc.currentLocation.type || 'Point',
                coordinates: Array.isArray(doc.currentLocation.coordinates) ? doc.currentLocation.coordinates : undefined,
                latitude: typeof doc.currentLocation.latitude === 'number' ? doc.currentLocation.latitude : (Array.isArray(doc.currentLocation.coordinates) ? doc.currentLocation.coordinates[1] : undefined),
                longitude: typeof doc.currentLocation.longitude === 'number' ? doc.currentLocation.longitude : (Array.isArray(doc.currentLocation.coordinates) ? doc.currentLocation.coordinates[0] : undefined),
                formattedAddress: doc.currentLocation.formattedAddress || doc.currentLocation.address || '',
                address: doc.currentLocation.address || doc.currentLocation.formattedAddress || '',
            }
            : null
    };
};

const toFiniteNumber = (value) => {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n : null;
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeCuisine = (value) => String(value || '').trim().slice(0, 80);

const parseSortBy = (value) => {
    const v = String(value || '').trim();
    const allowed = new Set(['nearest', 'rating', 'newest', 'deliveryTime', 'price-low', 'price-high', 'rating-high', 'rating-low']);
    return allowed.has(v) ? v : null;
};

const zoneToPolygon = (zoneDoc) => {
    const coords = Array.isArray(zoneDoc?.coordinates) ? zoneDoc.coordinates : [];
    if (coords.length < 3) return null;
    const ring = coords
        .map((c) => [Number(c.longitude), Number(c.latitude)])
        .filter((pair) => pair.every((n) => Number.isFinite(n)));
    if (ring.length < 3) return null;
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
    return { type: 'Polygon', coordinates: [ring] };
};

const buildZoneRestaurantFilter = async (zoneIdRaw) => {
    const trimmedZoneId = String(zoneIdRaw || '').trim();
    if (!trimmedZoneId || !mongoose.Types.ObjectId.isValid(trimmedZoneId)) {
        return null;
    }

    const zoneClauses = [{ zoneId: new mongoose.Types.ObjectId(trimmedZoneId) }];
    const zoneDoc = await FoodZone.findOne({ _id: trimmedZoneId, isActive: true }).lean();
    const polygon = zoneToPolygon(zoneDoc);
    if (polygon) {
        zoneClauses.push({ location: { $geoWithin: { $geometry: polygon } } });
    }

    return { $or: zoneClauses };
};

const notifyAdminsAboutRestaurantProfileReview = async (restaurantId, restaurantName) => {
    try {
        const { notifyAdminsSafely } = await import('../../../../core/notifications/firebase.service.js');
        void notifyAdminsSafely({
            title: 'Restaurant Profile Updated',
            body: `Restaurant "${restaurantName || 'Unknown Restaurant'}" updated its profile and is pending approval again.`,
            data: {
                type: 'restaurant_profile_updated',
                subType: 'restaurant',
                id: String(restaurantId)
            }
        });
    } catch (e) {
        console.error('Failed to notify admins of restaurant profile resubmission:', e);
    }
};

export const registerRestaurant = async (payload, files) => {
    const {
        businessType,
        restaurantName,
        ownerName,
        ownerEmail,
        ownerPhone,
        primaryContactNumber,
        pureVegRestaurant,
        addressLine1,
        addressLine2,
        area,
        city,
        state,
        pincode,
        landmark,
        formattedAddress,
        latitude,
        longitude,
        zoneId,
        cuisines,
        openingTime,
        closingTime,
        openDays,
        estimatedDeliveryTime,
        panNumber,
        nameOnPan,
        gstRegistered,
        gstNumber,
        gstLegalName,
        gstAddress,
        fssaiNumber,
        fssaiExpiry,
        accountNumber,
        ifscCode,
        accountHolderName,
        accountType,
        featuredDish,
        offer,
        ref
    } = payload;

    if (!ownerPhone) {
        throw new ValidationError('Owner phone is required to register a restaurant');
    }

    const { digits: ownerPhoneDigits, last10: ownerPhoneLast10 } = normalizePhone(ownerPhone);
    if (!ownerPhoneLast10) {
        throw new ValidationError('Owner phone is invalid');
    }

    const restaurantNameNormalized = normalizeName(restaurantName);
    if (!restaurantNameNormalized) {
        throw new ValidationError('Restaurant name is required to register a restaurant');
    }

    // Strict validation for onboarding images to prevent partial records
    if (!files?.profileImage?.[0]) {
        logger.warn(`[ONBOARDING] Registration failed for ${ownerPhoneDigits || 'unknown'}: Missing profile image`);
        throw new ValidationError('Restaurant profile image is required');
    }

    if (!files?.menuImages?.length) {
        logger.warn(`[ONBOARDING] Registration failed for ${ownerPhoneDigits || 'unknown'}: Missing menu images`);
        throw new ValidationError('At least one menu image is required');
    }

    const images = {};

    const uploadTasks = [];

    if (files?.profileImage?.[0]) {
        uploadTasks.push(
            uploadImageBuffer(files.profileImage[0].buffer, 'food/restaurants/profile')
                .then(url => images.profileImage = url)
        );
    }
    if (files?.panImage?.[0]) {
        uploadTasks.push(
            uploadImageBuffer(files.panImage[0].buffer, 'food/restaurants/pan')
                .then(url => images.panImage = url)
        );
    }
    if (files?.gstImage?.[0]) {
        uploadTasks.push(
            uploadImageBuffer(files.gstImage[0].buffer, 'food/restaurants/gst')
                .then(url => images.gstImage = url)
        );
    }
    if (files?.fssaiImage?.[0]) {
        uploadTasks.push(
            uploadImageBuffer(files.fssaiImage[0].buffer, 'food/restaurants/fssai')
                .then(url => images.fssaiImage = url)
        );
    }

    let menuImages = [];
    if (files?.menuImages?.length) {
        uploadTasks.push(
            Promise.all(
                files.menuImages.map((file) => uploadImageBuffer(file.buffer, 'food/restaurants/menu'))
            ).then(urls => menuImages = urls)
        );
    }

    await Promise.all(uploadTasks);

    const normalizedOpeningTime = normalizeRestaurantTime(openingTime);
    const normalizedClosingTime = normalizeRestaurantTime(closingTime);
    const openingMinutes = timeToMinutes(normalizedOpeningTime);
    const closingMinutes = timeToMinutes(normalizedClosingTime);
    if (openingMinutes !== null && closingMinutes !== null) {
        if (openingMinutes === closingMinutes) {
            throw new ValidationError('Opening time and closing time cannot be same');
        }
        if (closingMinutes < openingMinutes) {
            throw new ValidationError('Closing time cannot be less than opening time');
        }
    }
    const estimatedDeliveryTimeText = String(estimatedDeliveryTime || '').trim();
    const estimatedDeliveryTimeMinutes = parseEstimatedDeliveryMinutes(estimatedDeliveryTimeText);

    try {
        const latNum = toFiniteNumber(latitude);
        const lngNum = toFiniteNumber(longitude);

        // Strict Geofencing Validation
        if (!zoneId) {
            throw new ValidationError('Zone is required');
        }
        if (latNum === null || lngNum === null) {
            throw new ValidationError('Invalid address coordinates');
        }

        const zone = await FoodZone.findById(zoneId).lean();
        if (!zone || !Array.isArray(zone.coordinates) || zone.coordinates.length < 3) {
            throw new ValidationError('Invalid zone configuration');
        }

        if (!isPointInPolygon(latNum, lngNum, zone.coordinates)) {
            throw new ValidationError('Selected address is outside the selected zone');
        }

        const restaurant = await FoodRestaurant.create({
            businessType: businessType || 'Fixed Restaurant',
            restaurantName,
            restaurantNameNormalized,
            ownerName,
            ownerEmail,
            // Store phone in a consistent digits-only format to match OTP login flow.
            ownerPhone: ownerPhoneDigits,
            ownerPhoneDigits,
            ownerPhoneLast10,
            primaryContactNumber,
            pureVegRestaurant: pureVegRestaurant === true,
            zoneId: zoneId && mongoose.Types.ObjectId.isValid(String(zoneId).trim())
                ? new mongoose.Types.ObjectId(String(zoneId).trim())
                : undefined,
            // Store unified location object (geo + address).
            location: {
                type: 'Point',
                coordinates: latNum !== null && lngNum !== null ? [lngNum, latNum] : undefined,
                latitude: latNum ?? undefined,
                longitude: lngNum ?? undefined,
                formattedAddress: typeof formattedAddress === 'string' ? formattedAddress.trim() : '',
                address: typeof formattedAddress === 'string' ? formattedAddress.trim() : '',
                addressLine1: addressLine1 || '',
                addressLine2: addressLine2 || '',
                area: area || '',
                city: city || '',
                state: state || '',
                pincode: pincode || '',
                landmark: landmark || ''
            },
            cuisines: cuisines || [],
            openingTime: normalizedOpeningTime || undefined,
            closingTime: normalizedClosingTime || undefined,
            openDays: openDays || [],
            estimatedDeliveryTime: estimatedDeliveryTimeText || undefined,
            estimatedDeliveryTimeMinutes: estimatedDeliveryTimeMinutes ?? undefined,
            panNumber,
            nameOnPan,
            gstRegistered,
            gstNumber,
            gstLegalName,
            gstAddress,
            fssaiNumber,
            fssaiExpiry,
            accountNumber,
            ifscCode,
            accountHolderName,
            accountType,
            estimatedDeliveryTime: estimatedDeliveryTime || '',
            featuredDish: featuredDish || '',
            offer: offer || '',
            menuImages,
            ...images
        });

        // --- Referral Handling ---
        const refRaw = typeof ref === 'string' ? String(ref).trim() : '';
        if (refRaw) {
            try {
                // Find referrer by ID or referralCode
                const referrerQuery = mongoose.Types.ObjectId.isValid(refRaw)
                    ? { _id: new mongoose.Types.ObjectId(refRaw) }
                    : { referralCode: refRaw };

                const [referrer, settingsDoc] = await Promise.all([
                    FoodRestaurant.findOne(referrerQuery).select('_id referralCount').lean(),
                    FoodReferralSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).lean()
                ]);

                if (referrer && settingsDoc) {
                    const referrerReward = Math.max(0, Number(settingsDoc.restaurant?.referrerReward) || 0);
                    const refereeReward = Math.max(0, Number(settingsDoc.restaurant?.refereeReward) || 0);
                    const limit = Math.max(0, Number(settingsDoc.restaurant?.limit) || 0);

                    if (
                        (referrerReward > 0 || refereeReward > 0) &&
                        limit > 0 &&
                        Number(referrer.referralCount || 0) < limit
                    ) {
                        // Update new restaurant with referrer info
                        await FoodRestaurant.updateOne({ _id: restaurant._id }, { $set: { referredBy: referrer._id } });

                        // Create referral log as PENDING
                        await FoodReferralLog.create({
                            referrerId: referrer._id,
                            refereeId: restaurant._id,
                            role: 'RESTAURANT',
                            rewardAmount: referrerReward,
                            referrerRewardAmount: referrerReward,
                            refereeRewardAmount: refereeReward,
                            status: 'pending'
                        });
                    } else {
                        await FoodReferralLog.create({
                            referrerId: referrer._id,
                            refereeId: restaurant._id,
                            role: 'RESTAURANT',
                            rewardAmount: referrerReward,
                            status: 'rejected',
                            reason:
                                referrerReward <= 0 && refereeReward <= 0
                                    ? 'reward_disabled'
                                    : limit <= 0
                                    ? 'limit_disabled'
                                    : 'limit_reached'
                        });
                    }
                }
            } catch (e) {
                console.error('Referral log creation failed (restaurant):', e);
            }
        }
        // --- End Referral Handling ---

        const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const shortDaysMap = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
        const normalizedOpenDays = (openDays || []).map(d => shortDaysMap[d] || d);
        const timingsArray = daysOfWeek.map(day => {
            const isOpen = normalizedOpenDays.includes(day);
            return {
                day,
                isOpen,
                openingTime: normalizedOpeningTime || '',
                closingTime: normalizedClosingTime || ''
            };
        });

        await FoodRestaurantOutletTimings.create({
            restaurantId: restaurant._id,
            timings: timingsArray
        });

        try {
            const { notifyAdminsSafely } = await import('../../../../core/notifications/firebase.service.js');
            void notifyAdminsSafely({
                title: 'New Restaurant Registration 🏪',
                body: `A new restaurant "${restaurant.restaurantName}" has registered and is pending approval.`,
                data: {
                    type: 'new_registration',
                    subType: 'restaurant',
                    id: String(restaurant._id)
                }
            });
        } catch (e) {
            console.error('Failed to notify admins of new restaurant registration:', e);
        }

        return restaurant.toObject();
    } catch (err) {
        // Handle uniqueness conflicts deterministically (race-safe).
        if (err && (err.code === 11000 || err?.name === 'MongoServerError')) {
            throw new ValidationError('Restaurant with this name and owner phone already exists');
        }
        throw err;
    }
};

export const getCurrentRestaurantProfile = async (restaurantId) => {
    if (!restaurantId) return null;
    const doc = await FoodRestaurant.findById(restaurantId)
        .select(
            [
                'restaurantId',
                'restaurantName',
                'cuisines',
                'location',
                'addressLine1',
                'addressLine2',
                'area',
                'city',
                'state',
                'pincode',
                'landmark',
                'ownerName',
                'ownerEmail',
                'ownerPhone',
                'primaryContactNumber',
                'accountNumber',
                'ifscCode',
                'accountHolderName',
                'accountType',
                'upiId',
                'upiQrImage',
                'pureVegRestaurant',
                'zoneId',
                'profileImage',
                'coverImages',
                'menuImages',
                'businessType',
                'liveTrackingEnabled',
                'currentLocation',
                'lastLocationUpdate',
                'locationSource',
                'openingTime',
                'closingTime',
                'openDays',
                'estimatedDeliveryTime',
                'featuredDish',
                'featuredPrice',
                'offer',
                'estimatedDeliveryTimeMinutes',
                'diningSettings',
                'isAcceptingOrders',
                'status',
                'fssaiNumber',
                'fssaiExpiry',
                'gstNumber',
                'gstRegistered',
                'gstLegalName',
                'gstAddress',
                'panNumber',
                'nameOnPan',
                'fssaiImage',
                'gstImage',
                'panImage',
                'businessType',
                'currentLocation',
                'lastLocationUpdate',
                'liveTrackingEnabled',
                'locationSource',
                'createdAt',
                'updatedAt'
            ].join(' ')
        )
        .populate('zoneId', 'name zoneName serviceLocation')
        .lean();
    if (!doc) return null;

    // Determine derived acceptsOrders status using the pure read-only check
    let isAcceptingOrders = doc.isAcceptingOrders !== false;
    try {
        const eligibility = await checkRestaurantEligibilityReadOnly(restaurantId, 'RESTAURANT');
        if (isAcceptingOrders !== eligibility.shouldAppearOnline) {
            isAcceptingOrders = eligibility.shouldAppearOnline;
            
            // Self-heal the database state asynchronously (non-blocking)
            FoodRestaurant.updateOne(
                { _id: restaurantId },
                { $set: { isAcceptingOrders } }
            ).catch(err => {
                logger.error(`[SELF-HEAL] Failed to update isAcceptingOrders to ${isAcceptingOrders} for restaurant ${restaurantId}: ${err.message}`);
            });
        }
    } catch (err) {
        logger.error(`[PROFILE-HYDRATION] Error validating accepts orders status: ${err.message}`);
    }

    const diningSnapshot = await getRestaurantDiningSnapshot(restaurantId);
    return toRestaurantProfile({
        ...doc,
        isAcceptingOrders,
        diningCategoryIds: diningSnapshot.categoryIds,
        diningCategories: diningSnapshot.categories,
        diningPrimaryCategoryId: diningSnapshot.primaryCategoryId,
        pendingDiningRequest: diningSnapshot.pendingDiningRequest
    });
};

export const updateRestaurantAcceptingOrders = async (restaurantId, isAcceptingOrders) => {
    if (!restaurantId) {
        throw new ValidationError('Invalid restaurant id');
    }

    const currentRestaurant = await FoodRestaurant.findById(restaurantId).select('isAcceptingOrders');
    if (!currentRestaurant) {
        throw new ValidationError('Restaurant not found');
    }

    const value = Boolean(isAcceptingOrders);

    // PHASE 3C-2: SUBSCRIPTION TRIGGER (CLOSED -> OPEN ONLY)
    if (currentRestaurant.isAcceptingOrders === false && value === true) {
        const eligibility = await ensureDailyPassEligibility(restaurantId, 'RESTAURANT');
        
        if (!eligibility.eligible) {
            throw new ValidationError(eligibility.reason === 'LOW_BALANCE' 
                ? 'Insufficient subscription balance. Minimum ₹1000 required to open.' 
                : 'Subscription access blocked.');
        }

        if (eligibility.shouldDeduct) {
            const result = await activateDailyPass(restaurantId, 'RESTAURANT');
            if (!result.success) {
                throw new ValidationError(result.reason === 'LOW_BALANCE' 
                    ? 'Insufficient subscription balance for daily pass.' 
                    : 'Failed to activate daily pass.');
            }
        }
    }

    const doc = await FoodRestaurant.findByIdAndUpdate(
        restaurantId,
        { $set: { isAcceptingOrders: value } },
        {
            new: true,
            runValidators: true,
            projection: [
                'restaurantId',
                'restaurantName',
                'cuisines',
                'location',
                'addressLine1',
                'addressLine2',
                'area',
                'city',
                'state',
                'pincode',
                'landmark',
                'ownerName',
                'ownerEmail',
                'ownerPhone',
                'primaryContactNumber',
                'accountNumber',
                'ifscCode',
                'accountHolderName',
                'accountType',
                'upiId',
                'upiQrImage',
                'pureVegRestaurant',
                'profileImage',
                'coverImages',
                'menuImages',
                'openingTime',
                'closingTime',
                'openDays',
                'diningSettings',
                'isAcceptingOrders',
                'status',
                'createdAt',
                'updatedAt'
            ].join(' ')
        }
    ).lean();
    return toRestaurantProfile(doc);
};

export const updateCurrentRestaurantDiningSettings = async (restaurantId, body = {}) => {
    if (!restaurantId) {
        throw new ValidationError('Invalid restaurant id');
    }
    await submitRestaurantDiningRequest(restaurantId, body);
    return getCurrentRestaurantProfile(restaurantId);
};

export const updateRestaurantProfile = async (restaurantId, body = {}) => {
    if (!restaurantId) {
        throw new ValidationError('Invalid restaurant id');
    }

    const currentRestaurant = await FoodRestaurant.findById(restaurantId)
        .select('restaurantName restaurantNameNormalized ownerPhone ownerPhoneDigits ownerPhoneLast10 primaryContactNumber status fssaiNumber fssaiImage zoneId')
        .lean();

    if (!currentRestaurant) {
        throw new ValidationError('Restaurant not found');
    }

    const update = {};

    // Owner/contact fields (used by restaurant Contact Details screens)
    if (body.ownerName !== undefined) {
        const ownerName = String(body.ownerName || '').trim();
        if (!ownerName) {
            throw new ValidationError('Owner name cannot be empty');
        }
        if (ownerName.length > 120) {
            throw new ValidationError('Owner name is too long');
        }
        update.ownerName = ownerName;
    }

    if (body.ownerEmail !== undefined) {
        const ownerEmail = String(body.ownerEmail || '').trim().toLowerCase();
        if (ownerEmail) {
            const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,5}$/;
            if (!EMAIL_REGEX.test(ownerEmail)) {
                throw new ValidationError('Invalid email format (e.g. name@gmail.com)');
            }
            if (ownerEmail.length > 254) {
                throw new ValidationError('Owner email is too long');
            }
            update.ownerEmail = ownerEmail;
        } else {
            update.ownerEmail = '';
        }
    }

    // Note: UI keeps phone read-only, but we accept it safely and normalize if sent.
    if (body.ownerPhone !== undefined) {
        const { digits, last10 } = normalizePhone(body.ownerPhone);
        if (!digits || digits.length < 8) {
            throw new ValidationError('Owner phone is invalid');
        }

        const currentOwnerPhoneDigits =
            currentRestaurant.ownerPhoneDigits ||
            normalizePhone(currentRestaurant.ownerPhone).digits ||
            '';

        if (digits !== currentOwnerPhoneDigits) {
            update.ownerPhone = digits;
            update.ownerPhoneDigits = digits;
            update.ownerPhoneLast10 = last10 || undefined;
        }
    }

    if (body.primaryContactNumber !== undefined) {
        const { digits } = normalizePhone(body.primaryContactNumber);
        const normalizedPrimaryContact =
            digits || String(body.primaryContactNumber || '').trim();
        const currentPrimaryContact =
            currentRestaurant.primaryContactNumber != null
                ? String(currentRestaurant.primaryContactNumber).trim()
                : '';

        if (normalizedPrimaryContact !== currentPrimaryContact) {
            update.primaryContactNumber = normalizedPrimaryContact;
        }
    }

    if (body.pureVegRestaurant !== undefined) {
        if (typeof body.pureVegRestaurant === 'boolean') {
            update.pureVegRestaurant = body.pureVegRestaurant;
        } else if (typeof body.pureVegRestaurant === 'string') {
            const normalized = body.pureVegRestaurant.trim().toLowerCase();
            if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
                update.pureVegRestaurant = true;
            } else if (normalized === 'false' || normalized === '0' || normalized === 'no') {
                update.pureVegRestaurant = false;
            } else {
                throw new ValidationError('pureVegRestaurant must be a boolean');
            }
        } else {
            throw new ValidationError('pureVegRestaurant must be a boolean');
        }
    }

    if (body.zoneId !== undefined) {
        const zoneId = String(body.zoneId || '').trim();
        update.zoneId = zoneId && mongoose.Types.ObjectId.isValid(zoneId)
            ? new mongoose.Types.ObjectId(zoneId)
            : undefined;
    }

    // Bank + UPI fields (Explore -> Update Bank Details page)
    if (body.accountHolderName !== undefined) {
        update.accountHolderName = String(body.accountHolderName || '').trim();
    }
    if (body.accountNumber !== undefined) {
        update.accountNumber = String(body.accountNumber || '').replace(/\s|-/g, '').trim();
    }
    if (body.ifscCode !== undefined) {
        update.ifscCode = String(body.ifscCode || '').trim().toUpperCase();
    }
    if (body.accountType !== undefined) {
        update.accountType = String(body.accountType || '').trim();
    }
    if (body.upiId !== undefined) {
        update.upiId = String(body.upiId || '').trim();
    }
    if (body.upiQrImage !== undefined || body.upiQrCode !== undefined) {
        const qrImage = body.upiQrImage !== undefined ? body.upiQrImage : body.upiQrCode;
        update.upiQrImage = String(qrImage || '').trim();
    }

    if (body.name !== undefined || body.restaurantName !== undefined) {
        const raw = body.name !== undefined ? body.name : body.restaurantName;
        const name = String(raw || '').trim();
        if (!name) {
            throw new ValidationError('Restaurant name cannot be empty');
        }
        const normalizedName = normalizeName(name) || undefined;
        const currentName = String(currentRestaurant.restaurantName || '').trim();
        const currentNormalizedName =
            currentRestaurant.restaurantNameNormalized || normalizeName(currentName) || undefined;

        if (name !== currentName || normalizedName !== currentNormalizedName) {
            update.restaurantName = name;
            update.restaurantNameNormalized = normalizedName;
        }
    }

    if (body.cuisines !== undefined) {
        if (!Array.isArray(body.cuisines)) {
            throw new ValidationError('Cuisines must be an array of strings');
        }
        const cuisines = body.cuisines
            .map((c) => String(c || '').trim())
            .filter(Boolean)
            .slice(0, 50);
        update.cuisines = cuisines;
    }

    if (body.location !== undefined) {
        const loc = body.location && typeof body.location === 'object' ? body.location : null;
        if (!loc) {
            throw new ValidationError('Location must be an object');
        }
        const toStr = (v) => (v != null ? String(v).trim() : '');
        const formattedAddress = toStr(loc.formattedAddress || loc.address);
        update.addressLine1 = toStr(loc.addressLine1);
        update.addressLine2 = toStr(loc.addressLine2);
        update.area = toStr(loc.area);
        update.city = toStr(loc.city);
        update.state = toStr(loc.state);
        update.pincode = toStr(loc.pincode);
        update.landmark = toStr(loc.landmark);

        // Optional geo coords for server-side distance filtering.
        const lat = toFiniteNumber(loc.latitude);
        const lng = toFiniteNumber(loc.longitude);

        if (lat === null || lng === null) {
            throw new ValidationError('Invalid address coordinates');
        }

        // Strict Geofencing Validation: Check if address is within the zone
        const targetZoneId = update.zoneId || currentRestaurant.zoneId;
        if (!targetZoneId) {
            throw new ValidationError('Zone is required');
        }

        const zone = await FoodZone.findById(targetZoneId).lean();
        if (!zone || !Array.isArray(zone.coordinates) || zone.coordinates.length < 3) {
            throw new ValidationError('Invalid zone configuration');
        }

        if (!isPointInPolygon(lat, lng, zone.coordinates)) {
            throw new ValidationError('Selected address is outside the selected zone');
        }

        update.location = {
            type: 'Point',
            coordinates: lat !== null && lng !== null ? [lng, lat] : undefined,
            latitude: lat ?? undefined,
            longitude: lng ?? undefined,
            formattedAddress,
            address: formattedAddress,
            addressLine1: toStr(loc.addressLine1),
            addressLine2: toStr(loc.addressLine2),
            area: toStr(loc.area),
            city: toStr(loc.city),
            state: toStr(loc.state),
            pincode: toStr(loc.pincode),
            landmark: toStr(loc.landmark)
        };
    }

    if (body.openingTime !== undefined) {
        update.openingTime = normalizeRestaurantTime(body.openingTime) || '';
    }
    if (body.closingTime !== undefined) {
        update.closingTime = normalizeRestaurantTime(body.closingTime) || '';
    }
    if (body.openDays !== undefined) {
        if (!Array.isArray(body.openDays)) {
            throw new ValidationError('openDays must be an array');
        }
        update.openDays = body.openDays
            .map((day) => String(day || '').trim())
            .filter(Boolean)
            .slice(0, 7);
    }
    if (body.estimatedDeliveryTime !== undefined) {
        const estimatedDeliveryTimeText = String(body.estimatedDeliveryTime || '').trim();
        update.estimatedDeliveryTime = estimatedDeliveryTimeText;
        update.estimatedDeliveryTimeMinutes = parseEstimatedDeliveryMinutes(estimatedDeliveryTimeText) ?? undefined;
    }

    const openingMinutes = body.openingTime !== undefined ? timeToMinutes(update.openingTime) : null;
    const closingMinutes = body.closingTime !== undefined ? timeToMinutes(update.closingTime) : null;
    if (openingMinutes !== null && closingMinutes !== null) {
        if (openingMinutes === closingMinutes) {
            throw new ValidationError('Opening time and closing time cannot be same');
        }
        if (closingMinutes < openingMinutes) {
            throw new ValidationError('Closing time cannot be less than opening time');
        }
    }

    if (body.menuImages !== undefined) {
        if (!Array.isArray(body.menuImages)) {
            throw new ValidationError('menuImages must be an array');
        }
        const urls = body.menuImages
            .map((m) => toUrl(m))
            .filter(Boolean)
            .slice(0, 20);
        update.menuImages = urls;
    }

    if (body.coverImages !== undefined) {
        if (!Array.isArray(body.coverImages)) {
            throw new ValidationError('coverImages must be an array');
        }
        const urls = body.coverImages
            .map((m) => toUrl(m))
            .filter(Boolean)
            .slice(0, 20);
        update.coverImages = urls;
    }

    if (body.profileImage !== undefined) {
        update.profileImage = toUrl(body.profileImage) || '';
    }

    if (body.panNumber !== undefined) {
        update.panNumber = String(body.panNumber || '').trim().toUpperCase();
    }
    if (body.nameOnPan !== undefined) {
        update.nameOnPan = String(body.nameOnPan || '').trim();
    }
    if (body.panImage !== undefined) {
        update.panImage = toUrl(body.panImage) || '';
    }
    if (body.gstRegistered !== undefined) {
        if (typeof body.gstRegistered === 'boolean') {
            update.gstRegistered = body.gstRegistered;
        } else if (typeof body.gstRegistered === 'string') {
            const normalized = body.gstRegistered.trim().toLowerCase();
            if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
                update.gstRegistered = true;
            } else if (normalized === 'false' || normalized === '0' || normalized === 'no') {
                update.gstRegistered = false;
            } else {
                throw new ValidationError('gstRegistered must be a boolean');
            }
        } else {
            throw new ValidationError('gstRegistered must be a boolean');
        }
    }
    if (body.gstNumber !== undefined) {
        update.gstNumber = String(body.gstNumber || '').trim().toUpperCase();
    }
    if (body.gstLegalName !== undefined) {
        update.gstLegalName = String(body.gstLegalName || '').trim();
    }
    if (body.gstAddress !== undefined) {
        update.gstAddress = String(body.gstAddress || '').trim();
    }
    if (body.gstImage !== undefined) {
        update.gstImage = toUrl(body.gstImage) || '';
    }

    // FSSAI Re-verification Flow
    let fssaiChanged = false;
    const incomingFssaiNumber = body.fssaiNumber !== undefined ? String(body.fssaiNumber || '').trim() : null;
    const incomingFssaiImage = body.fssaiImage !== undefined ? toUrl(body.fssaiImage) : null;
    
    const currentFssaiNumber = String(currentRestaurant.fssaiNumber || '').trim();
    const currentFssaiImage = toUrl(currentRestaurant.fssaiImage) || '';

    if (incomingFssaiNumber !== null && incomingFssaiNumber !== currentFssaiNumber) {
        fssaiChanged = true;
    }
    if (incomingFssaiImage !== null && incomingFssaiImage !== currentFssaiImage) {
        fssaiChanged = true;
    }
    
    // Check for expiry date change
    if (body.fssaiExpiry !== undefined) {
        const incomingExpiry = String(body.fssaiExpiry || '').trim();
        const currentExpiry = currentRestaurant.fssaiExpiry ? new Date(currentRestaurant.fssaiExpiry).toISOString().split('T')[0] : '';
        if (incomingExpiry && incomingExpiry !== currentExpiry) {
            fssaiChanged = true;
        }
    }

    if (fssaiChanged) {
        update.status = 'pending';
        update.reVerification = {
            ...(currentRestaurant.reVerification || {}),
            isZoneUpdate: false, // It's an FSSAI update, not a zone update
            reVerificationReason: 'FSSAI License Update'
        };
    }

    if (body.fssaiNumber !== undefined) {
        update.fssaiNumber = String(body.fssaiNumber || '').trim();
    }
    if (body.fssaiExpiry !== undefined) {
        const rawExpiry = String(body.fssaiExpiry || '').trim();
        if (!rawExpiry) {
            update.fssaiExpiry = null;
        } else {
            const parsedExpiry = new Date(rawExpiry);
            if (Number.isNaN(parsedExpiry.getTime())) {
                throw new ValidationError('FSSAI expiry date is invalid');
            }
            update.fssaiExpiry = parsedExpiry;
        }
    }
    if (body.fssaiImage !== undefined) {
        update.fssaiImage = toUrl(body.fssaiImage) || '';
    }

    if (body.reVerification !== undefined) {
        update.reVerification = {
            isZoneUpdate: body.reVerification.isZoneUpdate === true,
            previousAddress: String(body.reVerification.previousAddress || '').trim(),
            previousLocation: {
                latitude: toFiniteNumber(body.reVerification.previousLocation?.latitude),
                longitude: toFiniteNumber(body.reVerification.previousLocation?.longitude)
            },
            previousZoneId: body.reVerification.previousZoneId && mongoose.Types.ObjectId.isValid(body.reVerification.previousZoneId)
                ? new mongoose.Types.ObjectId(body.reVerification.previousZoneId)
                : undefined,
            previousZone: String(body.reVerification.previousZone || '').trim(),
            updatedZone: String(body.reVerification.updatedZone || '').trim(),
            reVerificationReason: String(body.reVerification.reVerificationReason || 'Zone Update').trim()
        };
    }


    if (!Object.keys(update).length) {
        return getCurrentRestaurantProfile(restaurantId);
    }

    if (body.reVerification !== undefined) {
        update.status = 'pending';
    }

    try {
        const doc = await FoodRestaurant.findByIdAndUpdate(
            restaurantId,
            {
                $set: update,
                $unset: {
                    approvedAt: 1,
                    rejectedAt: 1,
                    rejectionReason: 1
                }
            },
            {
                new: true,
                runValidators: true,
                projection: [
                    'restaurantId',
                    'restaurantName',
                    'cuisines',
                    'location',
                    'addressLine1',
                    'addressLine2',
                    'area',
                    'city',
                    'state',
                    'pincode',
                    'landmark',
                    'ownerName',
                    'ownerEmail',
                    'ownerPhone',
                    'primaryContactNumber',
                'pureVegRestaurant',
                'profileImage',
                'coverImages',
                'menuImages',
                    'openingTime',
                    'closingTime',
                    'openDays',
                    'status',
                    'createdAt',
                    'updatedAt',
                    'panNumber',
                    'nameOnPan',
                    'panImage',
                    'gstRegistered',
                    'gstNumber',
                    'gstLegalName',
                    'gstAddress',
                    'gstImage',
                    'fssaiNumber',
                    'fssaiExpiry',
                    'fssaiImage',
                    'accountNumber',
                    'ifscCode',
                    'accountHolderName',
                    'accountType',
                    'upiId',
                    'upiQrImage',
                    'estimatedDeliveryTime',
                    'estimatedDeliveryTimeMinutes',
                    'zoneId',
                    'reVerification'
                ].join(' ')
            }
        ).lean();

        if (fssaiChanged) {
            // Notify Admin
            void notifyAdminsSafely({
                title: 'FSSAI License Update',
                body: `Restaurant "${doc.restaurantName}" has updated their FSSAI license and is pending re-verification.`,
                data: {
                    type: 'RE_VERIFICATION',
                    subType: 'FSSAI_UPDATE',
                    restaurantId: String(restaurantId)
                }
            });
            // Notify Owner (Mobile/Web Push)
            void notifyOwnerSafely({
                ownerType: 'RESTAURANT',
                ownerId: String(restaurantId),
                payload: {
                    title: 'FSSAI Updated',
                    body: 'Your FSSAI license has been updated. Your account is now pending re-verification and you have been logged out for security.',
                    data: { type: 'FSSAI_UPDATE' }
                }
            });
        } else if (currentRestaurant.status !== 'pending') {
            const restaurantNameForNotification =
                update.restaurantName || currentRestaurant.restaurantName || doc?.restaurantName;
            void notifyAdminsAboutRestaurantProfileReview(restaurantId, restaurantNameForNotification);
        }

        const profile = toRestaurantProfile(doc);
        if (fssaiChanged) {
            profile.requireLogout = true;
            profile.logoutReason = 'fssai_update';
        }
        return profile;
    } catch (err) {
        if (err && err.code === 11000) {
            throw new ValidationError('A restaurant with this name and phone already exists');
        }
        throw err;
    }
};

export const uploadRestaurantProfileImage = async (restaurantId, file) => {
    if (!restaurantId) throw new ValidationError('Invalid restaurant id');
    if (!file?.buffer) throw new ValidationError('Image file is required');

    const currentRestaurant = await FoodRestaurant.findById(restaurantId)
        .select('restaurantName status')
        .lean();
    if (!currentRestaurant) throw new ValidationError('Restaurant not found');

    const url = await uploadImageBuffer(file.buffer, 'food/restaurants/profile');

    const doc = await FoodRestaurant.findByIdAndUpdate(
        restaurantId,
        {
            $set: {
                profileImage: url,
                status: 'pending'
            },
            $unset: {
                approvedAt: 1,
                rejectedAt: 1,
                rejectionReason: 1
            }
        },
        { new: true, projection: 'restaurantId profileImage coverImages restaurantName cuisines location menuImages addressLine1 addressLine2 area city state pincode landmark ownerName ownerEmail ownerPhone primaryContactNumber pureVegRestaurant openingTime closingTime openDays status createdAt updatedAt' }
    ).lean();

    if (!doc) throw new ValidationError('Restaurant not found');

    if (currentRestaurant.status !== 'pending') {
        void notifyAdminsAboutRestaurantProfileReview(restaurantId, currentRestaurant.restaurantName || doc.restaurantName);
    }

    return { profileImage: { url } };
};

export const uploadRestaurantMenuImage = async (file) => {
    if (!file?.buffer) throw new ValidationError('Image file is required');
    const url = await uploadImageBuffer(file.buffer, 'food/restaurants/menu');
    return { menuImage: { url, publicId: null } };
};

export const uploadRestaurantCoverImages = async (restaurantId, files = []) => {
    if (!restaurantId) throw new ValidationError('Invalid restaurant id');
    if (!Array.isArray(files) || files.length === 0) {
        throw new ValidationError('At least one image file is required');
    }

    const validFiles = files.filter((file) => file?.buffer);
    if (validFiles.length === 0) {
        throw new ValidationError('At least one valid image file is required');
    }

    const currentRestaurant = await FoodRestaurant.findById(restaurantId)
        .select('restaurantName status profileImage coverImages')
        .lean();
    if (!currentRestaurant) throw new ValidationError('Restaurant not found');

    const uploadedUrls = await Promise.all(
        validFiles.slice(0, 20).map((file) => uploadImageBuffer(file.buffer, 'food/restaurants/cover'))
    );
    const existingCoverImages = Array.isArray(currentRestaurant.coverImages)
        ? currentRestaurant.coverImages.map((image) => toUrl(image)).filter(Boolean)
        : [];
    const nextCoverImages = [...existingCoverImages];

    uploadedUrls.forEach((url) => {
        if (!nextCoverImages.includes(url)) nextCoverImages.push(url);
    });

    const update = {
        coverImages: nextCoverImages.slice(0, 20),
        status: 'pending'
    };

    if (!toUrl(currentRestaurant.profileImage) && uploadedUrls[0]) {
        update.profileImage = uploadedUrls[0];
    }

    await FoodRestaurant.findByIdAndUpdate(
        restaurantId,
        {
            $set: update,
            $unset: {
                approvedAt: 1,
                rejectedAt: 1,
                rejectionReason: 1
            }
        },
        { new: true }
    ).lean();

    if (currentRestaurant.status !== 'pending') {
        void notifyAdminsAboutRestaurantProfileReview(restaurantId, currentRestaurant.restaurantName || '');
    }

    return {
        coverImages: uploadedUrls.map((url) => ({ url, publicId: null })),
        profileImage: update.profileImage ? { url: update.profileImage } : undefined
    };
};

export const uploadRestaurantMenuImages = async (restaurantId, files = []) => {
    if (!restaurantId) throw new ValidationError('Invalid restaurant id');
    if (!Array.isArray(files) || files.length === 0) {
        throw new ValidationError('At least one image file is required');
    }

    const validFiles = files.filter((file) => file?.buffer);
    if (validFiles.length === 0) {
        throw new ValidationError('At least one valid image file is required');
    }

    const currentRestaurant = await FoodRestaurant.findById(restaurantId)
        .select('restaurantName status menuImages')
        .lean();
    if (!currentRestaurant) throw new ValidationError('Restaurant not found');

    const uploadedUrls = await Promise.all(
        validFiles.slice(0, 20).map((file) => uploadImageBuffer(file.buffer, 'food/restaurants/menu'))
    );
    const existingMenuImages = Array.isArray(currentRestaurant.menuImages)
        ? currentRestaurant.menuImages.map((image) => toUrl(image)).filter(Boolean)
        : [];
    const nextMenuImages = [...existingMenuImages];

    uploadedUrls.forEach((url) => {
        if (!nextMenuImages.includes(url)) nextMenuImages.push(url);
    });

    await FoodRestaurant.findByIdAndUpdate(
        restaurantId,
        {
            $set: {
                menuImages: nextMenuImages.slice(0, 20),
                status: 'pending'
            },
            $unset: {
                approvedAt: 1,
                rejectedAt: 1,
                rejectionReason: 1
            }
        },
        { new: true }
    ).lean();

    if (currentRestaurant.status !== 'pending') {
        void notifyAdminsAboutRestaurantProfileReview(restaurantId, currentRestaurant.restaurantName || '');
    }

    return {
        menuImages: uploadedUrls.map((url) => ({ url, publicId: null }))
    };
};

export const listApprovedRestaurants = async (query = {}) => {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 100, 1), 1000);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filter = { status: 'approved' };

    if (query.city && String(query.city).trim()) {
        const city = String(query.city).trim().slice(0, 80);
        const rx = { $regex: escapeRegex(city), $options: 'i' };
        filter.$and = [...(filter.$and || []), { $or: [{ 'location.city': rx }, { city: rx }] }];
    }
    if (query.area && String(query.area).trim()) {
        const area = String(query.area).trim().slice(0, 80);
        const rx = { $regex: escapeRegex(area), $options: 'i' };
        filter.$and = [...(filter.$and || []), { $or: [{ 'location.area': rx }, { area: rx }] }];
    }
    if (query.cuisine && String(query.cuisine).trim()) {
        const cuisine = normalizeCuisine(query.cuisine);
        // cuisines is an array of strings.
        filter.cuisines = { $in: [new RegExp(escapeRegex(cuisine), 'i')] };
    }
    if (query.hasOffers === 'true') {
        filter.offer = { $exists: true, $ne: null, $ne: '' };
    }
    const minRating = toFiniteNumber(query.minRating);
    if (minRating !== null) {
        filter.rating = { $gte: Math.max(0, Math.min(5, minRating)) };
    }
    const maxDeliveryTime = toFiniteNumber(query.maxDeliveryTime);
    if (maxDeliveryTime !== null) {
        filter.estimatedDeliveryTimeMinutes = { $lte: Math.max(0, Math.round(maxDeliveryTime)) };
    }
    const maxPrice = toFiniteNumber(query.maxPrice);
    if (maxPrice !== null) {
        filter.featuredPrice = { $lte: Math.max(0, maxPrice) };
    }
    if (query.topRated === 'true') {
        filter.rating = { ...(filter.rating || {}), $gte: 4.5 };
    }
    if (query.trusted === 'true') {
        filter.totalRatings = { ...(filter.totalRatings || {}), $gte: 100 };
    }
    if (query.search && String(query.search).trim()) {
        const raw = String(query.search).trim().slice(0, 80);
        const term = escapeRegex(raw);
        if (term.length >= 2) {
            filter.$or = [
                { restaurantName: { $regex: term, $options: 'i' } },
                { area: { $regex: term, $options: 'i' } },
                { city: { $regex: term, $options: 'i' } },
                { 'location.area': { $regex: term, $options: 'i' } },
                { 'location.city': { $regex: term, $options: 'i' } },
                { cuisines: { $in: [new RegExp(term, 'i')] } }
            ];
        }
    }

    // Optional zone polygon filter (when restaurant.zoneId is not set yet).
    const zoneFilter = await buildZoneRestaurantFilter(query.zoneId);
    if (zoneFilter) {
        filter.$and = [...(filter.$and || []), zoneFilter];
    }

    const lat = toFiniteNumber(query.lat);
    const lng = toFiniteNumber(query.lng);
    // Accept both radiusKm (preferred) and maxDistance (legacy frontend param).
    const radiusKm = toFiniteNumber(query.radiusKm) ?? toFiniteNumber(query.maxDistance);
    const sortBy = parseSortBy(query.sortBy);

    const projection = {
        restaurantId: 1,
        restaurantName: 1,
        area: 1,
        city: 1,
        cuisines: 1,
        profileImage: 1,
        coverImages: 1,
        menuImages: 1,
        estimatedDeliveryTime: 1,
        estimatedDeliveryTimeMinutes: 1,
        offer: 1,
        featuredDish: 1,
        featuredPrice: 1,
        rating: 1,
        totalRatings: 1,
        isAcceptingOrders: 1,
        status: 1,
        pureVegRestaurant: 1,
        createdAt: 1,
        location: 1,
        openingTime: 1,
        closingTime: 1,
        openDays: 1
    };

    // Use $geoNear only when geo is explicitly needed (radius filter or nearest sorting).
    // This avoids accidentally hiding restaurants that do not have coordinates yet.
    const wantsGeo = (radiusKm !== null) || sortBy === 'nearest';
    if (lat !== null && lng !== null && wantsGeo) {
        const geoNear = {
            $geoNear: {
                near: { type: 'Point', coordinates: [lng, lat] },
                distanceField: 'distanceMeters',
                spherical: true,
                query: filter
            }
        };
        if (radiusKm !== null) {
            geoNear.$geoNear.maxDistance = Math.max(0.1, radiusKm) * 1000;
        }

        const sortStage = (() => {
            if (sortBy === 'rating' || sortBy === 'rating-high') return { $sort: { rating: -1, distanceMeters: 1 } };
            if (sortBy === 'rating-low') return { $sort: { rating: 1, distanceMeters: 1 } };
            if (sortBy === 'price-low') return { $sort: { featuredPrice: 1, distanceMeters: 1 } };
            if (sortBy === 'price-high') return { $sort: { featuredPrice: -1, distanceMeters: 1 } };
            if (sortBy === 'newest') return { $sort: { createdAt: -1 } };
            if (sortBy === 'deliveryTime') return { $sort: { estimatedDeliveryTimeMinutes: 1, distanceMeters: 1 } };
            // nearest (default)
            return { $sort: { distanceMeters: 1 } };
        })();

        const basePipeline = [
            geoNear,
            {
                $addFields: {
                    distanceInKm: { $round: [{ $divide: ['$distanceMeters', 1000] }, 2] }
                }
            },
            sortStage
        ];

        const [pageDocs, totalDocs] = await Promise.all([
            FoodRestaurant.aggregate([
                ...basePipeline,
                { $project: projection },
                { $skip: skip },
                { $limit: limit }
            ]),
            FoodRestaurant.aggregate([...basePipeline, { $count: 'count' }])
        ]);

        const total = totalDocs?.[0]?.count || 0;
        return { restaurants: pageDocs, total, page, limit };
    }

    // Non-geo path: normal query + sort.
    const sort = (() => {
        if (sortBy === 'rating' || sortBy === 'rating-high') return { rating: -1, createdAt: -1 };
        if (sortBy === 'rating-low') return { rating: 1, createdAt: -1 };
        if (sortBy === 'price-low') return { featuredPrice: 1, createdAt: -1 };
        if (sortBy === 'price-high') return { featuredPrice: -1, createdAt: -1 };
        if (sortBy === 'deliveryTime') return { estimatedDeliveryTimeMinutes: 1, createdAt: -1 };
        return { createdAt: -1 };
    })();

    const [restaurantsRaw, total] = await Promise.all([
        FoodRestaurant.find(filter)
            .select(Object.keys(projection).join(' '))
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean(),
        FoodRestaurant.countDocuments(filter)
    ]);

    const restaurants = (restaurantsRaw || []).map((r) => ({
        ...r,
        // Frontend user app expects `name` and often checks `profileImage.url`
        restaurantId: r._id,
        id: r._id,
        name: r.restaurantName || '',
        rating: normalizeRatingValue(r.rating),
        totalRatings: normalizeTotalRatingsValue(r.totalRatings),
        profileImage: r.profileImage ? { url: r.profileImage } : null,
        coverImages: Array.isArray(r.coverImages) ? r.coverImages : [],
        openingTime: r.openingTime || null,
        closingTime: r.closingTime || null,
        openDays: Array.isArray(r.openDays) ? r.openDays : [],
        // Keep menuImages as an array for fallbacks; allow both string and {url} on client.
        menuImages: Array.isArray(r.menuImages) ? r.menuImages : []
    }));

    return { restaurants, total, page, limit };
};

export const getApprovedRestaurantByIdOrSlug = async (idOrSlug) => {
    const value = String(idOrSlug || '').trim();
    if (!value) return null;

    // ObjectId path
    if (/^[0-9a-fA-F]{24}$/.test(value)) {
        const doc = await FoodRestaurant.findOne({ _id: value, status: 'approved' }).lean();
        if (!doc) return null;
        return {
            ...doc,
            rating: normalizeRatingValue(doc.rating),
            totalRatings: normalizeTotalRatingsValue(doc.totalRatings)
        };
    }

    // Public restaurant code path, e.g. REST000003
    if (/^REST\d{6}$/i.test(value)) {
        const doc = await FoodRestaurant.findOne({
            restaurantId: value.toUpperCase(),
            status: 'approved',
        }).lean();
        if (!doc) return null;
        return {
            ...doc,
            rating: normalizeRatingValue(doc.rating),
            totalRatings: normalizeTotalRatingsValue(doc.totalRatings)
        };
    }

    // Slug path: use normalized field for index-friendly exact match.
    const restaurantNameNormalized = normalizeName(value);
    if (!restaurantNameNormalized) return null;

    const doc = await FoodRestaurant.findOne({
        status: 'approved',
        restaurantNameNormalized
    }).lean();
    if (!doc) return null;
    return {
        ...doc,
        rating: normalizeRatingValue(doc.rating),
        totalRatings: normalizeTotalRatingsValue(doc.totalRatings)
    };
};

export const listPublicOffers = async () => {
    const now = new Date();
    const filter = {
        status: 'active',
        $and: [
            { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: now } }] },
            { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gt: now } }] }
        ]
    };

    const list = await FoodOffer.find(filter)
        .sort({ createdAt: -1 })
        .populate({ path: 'restaurantId', select: 'restaurantName restaurantNameNormalized profileImage estimatedDeliveryTime rating' })
        .lean();

    const allOffers = list.map((o) => {
        const restaurant = o.restaurantId && typeof o.restaurantId === 'object' ? o.restaurantId : null;
        const restaurantSlug = restaurant?.restaurantNameNormalized || undefined;
        const restaurantName =
            o.restaurantScope === 'selected'
                ? (restaurant?.restaurantName || 'Selected Restaurant')
                : 'All Restaurants';

        const title =
            o.discountType === 'percentage'
                ? `${Number(o.discountValue) || 0}% OFF`
                : `Flat ₹${Number(o.discountValue) || 0} OFF`;

        return {
            id: String(o._id),
            offerId: String(o._id),
            couponCode: o.couponCode,
            title,
            discountType: o.discountType,
            discountValue: o.discountValue,
            maxDiscount: o.maxDiscount ?? null,
            customerScope: o.customerScope,
            restaurantScope: o.restaurantScope,
            restaurantId: restaurant?._id ? String(restaurant._id) : (o.restaurantScope === 'selected' ? String(o.restaurantId) : null),
            restaurantName,
            restaurantSlug,
            restaurantImage: restaurant?.profileImage || null,
            deliveryTime: restaurant?.estimatedDeliveryTime || null,
            restaurantRating: typeof restaurant?.rating === 'number' ? restaurant.rating : 0,
            endDate: o.endDate || null,
            showInCart: o.showInCart !== false,
            minOrderValue: o.minOrderValue ?? 0
        };
    });

    return { allOffers, groupedByOffer: {} };
};

/**
 * Delete a restaurant account and its associated data.
 */
export const deleteRestaurantAccount = async (restaurantId) => {
    if (!restaurantId) {
        throw new ValidationError('Invalid restaurant id');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const restaurant = await FoodRestaurant.findById(restaurantId).session(session);
        if (!restaurant) {
            throw new ValidationError('Restaurant not found');
        }

        const restaurantName = restaurant.restaurantName;

        // Delete associated data
        await FoodRestaurantOutletTimings.deleteMany({ restaurantId }).session(session);
        // Note: You might want to delete foods, categories, etc. as well depending on business rules.
        // For soft delete, we just update the flags
        restaurant.isDeleted = true;
        restaurant.isAcceptingOrders = false;
        restaurant.deletionRequest = {
            status: 'approved',
            reason: 'Restaurant requested account deletion',
            requestedAt: new Date(),
            reviewedAt: new Date()
        };
        await restaurant.save({ session });

        await session.commitTransaction();

        // Notify admins about the deletion
        try {
            const { notifyAdminsSafely } = await import('../../../../core/notifications/firebase.service.js');
            void notifyAdminsSafely({
                title: 'Restaurant Account Deleted 🗑️',
                body: `The restaurant "${restaurantName}" has deleted its account.`,
                data: {
                    type: 'account_deleted',
                    subType: 'restaurant',
                    id: String(restaurantId)
                }
            });
        } catch (e) {
            console.error('Failed to notify admins of restaurant account deletion:', e);
        }

        return { success: true, message: 'Account deleted successfully' };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

/**
 * List complaints for a restaurant.
 */
export const getRestaurantComplaints = async (restaurantId, query = {}) => {
    const { getRestaurantComplaints: getComplaintsInternal } = await import('../../admin/services/admin.service.js');
    return getComplaintsInternal({ ...query, restaurantId });
};

