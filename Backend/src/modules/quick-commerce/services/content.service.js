
import mongoose from 'mongoose';
import { QuickCategory } from '../models/category.model.js';
import { QuickProduct } from '../models/product.model.js';
import { QuickExperienceSection } from '../models/experience.model.js';
import { QuickHeroConfig } from '../models/heroConfig.model.js';
import { QuickHomeTile } from '../models/homeTile.model.js';
import {
  buildQuickCouponDateQuery,
  enrichQuickCoupon,
  isQuickCouponCurrentlyValid,
  isQuickCouponExpired,
  isQuickCouponNotStarted,
  normalizeCouponValidFrom,
  normalizeCouponValidTill,
  startOfDay,
} from '../utils/coupon.helpers.js';
import { validateAndNormalizeQuickCouponPayload } from '../utils/couponValidation.helpers.js';

const CATEGORY_SELECT_FIELDS = '_id name slug image status isActive type parentId iconId headerColor accentColor handlingFees adminCommission gst returnsEnabled returnWindowHours approvalStatus sortOrder businessType';
const PRODUCT_SELECT_FIELDS = '_id name slug mainImage image galleryImages categoryId subcategoryId headerId price salePrice mrp packingFee unit stock status isActive brand description tags variants pharmacyDetails deliveryTime rating badge approvalStatus sellerId';


const getCollection = (name) => mongoose.connection?.db?.collection(name) || null;

const toObjectId = (id) => {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  const str = String(id);
  if (!mongoose.Types.ObjectId.isValid(str)) return null;
  return new mongoose.Types.ObjectId(str);
};

// --- In-memory Cache ---
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
/** Shorter TTL for category rate fields (GST / commission) so admin edits apply quickly. */
const CATEGORY_CACHE_TTL = 30 * 1000;
const cache = {
  settings: { data: null, expiry: 0 },
  hero: { data: new Map(), expiry: 0 },
  experience: { data: new Map(), expiry: 0 },
  offerSections: { data: null, expiry: 0 },
  homeTiles: { data: null, expiry: 0 },
  categories: { data: null, treeInfo: null, expiry: 0 },
  coupons: { data: null, expiry: 0 },
  offers: { data: null, expiry: 0 },
};

const isExpired = (expiry) => Date.now() > expiry;

const buildCategoryTreeInfo = (allCategories = []) => {
  const childrenMap = new Map();
  allCategories.forEach((c) => {
    if (c.parentId) {
      const pid = String(c.parentId);
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid).push(c);
    }
  });

  const getRecursiveChildIds = (catId, seen = new Set()) => {
    const id = String(catId);
    if (seen.has(id)) return [];
    seen.add(id);
    let ids = [id];
    const children = childrenMap.get(id) || [];
    children.forEach((child) => {
      ids = [...ids, ...getRecursiveChildIds(child._id, seen)];
    });
    return ids;
  };

  return { allCategories, childrenMap, getRecursiveChildIds };
};

export const clearContentCache = () => {
  cache.settings.expiry = 0;
  cache.hero.data.clear();
  cache.experience.data.clear();
  cache.offerSections.expiry = 0;
  cache.homeTiles.expiry = 0;
  cache.homeTiles.data = null;
  cache.categories.data = null;
  cache.categories.treeInfo = null;
  cache.categories.expiry = 0;
  cache.coupons.data = null;
  cache.coupons.expiry = 0;
  cache.offers.data = null;
  cache.offers.expiry = 0;
};

const toIdString = (value) => {
  if (!value) return null;
  if (typeof value === 'object' && value !== null) {
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
  }
  return String(value);
};

const toIdList = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map(toIdString).filter(Boolean);
};

/**
 * Persist experience configs in a single nested shape:
 * { banners|categories|subcategories|products: { ... } }
 * Accepts older flat payloads from admin and normalizes them.
 */
export const normalizeExperienceConfig = (displayType, config = {}) => {
  const raw = config && typeof config === 'object' ? config : {};
  const nested = raw[displayType] && typeof raw[displayType] === 'object' ? raw[displayType] : null;

  if (displayType === 'banners') {
    const items = Array.isArray(nested?.items)
      ? nested.items
      : (Array.isArray(raw.banners?.items) ? raw.banners.items : (Array.isArray(raw.items) ? raw.items : []));
    return {
      banners: {
        items: items
          .filter((item) => item && (item.imageUrl || item.url))
          .map((item) => ({
            imageUrl: String(item.imageUrl || item.url || '').trim(),
            title: String(item.title || '').trim(),
            subtitle: String(item.subtitle || '').trim(),
            linkType: String(item.linkType || 'none').trim() || 'none',
            linkValue: String(item.linkValue || '').trim(),
            status: item.status === 'inactive' ? 'inactive' : 'active',
          })),
      },
    };
  }

  if (displayType === 'categories') {
    const source = nested || raw.categories || raw;
    return {
      categories: {
        maxItems: Math.max(1, Number(source.maxItems || source.maxCategories || 4) || 4),
        categoryIds: toIdList(source.categoryIds),
        rows: Math.max(1, Number(source.rows || 1) || 1),
      },
    };
  }

  if (displayType === 'subcategories') {
    const source = nested || raw.subcategories || raw;
    return {
      subcategories: {
        categoryIds: toIdList(source.categoryIds),
        subcategoryIds: toIdList(source.subcategoryIds),
        rows: Math.max(1, Number(source.rows || 1) || 1),
      },
    };
  }

  if (displayType === 'products') {
    const source = nested || raw.products || raw;
    const singleRowScrollable = Boolean(source.singleRowScrollable);
    return {
      products: {
        categoryIds: toIdList(source.categoryIds),
        subcategoryIds: toIdList(source.subcategoryIds),
        productIds: toIdList(source.productIds),
        rows: singleRowScrollable ? 1 : Math.max(1, Number(source.rows || 1) || 1),
        columns: Math.max(1, Number(source.columns || 2) || 2),
        singleRowScrollable,
      },
    };
  }

  return raw;
};

