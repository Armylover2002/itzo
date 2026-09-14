import { FoodUnder250Banner } from '../models/under250Banner.model.js';
import { v2 as cloudinary } from 'cloudinary';
import { uploadImageBufferDetailed } from '../../../../services/cloudinary.service.js';

export const listUnder250Banners = async () => {
    return FoodUnder250Banner.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
};

const getNextSortOrder = async () => {
    const last = await FoodUnder250Banner.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
    return (last?.sortOrder ?? -1) + 1;
};

export const createUnder250BannersFromFiles = async (files, meta = {}) => {
    if (!files || !files.length) {
        return [];
    }

    const results = [];
    let currentSortOrder = typeof meta.sortOrder === 'number' ? meta.sortOrder : await getNextSortOrder();

    for (const file of files) {
        try {
            const uploadResult = await uploadImageBufferDetailed(file.buffer, 'food/under-250-banners');

            const banner = await FoodUnder250Banner.create({
                imageUrl: uploadResult.secure_url,
                publicId: uploadResult.public_id,
                title: meta.title,
                ctaText: meta.ctaText,
                ctaLink: meta.ctaLink,
                zoneId: meta.zoneId,
                sortOrder: currentSortOrder++,
                isActive: true,
            });

            results.push({ success: true, banner: banner.toObject() });
        } catch (error) {
            results.push({ success: false, error: error.message });
        }
    }

    return results;
};

export const deleteUnder250Banner = async (id) => {
    const doc = await FoodUnder250Banner.findById(id);
    if (!doc) {
        return { deleted: false };
    }

    if (doc.publicId) {
        try {
            await cloudinary.uploader.destroy(doc.publicId);
        } catch {
            // ignore cloudinary deletion errors
        }
    }

    await doc.deleteOne();
    return { deleted: true };
};

export const updateUnder250BannerOrder = async (id, sortOrder) => {
    const updated = await FoodUnder250Banner.findByIdAndUpdate(
        id,
        { sortOrder },
        { new: true }
    ).lean();
    return updated;
};

export const toggleUnder250BannerStatus = async (id, isActive) => {
    const updated = await FoodUnder250Banner.findByIdAndUpdate(
        id,
        { isActive },
        { new: true }
    ).lean();
    return updated;
};

