import mongoose from 'mongoose';
import { QuickCategory } from '../models/category.model.js';
import { QuickProduct } from '../models/product.model.js';

/**
 * Cascade rules for the quick-commerce category tree
 * (header -> category -> subcategory -> product).
 *
 * Deactivating a category has to hide everything beneath it, and every customer/seller
 * read path already filters on a row's own `isActive` / `status`. So instead of teaching
 * each of those queries to walk the parent chain, the flags are pushed down onto the
 * descendants and the linked products.
 *
 * Rows deactivated this way are stamped with `deactivatedByParentId` = the category the
 * admin switched off. Only stamped rows come back when that category is switched on
 * again, so anything an admin had already turned off by hand stays off.
 */

/** Visible = not switched off through either flag. Only these get stamped on the way down. */
const VISIBLE_FILTER = { isActive: { $ne: false }, status: { $ne: 'inactive' } };

const DEACTIVATE = { isActive: false, status: 'inactive' };
const REACTIVATE = { isActive: true, status: 'active' };

const toObjectId = (value) => new mongoose.Types.ObjectId(String(value));

/**
 * Breadth-first walk of the category tree below `rootId`.
 *
 * @returns {Promise<mongoose.Types.ObjectId[]>} descendant ids, root excluded
 */
export const collectDescendantCategoryIds = async (rootId) => {
    if (!mongoose.isValidObjectId(rootId)) return [];

    const root = toObjectId(rootId);
    const visited = new Set([String(root)]);
    const descendants = [];
    let frontier = [root];

    while (frontier.length > 0) {
        const children = await QuickCategory.find({ parentId: { $in: frontier } })
            .select('_id')
            .lean();

        frontier = [];
        for (const child of children) {
            const childId = String(child._id);
            if (visited.has(childId)) continue;
            visited.add(childId);
            frontier.push(child._id);
            descendants.push(child._id);
        }
    }

    return descendants;
};

/** Products reference their header / category / subcategory, so all three are matched. */
const productsUnderCategories = (categoryIds) => ({
    $or: [
        { categoryId: { $in: categoryIds } },
        { subcategoryId: { $in: categoryIds } },
        { headerId: { $in: categoryIds } },
    ],
});

/**
 * Switch off every descendant category and every linked product of `rootId`.
 * The root itself is left to the caller, which is already saving it.
 */
export const cascadeCategoryDeactivation = async (rootId) => {
    if (!mongoose.isValidObjectId(rootId)) {
        return { categoriesDeactivated: 0, productsDeactivated: 0 };
    }

    const root = toObjectId(rootId);
    const descendantIds = await collectDescendantCategoryIds(root);
    const stamp = { ...DEACTIVATE, deactivatedByParentId: root };

    const [categoryResult, productResult] = await Promise.all([
        descendantIds.length
            ? QuickCategory.updateMany(
                { _id: { $in: descendantIds }, ...VISIBLE_FILTER },
                { $set: stamp },
            )
            : Promise.resolve({ modifiedCount: 0 }),
        QuickProduct.updateMany(
            { ...productsUnderCategories([root, ...descendantIds]), ...VISIBLE_FILTER },
            { $set: stamp },
        ),
    ]);

    return {
        categoriesDeactivated: categoryResult.modifiedCount || 0,
        productsDeactivated: productResult.modifiedCount || 0,
    };
};

/**
 * When a category tree is deleted, keep the products but take them off the storefront.
 * Their header/category/subcategory ids stay as-is so an admin or seller can later
 * re-point them at a live branch and switch them back on.
 */
export const deactivateProductsUnderCategories = async (categoryIds = []) => {
    const ids = (Array.isArray(categoryIds) ? categoryIds : [])
        .filter((id) => mongoose.isValidObjectId(id))
        .map(toObjectId);

    if (!ids.length) {
        return { productsDeactivated: 0 };
    }

    const result = await QuickProduct.updateMany(
        productsUnderCategories(ids),
        { $set: { ...DEACTIVATE }, $unset: { deactivatedByParentId: '' } },
    );

    return { productsDeactivated: result.modifiedCount || 0 };
};

/**
 * Bring back only what this category switched off, leaving anything an admin
 * deactivated individually untouched.
 */
export const cascadeCategoryReactivation = async (rootId) => {
    if (!mongoose.isValidObjectId(rootId)) {
        return { categoriesReactivated: 0, productsReactivated: 0 };
    }

    const root = toObjectId(rootId);
    const descendantIds = await collectDescendantCategoryIds(root);
    const restore = { $set: REACTIVATE, $unset: { deactivatedByParentId: '' } };

    const [categoryResult, productResult] = await Promise.all([
        descendantIds.length
            ? QuickCategory.updateMany(
                { _id: { $in: descendantIds }, deactivatedByParentId: root },
                restore,
            )
            : Promise.resolve({ modifiedCount: 0 }),
        QuickProduct.updateMany(
            { ...productsUnderCategories([root, ...descendantIds]), deactivatedByParentId: root },
            restore,
        ),
    ]);

    return {
        categoriesReactivated: categoryResult.modifiedCount || 0,
        productsReactivated: productResult.modifiedCount || 0,
    };
};