/**
 * A row is public only when neither flag switches it off. Both are matched with `$ne` so older
 * documents that carry just one of the two fields stay visible.
 *
 * Deactivating a category stamps both flags onto its whole subtree and its products
 * (see categoryCascade.service.js), so this one filter is what hides them everywhere.
 */
const VISIBLE_ROW_FILTER = {
  status: { $ne: 'inactive' },
  isActive: { $ne: false },
};

/** Same rule, wrapped in a single-element `$and` because callers push extra clauses onto it. */
const normalizeStatusQuery = () => ({
  $and: [{ ...VISIBLE_ROW_FILTER }],
});

const approvedOrLegacyFilter = {
  $and: [
    {
      $or: [
        { approvalStatus: 'approved' },
        { approvalStatus: { $exists: false } },
      ],
    },
  ],
};

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

export const getQuickHeroConfig = async ({ pageType = 'home', headerId = null } = {}) => {
  const cacheKey = `${pageType}:${headerId}`;
  if (cache.hero.data.has(cacheKey) && !isExpired(cache.hero.expiry)) {
    return cache.hero.data.get(cacheKey);
  }

  const collection = getCollection('quick_hero_configs');
  if (!collection) return null;

  const query = { pageType };
  if (pageType === 'header') {
    query.headerId = headerId ? String(headerId) : null;
  }

  const data = await QuickHeroConfig.findOne(query).sort({ updatedAt: -1, createdAt: -1 }).lean();
  
  cache.hero.data.set(cacheKey, data);
  cache.hero.expiry = Date.now() + CACHE_TTL;
  return data;
};

export const getAllQuickHeroConfigs = async () => {
  const collection = getCollection('quick_hero_configs');
  if (!collection) return [];
  return QuickHeroConfig.find({}).lean();
};

export const setQuickHeroConfig = async (data) => {
  const query = { pageType: data.pageType };
  if (data.pageType === 'header') {
    query.headerId = data.headerId ? String(data.headerId) : null;
  }

  const payload = { ...data };
  if (Array.isArray(data.categoryIds)) {
    const uniqueIds = [...new Set(data.categoryIds.map((id) => String(id)).filter(Boolean))];
    const validObjectIds = uniqueIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validObjectIds.length) {
      const existing = await QuickCategory.find({
        _id: { $in: validObjectIds },
        type: 'category',
        ...normalizeStatusQuery(),
      })
        .select('_id')
        .lean();
      const existingSet = new Set(existing.map((c) => String(c._id)));
      payload.categoryIds = validObjectIds.filter((id) => existingSet.has(id));
    } else {
      payload.categoryIds = [];
    }
  }

  const result = await QuickHeroConfig.findOneAndUpdate(
    query,
    { $set: payload },
    { upsert: true, new: true }
  ).lean();
  clearContentCache();
  return result;
};

export const pullCategoryIdFromHeroConfigs = async (categoryId) => {
  if (!categoryId) return;
  await QuickHeroConfig.updateMany(
    { categoryIds: categoryId },
    { $pull: { categoryIds: categoryId } }
  );
  clearContentCache();
};

