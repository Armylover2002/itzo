import { FoodUser } from '../../../../core/users/user.model.js';
import { AuthError, ValidationError } from '../../../../core/auth/errors.js';
import { FoodUserWallet } from '../models/userWallet.model.js';
import { uploadImageBuffer } from '../../../../services/cloudinary.service.js';
import mongoose from 'mongoose';
import { normalizeAddressInput } from './userAddress.service.js';

/**
 * Normalize an incoming addresses array into the canonical persisted shape.
 * Items missing the required street/city/state are skipped so we never persist
 * partial/inconsistent entries. Exactly one address is guaranteed default.
 */
const normalizeAddressesList = (addresses) => {
    if (!Array.isArray(addresses)) return undefined;

    const normalized = addresses
        .map((item) => {
            const base = normalizeAddressInput(item);
            // street is required by the schema; fall back to the formatted
            // address when a caller only provided the full string.
            if (!base.street && base.address) base.street = base.address;
            // Preserve existing subdocument identity on edits.
            if (item?._id && mongoose.Types.ObjectId.isValid(item._id)) {
                base._id = item._id;
            }
            return {
                ...base,
                isDefault: !!item?.isDefault
            };
        })
        .filter((a) => a.street && a.city && a.state);

    if (normalized.length && !normalized.some((a) => a.isDefault)) {
        normalized[0].isDefault = true;
    } else if (normalized.length) {
        // Collapse to a single default (first one wins) to avoid inconsistency.
        let seen = false;
        normalized.forEach((a) => {
            if (a.isDefault && !seen) {
                seen = true;
            } else {
                a.isDefault = false;
            }
        });
    }

    return normalized;
};

const parseIsoDateOrNull = (value) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const d = new Date(`${String(value)}T00:00:00.000Z`);
    // Keep null for invalid; validation is handled by DTO, but be defensive.
    return Number.isNaN(d.getTime()) ? null : d;
};

export const getCurrentUserProfile = async (userId) => {
    const user = await FoodUser.findById(userId).lean();
    if (!user) throw new AuthError('Profile not found');
    const wallet = await FoodUserWallet.findOne({ userId }).select('balance').lean();
    return {
        user: {
            ...user,
            walletBalance: wallet ? Math.max(0, Number(wallet.balance) || 0) : Math.max(0, Number(user.walletBalance) || 0)
        }
    };
};

export const updateCurrentUserProfile = async (userId, body) => {
    const user = await FoodUser.findById(userId);
    if (!user) throw new AuthError('Profile not found');

    if (body.phone !== undefined) {
        const nextPhone = String(body.phone || '').trim();
        const currentPhone = String(user.phone || '').trim();
        // OTP login is phone-based in this project; don't allow changing it from profile edit.
        if (nextPhone && nextPhone !== currentPhone) {
            throw new ValidationError('Phone number cannot be changed');
        }
    }

    if (body.name !== undefined) user.name = String(body.name || '').trim();
    if (body.email !== undefined) user.email = String(body.email || '').trim().toLowerCase();
    if (body.alternatePhone !== undefined) user.alternatePhone = String(body.alternatePhone || '').trim();
    if (body.profileImage !== undefined) user.profileImage = String(body.profileImage || '').trim();
    if (body.gender !== undefined) user.gender = String(body.gender || '').trim();

    const dob = parseIsoDateOrNull(body.dateOfBirth);
    if (dob !== undefined) user.dateOfBirth = dob;
    const ann = parseIsoDateOrNull(body.anniversary);
    if (ann !== undefined) user.anniversary = ann;

    if (body.addresses !== undefined) {
        const nextAddresses = normalizeAddressesList(body.addresses);
        if (nextAddresses !== undefined) user.addresses = nextAddresses;
    }

    await user.save();
    return { user: user.toObject() };
};

export const uploadCurrentUserProfileImage = async (userId, file) => {
    if (!file || !file.buffer) {
        throw new ValidationError('File is required');
    }
    const user = await FoodUser.findById(userId);
    if (!user) throw new AuthError('Profile not found');

    const url = await uploadImageBuffer(file.buffer, 'food/users/profile');
    user.profileImage = String(url || '').trim();
    await user.save();
    return { profileImage: user.profileImage, user: user.toObject() };
};

export const deleteCurrentUserAccount = async (userId) => {
    const user = await FoodUser.findById(userId);
    if (!user) throw new AuthError('Profile not found');

    // Soft delete
    user.isDeleted = true;
    user.accountStatus = 'deleted';
    user.isActive = false;
    await user.save();

    // Invalidate/delete all active refresh tokens for this user
    const { FoodRefreshToken } = await import('../../../../core/refreshTokens/refreshToken.model.js');
    await FoodRefreshToken.deleteMany({ userId });

    return { success: true, message: 'Account soft deleted successfully' };
};

