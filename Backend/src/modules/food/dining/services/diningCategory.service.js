import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { DiningCategory } from '../models/diningCategory.model.js';

export async function listDiningCategories(query = {}) {
    const filter = {};
    if (query.isActive !== undefined) {
        filter.isActive = query.isActive === 'true' || query.isActive === true;
    }
    if (query.search && String(query.search).trim()) {
        filter.name = { $regex: String(query.search).trim(), $options: 'i' };
    }
    const categories = await DiningCategory.find(filter).sort({ sortOrder: 1, createdAt: -1 }).lean();
    return { categories };
}

export async function createDiningCategory(body = {}) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new ValidationError('Category name is required');

    const image = typeof body.image === 'string' ? body.image.trim() : '';
    if (!image) throw new ValidationError('Category image is required');

    const doc = await DiningCategory.create({
        name,
        image,
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
        isActive: body.isActive !== false,
    });
    return doc.toObject();
}

export async function updateDiningCategory(id, body = {}) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new ValidationError('Invalid category id');

    const update = {};
    if (typeof body.name === 'string') {
        const name = body.name.trim();
        if (!name) throw new ValidationError('Category name cannot be empty');
        update.name = name;
    }
    if (typeof body.image === 'string') {
        const image = body.image.trim();
        if (!image) throw new ValidationError('Category image cannot be empty');
        update.image = image;
    }
    if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))) update.sortOrder = Number(body.sortOrder);
    if (body.isActive !== undefined) update.isActive = body.isActive === true || body.isActive === 'true';

    const updated = await DiningCategory.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!updated) throw new ValidationError('Dining category not found');
    return updated;
}

export async function deleteDiningCategory(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new ValidationError('Invalid category id');
    const deleted = await DiningCategory.findByIdAndDelete(id).lean();
    if (!deleted) throw new ValidationError('Dining category not found');
    return deleted;
}

export async function toggleDiningCategoryStatus(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new ValidationError('Invalid category id');
    const category = await DiningCategory.findById(id);
    if (!category) throw new ValidationError('Dining category not found');
    category.isActive = !category.isActive;
    await category.save();
    return category.toObject();
}