export const getQuickExperienceSections = async ({ pageType = 'home', headerId = null, status = 'active' } = {}) => {
  const includeInactive = status === 'all' || status === 'inactive';
  const cacheKey = `${pageType}:${headerId}:${status || 'active'}`;
  if (cache.experience.data.has(cacheKey) && !isExpired(cache.experience.expiry)) {
    if (process.env.DEBUG_QUICK_EXPERIENCE === 'true') {
      const cached = cache.experience.data.get(cacheKey) || [];
      console.log('[quick-commerce] getQuickExperienceSections cache HIT', {
        cacheKey,
        pageType,
        headerId,
        headerIdType: typeof headerId,
        cachedCount: Array.isArray(cached) ? cached.length : 0,
        cachedIds: Array.isArray(cached) ? cached.map((s) => String(s?._id)) : [],
        cachedDisplayTypes: Array.isArray(cached) ? cached.map((s) => s?.displayType) : [],
      });
    }
    return cache.experience.data.get(cacheKey);
  }

  const collection = getCollection('quick_experience_sections');
  if (!collection) return [];

  const query = {};
  if (status === 'all') {
    // Admin list: no status filter
  } else if (status === 'inactive') {
    query.status = 'inactive';
  } else {
    Object.assign(query, normalizeStatusQuery());
  }

  if (pageType === 'header') {
    query.pageType = 'header';
    if (headerId) {
      const headerMatch = {
        $or: [
          { headerIds: headerId },
          { headerId },
        ],
      };
      query.$and = [...(query.$and || []), headerMatch];
    }
  } else if (includeInactive) {
    // Admin Home list: only native home sections (not header→All mirrors)
    query.pageType = 'home';
    query.$and = [
      ...(query.$and || []),
      {
        $and: [
          { $or: [{ headerId: null }, { headerId: { $exists: false } }] },
          {
            $or: [
              { headerIds: { $exists: false } },
              { headerIds: { $size: 0 } },
              { headerIds: null },
            ],
          },
        ],
      },
    ];
  } else {
    // Customer All / Home tab: home sections + header sections flagged for All
    query.$or = [
      {
        pageType: 'home',
        $and: [
          { $or: [{ headerId: null }, { headerId: { $exists: false } }] },
          {
            $or: [
              { headerIds: { $exists: false } },
              { headerIds: { $size: 0 } },
              { headerIds: null },
            ],
          },
        ],
      },
      { pageType: 'header', showOnAllTab: true },
    ];
  }

  if (process.env.DEBUG_QUICK_EXPERIENCE === 'true') {
    console.log('[quick-commerce] getQuickExperienceSections cache MISS', {
      cacheKey,
      pageType,
      headerId,
      headerIdType: typeof headerId,
      mongoQuery: query,
      includeInactive,
    });
  }

  const sections = await QuickExperienceSection.find(query).sort({ order: 1, createdAt: 1 }).lean();
  if (process.env.DEBUG_QUICK_EXPERIENCE === 'true') {
    console.log('[quick-commerce] getQuickExperienceSections raw mongo sections', {
      count: Array.isArray(sections) ? sections.length : 0,
      ids: Array.isArray(sections) ? sections.map((s) => String(s?._id)) : [],
      displayTypes: Array.isArray(sections) ? sections.map((s) => s?.displayType) : [],
      titles: Array.isArray(sections) ? sections.map((s) => s?.title) : [],
      headerIdValues: Array.isArray(sections) ? sections.map((s) => String(s?.headerId ?? '')) : [],
    });
  }
  if (!sections.length) {
    cache.experience.data.set(cacheKey, []);
    cache.experience.expiry = Date.now() + CACHE_TTL;
    return [];
  }

  // --- Category Tree Logic (Optimized) ---
  const getCategoryTreeInfo = async () => {
    if (cache.categories.data && !isExpired(cache.categories.expiry)) {
      if (cache.categories.treeInfo) {
        return cache.categories.treeInfo;
      }
      const treeInfo = buildCategoryTreeInfo(cache.categories.data);
      cache.categories.treeInfo = treeInfo;
      return treeInfo;
    }
    const allCategories = await QuickCategory.find(normalizeStatusQuery()).select(CATEGORY_SELECT_FIELDS).lean();
    const treeInfo = buildCategoryTreeInfo(allCategories);
    cache.categories.data = allCategories;
    cache.categories.treeInfo = treeInfo;
    cache.categories.expiry = Date.now() + CATEGORY_CACHE_TTL;
    return treeInfo;
  };

  const { getRecursiveChildIds } = await getCategoryTreeInfo();

  // Hydrate data
  const productIds = new Set();
  const categoryIds = new Set();
  const subcategoryIds = new Set();
  
  const dynamicProductCategoryIds = new Set();
  const dynamicProductSubcategoryIds = new Set();

  sections.forEach((section) => {
    const { config = {} } = section;
    const typeConfig = config[section.displayType] || config; // Handle both nested and flat
    
    // Banners
    const bannerItems = typeConfig.banners?.items || typeConfig.items || [];

    // Categories
    const catIds = typeConfig.categoryIds || [];
    catIds.forEach(id => {
      const nid = toIdString(id);
      if (nid) categoryIds.add(nid);
    });

    // Subcategories
    const subcatIds = typeConfig.subcategoryIds || [];
    subcatIds.forEach(id => {
      const nid = toIdString(id);
      if (nid) subcategoryIds.add(nid);
    });

    // Products
    const prodIds = typeConfig.productIds || [];
    prodIds.forEach(id => {
      const nid = toIdString(id);
      if (nid) productIds.add(nid);
    });

    // If products type and no explicit products, collect categories for dynamic fetch
    if (section.displayType === 'products' && (!prodIds || prodIds.length === 0)) {
       catIds.forEach(id => {
         const nid = toIdString(id);
         if (nid) {
            getRecursiveChildIds(nid).forEach(childId => dynamicProductCategoryIds.add(childId));
         }
       });
       subcatIds.forEach(id => {
         const nid = toIdString(id);
         if (nid) {
            getRecursiveChildIds(nid).forEach(childId => dynamicProductSubcategoryIds.add(childId));
         }
       });
    }
  });

  // Pre-fetch products for dynamic product sections
  if (query.pageType === 'header' && query.headerId) {
    const childCategories = (cache.categories.data || [])
      .filter(c => String(c.parentId) === String(query.headerId) && c.isActive !== false);
    
    childCategories.forEach(c => {
      const nid = toIdString(c._id);
      if (nid) {
        getRecursiveChildIds(nid).forEach(childId => dynamicProductCategoryIds.add(childId));
      }
    });
  }

  const [products, categories] = await Promise.all([
    (productIds.size || dynamicProductCategoryIds.size || dynamicProductSubcategoryIds.size)
      ? QuickProduct.find({ 
          $and: [
            { 
              $or: [
                { _id: { $in: Array.from(productIds) } },
                { categoryId: { $in: Array.from(dynamicProductCategoryIds) } },
                { subcategoryId: { $in: Array.from(dynamicProductSubcategoryIds) } },
                { headerId: { $in: Array.from(dynamicProductCategoryIds) } }
              ]
            },
            approvedOrLegacyFilter,
            VISIBLE_ROW_FILTER
          ]
        }).select(PRODUCT_SELECT_FIELDS).sort({ createdAt: -1 }).limit(500).lean()
      : Promise.resolve([]),
    (categoryIds.size || subcategoryIds.size)
      ? QuickCategory.find({
          _id: { $in: Array.from(new Set([...Array.from(categoryIds), ...Array.from(subcategoryIds)])) },
          ...VISIBLE_ROW_FILTER
        }).select(CATEGORY_SELECT_FIELDS).lean()
      : Promise.resolve([]),
  ]);

  const productsById = new Map(products.map((p) => [String(p._id), p]));
  const categoriesById = new Map(categories.map((c) => [String(c._id), c]));

  const finalSections = sections.map((section) => {
    const { config = {} } = section;
    const typeConfig = config[section.displayType] || config;
    const newConfig = { ...config };

    if (section.displayType === 'banners') {
      const target = config.banners ? { ...config.banners } : { items: Array.isArray(config.items) ? config.items : [] };
      if (!Array.isArray(target.items)) target.items = [];
      newConfig.banners = target;
    }

    if (section.displayType === 'categories') {
      const target = config.categories ? { ...config.categories } : { ...config };
      target.items = (target.categoryIds || [])
          .map(id => categoriesById.get(toIdString(id)))
          .filter(Boolean);
      
      newConfig.categories = target;
    }

    if (section.displayType === 'subcategories') {
      const target = config.subcategories ? { ...config.subcategories } : { ...config };
      target.items = (target.subcategoryIds || [])
          .map(id => categoriesById.get(toIdString(id)))
          .filter(Boolean);
      
      newConfig.subcategories = target;
    }

    if (section.displayType === 'products') {
      const target = config.products ? { ...config.products } : { ...config };
      const explicitItems = (target.productIds || [])
          .map(id => productsById.get(toIdString(id)))
          .filter(Boolean);
      
      if (explicitItems.length > 0) {
        target.items = explicitItems;
      } else {
        const sectionCatIds = new Set((target.categoryIds || []).map(toIdString).filter(Boolean));
        const sectionSubcatIds = new Set((target.subcategoryIds || []).map(toIdString).filter(Boolean));
        
        const expandedCatIds = new Set();
        sectionCatIds.forEach(id => getRecursiveChildIds(id).forEach(cid => expandedCatIds.add(cid)));
        const expandedSubcatIds = new Set();
        sectionSubcatIds.forEach(id => getRecursiveChildIds(id).forEach(cid => expandedSubcatIds.add(cid)));

        target.items = products.filter(p => 
          expandedCatIds.has(toIdString(p.categoryId)) || 
          expandedSubcatIds.has(toIdString(p.subcategoryId)) ||
          expandedCatIds.has(toIdString(p.headerId))
        ).slice(0, (target.rows || 1) * (target.columns || 4) || 20);
      }
      
      newConfig.products = target;
    }

    return {
      ...section,
      headerIds: (() => {
        const ids = Array.isArray(section.headerIds)
          ? section.headerIds.map(toIdString).filter(Boolean)
          : [];
        if (ids.length) return [...new Set(ids)];
        if (section.headerId) return [toIdString(section.headerId)].filter(Boolean);
        return [];
      })(),
      config: newConfig
    };
  });

  // No auto-generated / virtual fallback sections — only what admin configured.
  const augmentedSections = [...finalSections];

  if (process.env.DEBUG_QUICK_EXPERIENCE === 'true') {
    console.log('[quick-commerce] getQuickExperienceSections final sections (post-hydration)', {
      count: Array.isArray(augmentedSections) ? augmentedSections.length : 0,
      ids: Array.isArray(augmentedSections) ? augmentedSections.map((s) => String(s?._id)) : [],
      displayTypes: Array.isArray(augmentedSections) ? augmentedSections.map((s) => s?.displayType) : [],
      categoriesItemsCounts: Array.isArray(augmentedSections)
        ? augmentedSections.map((s) => (s?.displayType === 'categories' ? (s?.config?.categories?.items || []).length : null))
        : [],
      productsItemsCounts: Array.isArray(augmentedSections)
        ? augmentedSections.map((s) => (s?.displayType === 'products' ? (s?.config?.products?.items || []).length : null))
        : [],
    });
  }

  cache.experience.data.set(cacheKey, augmentedSections);
  cache.experience.expiry = Date.now() + CACHE_TTL;
  return augmentedSections;
};

