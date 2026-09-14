import {
    registerRestaurant,
    listApprovedRestaurants,
    getApprovedRestaurantByIdOrSlug,
    getCurrentRestaurantProfile,
    updateRestaurantProfile,
    updateRestaurantAcceptingOrders,
    uploadRestaurantProfileImage,
    uploadRestaurantMenuImage,
    uploadRestaurantCoverImages,
    uploadRestaurantMenuImages,
    listPublicOffers,
    getRestaurantComplaints,
    deleteRestaurantAccount,
    saveOnboardingStep,
    getOnboardingDraftByPhone
} from '../services/restaurant.service.js';
import { 
    getRestaurantReferralStats, 
    getRestaurantReferralDetails 
} from '../services/restaurantReferral.service.js';
import { validateRestaurantRegisterDto, validateOnboardingStepDto } from '../validators/restaurant.validator.js';
import { sendResponse } from '../../../../utils/response.js';

export const registerRestaurantController = async (req, res, next) => {
    try {
        console.log("REGISTER RESTAURANT PAYLOAD:", req.body);
        const validated = validateRestaurantRegisterDto(req.body);

        const tokenPhone = String(req.registrationPhone || '').replace(/\D/g, '').slice(-10);
        const payloadPhone = String(validated.ownerPhone || '').replace(/\D/g, '').slice(-10);
        if (!tokenPhone || !payloadPhone || tokenPhone !== payloadPhone) {
            return res.status(403).json({
                success: false,
                message: 'Phone does not match verified registration token. Please verify OTP again.',
            });
        }

        const restaurant = await registerRestaurant(validated, req.files, null);
        const { issueRestaurantSession } = await import('../../../../core/auth/auth.service.js');
        const session = await issueRestaurantSession(restaurant);
        return sendResponse(res, 201, 'Restaurant registered successfully', {
            restaurant,
            ...session,
        });
    } catch (error) {
        next(error);
    }
};

export const saveOnboardingStepController = async (req, res, next) => {
    try {
        console.log('CONTROLLER HIT');
        console.log('REQUEST RECEIVED', req.body);
        const stepNum = req.params.step;
        const validated = validateOnboardingStepDto(stepNum, req.body);

        const tokenPhone = String(req.registrationPhone || '').replace(/\D/g, '').slice(-10);
        const payloadPhone = String(validated.ownerPhone || '').replace(/\D/g, '').slice(-10);
        if (!tokenPhone || !payloadPhone || tokenPhone !== payloadPhone) {
            return res.status(403).json({
                success: false,
                message: 'Phone does not match verified registration token',
            });
        }

        const restaurant = await saveOnboardingStep(stepNum, validated, req.files);
        return sendResponse(res, 200, 'Onboarding step saved successfully', { restaurant });
    } catch (error) {
        next(error);
    }
};

export const getOnboardingDraftController = async (req, res, next) => {
    try {
        // Always bind to OTP-verified phone from registration token (ignore/override query).
        const phone = req.registrationPhoneDigits || req.registrationPhone;
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Phone is required' });
        }
        const restaurant = await getOnboardingDraftByPhone(phone);
        if (!restaurant) {
            return res.status(404).json({ success: false, message: 'No onboarding draft found' });
        }
        return sendResponse(res, 200, 'Onboarding draft fetched successfully', { restaurant });
    } catch (error) {
        next(error);
    }
};

export const listApprovedRestaurantsController = async (req, res, next) => {
    try {
        const data = await listApprovedRestaurants(req.query);
        return sendResponse(res, 200, 'Restaurants fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const listUnder250RestaurantsController = async (req, res, next) => {
    try {
        const { listUnder250Restaurants } = await import('../services/under250.service.js');
        const data = await listUnder250Restaurants(req.query);
        return sendResponse(res, 200, 'Under ₹250 restaurants fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getApprovedRestaurantController = async (req, res, next) => {
    try {
        const restaurant = await getApprovedRestaurantByIdOrSlug(req.params.id);
        if (!restaurant) {
            return res.status(404).json({ success: false, message: 'Restaurant not found' });
        }
        return sendResponse(res, 200, 'Restaurant fetched successfully', { restaurant });
    } catch (error) {
        next(error);
    }
};

export const getCurrentRestaurantController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const restaurant = await getCurrentRestaurantProfile(restaurantId);
        return sendResponse(res, 200, 'Restaurant fetched successfully', { restaurant });
    } catch (error) {
        next(error);
    }
};

export const updateRestaurantProfileController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const restaurant = await updateRestaurantProfile(restaurantId, req.body || {});
        return sendResponse(res, 200, 'Restaurant updated successfully', { restaurant });
    } catch (error) {
        next(error);
    }
};

export const updateRestaurantAcceptingOrdersController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const restaurant = await updateRestaurantAcceptingOrders(restaurantId, req.body?.isAcceptingOrders);
        return sendResponse(res, 200, 'Restaurant availability updated successfully', { restaurant });
    } catch (error) {
        next(error);
    }
};

export const checkSubscriptionEligibilityController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const { ensureDailyPassEligibility } = await import('../../subscriptions/services/wallet.service.js');
        const eligibility = await ensureDailyPassEligibility(restaurantId, 'RESTAURANT');
        return sendResponse(res, 200, 'Eligibility checked', eligibility);
    } catch (error) {
        next(error);
    }
};

export const uploadRestaurantProfileImageController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const result = await uploadRestaurantProfileImage(restaurantId, req.file);
        return sendResponse(res, 200, 'Profile image uploaded successfully', result);
    } catch (error) {
        next(error);
    }
};

export const uploadRestaurantMenuImageController = async (req, res, next) => {
    try {
        const result = await uploadRestaurantMenuImage(req.file);
        return sendResponse(res, 200, 'Menu image uploaded successfully', result);
    } catch (error) {
        next(error);
    }
};

export const uploadRestaurantCoverImagesController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const result = await uploadRestaurantCoverImages(restaurantId, req.files || []);
        return sendResponse(res, 200, 'Restaurant photos uploaded successfully', result);
    } catch (error) {
        next(error);
    }
};

export const uploadRestaurantMenuImagesController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const result = await uploadRestaurantMenuImages(restaurantId, req.files || []);
        return sendResponse(res, 200, 'Menu photos uploaded successfully', result);
    } catch (error) {
        next(error);
    }
};

export const listPublicOffersController = async (req, res, next) => {
    try {
        const query = { ...(req.query || {}) };
        if (req.user?.role === 'USER' && req.user?.userId) {
            query.userId = String(req.user.userId);
        }
        const data = await listPublicOffers(query);
        return sendResponse(res, 200, 'Offers fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getRestaurantComplaintsController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const data = await getRestaurantComplaints(restaurantId, req.query || {});
        return sendResponse(res, 200, 'Complaints fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const deleteRestaurantAccountController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const result = await deleteRestaurantAccount(restaurantId);
        return sendResponse(res, 200, 'Account deleted successfully', result);
    } catch (error) {
        next(error);
    }
};

export const getRestaurantReferralStatsController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const data = await getRestaurantReferralStats(restaurantId);
        return sendResponse(res, 200, 'Referral stats fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getRestaurantReferralDetailsController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const data = await getRestaurantReferralDetails(restaurantId);
        return sendResponse(res, 200, 'Referral details fetched successfully', data);
    } catch (error) {
        next(error);
    }
};



