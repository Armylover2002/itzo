import mongoose from 'mongoose';
import { QuickCategory } from '../../models/category.model.js';
import { QuickProduct } from '../../models/product.model.js';
import { DEFAULT_RETURN_WINDOW_HOURS } from '../../utils/category.helpers.js';

/** Configurable percent bounds for Header Category Commission & GST. */
export const RATE_PERCENT_MIN = 0;
export const RATE_PERCENT_MAX = 100;

export function normalizePercent(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(RATE_PERCENT_MIN, Math.min(RATE_PERCENT_MAX, n));
}

export function computePercentAmount(baseAmount, ratePercent) {
  const safeBase = Math.max(0, Number(baseAmount) || 0);
  const rate = normalizePercent(ratePercent, 0);
  let amount = Math.round(safeBase * (rate / 100) * 100) / 100;
  return Math.max(0, Math.min(amount, safeBase));
}

const normalizeId = (value) => {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  const id = String(value).trim();
  return mongoose.Types.ObjectId.isValid(id) ? id : '';
};

const collectCategoryIdsFromProducts = (products = []) => {
  const ids = new Set();
  for (const product of products) {
    [product?.headerId, product?.categoryId, product?.subcategoryId].forEach((value) => {
      const id = normalizeId(value);
      if (id) ids.add(id);
    });
  }
  return [...ids];
};

/**
 * Load categories + ancestors needed to resolve Header Category rates.
 */
async function loadCategoryAncestryMap(seedIds = []) {
  const categoryMap = new Map();
  let pending = seedIds.filter(Boolean);

  while (pending.length) {
    const missing = pending.filter((id) => !categoryMap.has(id));
    if (!missing.length) break;

    const categories = await QuickCategory.find({ _id: { $in: missing } })
      .select('_id type parentId adminCommission gst handlingFees returnsEnabled returnWindowHours')
      .lean();

    const nextParents = [];
    for (const category of categories) {
      categoryMap.set(String(category._id), category);
      const parentId = normalizeId(category.parentId);
      if (parentId && !categoryMap.has(parentId)) {
        nextParents.push(parentId);
      }
    }
    pending = nextParents;
  }

  return categoryMap;
}

/**
 * Walk category ancestry and return the root-most header.
 * Mid-level nodes mistyped as `header` must not shadow the real Header Category GST/commission.
 */
export function resolveHeaderFromCategoryMap(startId, categoryMap) {
  let currentId = normalizeId(startId);
  const visited = new Set();
  let resolvedHeader = null;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const category = categoryMap.get(currentId);
    if (!category) break;
    const type = String(category.type || '').toLowerCase();
    const parentId = normalizeId(category.parentId);
    // Root nodes without an explicit type are treated as headers (legacy records).
    const isHeader = type === 'header' || (!type && !parentId);
    if (isHeader) {
      resolvedHeader = category;
    }
    currentId = parentId;
  }

  return resolvedHeader;
}

export function normalizeReturnWindowHours(value, fallback = DEFAULT_RETURN_WINDOW_HOURS) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(720, Math.max(1, Math.round(n)));
}

export function getProductHeaderRates(product, categoryMap) {
  const header =
    resolveHeaderFromCategoryMap(product?.headerId, categoryMap) ||
    resolveHeaderFromCategoryMap(product?.categoryId, categoryMap) ||
    resolveHeaderFromCategoryMap(product?.subcategoryId, categoryMap);

  return {
    headerId: header ? String(header._id) : null,
    commission: normalizePercent(header?.adminCommission, 0),
    gst: normalizePercent(header?.gst, 0),
    handlingFees: Math.max(0, Number(header?.handlingFees || 0) || 0),
    returnsEnabled: header ? header.returnsEnabled !== false : true,
    returnWindowHours: normalizeReturnWindowHours(header?.returnWindowHours),
  };
}

/**
 * Resolve Header Category commission/GST/return policy for a list of products.
 * @returns {Map<string, { headerId, commission, gst, handlingFees, returnsEnabled, returnWindowHours }>}
 */
