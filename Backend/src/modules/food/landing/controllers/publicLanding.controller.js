import { getPublicGourmetRestaurants } from '../services/gourmet.service.js';
import { getLandingSettings } from '../services/landingSettings.service.js';
import { FoodHeroBanner } from '../models/heroBanner.model.js';
import { FoodUnder250Banner } from '../models/under250Banner.model.js';
import { FoodExploreIcon } from '../models/exploreIcon.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodAdvertisement } from '../../admin/models/advertisement.model.js';
import { sendResponse } from '../../../../utils/response.js';

/** Public hero banners for user home: active only, sorted */
export const getPublicHeroBannersController = async (req, res, next) => {
    try {
        const requestedZoneId =
            typeof req.query?.zoneId === 'string' ? req.query.zoneId.trim() : '';
        const query = { isActive: true };

        if (requestedZoneId) {
            query.$or = [
                { zoneId: requestedZoneId },
                { zoneId: '' },
                { zoneId: null },
                { zoneId: { $exists: false } }
            ];
        }

        const docs = await FoodHeroBanner.find(query)
            .sort({ sortOrder: 1, createdAt: -1 })
            .lean();
        const banners = (docs || []).map((b) => ({
            ...b,
            linkedRestaurants: [],
            imageUrl: b.imageUrl
        }));
        return sendResponse(res, 200, 'Hero banners fetched', { banners });
    } catch (error) {
        next(error);
    }
};

export const getPublicUnder250BannersController = async (req, res, next) => {
    try {
        const docs = await FoodUnder250Banner.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).lean();
        return sendResponse(res, 200, 'Under 250 banners fetched', { banners: docs });
    } catch (error) {
        next(error);
    }
};

export const getPublicExploreIconsController = async (req, res, next) => {
    try {
        const docs = await FoodExploreIcon.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).lean();
        const items = docs.map(({ targetPath, sortOrder, ...rest }) => ({ ...rest, link: targetPath, order: sortOrder }));
        return sendResponse(res, 200, 'Explore icons fetched', { items });
    } catch (error) {
        next(error);
    }
};


export const getPublicGourmetController = async (req, res, next) => {
    try {
        const docs = await getPublicGourmetRestaurants();
        const restaurants = (docs || []).map((d) => ({
            ...(d.restaurant || {}),
            _id: d.restaurant?._id || d.restaurantId,
            priority: d.priority
        })).filter((r) => r && r._id);
        return sendResponse(res, 200, 'Gourmet restaurants fetched', { restaurants });
    } catch (error) {
        next(error);
    }
};

export const getPublicAdvertisementsController = async (req, res, next) => {
    try {
        const now = new Date();
        const query = {
            status: 'Approved',
            isDeleted: false,
            $and: [
                { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
                { $or: [{ endDate: null }, { endDate: { $gte: now } }] }
            ]
        };

        const docs = await FoodAdvertisement.find(query)
            .sort({ priority: 1, createdAt: -1 })
            .lean();

        return sendResponse(res, 200, 'Public advertisements fetched', { advertisements: docs });
    } catch (error) {
        next(error);
    }
};

export const getPublicLandingSettingsController = async (req, res, next) => {
    try {
        const settings = await getLandingSettings();
        const ids = settings?.recommendedRestaurantIds || [];
        let recommendedRestaurants = [];
        if (Array.isArray(ids) && ids.length > 0) {
            recommendedRestaurants = await FoodRestaurant.find({ _id: { $in: ids }, status: 'approved' })
                .select('restaurantName area city profileImage coverImages menuImages slug rating cuisines pureVegRestaurant')
                .sort({ rating: -1 })
                .lean();
        }
        const payload = {
            ...settings,
            headerVideoPublicId: undefined,
            recommendedRestaurantIds: undefined,
            recommendedRestaurants
        };
        return sendResponse(res, 200, 'Landing settings fetched', payload);
    } catch (error) {
        next(error);
    }
};