const resolveExperienceHeaderIds = (data = {}) => {
  const fromArray = Array.isArray(data.headerIds) ? data.headerIds : [];
  const single = data.headerId ? [data.headerId] : [];
  const unique = [];
  const seen = new Set();
  [...fromArray, ...single].forEach((value) => {
    const id = toIdString(value);
    if (!id || seen.has(id)) return;
    seen.add(id);
    unique.push(id);
  });
  return unique;
};

export const createQuickExperienceSection = async (data = {}) => {
  let pageType = data.pageType === 'header' ? 'header' : 'home';
  const displayType = data.displayType;
  const showOnAllTab = !!data.showOnAllTab;
  let headerIds = pageType === 'header' ? resolveExperienceHeaderIds(data) : [];

  // All-tab only (no specific headers) → store as home section
  if (pageType === 'header' && !headerIds.length && showOnAllTab) {
    pageType = 'home';
    headerIds = [];
  }

  if (pageType === 'header' && !headerIds.length) {
    const err = new Error('Select at least one header category');
    err.statusCode = 400;
    throw err;
  }
  const headerId = headerIds[0] || null;

  const maxSection = await QuickExperienceSection.findOne({ pageType }).sort({ order: -1 });
  const order = (maxSection?.order ?? -1) + 1;

  return QuickExperienceSection.create({
    pageType,
    headerId,
    headerIds: pageType === 'header' ? headerIds : [],
    showOnAllTab: pageType === 'header' ? showOnAllTab : false,
    displayType,
    title: String(data.title || '').trim(),
    status: data.status === 'inactive' ? 'inactive' : 'active',
    config: normalizeExperienceConfig(displayType, data.config),
    order,
  });
};

