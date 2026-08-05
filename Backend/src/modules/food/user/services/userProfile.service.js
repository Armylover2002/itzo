import { FoodUser } from '../../../../core/users/user.model.js';
import { AuthError, ValidationError } from '../../../../core/auth/errors.js';
import { FoodUserWallet } from '../models/userWallet.model.js';
import { uploadImageBuffer } from '../../../../services/upload.service.js';

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
    if (body.profileImage !== undefined) user.profileImage = String(body.profileImage || '').trim();
    if (body.gender !== undefined) user.gender = String(body.gender || '').trim();

    const dob = parseIsoDateOrNull(body.dateOfBirth);
    if (dob !== undefined) user.dateOfBirth = dob;
    const ann = parseIsoDateOrNull(body.anniversary);
    if (ann !== undefined) user.anniversary = ann;

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

    user.isDeleted = true;
    user.isActive = false;
    user.deletionRequest = {
        status: 'approved',
        reason: 'User requested account deletion',
        requestedAt: new Date(),
        reviewedAt: new Date()
    };
    await user.save();
    return { success: true, message: 'Account deleted successfully' };
};
