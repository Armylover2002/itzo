import { DiningBanner } from '../models/diningBanner.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';

export async function listDiningBanners() {
    return DiningBanner.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
}

export async function createDiningBanner(data) {
    return DiningBanner.create(data);
}

export async function updateDiningBanner(id, data) {
    const banner = await DiningBanner.findByIdAndUpdate(id, { $set: data }, { new: true });
    if (!banner) throw new ValidationError('Dining banner not found');
    return banner;
}

export async function deleteDiningBanner(id) {
    const banner = await DiningBanner.findByIdAndDelete(id);
    if (!banner) throw new ValidationError('Dining banner not found');
    return banner;
}

export async function toggleDiningBannerStatus(id) {
    const banner = await DiningBanner.findById(id);
    if (!banner) throw new ValidationError('Dining banner not found');
    banner.isActive = !banner.isActive;
    await banner.save();
    return banner;
}
