import { v2 as cloudinary } from 'cloudinary';
import { uploadBufferDetailed } from '../../../../services/upload.service.js';
import { FoodLandingSettings } from '../models/landingSettings.model.js';

export const getLandingSettings = async () => {
    let doc = await FoodLandingSettings.findOne().lean();
    if (!doc) {
        doc = (await FoodLandingSettings.create({})).toObject();
    }
    return doc;
};

export const updateLandingSettings = async (payload) => {
    const doc = await FoodLandingSettings.findOneAndUpdate({}, payload, {
        new: true,
        upsert: true
    }).lean();
    return doc;
};

export const uploadLandingHeaderVideo = async (file) => {
    if (!file?.buffer) {
        throw new Error('Video file is required');
    }

    const existing = await getLandingSettings();
    const uploaded = await uploadBufferDetailed(file.buffer, {
        folder: 'food/landing/header-video',
        resourceType: 'video'
    });

    if (existing?.headerVideoPublicId) {
        await cloudinary.uploader
            .destroy(existing.headerVideoPublicId, { resource_type: 'video' })
            .catch(() => {});
    }

    return updateLandingSettings({
        headerVideoUrl: uploaded?.secure_url || '',
        headerVideoPublicId: uploaded?.public_id || ''
    });
};

export const deleteLandingHeaderVideo = async () => {
    const existing = await getLandingSettings();

    if (existing?.headerVideoPublicId) {
        await cloudinary.uploader
            .destroy(existing.headerVideoPublicId, { resource_type: 'video' })
            .catch(() => {});
    }

    return updateLandingSettings({
        headerVideoUrl: '',
        headerVideoPublicId: ''
    });
};

