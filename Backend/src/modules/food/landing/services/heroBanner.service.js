import { FoodHeroBanner } from '../models/heroBanner.model.js';
import { v2 as cloudinary } from 'cloudinary';
import { uploadImageBufferDetailed } from '../../../../services/upload.service.js';

export const listHeroBanners = async () => {
    return FoodHeroBanner.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
};

export const createHeroBannersFromFiles = async (files, meta = {}) => {
    if (!files || !files.length) {
        return [];
    }

    const results = [];

    for (const file of files) {
        try {
            const uploadResult = await uploadImageBufferDetailed(file.buffer, 'food/hero-banners');

            const banner = await FoodHeroBanner.create({
                imageUrl: uploadResult.secure_url,
                publicId: uploadResult.public_id,
                title: meta.title,
                ctaText: meta.ctaText,
                ctaLink: meta.ctaLink,
                zoneId: typeof meta.zoneId === 'string' ? meta.zoneId.trim() : '',
                linkedRestaurantIds: meta.linkedRestaurantIds || [],
                sortOrder: meta.sortOrder ?? 0,
                isActive: true
            });

            results.push({ success: true, banner: banner.toObject() });
        } catch (error) {
            results.push({ success: false, error: error.message });
        }
    }

    return results;
};

export const deleteHeroBanner = async (id) => {
    const doc = await FoodHeroBanner.findById(id);
    if (!doc) {
        return { deleted: false };
    }

    if (doc.publicId) {
        try {
            await cloudinary.uploader.destroy(doc.publicId);
        } catch {
            // ignore cloudinary deletion errors to avoid blocking deletion
        }
    }

    await doc.deleteOne();
    return { deleted: true };
};

export const updateHeroBannerOrder = async (id, sortOrder) => {
    const updated = await FoodHeroBanner.findByIdAndUpdate(
        id,
        { sortOrder },
        { new: true }
    ).lean();
    return updated;
};

export const toggleHeroBannerStatus = async (id, isActive) => {
    const updated = await FoodHeroBanner.findByIdAndUpdate(
        id,
        { isActive },
        { new: true }
    ).lean();
    return updated;
};

export const updateHeroBanner = async (id, updates = {}) => {
    const payload = {};

    if (Object.prototype.hasOwnProperty.call(updates, 'zoneId')) {
        payload.zoneId = typeof updates.zoneId === 'string' ? updates.zoneId.trim() : '';
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'title')) {
        payload.title = updates.title;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'subtitle')) {
        payload.subtitle = updates.subtitle;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'ctaText')) {
        payload.ctaText = updates.ctaText;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'ctaLink')) {
        payload.ctaLink = updates.ctaLink;
    }

    const updated = await FoodHeroBanner.findByIdAndUpdate(id, payload, {
        new: true
    }).lean();

    return updated;
};

