import mongoose from 'mongoose';
import { FoodAdmin } from '../admin/admin.model.js';

export function extractPerformer(reqUser) {
    if (!reqUser) return null;
    return {
        userId: reqUser.userId || reqUser._id || null,
        name: reqUser.name || 'Unknown',
        email: reqUser.email || '',
        role: reqUser.role || 'Unknown',
        roleName: reqUser.roleName || reqUser.role || 'Unknown',
        phone: reqUser.phone || '',
        actionAt: new Date()
    };
}

export async function resolveActionPerformerSnapshot(reqUser) {
    if (!reqUser?.userId || !mongoose.Types.ObjectId.isValid(String(reqUser.userId))) {
        return extractPerformer(reqUser);
    }

    const admin = await FoodAdmin.findById(reqUser.userId)
        .select('name email phone role adminRoleId')
        .populate('adminRoleId', 'roleName')
        .lean();

    if (!admin) {
        return extractPerformer(reqUser);
    }

    const role = String(admin.role || reqUser.role || '').toUpperCase();
    const populatedRoleName = typeof admin.adminRoleId === 'object' ? admin.adminRoleId?.roleName : '';
    const roleName = populatedRoleName
        || (role === 'ADMIN' ? 'Admin' : '')
        || reqUser.roleName
        || reqUser.role
        || 'Admin';

    return {
        userId: admin._id || reqUser.userId || null,
        name: admin.name || reqUser.name || 'Unknown',
        email: admin.email || reqUser.email || '',
        phone: admin.phone || reqUser.phone || '',
        role: role || reqUser.role || 'Unknown',
        roleName,
        actionAt: new Date()
    };
}
