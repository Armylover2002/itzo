import mongoose from 'mongoose';
import { QuickBanner } from '../models/banner.model.js';
import { QuickZone } from '../models/quick_zone.model.js';
import { isPointInZone } from '../../../utils/geo.js';

// --- In-memory Public Banner Cache ---
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const publicBannerCache = new Map();

export const clearBannerCache = () => {
  publicBannerCache.clear();
};

const isExpired = (entry) => !entry || Date.now() > entry.expiry;

/**
 * Normalizes input arrays of IDs (strings, ObjectId instances, or JSON strings).
 */
const normalizeIdArray = (val) => {
  if (!val) return [];
  let arr = val;
  if (typeof val === 'string') {
    try {
      arr = JSON.parse(val);
    } catch {
      arr = val.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(arr)) arr = [arr];
  return arr
    .map((item) => (item?._id ? String(item._id) : String(item).trim()))
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
};

/**
 * Formats banner for client response.
 */
const formatBanner = (banner) => {
  const now = new Date();
  const isDateActive =
    banner.isAlwaysActive ||
    ((!banner.startDate || new Date(banner.startDate) <= now) &&
      (!banner.endDate || new Date(banner.endDate) >= now));

  const isCurrentlyActive = banner.status === 'active' && isDateActive;

  let scheduleStatus = 'active';
  if (banner.status !== 'active') {
    scheduleStatus = 'inactive';
  } else if (banner.isAlwaysActive) {
    scheduleStatus = 'always_active';
  } else if (banner.startDate && new Date(banner.startDate) > now) {
    scheduleStatus = 'scheduled';
  } else if (banner.endDate && new Date(banner.endDate) < now) {
    scheduleStatus = 'expired';
  } else {
    scheduleStatus = 'active';
  }

  return {
    ...banner,
    id: banner._id,
    isCurrentlyActive,
    scheduleStatus,
  };
};

/**
 * Get banners for admin panel with filters and pagination.
 */
export const getAdminBanners = async ({
  status,
  zoneId,
  headerCategoryId,
  search,
  page = 1,
  limit = 50,
} = {}) => {
  const query = {};

  if (status && status !== 'all') {
    query.status = status;
  }

  if (zoneId && zoneId !== 'all') {
    query.$or = [
      { targetZoneType: 'all' },
      { zoneIds: new mongoose.Types.ObjectId(zoneId) },
    ];
  }

  if (headerCategoryId && headerCategoryId !== 'all') {
    const catCondition = {
      $or: [
        { targetCategoryType: 'all' },
        { headerCategoryIds: new mongoose.Types.ObjectId(headerCategoryId) },
      ],
    };
    if (query.$or) {
      query.$and = [{ $or: query.$or }, catCondition];
      delete query.$or;
    } else {
      query.$or = catCondition.$or;
    }
  }

  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    const searchCondition = { $or: [{ title: regex }, { subtitle: regex }] };
    if (query.$and) {
      query.$and.push(searchCondition);
    } else if (query.$or) {
      query.$and = [{ $or: query.$or }, searchCondition];
      delete query.$or;
    } else {
      query.$or = searchCondition.$or;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [rawBanners, total] = await Promise.all([
    QuickBanner.find(query)
      .populate('zoneIds', 'name')
      .populate('headerCategoryIds', 'name image accentColor')
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    QuickBanner.countDocuments(query),
  ]);

  const banners = rawBanners.map(formatBanner);

  // Summary counts for admin dashboard
  const allBanners = await QuickBanner.find({}).lean();
  const now = new Date();
  const stats = {
    total: allBanners.length,
    activeNow: 0,
    alwaysActive: 0,
    scheduled: 0,
    expired: 0,
    inactive: 0,
  };

  allBanners.forEach((b) => {
    if (b.status !== 'active') {
      stats.inactive += 1;
    } else if (b.isAlwaysActive) {
      stats.alwaysActive += 1;
      stats.activeNow += 1;
    } else if (b.startDate && new Date(b.startDate) > now) {
      stats.scheduled += 1;
    } else if (b.endDate && new Date(b.endDate) < now) {
      stats.expired += 1;
    } else {
      stats.activeNow += 1;
    }
  });

  return {
    banners,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
    stats,
  };
};

/**
 * Get banner by ID for admin.
 */
export const getAdminBannerById = async (id) => {
  const banner = await QuickBanner.findById(id)
    .populate('zoneIds', 'name')
    .populate('headerCategoryIds', 'name image accentColor')
    .lean();

  if (!banner) return null;
  return formatBanner(banner);
};

/**
 * Create new banner (Admin).
 */
export const createAdminBanner = async (payload = {}) => {
  const data = { ...payload };

  if (data.targetZoneType === 'specific') {
    data.zoneIds = normalizeIdArray(data.zoneIds);
  } else {
    data.targetZoneType = 'all';
    data.zoneIds = [];
  }

  if (data.targetCategoryType === 'specific') {
    data.headerCategoryIds = normalizeIdArray(data.headerCategoryIds);
  } else {
    data.targetCategoryType = 'all';
    data.headerCategoryIds = [];
  }

  data.isAlwaysActive =
    data.isAlwaysActive === true ||
    data.isAlwaysActive === 'true' ||
    data.isAlwaysActive === 1 ||
    data.isAlwaysActive === '1';

  if (!data.isAlwaysActive) {
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
  } else {
    data.startDate = null;
    data.endDate = null;
  }

  if (data.priority !== undefined) {
    data.priority = Number(data.priority) || 0;
  }

  const banner = await QuickBanner.create(data);
  clearBannerCache();

  return getAdminBannerById(banner._id);
};

/**
 * Update banner (Admin).
 */
export const updateAdminBanner = async (id, payload = {}) => {
  const data = { ...payload };

  if (data.targetZoneType !== undefined) {
    if (data.targetZoneType === 'specific') {
      data.zoneIds = normalizeIdArray(data.zoneIds);
    } else {
      data.targetZoneType = 'all';
      data.zoneIds = [];
    }
  } else if (data.zoneIds !== undefined) {
    data.zoneIds = normalizeIdArray(data.zoneIds);
  }

  if (data.targetCategoryType !== undefined) {
    if (data.targetCategoryType === 'specific') {
      data.headerCategoryIds = normalizeIdArray(data.headerCategoryIds);
    } else {
      data.targetCategoryType = 'all';
      data.headerCategoryIds = [];
    }
  } else if (data.headerCategoryIds !== undefined) {
    data.headerCategoryIds = normalizeIdArray(data.headerCategoryIds);
  }

  if (data.isAlwaysActive !== undefined) {
    data.isAlwaysActive =
      data.isAlwaysActive === true ||
      data.isAlwaysActive === 'true' ||
      data.isAlwaysActive === 1 ||
      data.isAlwaysActive === '1';

    if (data.isAlwaysActive) {
      data.startDate = null;
      data.endDate = null;
    }
  }

  if (!data.isAlwaysActive) {
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
  }

  if (data.priority !== undefined) {
    data.priority = Number(data.priority) || 0;
  }

  const updated = await QuickBanner.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true, runValidators: true }
  ).lean();

  clearBannerCache();

  if (!updated) return null;
  return getAdminBannerById(id);
};

