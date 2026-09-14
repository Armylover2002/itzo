import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { ItemSlotTiming } from '../models/itemSlotTiming.model.js';
import {
    buildActionPerformer,
    serializeItemSlotTiming,
    validateSlotTimingPayload
} from './itemSlotTiming.util.js';

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getRestaurantContext = async (restaurantId) => {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }

    const restaurant = await FoodRestaurant.findById(restaurantId).select('_id').lean();
    if (!restaurant?._id) {
        throw new ValidationError('Restaurant not found');
    }

    return {
        restaurantId: new mongoose.Types.ObjectId(String(restaurantId))
    };
};

const assertUniqueSlotName = async (restaurantId, name, excludeId = null) => {
    const filter = {
        restaurantId,
        name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' }
    };
    if (excludeId && mongoose.Types.ObjectId.isValid(String(excludeId))) {
        filter._id = { $ne: new mongoose.Types.ObjectId(String(excludeId)) };
    }

    const existing = await ItemSlotTiming.findOne(filter).select('_id').lean();
    if (existing?._id) {
        throw new ValidationError('A slot with this name already exists');
    }
};

export async function listRestaurantItemSlotTimings(restaurantId) {
    const context = await getRestaurantContext(restaurantId);
    const slots = await ItemSlotTiming.find({ restaurantId: context.restaurantId })
        .sort({ startTime: 1, name: 1 })
        .lean();

    return {
        slots: slots.map(serializeItemSlotTiming)
    };
}

export async function getRestaurantItemSlotTimingById(restaurantId, slotId) {
    const context = await getRestaurantContext(restaurantId);
    if (!slotId || !mongoose.Types.ObjectId.isValid(String(slotId))) {
        throw new ValidationError('Invalid slot id');
    }

    const slot = await ItemSlotTiming.findOne({
        _id: slotId,
        restaurantId: context.restaurantId
    }).lean();

    if (!slot?._id) return null;
    return serializeItemSlotTiming(slot);
}

export async function createRestaurantItemSlotTiming(restaurantId, body = {}, req = {}) {
    const context = await getRestaurantContext(restaurantId);
    const payload = validateSlotTimingPayload(body);
    await assertUniqueSlotName(context.restaurantId, payload.name);

    const performer = buildActionPerformer(req);
    const created = await ItemSlotTiming.create({
        restaurantId: context.restaurantId,
        ...payload,
        createdBy: performer,
        updatedBy: performer
    });

    return serializeItemSlotTiming(created.toObject());
}

export async function updateRestaurantItemSlotTiming(restaurantId, slotId, body = {}, req = {}) {
    const context = await getRestaurantContext(restaurantId);
    if (!slotId || !mongoose.Types.ObjectId.isValid(String(slotId))) {
        throw new ValidationError('Invalid slot id');
    }

    const existing = await ItemSlotTiming.findOne({
        _id: slotId,
        restaurantId: context.restaurantId
    }).lean();
    if (!existing?._id) return null;

    const update = {};
    if (body.name !== undefined || body.startTime !== undefined || body.endTime !== undefined) {
        const payload = validateSlotTimingPayload({
            name: body.name !== undefined ? body.name : existing.name,
            startTime: body.startTime !== undefined ? body.startTime : existing.startTime,
            endTime: body.endTime !== undefined ? body.endTime : existing.endTime
        });
        if (payload.name.toLowerCase() !== String(existing.name || '').toLowerCase()) {
            await assertUniqueSlotName(context.restaurantId, payload.name, slotId);
        }
        update.name = payload.name;
        update.startTime = payload.startTime;
        update.endTime = payload.endTime;
    }

    if (Object.keys(update).length === 0) {
        return serializeItemSlotTiming(existing);
    }

    update.updatedBy = buildActionPerformer(req);

    const updated = await ItemSlotTiming.findOneAndUpdate(
        { _id: slotId, restaurantId: context.restaurantId },
        { $set: update },
        { new: true }
    ).lean();

    return serializeItemSlotTiming(updated);
}

export async function deleteRestaurantItemSlotTiming(restaurantId, slotId) {
    const context = await getRestaurantContext(restaurantId);
    if (!slotId || !mongoose.Types.ObjectId.isValid(String(slotId))) {
        throw new ValidationError('Invalid slot id');
    }

    const existing = await ItemSlotTiming.findOne({
        _id: slotId,
        restaurantId: context.restaurantId
    }).select('_id name')
        .lean();
    if (!existing?._id) return null;

    const linkedItems = await FoodItem.find({
        restaurantId: context.restaurantId,
        itemSlotTimingId: existing._id
    })
        .select('_id')
        .lean();

    if (linkedItems.length > 0) {
        await FoodItem.updateMany(
            { restaurantId: context.restaurantId, itemSlotTimingId: existing._id },
            { $set: { itemSlotTimingId: null } }
        );
    }

    await ItemSlotTiming.deleteOne({ _id: existing._id, restaurantId: context.restaurantId });

    return {
        id: String(existing._id),
        unlinkedItemCount: linkedItems.length
    };
}

export async function resolveRestaurantItemSlotTimingId(restaurantId, rawSlotId) {
    if (rawSlotId === undefined) return undefined;
    if (rawSlotId === null || rawSlotId === '' || rawSlotId === 'none') return null;

    const context = await getRestaurantContext(restaurantId);
    if (!mongoose.Types.ObjectId.isValid(String(rawSlotId))) {
        throw new ValidationError('Invalid availability slot id');
    }

    const slot = await ItemSlotTiming.findOne({
        _id: rawSlotId,
        restaurantId: context.restaurantId
    }).select('_id')
        .lean();

    if (!slot?._id) {
        throw new ValidationError('Availability slot not found');
    }

    return slot._id;
}
