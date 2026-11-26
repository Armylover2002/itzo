import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import { FoodUserWallet } from '../models/userWallet.model.js';
import { FoodReferralSettings } from '../../admin/models/referralSettings.model.js';
import { FoodReferralLog } from '../../admin/models/referralLog.model.js';
import { FoodOrder } from '../../orders/models/order.model.js';
import { creditReferralReward } from './userWallet.service.js';
import { logger } from '../../../../utils/logger.js';

export const getUserReferralStats = async (userId) => {
    const id = String(userId || '');
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('User not found');
    }
    const oid = new mongoose.Types.ObjectId(id);
    const [user, wallet, settingsDoc] = await Promise.all([
        FoodUser.findById(oid).select('_id referralCount referralCode').lean(),
        FoodUserWallet.findOne({ userId: oid }).select('referralEarnings').lean(),
        FoodReferralSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).lean()
    ]);

    return {
        referralCount: Number(user?.referralCount) || 0,
        totalReferralEarnings: Number(wallet?.referralEarnings) || 0,
        rewardAmount: Math.max(0, Number(settingsDoc?.user?.referrerReward) || 0),
        description: String(settingsDoc?.user?.description || '').trim()
    };
};

export const getUserReferralDetails = async (userId) => {
    const id = String(userId || '');
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('User not found');
    }

    const oid = new mongoose.Types.ObjectId(id);
    const [user, wallet, settingsDoc, logs] = await Promise.all([
        FoodUser.findById(oid).select('_id referralCount referralCode').lean(),
        FoodUserWallet.findOne({ userId: oid }).select('referralEarnings').lean(),
        FoodReferralSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).lean(),
        FoodReferralLog.find({ referrerId: oid, role: 'USER' })
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
        ? await FoodUser.find({ _id: { $in: refereeIds } })
            .select('_id name phone profileImage')
            .lean()
        : [];

    const refereeMap = new Map(referees.map((entry) => [String(entry._id), entry]));

    const invitedFriends = (Array.isArray(logs) ? logs : []).map((log) => {
        const referee = refereeMap.get(String(log?.refereeId || ''));
        const rawPhone = String(referee?.phone || '');
        const maskedPhone = rawPhone
            ? `${rawPhone.slice(0, Math.min(3, rawPhone.length))}${'*'.repeat(Math.max(rawPhone.length - 5, 0))}${rawPhone.slice(-2)}`
            : '';

        return {
            id: String(log?._id || ''),
            refereeId: String(log?.refereeId || ''),
            name: String(referee?.name || '').trim() || 'Friend',
            phone: maskedPhone,
            profileImage: String(referee?.profileImage || '').trim() || '',
            status: String(log?.status || 'pending'),
            reason: String(log?.reason || ''),
            rewardAmount: Math.max(0, Number(log?.rewardAmount) || 0),
            earnedAmount: String(log?.status || '') === 'credited' ? Math.max(0, Number(log?.rewardAmount) || 0) : 0,
            invitedAt: log?.createdAt || null
        };
    });

    const totalInvited = invitedFriends.length;
    const creditedCount = invitedFriends.filter((entry) => entry.status === 'credited').length;
    const pendingCount = invitedFriends.filter((entry) => entry.status === 'pending').length;
    const rejectedCount = invitedFriends.filter((entry) => entry.status === 'rejected').length;

    return {
        stats: {
            referralCount: Number(user?.referralCount) || 0,
            totalReferralEarnings: Number(wallet?.referralEarnings) || 0,
            rewardAmount: Math.max(0, Number(settingsDoc?.user?.referrerReward) || 0),
            description: String(settingsDoc?.user?.description || '').trim(),
            totalInvited,
            creditedCount,
            pendingCount,
            rejectedCount
        },
        invitedFriends
    };
};

/**
 * Unlocks a USER-role referral reward once the referee completes their first
 * delivered order (not at signup). Mirrors the RESTAURANT / DELIVERY_PARTNER
 * referral-crediting pattern: re-validate current settings/limits, atomically
 * claim the pending log + reserve the referrer's limit slot inside a
 * transaction, then credit both wallets. Safe to call on every delivery
 * completion — it is a no-op once the log is no longer 'pending'.
 */
