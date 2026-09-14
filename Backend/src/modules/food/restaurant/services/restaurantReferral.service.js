import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { FoodRestaurantWallet } from '../models/restaurantWallet.model.js';
import { FoodReferralSettings } from '../../admin/models/referralSettings.model.js';
import { FoodReferralLog } from '../../admin/models/referralLog.model.js';

export const getRestaurantReferralStats = async (restaurantId) => {
    const id = String(restaurantId || '');
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('Restaurant not found');
    }
    const oid = new mongoose.Types.ObjectId(id);
    const [restaurant, wallet, settingsDoc] = await Promise.all([
        FoodRestaurant.findById(oid).select('_id referralCount referralCode').lean(),
        FoodRestaurantWallet.findOne({ restaurantId: oid }).select('referralEarnings').lean(),
        FoodReferralSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).lean()
    ]);

    return {
        referralCount: Number(restaurant?.referralCount) || 0,
        totalReferralEarnings: Number(wallet?.referralEarnings) || 0,
        rewardAmount: Math.max(0, Number(settingsDoc?.restaurant?.referrerReward) || 0)
    };
};

export const getRestaurantReferralDetails = async (restaurantId) => {
    const id = String(restaurantId || '');
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('Restaurant not found');
    }

    const oid = new mongoose.Types.ObjectId(id);
    const [restaurant, wallet, settingsDoc, logs] = await Promise.all([
        FoodRestaurant.findById(oid).select('_id referralCount referralCode').lean(),
        FoodRestaurantWallet.findOne({ restaurantId: oid }).select('referralEarnings').lean(),
        FoodReferralSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).lean(),
        FoodReferralLog.find({ referrerId: oid, role: 'RESTAURANT' })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean()
    ]);

    const refereeIds = Array.from(
        new Set(
            (Array.isArray(logs) ? logs : [])
                .map((log) => String(log?.refereeId || ''))
                .filter(Boolean)
        )
    )
        .filter((value) => mongoose.Types.ObjectId.isValid(value))
        .map((value) => new mongoose.Types.ObjectId(value));

    const referees = refereeIds.length
        ? await FoodRestaurant.find({ _id: { $in: refereeIds } })
            .select('_id restaurantName ownerPhone profileImage')
            .lean()
        : [];

    const refereeMap = new Map(referees.map((entry) => [String(entry._id), entry]));

    const referredRestaurants = (Array.isArray(logs) ? logs : []).map((log) => {
        const referee = refereeMap.get(String(log?.refereeId || ''));
        const rawPhone = String(referee?.ownerPhone || '');
        const maskedPhone = rawPhone
            ? `${rawPhone.slice(0, Math.min(3, rawPhone.length))}${'*'.repeat(Math.max(rawPhone.length - 5, 0))}${rawPhone.slice(-2)}`
            : '';

        return {
            id: String(log?._id || ''),
            refereeId: String(log?.refereeId || ''),
            name: String(referee?.restaurantName || '').trim() || 'Restaurant',
            phone: maskedPhone,
            profileImage: String(referee?.profileImage || '').trim() || '',
            status: String(log?.status || 'pending'),
            reason: String(log?.reason || ''),
            rewardAmount: Math.max(0, Number(log?.rewardAmount) || 0),
            earnedAmount: String(log?.status || '') === 'credited' ? Math.max(0, Number(log?.rewardAmount) || 0) : 0,
            invitedAt: log?.createdAt || null
        };
    });

    const totalInvited = referredRestaurants.length;
    const creditedCount = referredRestaurants.filter((entry) => entry.status === 'credited').length;
    const pendingCount = referredRestaurants.filter((entry) => entry.status === 'pending').length;
    const rejectedCount = referredRestaurants.filter((entry) => entry.status === 'rejected').length;

    return {
        stats: {
            referralCount: Number(restaurant?.referralCount) || 0,
            totalReferralEarnings: Number(wallet?.referralEarnings) || 0,
            rewardAmount: Math.max(0, Number(settingsDoc?.restaurant?.referrerReward) || 0),
            totalInvited,
            creditedCount,
            pendingCount,
            rejectedCount
        },
        referredRestaurants
    };
};