export const updateQuickExperienceSection = async (id, data = {}) => {
  const existing = await QuickExperienceSection.findById(id).lean();
  if (!existing) return null;

  let pageType =
    data.pageType === 'header' || data.pageType === 'home'
      ? data.pageType
      : existing.pageType;
  const displayType = data.displayType || existing.displayType;

  let headerIds = Array.isArray(existing.headerIds)
    ? existing.headerIds.map(toIdString).filter(Boolean)
    : [];
  if (!headerIds.length && existing.headerId) {
    headerIds = [toIdString(existing.headerId)].filter(Boolean);
  }

  const showOnAllTab =
    data.showOnAllTab !== undefined ? !!data.showOnAllTab : !!existing.showOnAllTab;

  if (pageType === 'home') {
    headerIds = [];
  } else if (data.headerIds !== undefined || data.headerId !== undefined) {
    headerIds = resolveExperienceHeaderIds({
      headerIds: data.headerIds !== undefined ? data.headerIds : headerIds,
      headerId: data.headerId,
    });
  }

  // All-tab only → convert to home
  if (pageType === 'header' && !headerIds.length && showOnAllTab) {
    pageType = 'home';
  }

  if (pageType === 'header' && !headerIds.length) {
    const err = new Error('Select at least one header category');
    err.statusCode = 400;
    throw err;
  }

  const next = {
    ...(data.title !== undefined ? { title: String(data.title || '').trim() } : {}),
    ...(data.status !== undefined
      ? { status: data.status === 'inactive' ? 'inactive' : 'active' }
      : {}),
    pageType,
    headerId: pageType === 'header' ? (headerIds[0] || null) : null,
    headerIds: pageType === 'header' ? headerIds : [],
    showOnAllTab: pageType === 'header' ? showOnAllTab : false,
    displayType,
  };

  if (data.config !== undefined || data.displayType) {
    next.config = normalizeExperienceConfig(
      displayType,
      data.config !== undefined ? data.config : existing.config,
    );
  }

  return QuickExperienceSection.findByIdAndUpdate(id, { $set: next }, { new: true }).lean();
};

export const deleteQuickExperienceSection = async (id) => {
  return QuickExperienceSection.findByIdAndDelete(id);
};

export const reorderQuickExperienceSections = async (items = []) => {
  const list = Array.isArray(items) ? items : (Array.isArray(items?.items) ? items.items : []);
  const ops = list
    .filter((item) => item?.id && !String(item.id).startsWith('virtual_'))
    .map((item) => ({
      updateOne: {
        filter: { _id: item.id },
        update: { $set: { order: Number(item.order) || 0 } },
      },
    }));
  if (!ops.length) return;
  return QuickExperienceSection.bulkWrite(ops);
};

export const expireStaleQuickCoupons = async () => {
  const collection = getCollection('quick_coupons');
  if (!collection) return 0;

  const now = new Date();
  const today = startOfDay(now);
  const result = await collection.updateMany(
    {
      isActive: true,
      validTill: { $type: 'date', $lt: today },
    },
    { $set: { isActive: false, status: 'expired', updatedAt: now } },
  );

  return Number(result?.modifiedCount || 0);
};

