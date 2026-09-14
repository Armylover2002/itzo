import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodAdvertisement, ADS_TYPE_OPTIONS } from '../../admin/models/advertisement.model.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import {
    uploadImageBufferDetailed,
    uploadBufferDetailed
} from '../../../../services/cloudinary.service.js';
import { v2 as cloudinary } from 'cloudinary';

function generateAdsId() {
    const suffix = Date.now().toString(36).toUpperCase().slice(-6);
    const rand = Math.random().toString(36).toUpperCase().slice(2, 5);
    return `AD-${suffix}${rand}`;
}

function parseValidity(validity, { allowPastStart = false } = {}) {
    const raw = String(validity || '').trim();
    if (!raw) return { validity: '', startDate: null, endDate: null };

    // Supports "YYYY-MM-DD" or "YYYY-MM-DD to YYYY-MM-DD"
    const parts = raw.split(/\s+to\s+|\s+-\s+/i).map((p) => p.trim()).filter(Boolean);
    const start = parts[0] ? new Date(parts[0]) : null;
    const end = parts[1] ? new Date(parts[1]) : start ? new Date(parts[0]) : null;

    const startDate = start && !Number.isNaN(start.getTime()) ? start : null;
    let endDate = end && !Number.isNaN(end.getTime()) ? end : null;
    if (startDate && endDate && endDate < startDate) {
        throw new ValidationError('Validity end date must be on or after start date');
    }
    if (startDate && !allowPastStart) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDay = new Date(startDate);
        startDay.setHours(0, 0, 0, 0);
        if (startDay < today) {
            throw new ValidationError('Start date cannot be in the past');
        }
    }
    if (endDate) {
        endDate = new Date(endDate);
        endDate.setHours(23, 59, 59, 999);
    }

    return { validity: raw, startDate, endDate };
}

function displayStatus(ad) {
    if (!ad) return 'Pending';
    if (ad.status === 'Pending') return 'Pending';
    if (ad.status === 'Rejected') return 'Rejected';
    if (ad.status === 'Paused') return 'Paused';
    if (ad.status === 'Approved') {
        const now = Date.now();
        const end = ad.endDate ? new Date(ad.endDate).getTime() : Number.POSITIVE_INFINITY;
        if (now > end) return 'Expired';
        return 'Approved';
    }
    return ad.status;
}

function formatDate(value) {
    if (!value) return 'N/A';
    try {
        return new Date(value).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    } catch {
        return 'N/A';
    }
}

function toRestaurantView(ad) {
    const obj = ad?.toObject ? ad.toObject() : { ...ad };
    const id = String(obj._id);
    return {
        ...obj,
        id,
        _id: obj._id,
        adsId: obj.adsId,
        type: obj.adsType,
        status: displayStatus(obj),
        lifecycleStatus: obj.status,
        adsPlaced: formatDate(obj.createdAt),
        adsCreated: formatDate(obj.createdAt),
        adsDetails: obj.adsType,
        paymentStatus: obj.status === 'Approved' || displayStatus(obj) === 'Running' ? 'N/A' : 'Unpaid',
        pauseNote: obj.status === 'Paused' ? 'Paused by restaurant' : '—',
        duration: {
            start: formatDate(obj.startDate) !== 'N/A' ? formatDate(obj.startDate) : (obj.validity || 'N/A'),
            end: formatDate(obj.endDate) !== 'N/A' ? formatDate(obj.endDate) : (obj.validity || 'N/A')
        }
    };
}

function toAdminListView(ad, index = 0) {
    const obj = ad?.toObject ? ad.toObject() : { ...ad };
    return {
        sl: index + 1,
        _id: obj._id,
        adsId: obj.adsId,
        adsTitle: obj.title,
        restaurantName: obj.restaurantName,
        restaurantEmail: obj.restaurantEmail || '',
        adsType: obj.adsType,
        duration: obj.validity || (
            obj.endDate
                ? new Date(obj.endDate).toISOString().slice(0, 10)
                : 'N/A'
        ),
        status: displayStatus(obj),
        lifecycleStatus: obj.status,
        priority: obj.priority || '2',
        imageUrl: obj.imageUrl || '',
        videoUrl: obj.videoUrl || '',
        description: obj.description || '',
        createdAt: obj.createdAt
    };
}

