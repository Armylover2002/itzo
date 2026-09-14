import mongoose from 'mongoose';
import { QuickCategory } from '../models/category.model.js';

export const VALID_BUSINESS_TYPES = ['quick_commerce', 'food', 'default'];
export const VALID_CATEGORY_TYPES = ['header', 'category', 'subcategory'];

/** Normalize seller/header businessType to snake_case keys. */
export const normalizeBusinessTypeKey = (value) =>
  String(value || 'quick_commerce')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

/**
 * Pharmacy has been retired: quick commerce sellers see every header category.
 * Kept as a function (rather than inlining `true`) so call sites don't need to change.
 */
export const headerMatchesSellerBusinessType = () => true;

/** Configurable bounds for Header Category Commission (%) and GST (%). */
export const COMMISSION_PERCENT_MIN = 0;
export const COMMISSION_PERCENT_MAX = 100;
export const GST_PERCENT_MIN = 0;
export const GST_PERCENT_MAX = 100;
/** Return window stored in hours (UI uses whole days). Max 30 days. */
export const RETURN_WINDOW_HOURS_MIN = 1;
export const RETURN_WINDOW_HOURS_MAX = 720;
export const DEFAULT_RETURN_WINDOW_HOURS = 72;

const PARENT_TYPE_BY_CHILD = {
  category: 'header',
  subcategory: 'category',
};

export const slugify = (value = '') =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

export const validateCategoryImageFile = (file) => {
  if (!file) return null;

  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 5 * 1024 * 1024;

  if (!allowedMimes.includes(file.mimetype)) {
    return 'Only JPEG, PNG, WebP, and GIF images are allowed';
  }
  if (file.size > maxSize) {
    return 'Image must be smaller than 5MB';
  }
  return null;
};

export const generateUniqueSlug = async (rawSlug, excludeId = null) => {
  const baseSlug = slugify(rawSlug);
  if (!baseSlug) return null;

  const buildQuery = (slug) => {
    const query = { slug };
    if (excludeId && mongoose.isValidObjectId(excludeId)) {
      query._id = { $ne: excludeId };
    }
    return query;
  };

  const exactMatch = await QuickCategory.findOne(buildQuery(baseSlug)).select('_id').lean();
  if (!exactMatch) return baseSlug;

  for (let counter = 2; counter <= 1000; counter += 1) {
    const candidate = `${baseSlug}-${counter}`;
    const exists = await QuickCategory.findOne(buildQuery(candidate)).select('_id').lean();
    if (!exists) return candidate;
  }

  throw new Error('Unable to generate a unique slug');
};

export const wouldCreateCircularParent = async (categoryId, newParentId) => {
  if (!categoryId || !newParentId) return false;

  let current = String(newParentId);
  const visited = new Set([String(categoryId)]);

  while (current) {
    if (visited.has(current)) return true;
    visited.add(current);

    const parent = await QuickCategory.findById(current).select('parentId').lean();
    if (!parent?.parentId) break;
    current = String(parent.parentId);
  }

  return false;
};

export const validateCategoryParent = async (type, parentId, categoryId = null) => {
  const normalizedType = String(type || 'header').toLowerCase();

  if (!VALID_CATEGORY_TYPES.includes(normalizedType)) {
    return { error: 'Invalid category type' };
  }

  if (normalizedType === 'header') {
    if (parentId && parentId !== 'null') {
      return { error: 'Header categories cannot have a parent' };
    }
    return { parentId: null, type: normalizedType };
  }

  const expectedParentType = PARENT_TYPE_BY_CHILD[normalizedType];
  if (!parentId || !mongoose.isValidObjectId(parentId)) {
    return { error: `${normalizedType} requires a valid parent category` };
  }

  const parent = await QuickCategory.findById(parentId).select('type').lean();
  if (!parent) {
    return { error: 'Parent category not found' };
  }

  if (parent.type !== expectedParentType) {
    return { error: `Parent must be a ${expectedParentType} category` };
  }

  if (categoryId && await wouldCreateCircularParent(categoryId, parentId)) {
    return { error: 'Cannot set parent: circular reference detected' };
  }

  return { parentId, type: normalizedType };
};