export const getQuickCoupons = async () => {
  if (cache.coupons.data && !isExpired(cache.coupons.expiry)) {
    return cache.coupons.data;
  }

  const collection = getCollection('quick_coupons');
  if (!collection) return [];

  const coupons = await collection
    .find({
      $and: [
        normalizeStatusQuery().$and[0],
        buildQuickCouponDateQuery(),
      ],
    })
    .sort({ updatedAt: -1, createdAt: -1 })
    .toArray();

  const result = coupons
    .filter((coupon) => isQuickCouponCurrentlyValid(coupon))
    .map((coupon) => enrichQuickCoupon(coupon));

  cache.coupons.data = result;
  cache.coupons.expiry = Date.now() + CACHE_TTL;
  return result;
};

export const getAdminQuickCoupons = async (params = {}) => {
  const collection = getCollection('quick_coupons');
  if (!collection) return [];

  await expireStaleQuickCoupons();

  const filter = {};
  if (params.status && params.status !== 'all') {
    if (params.status === 'active') {
      filter.isActive = true;
    } else if (params.status === 'inactive') {
      filter.isActive = false;
    } else if (params.status === 'expired') {
      filter.$or = [{ status: 'expired' }, { isActive: false }];
    }
  }
  if (params.search) {
    filter.$or = [
      { code: { $regex: params.search, $options: 'i' } },
      { title: { $regex: params.search, $options: 'i' } },
      { description: { $regex: params.search, $options: 'i' } },
    ];
  }

  const coupons = await collection.find(filter).sort({ updatedAt: -1, createdAt: -1 }).toArray();
  const now = new Date();

  return coupons
    .map((coupon) => enrichQuickCoupon(coupon, now))
    .filter((coupon) => {
      if (params.status === 'active') return coupon.isEffectivelyActive;
      if (params.status === 'expired') return coupon.effectiveStatus === 'expired';
      if (params.status === 'inactive') {
        return coupon.effectiveStatus === 'inactive' || coupon.effectiveStatus === 'scheduled';
      }
      return true;
    });
};

