import mongoose from 'mongoose';
import * as adminService from '../services/admin.service.js';
import { validateAddonAdminListQuery, validateAddonRejectDto } from '../validators/addonApproval.validator.js';
import { extractPerformer } from '../../../../core/utils/performer.js';

export async function getRestaurantAddons(req, res, next) {
    try {
        const query = validateAddonAdminListQuery(req.query || {});
        const data = await adminService.getRestaurantAddonsAdmin(query);
        res.status(200).json({ success: true, message: 'Restaurant add-ons fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function approveRestaurantAddon(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid add-on id' });
        }
        const performer = extractPerformer(req.user);
        const updated = await adminService.approveRestaurantAddon(id, performer);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Add-on not found' });
        }
        res.status(200).json({ success: true, message: 'Add-on approved successfully', data: { addon: updated } });
    } catch (error) {
        next(error);
    }
}

export async function rejectRestaurantAddon(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid add-on id' });
        }
        const { reason } = validateAddonRejectDto(req.body || {});
        const performer = extractPerformer(req.user);
        const updated = await adminService.rejectRestaurantAddon(id, reason, performer);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Add-on not found' });
        }
        res.status(200).json({ success: true, message: 'Add-on rejected successfully', data: { addon: updated } });
    } catch (error) {
        next(error);
    }
}

export async function updateRestaurantAddon(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid add-on id' });
        }
        const updated = await adminService.updateRestaurantAddonAdmin(id, req.body || {});
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Add-on not found' });
        }
        res.status(200).json({ success: true, message: 'Add-on updated successfully', data: { addon: updated } });
    } catch (error) {
        next(error);
    }
}
