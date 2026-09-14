import { DiningCategory } from '../models/diningCategory.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';

export async function listDiningCategories() {
    return DiningCategory.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
}

export async function createDiningCategory(data) {
    return DiningCategory.create(data);
}

export async function updateDiningCategory(id, data) {
    const category = await DiningCategory.findByIdAndUpdate(id, { $set: data }, { new: true });
    if (!category) throw new ValidationError('Dining category not found');
    return category;
}

export async function deleteDiningCategory(id) {
    const category = await DiningCategory.findByIdAndDelete(id);
    if (!category) throw new ValidationError('Dining category not found');
    return category;
}

export async function toggleDiningCategoryStatus(id) {
    const category = await DiningCategory.findById(id);
    if (!category) throw new ValidationError('Dining category not found');
    category.isActive = !category.isActive;
    await category.save();
    return category;
}