function toAdminRequestView(ad, index = 0) {
    const obj = ad?.toObject ? ad.toObject() : { ...ad };
    let requestStatus = 'new';
    if (obj.status === 'Rejected') requestStatus = 'denied';
    else if (obj.status === 'Approved' || obj.status === 'Paused') requestStatus = 'approved';
    else if (obj.requestType === 'update') requestStatus = 'update';
    else requestStatus = 'new';

    return {
        sl: index + 1,
        _id: obj._id,
        adsId: obj.adsId,
        adsTitle: obj.title,
        restaurantName: obj.restaurantName,
        restaurantEmail: obj.restaurantEmail || '',
        adsType: obj.adsType,
        duration: obj.validity || 'N/A',
        status: requestStatus,
        lifecycleStatus: obj.status,
        requestType: obj.requestType,
        priority: obj.priority || '2',
        imageUrl: obj.imageUrl || '',
        videoUrl: obj.videoUrl || '',
        description: obj.description || '',
        createdAt: obj.createdAt
    };
}

async function destroyCloudinary(publicId, resourceType = 'image') {
    if (!publicId) return;
    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch {
        // ignore cleanup failures
    }
}

async function uploadMediaFromFiles(files = {}) {
    const result = {};
    const imageFile = Array.isArray(files.image) ? files.image[0] : files.image;
    const videoFile = Array.isArray(files.video) ? files.video[0] : files.video;

    try {
        if (imageFile?.buffer) {
            const uploaded = await uploadImageBufferDetailed(imageFile.buffer, 'food/advertisements');
            result.imageUrl = uploaded.secure_url;
            result.imagePublicId = uploaded.public_id;
        }

        if (videoFile?.buffer) {
            const uploaded = await uploadBufferDetailed(videoFile.buffer, {
                folder: 'food/advertisements',
                resourceType: 'video'
            });
            result.videoUrl = uploaded.secure_url;
            result.videoPublicId = uploaded.public_id;
        }
    } catch (error) {
        const message = String(error?.message || '').trim();
        throw new ValidationError(
            message
                ? `Failed to upload advertisement media: ${message}`
                : 'Failed to upload advertisement media. Please try again.'
        );
    }

    return result;
}

function normalizePayload(body = {}, { allowPastStart = false } = {}) {
    const title = String(body.title || '').trim();
    if (!title) throw new ValidationError('Title is required');

    const adsType = String(body.adsType || body.category || '').trim();
    if (!ADS_TYPE_OPTIONS.includes(adsType)) {
        throw new ValidationError(`Invalid ads type. Allowed: ${ADS_TYPE_OPTIONS.join(', ')}`);
    }

    const { validity, startDate, endDate } = parseValidity(body.validity, { allowPastStart });
    if (!validity) {
        throw new ValidationError('Validity is required');
    }

    return {
        title,
        description: String(body.description || '').trim(),
        adsType,
        fileDescription: String(body.fileDescription || '').trim(),
        videoDescription: String(body.videoDescription || '').trim(),
        validity,
        startDate,
        endDate
    };
}

export async function listRestaurantAdvertisements(restaurantId) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant');
    }

    const ads = await FoodAdvertisement.find({
        restaurantId,
        isDeleted: false
    })
        .sort({ createdAt: -1 })
        .lean();

    return ads.map(toRestaurantView);
}

export async function getRestaurantAdvertisement(restaurantId, adId) {
    if (!mongoose.Types.ObjectId.isValid(String(adId))) {
        throw new ValidationError('Invalid advertisement id');
    }

    const ad = await FoodAdvertisement.findOne({
        _id: adId,
        restaurantId,
        isDeleted: false
    }).lean();

    if (!ad) throw new ValidationError('Advertisement not found');
    return toRestaurantView(ad);
}

