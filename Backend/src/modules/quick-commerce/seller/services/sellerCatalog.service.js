import mongoose from "mongoose";
import { QuickCategory } from "../../models/category.model.js";
import { SellerNotification } from "../models/sellerNotification.model.js";
import { computeNotificationExpiresAt } from "../../../../core/notifications/utils/notificationTtl.js";
import { headerMatchesSellerBusinessType } from "../../utils/category.helpers.js";

const categoryNode = (doc) => ({
  _id: doc._id,
  id: doc._id,
  name: doc.name,
  slug: doc.slug,
  type: doc.type || "header",
  ...(doc.type === "header" || !doc.parentId ? { businessType: doc.businessType || "quick_commerce" } : {}),
  parentId: doc.parentId || null,
  children: [],
});

const toObjectId = (value) => {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

/**
 * Both flags must be clear for a category to be selectable. Deactivating a category stamps this
 * pair onto its whole subtree (see categoryCascade.service.js), so checking the row is enough.
 */
const SELECTABLE_CATEGORY_FILTER = {
  isActive: { $ne: false },
  status: { $ne: "inactive" },
};

const assertHeaderAllowedForSeller = (header, sellerBusinessType) => {
  if (!sellerBusinessType) return;
  if (headerMatchesSellerBusinessType(header, sellerBusinessType)) return;
  const err = new Error("This header category is not available for your business type");
  err.statusCode = 400;
  throw err;
};

/** Read-only tree from DB — never auto-creates categories. Filtered by seller business type. */
export const buildSellerCategoryTree = async (sellerBusinessType = null) => {
  const docs = await QuickCategory.find({ ...SELECTABLE_CATEGORY_FILTER })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  const lookup = new Map();
  const roots = [];

  docs.forEach((doc) => {
    lookup.set(String(doc._id), categoryNode(doc));
  });

  docs.forEach((doc) => {
    const current = lookup.get(String(doc._id));
    if (doc.parentId && lookup.has(String(doc.parentId))) {
      lookup.get(String(doc.parentId)).children.push(current);
    } else {
      roots.push(current);
    }
  });

  if (!sellerBusinessType) return roots;

  return roots.filter((header) =>
    headerMatchesSellerBusinessType(header, sellerBusinessType),
  );
};

/** First active header → category → subcategory path already in DB (no inserts). */
export const getDefaultSellerCategoryPath = async (sellerBusinessType = null) => {
  const headers = await QuickCategory.find({ type: "header", ...SELECTABLE_CATEGORY_FILTER })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  const header = sellerBusinessType
    ? headers.find((row) => headerMatchesSellerBusinessType(row, sellerBusinessType))
    : headers[0];
  if (!header) return null;

  const category = await QuickCategory.findOne({
    parentId: header._id,
    type: "category",
    ...SELECTABLE_CATEGORY_FILTER,
  })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  const subcategory = category
    ? await QuickCategory.findOne({
        parentId: category._id,
        type: "subcategory",
        ...SELECTABLE_CATEGORY_FILTER,
      })
        .sort({ sortOrder: 1, createdAt: 1 })
        .lean()
    : null;

  return {
    headerId: header?._id || null,
    categoryId: category?._id || null,
    subcategoryId: subcategory?._id || category?._id || header?._id || null,
  };
};

export const resolveSellerCategoryIds = async ({
  headerId,
  categoryId,
  subcategoryId,
  allowDefaultFallback = true,
  sellerBusinessType = null,
}) => {
  const selectedIds = [headerId, categoryId, subcategoryId]
    .map((value) => toObjectId(value))
    .filter(Boolean);

  if (selectedIds.length >= 1) {
    // A deactivated category is treated as missing, so a stale picker or a hand-made request
    // cannot attach a product to a branch the admin has switched off.
    const docs = await QuickCategory.find({
      _id: { $in: selectedIds },
      ...SELECTABLE_CATEGORY_FILTER,
    }).lean();
    const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
    const selectedHeader = headerId ? byId.get(String(headerId)) : null;
    const selectedCategory = categoryId ? byId.get(String(categoryId)) : null;
    const selectedSubcategory = subcategoryId
      ? byId.get(String(subcategoryId))
      : null;

    // Reject IDs that were sent but not found / wrong type.
    if (headerId && !selectedHeader) {
      const err = new Error("Invalid header category");
      err.statusCode = 400;
      throw err;
    }
    if (categoryId && !selectedCategory) {
      const err = new Error("Invalid category");
      err.statusCode = 400;
      throw err;
    }
    if (subcategoryId && !selectedSubcategory) {
      const err = new Error("Invalid subcategory");
      err.statusCode = 400;
      throw err;
    }

    const category =
      selectedCategory?.type === "category"
        ? selectedCategory
        : selectedSubcategory?.type === "subcategory" &&
            selectedSubcategory.parentId
          ? await QuickCategory.findOne({
              _id: selectedSubcategory.parentId,
              type: "category",
              ...SELECTABLE_CATEGORY_FILTER,
            }).lean()
          : null;

    const header =
      selectedHeader?.type === "header"
        ? selectedHeader
        : category?.parentId
          ? await QuickCategory.findOne({
              _id: category.parentId,
              type: "header",
              ...SELECTABLE_CATEGORY_FILTER,
            }).lean()
          : null;

    const subcategory =
      selectedSubcategory?.type === "subcategory" ? selectedSubcategory : null;

    if (header) {
      assertHeaderAllowedForSeller(header, sellerBusinessType);
    }

    if (category && header && String(category.parentId) === String(header._id)) {
      if (
        subcategory &&
        String(subcategory.parentId) !== String(category._id)
      ) {
        const err = new Error("Subcategory does not belong to the selected category");
        err.statusCode = 400;
        throw err;
      }
      return {
        headerId: header._id,
        categoryId: category._id,
        subcategoryId: subcategory ? subcategory._id : null,
      };
    }

    if (
      selectedHeader?.type === "header" &&
      !selectedCategory &&
      !selectedSubcategory
    ) {
      const fallback = await getDefaultSellerCategoryPath(sellerBusinessType);
      return {
        headerId: selectedHeader._id,
        categoryId: fallback?.categoryId || null,
        subcategoryId: fallback?.subcategoryId || null,
      };
    }

    const err = new Error("Invalid category hierarchy");
    err.statusCode = 400;
    throw err;
  }

  if (!allowDefaultFallback) {
    const err = new Error("Category selection is required");
    err.statusCode = 400;
    throw err;
  }

  return getDefaultSellerCategoryPath(sellerBusinessType);
};

const effectiveProductStock = (product) => {
  const variantSum = (Array.isArray(product?.variants) ? product.variants : []).reduce(
    (sum, variant) => sum + Math.max(0, Number(variant?.stock || 0)),
    0,
  );
  const parentStock = Math.max(0, Number(product?.stock || 0));
  return Math.max(parentStock, variantSum);
};

const notificationPayloadForProduct = (product) => {
  if (!product?._id) return null;

  const stock = effectiveProductStock(product);
  const threshold = Number(product.lowStockAlert || 5);

  if (stock <= 0) {
    return {
      key: `inventory:${product._id}:out`,
      type: "inventory",
      title: `Out of stock: ${product.name}`,
      message: `${product.name} is unavailable until you restock it.`,
      metadata: { productId: String(product._id), stock },
    };
  }

  if (stock <= threshold) {
    return {
      key: `inventory:${product._id}:low`,
      type: "inventory",
      title: `Low stock: ${product.name}`,
      message: `Only ${stock} unit(s) are left for ${product.name}.`,
      metadata: { productId: String(product._id), stock },
    };
  }

  return null;
};

export const syncSellerInventoryNotification = async (sellerId, product) => {
  if (!sellerId || !product?._id) return;

  const staleKeys = [
    `inventory:${product._id}:low`,
    `inventory:${product._id}:out`,
  ];

  const nextNotification = notificationPayloadForProduct(product);

  if (!nextNotification) {
    await SellerNotification.deleteMany({
      sellerId,
      key: { $in: staleKeys },
    });
    return;
  }

  await SellerNotification.deleteMany({
    sellerId,
    key: { $in: staleKeys.filter((key) => key !== nextNotification.key) },
  });

  // Route through upsert helper so seller also gets FCM push
  const { upsertSellerNotification } = await import('./sellerNotify.service.js');
  await upsertSellerNotification(sellerId, {
    key: nextNotification.key,
    type: nextNotification.type || 'inventory',
    title: nextNotification.title,
    message: nextNotification.message,
    link: '/seller/inventory',
    metadata: nextNotification.metadata || {},
  });
};
