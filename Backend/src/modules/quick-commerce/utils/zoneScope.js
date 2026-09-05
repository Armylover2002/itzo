import { Seller } from '../seller/models/seller.model.js';
import { QuickZone } from '../models/quick_zone.model.js';
import { isPointInZone } from '../../../utils/geo.js';

/**
 * Resolves which delivery zone a customer request belongs to — either the
 * explicit zoneId the client already knows, or (falling back) whichever
 * active zone's shape contains the given lat/lng.
 *
 * This is the single source of truth for zone resolution across the public
 * Quick Commerce endpoints (shops list, products, home feed, banners) so a
 * seller in one zone never leaks into another zone's browsing results.
 *
 * @returns {Promise<string|null>} the zone id, or null when it cannot be resolved
 */
export const resolveZoneId = async ({ zoneId, lat, lng } = {}) => {
  if (zoneId) return String(zoneId);

  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;

  const zones = await QuickZone.find({ isActive: true }).lean();
  const zone = zones.find((z) => isPointInZone(latNum, lngNum, z));
  return zone ? String(zone._id) : null;
};

/**
 * Seller ids operating in the given zone. Returns null (meaning "no zone
 * filter should be applied") when the zone itself couldn't be resolved —
 * callers should fail open rather than show an empty storefront when we
 * simply don't know the customer's location yet.
 */
export const getZoneSellerIds = async (resolvedZoneId) => {
  if (!resolvedZoneId) return null;

  const sellers = await Seller.find({
    'shopInfo.zoneId': resolvedZoneId,
    isActive: true,
    approved: true,
    isDeleted: { $ne: true },
  })
    .select('_id')
    .lean();

  return sellers.map((s) => s._id);
};

/**
 * Convenience wrapper: resolves the zone from the request's location params
 * and returns the seller ids scoped to it in one call.
 */
export const resolveZoneSellerIds = async ({ zoneId, lat, lng } = {}) => {
  const resolvedZoneId = await resolveZoneId({ zoneId, lat, lng });
  return getZoneSellerIds(resolvedZoneId);
};

/**
 * Merges a "seller must be in this zone (or be an admin-owned product with no
 * seller)" constraint into an existing Mongoose filter object, matching the
 * $or/$and shape already used across the QC product queries.
 */
export const applyZoneSellerScope = (filter, zoneSellerIds) => {
  if (!Array.isArray(zoneSellerIds)) return filter;

  const sellerOr = [
    { sellerId: { $in: zoneSellerIds } },
    { sellerId: { $exists: false } },
    { sellerId: null },
  ];

  if (filter.$and) {
    filter.$and.push({ $or: sellerOr });
  } else if (filter.$or) {
    // Preserve the existing $or by folding it into $and alongside the zone scope.
    filter.$and = [{ $or: filter.$or }, { $or: sellerOr }];
    delete filter.$or;
  } else {
    filter.$or = sellerOr;
  }

  return filter;
};
