import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { DiningBanner } from '../models/diningBanner.model.js';

export async function listDiningBanners(query = {}) {
    const filter = {};
    if (query.isActive !== undefined) {
        filter.isActive = query.isActive === 'true' || query.isActive === true;
    }
    const banners = await DiningBanner.find(filter).sort({ sortOrder: 1, createdAt: -1 }).lean();
    return { banners };
}

export async function createDiningBanner(body = {}) {
    const image = typeof body.image === 'string' ? body.image.trim() : '';
    if (!image) throw new ValidationError('Banner image is required');

    const doc = await DiningBanner.create({
        title: typeof body.title === 'string' ? body.title.trim() : '',
        image,
        link: typeof body.link === 'string' ? body.link.trim() : '',
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
        isActive: body.isActive !== false,
    });
    return doc.toObject();
}

export async function updateDiningBanner(id, body = {}) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new ValidationError('Invalid banner id');

    const update = {};
    if (typeof body.title === 'string') update.title = body.title.trim();
    if (typeof body.image === 'string') {
        const image = body.image.trim();
        if (!image) throw new ValidationError('Banner image cannot be empty');
        update.image = image;
    }
    if (typeof body.link === 'string') update.link = body.link.trim();
    if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))) update.sortOrder = Number(body.sortOrder);
    if (body.isActive !== undefined) update.isActive = body.isActive === true || body.isActive === 'true';

    const updated = await DiningBanner.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!updated) throw new ValidationError('Dining banner not found');
    return updated;
}

export async function deleteDiningBanner(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new ValidationError('Invalid banner id');
    const deleted = await DiningBanner.findByIdAndDelete(id).lean();
    if (!deleted) throw new ValidationError('Dining banner not found');
    return deleted;
}

export async function toggleDiningBannerStatus(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new ValidationError('Invalid banner id');
    const banner = await DiningBanner.findById(id);
    if (!banner) throw new ValidationError('Dining banner not found');
    banner.isActive = !banner.isActive;
    await banner.save();
    return banner.toObject();
}