const parseOptionalPercent = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
};

export const parseReturnWindowHours = (returnWindowHours, returnWindowDays) => {
  if (returnWindowHours !== undefined && returnWindowHours !== null && returnWindowHours !== '') {
    const hours = Number(returnWindowHours);
    return Number.isFinite(hours) ? hours : NaN;
  }
  if (returnWindowDays !== undefined && returnWindowDays !== null && returnWindowDays !== '') {
    const days = Number(returnWindowDays);
    return Number.isFinite(days) ? Math.round(days * 24) : NaN;
  }
  return null;
};

export const validateCategoryFields = ({
  name,
  type,
  businessType,
  adminCommission,
  commission,
  gst,
  handlingFees,
  returnsEnabled,
  returnWindowHours,
  returnWindowDays,
  status,
  requireHeaderRates = false,
}) => {
  if (!name || !String(name).trim()) {
    return 'name is required';
  }

  const normalizedType = String(type || 'header').toLowerCase();
  if (!VALID_CATEGORY_TYPES.includes(normalizedType)) {
    return 'Invalid category type';
  }

  if (normalizedType === 'header' && businessType && !VALID_BUSINESS_TYPES.includes(businessType)) {
    return 'Invalid business type';
  }

  // Prefer explicit `commission` alias when provided; otherwise use adminCommission.
  const commissionRaw =
    commission !== undefined && commission !== null && commission !== ''
      ? commission
      : adminCommission;
  const commissionValue = parseOptionalPercent(commissionRaw);
  if (commissionRaw !== undefined && commissionRaw !== null && commissionRaw !== '') {
    if (
      !Number.isFinite(commissionValue) ||
      commissionValue < COMMISSION_PERCENT_MIN ||
      commissionValue > COMMISSION_PERCENT_MAX
    ) {
      return `Commission (%) must be a number between ${COMMISSION_PERCENT_MIN} and ${COMMISSION_PERCENT_MAX}`;
    }
  }

  const gstValue = parseOptionalPercent(gst);
  if (gst !== undefined && gst !== null && gst !== '') {
    if (
      !Number.isFinite(gstValue) ||
      gstValue < GST_PERCENT_MIN ||
      gstValue > GST_PERCENT_MAX
    ) {
      return `GST (%) must be a number between ${GST_PERCENT_MIN} and ${GST_PERCENT_MAX}`;
    }
  }

  if (normalizedType === 'header' && requireHeaderRates) {
    if (commissionRaw === undefined || commissionRaw === null || commissionRaw === '') {
      return 'Commission (%) is required for header categories';
    }
    if (gst === undefined || gst === null || gst === '') {
      return 'GST (%) is required for header categories';
    }
  }

  const fees = Number(handlingFees);
  if (handlingFees !== undefined && handlingFees !== '' && (!Number.isFinite(fees) || fees < 0)) {
    return 'handlingFees must be a non-negative number';
  }

  if (normalizedType === 'header') {
    if (returnsEnabled !== undefined && returnsEnabled !== null && returnsEnabled !== '') {
      const asStr = String(returnsEnabled).trim().toLowerCase();
      if (asStr !== 'true' && asStr !== 'false' && typeof returnsEnabled !== 'boolean') {
        return 'returnsEnabled must be true or false';
      }
    }

    const hasReturnWindowInput =
      (returnWindowHours !== undefined && returnWindowHours !== null && returnWindowHours !== '') ||
      (returnWindowDays !== undefined && returnWindowDays !== null && returnWindowDays !== '');
    if (hasReturnWindowInput) {
      const hours = parseReturnWindowHours(returnWindowHours, returnWindowDays);
      if (
        !Number.isFinite(hours) ||
        hours < RETURN_WINDOW_HOURS_MIN ||
        hours > RETURN_WINDOW_HOURS_MAX
      ) {
        return 'Return window must be between 1 and 30 days';
      }
    }
  }

  if (status && !['active', 'inactive'].includes(status)) {
    return 'status must be active or inactive';
  }

  return null;
};