export async function createRestaurantAdvertisement(restaurantId, body, files = {}) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant');
    }

    const restaurant = await FoodRestaurant.findById(restaurantId)
        .select('restaurantName ownerEmail')
        .lean();
    if (!restaurant) throw new ValidationError('Restaurant not found');

    const payload = normalizePayload(body);
    const media = await uploadMediaFromFiles(files);

    if (payload.adsType === 'Video Promotion' && !media.videoUrl) {
        throw new ValidationError('Video file is required for Video Promotion');
    }
    if (
        ['Image Promotion', 'Banner Promotion', 'Restaurant Promotion'].includes(payload.adsType) &&
        !media.imageUrl
    ) {
        throw new ValidationError('Image file is required for this advertisement type');
    }

    let adsId = generateAdsId();
    for (let i = 0; i < 3; i += 1) {
        const exists = await FoodAdvertisement.exists({ adsId });
        if (!exists) break;
        adsId = generateAdsId();
    }

    const created = await FoodAdvertisement.create({
        restaurantId,
        restaurantName: restaurant.restaurantName || 'Restaurant',
        restaurantEmail: restaurant.ownerEmail || '',
        adsId,
        ...payload,
        ...media,
        priority: '2',
        status: 'Pending',
        requestType: 'new'
    });

    return toRestaurantView(created);
}

export async function updateRestaurantAdvertisement(restaurantId, adId, body, files = {}) {
    if (!mongoose.Types.ObjectId.isValid(String(adId))) {
        throw new ValidationError('Invalid advertisement id');
    }

    const existing = await FoodAdvertisement.findOne({
        _id: adId,
        restaurantId,
        isDeleted: false
    });
    if (!existing) throw new ValidationError('Advertisement not found');

    const payload = normalizePayload({
        title: body.title ?? existing.title,
        description: body.description ?? existing.description,
        adsType: body.adsType || body.category || existing.adsType,
        validity: body.validity ?? existing.validity,
        fileDescription: body.fileDescription ?? existing.fileDescription,
        videoDescription: body.videoDescription ?? existing.videoDescription
    }, { allowPastStart: true });

    const media = await uploadMediaFromFiles(files);

    if (media.imageUrl && existing.imagePublicId) {
        await destroyCloudinary(existing.imagePublicId, 'image');
    }
    if (media.videoUrl && existing.videoPublicId) {
        await destroyCloudinary(existing.videoPublicId, 'video');
    }

    Object.assign(existing, payload, media, {
        status: 'Pending',
        requestType: 'update'
    });

    await existing.save();
    return toRestaurantView(existing);
}

export async function deleteRestaurantAdvertisement(restaurantId, adId) {
    if (!mongoose.Types.ObjectId.isValid(String(adId))) {
        throw new ValidationError('Invalid advertisement id');
    }

    const existing = await FoodAdvertisement.findOne({
        _id: adId,
        restaurantId,
        isDeleted: false
    });
    if (!existing) throw new ValidationError('Advertisement not found');

    existing.isDeleted = true;
    existing.status = 'Paused';
    await existing.save();
    return { deleted: true, id: String(existing._id) };
}

export async function pauseRestaurantAdvertisement(restaurantId, adId) {
    if (!mongoose.Types.ObjectId.isValid(String(adId))) {
        throw new ValidationError('Invalid advertisement id');
    }

    const existing = await FoodAdvertisement.findOne({
        _id: adId,
        restaurantId,
        isDeleted: false
    });
    if (!existing) throw new ValidationError('Advertisement not found');
    if (existing.status !== 'Approved' && existing.status !== 'Paused') {
        throw new ValidationError('Only approved advertisements can be paused');
    }

    existing.status = existing.status === 'Paused' ? 'Approved' : 'Paused';
    await existing.save();
    return toRestaurantView(existing);
}

export async function listAdminAdvertisements() {
    const ads = await FoodAdvertisement.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .lean();
    return ads.map((ad, idx) => toAdminListView(ad, idx));
}

