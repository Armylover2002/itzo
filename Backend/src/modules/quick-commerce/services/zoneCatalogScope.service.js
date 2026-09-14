import mongoose from 'mongoose';
import { Seller } from '../seller/models/seller.model.js';
import { detectQuickZoneForPoint } from './quick-zone-lookup.service.js';

export const ZONE_CATALOG_MESSAGES = {
  LOCATION_REQUIRED: 'Select your delivery location to see available products',
  OUT_OF_SERVICE: 'Services not available in your area',
  NO_PRODUCTS: 'Services not available in your area',
};

const APPROVED_SELLER_FILTER = {
  approvalStatus: 'approved',
  approved: { $ne: false },
  isDeleted: { $ne: true },
  accountStatus: { $ne: 'deleted' },
};

/**
 * Resolve the user's QC zone from lat/lng and the approved sellers in that zone.
 * Catalog endpoints use this to scope products to the active delivery zone only.
 */
export async function resolveZoneCatalogScope({ lat, lng } = {}) {
  // null/undefined must NOT become 0 via Number(null) — that maps to (0,0) ocean.
  if (lat == null || lng == null || lat === '' || lng === '') {
    return {
      status: 'LOCATION_REQUIRED',
      serviceAvailable: false,
      zoneId: null,
      zone: null,
      sellerIds: [],
      message: ZONE_CATALOG_MESSAGES.LOCATION_REQUIRED,
    };
  }

  const latNum = Number(lat);
  const lngNum = Number(lng);

  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return {
      status: 'LOCATION_REQUIRED',
      serviceAvailable: false,
      zoneId: null,
      zone: null,
      sellerIds: [],
      message: ZONE_CATALOG_MESSAGES.LOCATION_REQUIRED,
    };
  }

  const detection = await detectQuickZoneForPoint(latNum, lngNum);
  if (detection.status !== 'IN_SERVICE' || !detection.zoneId) {
    return {
      status: 'OUT_OF_SERVICE',
      serviceAvailable: false,
      zoneId: null,
      zone: null,
      sellerIds: [],
      message: ZONE_CATALOG_MESSAGES.OUT_OF_SERVICE,
    };
  }

  const zoneObjectId = mongoose.Types.ObjectId.isValid(String(detection.zoneId))
    ? new mongoose.Types.ObjectId(String(detection.zoneId))
    : null;

  if (!zoneObjectId) {
    return {
      status: 'OUT_OF_SERVICE',
      serviceAvailable: false,
      zoneId: null,
      zone: null,
      sellerIds: [],
      message: ZONE_CATALOG_MESSAGES.OUT_OF_SERVICE,
    };
  }

  const sellers = await Seller.find({
    ...APPROVED_SELLER_FILTER,
    'shopInfo.zoneId': zoneObjectId,
  })
    .select('_id')
    .lean();

  const sellerIds = sellers.map((seller) => seller._id).filter(Boolean);

  if (!sellerIds.length) {
    return {
      status: 'NO_PRODUCTS',
      serviceAvailable: false,
      zoneId: detection.zoneId,
      zone: detection.zone,
      sellerIds: [],
      message: ZONE_CATALOG_MESSAGES.NO_PRODUCTS,
    };
  }

  return {
    status: 'IN_SERVICE',
    serviceAvailable: true,
    zoneId: detection.zoneId,
    zone: detection.zone,
    sellerIds,
    message: null,
  };
}

export function buildZoneProductFilter(baseFilter = {}, sellerIds = []) {
  const ids = Array.isArray(sellerIds) ? sellerIds.filter(Boolean) : [];
  return {
    ...baseFilter,
    sellerId: ids.length ? { $in: ids } : { $in: [] },
  };
}

export function toZoneServiceMeta(scope = {}) {
  return {
    serviceAvailable: scope.serviceAvailable === true,
    serviceStatus: scope.status || 'OUT_OF_SERVICE',
    message: scope.message || null,
    zoneId: scope.zoneId || null,
    zoneName: scope.zone?.zoneName || scope.zone?.name || null,
  };
}

/** Keep only hydrated product docs whose seller is in the zone. */
export function filterProductsByZoneSellers(products = [], sellerIds = []) {
  const allowed = new Set((sellerIds || []).map((id) => String(id)));
  if (!allowed.size) return [];
  return (Array.isArray(products) ? products : []).filter((product) =>
    allowed.has(String(product?.sellerId || '')),
  );
}

/**
 * Scope experience / offer section product payloads without touching banners/categories.
 */
export function filterSectionsByZoneSellers(sections = [], sellerIds = []) {
  const allowed = new Set((sellerIds || []).map((id) => String(id)));
  if (!allowed.size) {
    return (Array.isArray(sections) ? sections : []).map((section) =>
      stripSectionProducts(section),
    );
  }

  return (Array.isArray(sections) ? sections : []).map((section) => {
    if (!section || typeof section !== 'object') return section;

    // Offer-section shape: productIds may already be hydrated product docs.
    if (Array.isArray(section.productIds)) {
      const nextProducts = section.productIds.filter((item) => {
        if (!item || typeof item !== 'object') return false;
        return allowed.has(String(item.sellerId || ''));
      });
      return { ...section, productIds: nextProducts };
    }

    if (section.displayType === 'products') {
      const config = section.config && typeof section.config === 'object' ? { ...section.config } : {};
      const productsCfg =
        config.products && typeof config.products === 'object' ? { ...config.products } : { ...config };
      const items = Array.isArray(productsCfg.items) ? productsCfg.items : [];
      const nextItems = items.filter((item) => allowed.has(String(item?.sellerId || '')));
      const nextProductIds = Array.isArray(productsCfg.productIds)
        ? productsCfg.productIds.filter((id) => {
            if (id && typeof id === 'object') {
              return allowed.has(String(id.sellerId || ''));
            }
            return nextItems.some((item) => String(item?._id || item?.id) === String(id));
          })
        : nextItems.map((item) => item._id || item.id).filter(Boolean);

      const nextProductsCfg = {
        ...productsCfg,
        items: nextItems,
        productIds: nextProductIds,
      };

      return {
        ...section,
        config: {
          ...config,
          products: nextProductsCfg,
        },
      };
    }

    return section;
  });
}

function stripSectionProducts(section) {
  if (!section || typeof section !== 'object') return section;
  if (Array.isArray(section.productIds)) {
    return { ...section, productIds: [] };
  }
  if (section.displayType === 'products') {
    const config = section.config && typeof section.config === 'object' ? { ...section.config } : {};
    const productsCfg =
      config.products && typeof config.products === 'object' ? { ...config.products } : {};
    return {
      ...section,
      config: {
        ...config,
        products: { ...productsCfg, items: [], productIds: [] },
      },
    };
  }
  return section;
}