export const creditUserReferralOnFirstOrder = async (refereeUserId) => {
    const id = String(refereeUserId || '');
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return;
    const refereeId = new mongoose.Types.ObjectId(id);

    try {
        const pending = await FoodReferralLog.findOne({
            refereeId,
            role: 'USER',
            status: 'pending',
        }).lean();
        if (!pending) return;

        // Only unlock on the referee's FIRST delivered order.
        const deliveredOrderCount = await FoodOrder.countDocuments({
            userId: refereeId,
            orderStatus: 'delivered',
        });
        if (deliveredOrderCount !== 1) return;

        let claimed = null;
        let referrerRewardToCredit = 0;
        let refereeRewardToCredit = 0;

        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                const settingsDoc = await FoodReferralSettings.findOne({ isActive: true })
                    .sort({ createdAt: -1 })
                    .session(session)
                    .lean();

                const referrerReward = Math.max(0, Number(settingsDoc?.user?.referrerReward) || 0);
                const refereeReward = Math.max(0, Number(settingsDoc?.user?.refereeReward) || 0);
                const limit = Math.max(0, Number(settingsDoc?.user?.limit) || 0);

                const referrer = await FoodUser.findById(pending.referrerId)
                    .select('_id referralCount')
                    .session(session)
                    .lean();

                let rejectReason = null;
                if (!settingsDoc) rejectReason = 'program_inactive';
                else if (!referrer) rejectReason = 'referrer_not_found';
                else if (referrerReward <= 0 && refereeReward <= 0) rejectReason = 'reward_disabled';
                else if (limit <= 0) rejectReason = 'limit_disabled';

                if (rejectReason) {
                    await FoodReferralLog.updateOne(
                        { _id: pending._id, status: 'pending' },
                        { $set: { status: 'rejected', reason: rejectReason } },
                        { session }
                    );
                    return;
                }

                // Atomic hard gate: only credit if referrer still has slots left.
                const slotReserved = await FoodUser.findOneAndUpdate(
                    { _id: pending.referrerId, referralCount: { $lt: limit } },
                    { $inc: { referralCount: 1 } },
                    { new: true, session }
                );
                if (!slotReserved) {
                    await FoodReferralLog.updateOne(
                        { _id: pending._id, status: 'pending' },
                        { $set: { status: 'rejected', reason: 'limit_reached' } },
                        { session }
                    );
                    return;
                }

                // Claim with current settings amounts (not signup-time freeze).
                const result = await FoodReferralLog.findOneAndUpdate(
                    { _id: pending._id, status: 'pending' },
                    {
                        $set: {
                            status: 'credited',
                            rewardAmount: referrerReward,
                            referrerRewardAmount: referrerReward,
                            refereeRewardAmount: refereeReward,
                        },
                    },
                    { new: true, session }
                );
                if (!result) {
                    // Lost the race — release the reserved slot.
                    await FoodUser.updateOne(
                        { _id: pending.referrerId },
                        { $inc: { referralCount: -1 } },
                        { session }
                    );
                    return;
                }

                claimed = result;
                referrerRewardToCredit = referrerReward;
                refereeRewardToCredit = refereeReward;
            });
        } finally {
            await session.endSession();
        }

        if (!claimed) return;

        await Promise.all([
            referrerRewardToCredit > 0
                ? creditReferralReward(claimed.referrerId, referrerRewardToCredit, {
                    role: 'USER',
                    refereeId: String(refereeId),
                    referralLogId: String(claimed._id),
                    type: 'referrer_reward',
                })
                : Promise.resolve(),
            refereeRewardToCredit > 0
                ? creditReferralReward(refereeId, refereeRewardToCredit, {
                    role: 'USER',
                    referrerId: String(claimed.referrerId),
                    referralLogId: String(claimed._id),
                    type: 'referee_reward',
                })
                : Promise.resolve(),
        ]);
    } catch (e) {
        // Never fail order completion due to referral errors; log stays 'pending' and is retried.
        logger?.warn?.({ err: e }, 'Referral crediting on first order failed (user)');
    }
};
