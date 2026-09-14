import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodAddon } from '../models/foodAddon.model.js';

const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeAddonDoc = (doc) => {
    if (!doc) return null;
    const draft = doc.draft || {};
    const published = doc.published || null;
    return {
        _id: doc._id,
        id: doc._id,
        restaurantId: doc.restaurantId,
        approvalStatus: doc.approvalStatus || 'pending',
        rejectionReason: doc.rejectionReason || '',
        requestedAt: doc.requestedAt,
        approvedAt: doc.approvedAt,
        rejectedAt: doc.rejectedAt,
        isAvailable: doc.isAvailable !== false,
        // Draft fields (what restaurant edits)
        name: draft.name || '',
        description: draft.description || '',
        price: Number(draft.price) || 0,
        image: draft.image || '',
        images: Array.isArray(draft.images) ? draft.images : [],
        foodType: draft.foodType || 'Veg',
        // Published snapshot (what user app sees)
        published: published
            ? {
                name: published.name || '',
                description: published.description || '',
                price: Number(published.price) || 0,
                image: published.image || '',
                images: Array.isArray(published.images) ? published.images : [],
                foodType: published.foodType || 'Veg'
            }
            : null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
    };
};

export async function listRestaurantAddons(restaurantId, query = {}) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 100, 1), 100);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;
    const includeDeleted = query.includeDeleted === true;
    const status = String(query.status || '').trim();
    const search = typeof query.search === 'string' ? query.search.trim().slice(0, 80) : '';

    const filter = {
        restaurantId: new mongoose.Types.ObjectId(String(restaurantId)),
        ...(includeDeleted ? {} : { isDeleted: { $ne: true } })
    };
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
        filter.approvalStatus = status;
    }
    if (search) {
        const term = escapeRegex(search);
        filter.$or = [{ 'draft.name': { $regex: term, $options: 'i' } }];
    }

    const [list, total] = await Promise.all([
        FoodAddon.find(filter)
            .sort({ requestedAt: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        FoodAddon.countDocuments(filter)
    ]);

    return {
        addons: list.map(normalizeAddonDoc),
        total,
        page,
        limit
    };
}

export async function createRestaurantAddon(restaurantId, body) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    const rid = new mongoose.Types.ObjectId(String(restaurantId));
    const name = String(body?.name || '').trim();
    if (!name) throw new ValidationError('Add-on name is required');

    // Prevent duplicates per restaurant among non-deleted docs (case-insensitive exact).
    const exact = `^${escapeRegex(name)}$`;
    const exists = await FoodAddon.findOne({
        restaurantId: rid,
        isDeleted: { $ne: true },
        'draft.name': { $regex: exact, $options: 'i' }
    })
        .select('_id')
        .lean();
    if (exists?._id) {
        throw new ValidationError('Add-on already exists');
    }

    const doc = await FoodAddon.create({
        restaurantId: rid,
        draft: {
            name,
            description: String(body.description || '').trim(),
            price: Number(body.price) || 0,
            image: String(body.image || '').trim(),
            images: Array.isArray(body.images) ? body.images.filter(Boolean).slice(0, 10) : [],
            foodType: body.foodType === 'Non-Veg' ? 'Non-Veg' : 'Veg'
        },
        published: null,
        approvalStatus: 'pending',
        rejectionReason: '',
        requestedAt: new Date(),
        approvedAt: null,
        rejectedAt: null,
        isAvailable: true,
        isDeleted: false
    });

    try {
        const { notifyAdminsSafely } = await import('../../../../core/notifications/firebase.service.js');
        void notifyAdminsSafely({
            title: 'New Addon Approval Request 🍟',
            body: `Restaurant has submitted a new addon "${name}" for approval.`,
            data: {
                type: 'approval_request',
                subType: 'addon',
                id: String(doc._id)
            }
        });
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to notify admins of new addon approval request:', e);
    }

    return normalizeAddonDoc(doc.toObject());
}

export async function updateRestaurantAddon(restaurantId, addonId, updateDto) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    if (!addonId || !mongoose.Types.ObjectId.isValid(String(addonId))) {
        throw new ValidationError('Invalid add-on id');
    }
    const rid = new mongoose.Types.ObjectId(String(restaurantId));
    const _id = new mongoose.Types.ObjectId(String(addonId));

    const set = {};

    if (updateDto?.isAvailable !== undefined) {
        set.isAvailable = updateDto.isAvailable !== false;
    }

    if (updateDto?.draft) {
        const d = updateDto.draft;
        if (d.name !== undefined) {
            const name = String(d.name || '').trim();
            if (!name) throw new ValidationError('Add-on name is required');
            if (name.length > 200) throw new ValidationError('Add-on name is too long');

            // Duplicate check excluding current doc.
            const exact = `^${escapeRegex(name)}$`;
            const exists = await FoodAddon.findOne({
                restaurantId: rid,
                isDeleted: { $ne: true },
                _id: { $ne: _id },
                'draft.name': { $regex: exact, $options: 'i' }
            })
                .select('_id')
                .lean();
            if (exists?._id) throw new ValidationError('Add-on already exists');

            set['draft.name'] = name;
        }
        if (d.description !== undefined) set['draft.description'] = String(d.description || '').trim();
        if (d.price !== undefined) {
            const price = Number(d.price);
            if (!Number.isFinite(price) || price < 0) throw new ValidationError('Price must be >= 0');
            set['draft.price'] = price;
        }
        if (d.image !== undefined) set['draft.image'] = String(d.image || '').trim();
        if (d.images !== undefined) {
            const imgs = Array.isArray(d.images) ? d.images.filter(Boolean).slice(0, 10) : [];
            set['draft.images'] = imgs;
        }
        if (d.foodType !== undefined) set['draft.foodType'] = d.foodType === 'Non-Veg' ? 'Non-Veg' : 'Veg';

        // Any draft content change must go through admin approval again.
        set.approvalStatus = 'pending';
        set.rejectionReason = '';
        set.requestedAt = new Date();
        set.approvedAt = null;
        set.rejectedAt = null;
    }

    if (Object.keys(set).length === 0) {
        const existing = await FoodAddon.findOne({ _id, restaurantId: rid, isDeleted: { $ne: true } }).lean();
        return existing ? normalizeAddonDoc(existing) : null;
    }

    const updated = await FoodAddon.findOneAndUpdate(
        { _id, restaurantId: rid, isDeleted: { $ne: true } },
        { $set: set },
        { new: true }
    ).lean();
    return updated ? normalizeAddonDoc(updated) : null;
}

export async function deleteRestaurantAddon(restaurantId, addonId) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    if (!addonId || !mongoose.Types.ObjectId.isValid(String(addonId))) {
        throw new ValidationError('Invalid add-on id');
    }
    const rid = new mongoose.Types.ObjectId(String(restaurantId));
    const _id = new mongoose.Types.ObjectId(String(addonId));
    const updated = await FoodAddon.findOneAndUpdate(
        { _id, restaurantId: rid, isDeleted: { $ne: true } },
        { $set: { isDeleted: true } },
        { new: true }
    ).lean();
    return updated ? { id: updated._id } : null;
}