export async function createAdminAdvertisement(body = {}, files = {}) {
    const restaurantId = body.restaurantId;
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Restaurant is required');
    }

    const restaurant = await FoodRestaurant.findById(restaurantId)
        .select('restaurantName ownerEmail')
        .lean();
    if (!restaurant) throw new ValidationError('Restaurant not found');

    const payload = normalizePayload(body);
    const media = await uploadMediaFromFiles(files);

    if (payload.adsType === 'Video Promotion' && !media.videoUrl) {
        throw new ValidationError('Video file is required for Video Promotion');
    }
    if (
        ['Image Promotion', 'Banner Promotion', 'Restaurant Promotion'].includes(payload.adsType) &&
        !media.imageUrl
    ) {
        throw new ValidationError('Image file is required for this advertisement type');
    }

    const priority = ['1', '2', '3'].includes(String(body.priority)) ? String(body.priority) : '2';
    const autoApprove = body.autoApprove !== false && body.autoApprove !== 'false';

    let adsId = generateAdsId();
    for (let i = 0; i < 3; i += 1) {
        const exists = await FoodAdvertisement.exists({ adsId });
        if (!exists) break;
        adsId = generateAdsId();
    }

    const created = await FoodAdvertisement.create({
        restaurantId,
        restaurantName: restaurant.restaurantName || 'Restaurant',
        restaurantEmail: restaurant.ownerEmail || '',
        adsId,
        ...payload,
        ...media,
        priority,
        status: autoApprove ? 'Approved' : 'Pending',
        requestType: 'new'
    });

    return toAdminListView(created.toObject ? created.toObject() : created);
}

export async function listAdminAdvertisementRequests() {
    const all = await FoodAdvertisement.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .lean();

    return all.map((ad, idx) => toAdminRequestView(ad, idx));
}

export async function updateAdminAdvertisementStatus(adId, status) {
    if (!mongoose.Types.ObjectId.isValid(String(adId))) {
        throw new ValidationError('Invalid advertisement id');
    }

    const normalized =
        status === 'approved' || status === 'Approved'
            ? 'Approved'
            : status === 'denied' || status === 'Rejected'
              ? 'Rejected'
              : null;

    if (!normalized) {
        throw new ValidationError('Status must be Approved or Rejected');
    }

    const updated = await FoodAdvertisement.findOneAndUpdate(
        { _id: adId, isDeleted: false },
        { $set: { status: normalized } },
        { new: true }
    ).lean();

    if (!updated) throw new ValidationError('Advertisement not found');
    return toAdminRequestView(updated);
}

export async function updateAdminAdvertisementPriority(adId, priority) {
    if (!mongoose.Types.ObjectId.isValid(String(adId))) {
        throw new ValidationError('Invalid advertisement id');
    }
    const p = String(priority);
    if (!['1', '2', '3'].includes(p)) {
        throw new ValidationError('Priority must be 1, 2, or 3');
    }

    const updated = await FoodAdvertisement.findOneAndUpdate(
        { _id: adId, isDeleted: false },
        { $set: { priority: p } },
        { new: true }
    ).lean();

    if (!updated) throw new ValidationError('Advertisement not found');
    return toAdminListView(updated);
}

export async function deleteAdminAdvertisement(adId) {
    if (!mongoose.Types.ObjectId.isValid(String(adId))) {
        throw new ValidationError('Invalid advertisement id');
    }

    const updated = await FoodAdvertisement.findOneAndUpdate(
        { _id: adId, isDeleted: false },
        { $set: { isDeleted: true, status: 'Paused' } },
        { new: true }
    ).lean();

    if (!updated) throw new ValidationError('Advertisement not found');
    return { deleted: true, id: String(updated._id) };
}

export async function updateAdminAdvertisement(adId, body, files = {}) {
    if (!mongoose.Types.ObjectId.isValid(String(adId))) {
        throw new ValidationError('Invalid advertisement id');
    }

    const existing = await FoodAdvertisement.findOne({
        _id: adId,
        isDeleted: false
    });
    if (!existing) throw new ValidationError('Advertisement not found');

    const payload = normalizePayload({
        title: body.title ?? existing.title,
        description: body.description ?? existing.description,
        adsType: body.adsType || body.category || existing.adsType,
        validity: body.validity ?? existing.validity,
        fileDescription: body.fileDescription ?? existing.fileDescription,
        videoDescription: body.videoDescription ?? existing.videoDescription
    }, { allowPastStart: true });

    const media = await uploadMediaFromFiles(files);

    if (media.imageUrl && existing.imagePublicId) {
        await destroyCloudinary(existing.imagePublicId, 'image');
    }
    if (media.videoUrl && existing.videoPublicId) {
        await destroyCloudinary(existing.videoPublicId, 'video');
    }

    Object.assign(existing, payload, media);

    await existing.save();
    return toAdminListView(existing);
}