/**
 * Toggle banner status (Admin).
 */
export const toggleAdminBannerStatus = async (id) => {
  const banner = await QuickBanner.findById(id);
  if (!banner) return null;

  banner.status = banner.status === 'active' ? 'inactive' : 'active';
  await banner.save();

  clearBannerCache();
  return getAdminBannerById(id);
};

/**
 * Delete banner (Admin).
 */
export const deleteAdminBanner = async (id) => {
  const deleted = await QuickBanner.findByIdAndDelete(id);
  clearBannerCache();
  return Boolean(deleted);
};

/**
 * Public helper to fetch active banners for customer storefront.
 */
export const getPublicQuickBanners = async ({
  zoneId = null,
  headerCategoryId = null,
  lat = null,
  lng = null,
} = {}) => {
  // 1. Resolve zone if coords are given but no zoneId
  let resolvedZoneId = zoneId;
  if (!resolvedZoneId && lat && lng) {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!isNaN(latNum) && !isNaN(lngNum)) {
      const zones = await QuickZone.find({ isActive: true }).lean();
      const userZone = zones.find((z) => isPointInZone(latNum, lngNum, z));
      if (userZone) {
        resolvedZoneId = String(userZone._id);
      }
    }
  }

  // 2. Cache key check
  const cacheKey = `${resolvedZoneId || 'all'}:${headerCategoryId || 'all'}`;
  const cached = publicBannerCache.get(cacheKey);
  if (cached && !isExpired(cached)) {
    return cached.data;
  }

  // 3. Build optimized query
  const now = new Date();

  const query = {
    status: 'active',
    $or: [
      { isAlwaysActive: true },
      {
        $and: [
          { $or: [{ startDate: { $lte: now } }, { startDate: { $exists: false } }, { startDate: null }] },
          { $or: [{ endDate: { $gte: now } }, { endDate: { $exists: false } }, { endDate: null }] },
        ],
      },
    ],
  };

  // Zone condition
  if (resolvedZoneId) {
    const zoneOid = mongoose.Types.ObjectId.isValid(resolvedZoneId)
      ? new mongoose.Types.ObjectId(resolvedZoneId)
      : null;

    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { targetZoneType: 'all' },
        ...(zoneOid ? [{ zoneIds: zoneOid }] : []),
      ],
    });
  } else {
    // If no zone detected, show global banners
    query.$and = query.$and || [];
    query.$and.push({ targetZoneType: 'all' });
  }

  // Category condition
  if (headerCategoryId && headerCategoryId !== 'all') {
    const catOid = mongoose.Types.ObjectId.isValid(headerCategoryId)
      ? new mongoose.Types.ObjectId(headerCategoryId)
      : null;

    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { targetCategoryType: 'all' },
        ...(catOid ? [{ headerCategoryIds: catOid }] : []),
      ],
    });
  }

  const rawBanners = await QuickBanner.find(query)
    .populate('zoneIds', 'name')
    .populate('headerCategoryIds', 'name image accentColor')
    .sort({ priority: -1, createdAt: -1 })
    .lean();

  const banners = rawBanners.map(formatBanner);

  // Save in cache
  publicBannerCache.set(cacheKey, {
    data: banners,
    expiry: Date.now() + CACHE_TTL,
  });

  return banners;
};
