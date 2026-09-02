import mongoose from 'mongoose';
import { QuickCategory } from '../models/category.model.js';
import { QuickProduct } from '../models/product.model.js';

const getCollection = (name) => mongoose.connection?.db?.collection(name) || null;

// --- In-memory Cache ---
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = {
  settings: { data: null, expiry: 0 },
  categories: { data: null, expiry: 0 }
};

const isExpired = (expiry) => Date.now() > expiry;

export const clearContentCache = () => {
  cache.settings.expiry = 0;
  cache.categories.expiry = 0;
};

const toIdString = (value) => {
  if (!value) return null;
  if (typeof value === 'object' && value !== null) {
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
  }
  return String(value);
};

const normalizeStatusQuery = () => ({
  $and: [
    {
      $or: [
        { status: 'active' },
        { status: { $exists: false } },
        { isActive: true },
        { isActive: { $exists: false } },
      ],
    },
  ],
});

export const getQuickSettings = async () => {
  if (cache.settings.data && !isExpired(cache.settings.expiry)) {
    return cache.settings.data;
  }

  const collection = getCollection('quick_settings');
  if (!collection) return null;
  const data = await collection.findOne({}, { sort: { updatedAt: -1, createdAt: -1 } });
  
  cache.settings.data = data;
  cache.settings.expiry = Date.now() + CACHE_TTL;
  return data;
};

export const getQuickCoupons = async () => {
  const collection = getCollection('quick_coupons');
  if (!collection) return [];
  return collection.find(normalizeStatusQuery()).sort({ updatedAt: -1, createdAt: -1 }).toArray();
};

export const getQuickCategories = async (query = {}) => {
  if (!query.parentId && cache.categories.data && !isExpired(cache.categories.expiry)) {
    return cache.categories.data;
  }

  const filter = normalizeStatusQuery();

  if (query.parentId) {
    filter.$and.push({ parentId: query.parentId });
  }

  const categories = await QuickCategory.find(filter)
    .sort({ order: 1, name: 1 })
    .lean();

  if (!query.parentId) {
    cache.categories.data = categories;
    cache.categories.expiry = Date.now() + CACHE_TTL;
  }
  return categories;
};

