import mongoose from 'mongoose';
import { FoodHeroBanner } from '../models/heroBanner.model.js';
import { v2 as cloudinary } from 'cloudinary';
import { uploadImageBufferDetailed } from '../../../../services/cloudinary.service.js';

export const listHeroBanners = async () => {
    return FoodHeroBanner.find()
        .sort({ sortOrder: 1, createdAt: -1 })
        .populate({
            path: 'linkedRestaurantIds',
            select: '_id restaurantName slug',
            model: 'FoodRestaurant'
        })
        .lean();
};

const getNextSortOrder = async () => {
    const last = await FoodHeroBanner.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
    return (last?.sortOrder ?? -1) + 1;
};

const normalizeLinkedRestaurantIds = (value) => {
    if (value == null || value === '') return [];
    const raw = Array.isArray(value) ? value : [value];
    return [...new Set(
        raw
            .map((id) => String(id || '').trim())
            .filter((id) => mongoose.Types.ObjectId.isValid(id))
    )];
};

export const createHeroBannersFromFiles = async (files, meta = {}) => {
    if (!files || !files.length) {
        return [];
    }

    const results = [];
    let currentSortOrder = typeof meta.sortOrder === 'number' ? meta.sortOrder : await getNextSortOrder();
    const linkedRestaurantIds = normalizeLinkedRestaurantIds(meta.linkedRestaurantIds);

    for (const file of files) {
        try {
            const uploadResult = await uploadImageBufferDetailed(file.buffer, 'food/hero-banners');

            const banner = await FoodHeroBanner.create({
                imageUrl: uploadResult.secure_url,
                publicId: uploadResult.public_id,
                title: meta.title,
                ctaText: meta.ctaText,
                ctaLink: typeof meta.ctaLink === 'string' ? meta.ctaLink.trim() : '',
                zoneId: typeof meta.zoneId === 'string' ? meta.zoneId.trim() : '',
                linkedRestaurantIds,
                sortOrder: currentSortOrder++,
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

    if (Object.prototype.hasOwnProperty.call(updates, 'ctaLink')) {
        payload.ctaLink = typeof updates.ctaLink === 'string' ? updates.ctaLink.trim() : '';
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'ctaText')) {
        payload.ctaText = typeof updates.ctaText === 'string' ? updates.ctaText.trim() : '';
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'title')) {
        payload.title = typeof updates.title === 'string' ? updates.title.trim() : '';
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'linkedRestaurantIds')) {
        payload.linkedRestaurantIds = normalizeLinkedRestaurantIds(updates.linkedRestaurantIds);
    }

    const updated = await FoodHeroBanner.findByIdAndUpdate(id, payload, {
        new: true
    })
        .populate({
            path: 'linkedRestaurantIds',
            select: '_id restaurantName slug',
            model: 'FoodRestaurant'
        })
        .lean();

    return updated;
};