export const createAdminQuickCoupon = async (data) => {
  const collection = getCollection('quick_coupons');
  if (!collection) throw new Error('Collection not found');

  let payload;
  try {
    payload = validateAndNormalizeQuickCouponPayload(data);
  } catch (err) {
    throw new Error(err?.message || 'Invalid coupon data');
  }

  const existing = await collection.findOne({ code: payload.code });
  if (existing) throw new Error('A coupon with this code already exists');

  const coupon = {
    ...payload,
    usedCount: 0,
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await collection.insertOne(coupon);
  clearContentCache();
  return { ...coupon, _id: result.insertedId };
};

export const updateAdminQuickCoupon = async (id, data) => {
  const collection = getCollection('quick_coupons');
  if (!collection) throw new Error('Collection not found');

  let payload;
  try {
    payload = validateAndNormalizeQuickCouponPayload(data);
  } catch (err) {
    throw new Error(err?.message || 'Invalid coupon data');
  }

  const { ObjectId } = mongoose.Types;
  const objId = ObjectId.isValid(id) ? new ObjectId(id) : null;
  if (!objId) throw new Error('Invalid coupon ID');

  const existing = await collection.findOne({ _id: objId });
  if (!existing) throw new Error('Coupon not found');

  const duplicate = await collection.findOne({
    code: payload.code,
    _id: { $ne: objId },
  });
  if (duplicate) throw new Error('A coupon with this code already exists');

  const update = {
    ...payload,
    updatedAt: new Date(),
  };

  // If dates were previously expired (or day-shifted), revive when the new window is valid.
  const merged = { ...existing, ...payload };
  if (
    String(existing.status || '').toLowerCase() === 'expired' &&
    !isQuickCouponExpired(merged) &&
    !isQuickCouponNotStarted(merged)
  ) {
    update.isActive = true;
    update.status = 'active';
  }

  const result = await collection.findOneAndUpdate(
    { _id: objId },
    { $set: update },
    { returnDocument: 'after' }
  );
  clearContentCache();
  return result;
};

export const deleteAdminQuickCoupon = async (id) => {
  const collection = getCollection('quick_coupons');
  if (!collection) throw new Error('Collection not found');

  const { ObjectId } = mongoose.Types;
  const objId = ObjectId.isValid(id) ? new ObjectId(id) : null;
  if (!objId) throw new Error('Invalid coupon ID');

  await collection.deleteOne({ _id: objId });
  clearContentCache();
  return true;
};

export const toggleAdminQuickCouponStatus = async (id) => {
  const collection = getCollection('quick_coupons');
  if (!collection) throw new Error('Collection not found');

  const { ObjectId } = mongoose.Types;
  const objId = ObjectId.isValid(id) ? new ObjectId(id) : null;
  if (!objId) throw new Error('Invalid coupon ID');

  const existing = await collection.findOne({ _id: objId });
  if (!existing) throw new Error('Coupon not found');

  if (isQuickCouponExpired(existing)) {
    throw new Error('Expired coupons cannot be reactivated. Update the validity dates first.');
  }

  const newStatus = !existing.isActive;
  await collection.updateOne({ _id: objId }, { $set: { isActive: newStatus, updatedAt: new Date() } });
  clearContentCache();
  return { ...existing, isActive: newStatus };
};

export const getQuickOffers = async () => {
  if (cache.offers.data && !isExpired(cache.offers.expiry)) {
    return cache.offers.data;
  }

  const collection = getCollection('quick_offers');
  if (!collection) return [];

  const result = await collection.find(normalizeStatusQuery()).sort({ updatedAt: -1, createdAt: -1 }).toArray();
  cache.offers.data = result;
  cache.offers.expiry = Date.now() + CACHE_TTL;
  return result;
};

export const getQuickOfferSections = async (query = {}) => {
  const status = query.status || 'active';
  const useSharedCache = status === 'active';

  if (useSharedCache && cache.offerSections.data && !isExpired(cache.offerSections.expiry)) {
    return cache.offerSections.data;
  }

  const collection = getCollection('quick_offer_sections');
  if (!collection) return [];

  let filter = {};
  if (status === 'all') {
    filter = {};
  } else if (status === 'inactive') {
    filter = { status: 'inactive' };
  } else {
    filter = normalizeStatusQuery();
  }

  const sections = await collection
    .find(filter)
    .sort({ order: 1, createdAt: 1 })
    .toArray();

  if (!sections.length) {
    if (useSharedCache) {
      cache.offerSections.data = [];
      cache.offerSections.expiry = Date.now() + CACHE_TTL;
    }
    return [];
  }

  const productIds = new Set();
  const categoryIds = new Set();

  sections.forEach((section) => {
    const rawProductIds = Array.isArray(section.productIds) ? section.productIds : [];
    rawProductIds.forEach((id) => {
      const normalized = toIdString(id);
      if (normalized) productIds.add(normalized);
    });

    const rawCategoryIds = Array.isArray(section.categoryIds)
      ? section.categoryIds
      : section.categoryId
        ? [section.categoryId]
        : [];

    rawCategoryIds.forEach((id) => {
      const normalized = toIdString(id);
      if (normalized) categoryIds.add(normalized);
    });
  });

  // Storefront reads must not hydrate rows a category deactivation switched off; unresolved ids
  // are dropped by the callers. Admin views ask for every status, so they hydrate unfiltered.
  const hydrationFilter = status === 'active' ? VISIBLE_ROW_FILTER : {};

  const [products, categories] = await Promise.all([
    productIds.size
      ? QuickProduct.find({ _id: { $in: Array.from(productIds) }, ...hydrationFilter }).select(PRODUCT_SELECT_FIELDS).lean()
      : Promise.resolve([]),
    categoryIds.size
      ? QuickCategory.find({ _id: { $in: Array.from(categoryIds) }, ...hydrationFilter }).select(CATEGORY_SELECT_FIELDS).lean()
      : Promise.resolve([]),
  ]);

  const productsById = new Map(products.map((product) => [String(product._id), product]));
  const categoriesById = new Map(categories.map((category) => [String(category._id), category]));

  const finalOfferSections = sections.map((section) => {
    const hydratedCategoryIds = (Array.isArray(section.categoryIds) ? section.categoryIds : [])
      .map((id) => categoriesById.get(toIdString(id)) || id);

    const hydratedCategory =
      categoriesById.get(toIdString(section.categoryId)) || section.categoryId || null;

    const hydratedProducts = (Array.isArray(section.productIds) ? section.productIds : [])
      .map((id) => productsById.get(toIdString(id)) || id);

    return {
      ...section,
      categoryId: hydratedCategory,
      categoryIds: hydratedCategoryIds,
      productIds: hydratedProducts,
    };
  });

  if (useSharedCache) {
    cache.offerSections.data = finalOfferSections;
    cache.offerSections.expiry = Date.now() + CACHE_TTL;
  }
  return finalOfferSections;
};

export const createQuickOfferSection = async (data) => {
  const collection = getCollection('quick_offer_sections');
  if (!collection) throw new Error('Collection not found');

  const section = {
    ...data,
    order: data.order ?? 0,
    status: data.status || 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await collection.insertOne(section);
  clearContentCache();
  return { ...section, _id: result.insertedId };
};

export const updateQuickOfferSection = async (id, data) => {
  const collection = getCollection('quick_offer_sections');
  if (!collection) throw new Error('Collection not found');

  const update = {
    ...data,
    updatedAt: new Date(),
  };
  delete update._id;

  const result = await collection.findOneAndUpdate(
    { _id: toObjectId(id) },
    { $set: update },
    { returnDocument: 'after' }
  );

  clearContentCache();
  return result;
};

export const deleteQuickOfferSection = async (id) => {
  const collection = getCollection('quick_offer_sections');
  if (!collection) throw new Error('Collection not found');

  await collection.deleteOne({ _id: toObjectId(id) });
  clearContentCache();
  return true;
};

export const reorderQuickOfferSections = async (items = []) => {
  const collection = getCollection('quick_offer_sections');
  if (!collection) throw new Error('Collection not found');

  const ops = items.map((item) => ({
    updateOne: {
      filter: { _id: toObjectId(item.id) },
      update: { $set: { order: item.order, updatedAt: new Date() } },
    },
  }));

  if (ops.length > 0) {
    await collection.bulkWrite(ops);
  }
  clearContentCache();
  return true;
};

const DEFAULT_HOME_HEADINGS = {
  fastFavHeading: 'Fast Fav',
  moreHeading: 'More',
};

export const getQuickHomeTiles = async (query = {}) => {
  const status = query.status || 'active';
  const sectionType = query.sectionType || null;
  const useSharedCache = status === 'active' && !sectionType;

  if (useSharedCache && cache.homeTiles.data && !isExpired(cache.homeTiles.expiry)) {
    return cache.homeTiles.data;
  }

  const filter = {};
  if (status === 'all') {
    // no status filter
  } else if (status === 'inactive') {
    filter.status = 'inactive';
  } else {
    filter.status = 'active';
  }
  if (sectionType === 'fast_fav' || sectionType === 'more') {
    filter.sectionType = sectionType;
  }

  const tiles = await QuickHomeTile.find(filter)
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  if (useSharedCache) {
    cache.homeTiles.data = tiles;
    cache.homeTiles.expiry = Date.now() + CACHE_TTL;
  }

  return tiles;
};

export const createQuickHomeTile = async (data) => {
  const sectionType = data.sectionType === 'more' ? 'more' : 'fast_fav';
  const label = String(data.label || '').trim();
  if (!label) throw new Error('Label is required');
  const imageUrl = String(data.imageUrl || '').trim();
  if (!imageUrl) throw new Error('Image is required');

  const last = await QuickHomeTile.findOne({ sectionType })
    .sort({ sortOrder: -1 })
    .select('sortOrder')
    .lean();

  const tile = await QuickHomeTile.create({
    sectionType,
    label,
    subtitle: String(data.subtitle || '').trim(),
    imageUrl,
    targetPath: String(data.targetPath || data.link || '').trim(),
    sortOrder: data.sortOrder ?? ((last?.sortOrder ?? -1) + 1),
    status: data.status === 'inactive' ? 'inactive' : 'active',
  });

  clearContentCache();
  return tile.toObject();
};

export const updateQuickHomeTile = async (id, data) => {
  const existing = await QuickHomeTile.findById(id);
  if (!existing) return null;

  if (data.sectionType === 'fast_fav' || data.sectionType === 'more') {
    existing.sectionType = data.sectionType;
  }
  if (data.label !== undefined) existing.label = String(data.label).trim();
  if (data.subtitle !== undefined) existing.subtitle = String(data.subtitle).trim();
  if (data.imageUrl !== undefined) existing.imageUrl = String(data.imageUrl).trim();
  if (data.targetPath !== undefined || data.link !== undefined) {
    existing.targetPath = String(data.targetPath ?? data.link ?? '').trim();
  }
  if (data.sortOrder !== undefined) existing.sortOrder = Number(data.sortOrder) || 0;
  if (data.status === 'active' || data.status === 'inactive') existing.status = data.status;

  await existing.save();
  clearContentCache();
  return existing.toObject();
};

export const deleteQuickHomeTile = async (id) => {
  const result = await QuickHomeTile.findByIdAndDelete(id);
  clearContentCache();
  return Boolean(result);
};

export const reorderQuickHomeTiles = async (items = []) => {
  const ops = (Array.isArray(items) ? items : [])
    .map((item) => {
      const _id = toObjectId(item.id || item._id);
      if (!_id) return null;
      return {
        updateOne: {
          filter: { _id },
          update: { $set: { sortOrder: Number(item.order ?? item.sortOrder) || 0 } },
        },
      };
    })
    .filter(Boolean);

  if (ops.length) await QuickHomeTile.bulkWrite(ops);
  clearContentCache();
  return true;
};

export const updateQuickHomeHeadings = async (payload = {}) => {
  const collection = getCollection('quick_settings');
  if (!collection) throw new Error('Settings collection not found');

  const update = { updatedAt: new Date() };
  if (payload.fastFavHeading !== undefined) {
    update.fastFavHeading = String(payload.fastFavHeading || '').trim() || DEFAULT_HOME_HEADINGS.fastFavHeading;
  }
  if (payload.moreHeading !== undefined) {
    update.moreHeading = String(payload.moreHeading || '').trim() || DEFAULT_HOME_HEADINGS.moreHeading;
  }

  const existing = await collection.findOne({}, { sort: { updatedAt: -1, createdAt: -1 } });
  let result;
  if (existing?._id) {
    result = await collection.findOneAndUpdate(
      { _id: existing._id },
      { $set: update },
      { returnDocument: 'after' },
    );
  } else {
    const doc = {
      ...DEFAULT_HOME_HEADINGS,
      ...update,
      createdAt: new Date(),
    };
    const inserted = await collection.insertOne(doc);
    result = { ...doc, _id: inserted.insertedId };
  }

  clearContentCache();
  return result;
};

export const getQuickHomeHeadings = async () => {
  const settings = await getQuickSettings();
  return {
    fastFavHeading: settings?.fastFavHeading || DEFAULT_HOME_HEADINGS.fastFavHeading,
    moreHeading: settings?.moreHeading || DEFAULT_HOME_HEADINGS.moreHeading,
  };
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
    .select(CATEGORY_SELECT_FIELDS)
    .sort({ sortOrder: 1, name: 1 })
    .sort({ order: 1, name: 1 })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  if (!query.parentId) {
    cache.categories.data = categories;
    cache.categories.treeInfo = buildCategoryTreeInfo(categories);
    cache.categories.expiry = Date.now() + CATEGORY_CACHE_TTL;
  }
  return categories;
};