export async function resolveHeaderRatesByProduct(products = []) {
  const ids = collectCategoryIdsFromProducts(products);
  const categoryMap = await loadCategoryAncestryMap(ids);
  const byProduct = new Map();

  for (const product of products) {
    const productId = normalizeId(product?._id || product?.id || product?.productId);
    if (!productId) continue;
    byProduct.set(productId, getProductHeaderRates(product, categoryMap));
  }

  return byProduct;
}

/**
 * Resolve header return policy for product ids (order items → header category).
 */
export async function resolveHeaderReturnPolicyByProductIds(productIds = []) {
  const ids = [...new Set((productIds || []).map(normalizeId).filter(Boolean))];
  if (!ids.length) return new Map();
  const products = await QuickProduct.find({ _id: { $in: ids } })
    .select('_id headerId categoryId subcategoryId')
    .lean();
  return resolveHeaderRatesByProduct(products);
}

async function ensureProductDocs(lineItems = [], products = []) {
  let productDocs = Array.isArray(products) ? products.filter(Boolean) : [];
  if (productDocs.length) return productDocs;

  const productIds = [
    ...new Set(
      (Array.isArray(lineItems) ? lineItems : [])
        .map((item) => normalizeId(item?.productId || item?.itemId || item?._id))
        .filter(Boolean),
    ),
  ];
  if (!productIds.length) return [];

  return QuickProduct.find({ _id: { $in: productIds } })
    .select('_id headerId categoryId subcategoryId')
    .lean();
}

/**
 * Line-item GST from Header Category GST % (single source of truth).
 */
export async function calculateHeaderGstAmount({
  products = [],
  items = [],
  subtotal = 0,
} = {}) {
  const productDocs = await ensureProductDocs(items, products);
  const rateByProduct = await resolveHeaderRatesByProduct(productDocs);

  if (Array.isArray(items) && items.length > 0) {
    const gst = items.reduce((sum, item) => {
      const productId = normalizeId(item?.productId || item?.itemId || item?._id);
      const rates = rateByProduct.get(productId) || { gst: 0 };
      const lineTotal =
        Number(item?.lineTotal) ||
        Math.max(0, Number(item?.price || 0) * Number(item?.quantity || 0));
      return sum + lineTotal * (rates.gst / 100);
    }, 0);
    return Math.round(gst);
  }

  // Fallback when only products + subtotal are available: use shared header GST if uniform.
  const rates = [...rateByProduct.values()];
  if (!rates.length) return 0;
  const uniqueGst = [...new Set(rates.map((r) => r.gst))];
  if (uniqueGst.length === 1) {
    return Math.round(Math.max(0, Number(subtotal) || 0) * (uniqueGst[0] / 100));
  }
  return 0;
}

/**
 * Line-item commission from Header Category Commission % (single source of truth).
 */
export async function getHeaderCommissionSnapshot(lineItems = [], products = []) {
  const safeItems = Array.isArray(lineItems) ? lineItems : [];
  const baseAmount = safeItems.reduce(
    (sum, item) =>
      sum +
      (Number(item?.lineTotal) ||
        Math.max(0, Number(item?.price || 0) * Number(item?.quantity || 0))),
    0,
  );

  const productDocs = await ensureProductDocs(safeItems, products);
  const rateByProduct = await resolveHeaderRatesByProduct(productDocs);

  let commissionAmount = 0;
  let weightedRateSum = 0;

  for (const item of safeItems) {
    const productId = normalizeId(item?.productId || item?.itemId || item?._id);
    const rates = rateByProduct.get(productId) || { commission: 0 };
    const lineTotal =
      Number(item?.lineTotal) ||
      Math.max(0, Number(item?.price || 0) * Number(item?.quantity || 0));
    commissionAmount += computePercentAmount(lineTotal, rates.commission);
    weightedRateSum += lineTotal * rates.commission;
  }

  commissionAmount = Math.round(commissionAmount * 100) / 100;
  commissionAmount = Math.max(0, Math.min(commissionAmount, baseAmount));

  const commissionValue =
    baseAmount > 0 ? Math.round((weightedRateSum / baseAmount) * 100) / 100 : 0;

  return {
    commissionAmount,
    commissionType: 'percentage',
    commissionValue,
    baseAmount,
  };
}
