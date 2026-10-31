import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { ensureRestaurantWallet } from '../models/restaurantWallet.model.js';
import { ValidationError, NotFoundError, ConflictError } from '../../../../core/auth/errors.js';
import { config } from '../../../../config/env.js';
import { normalizeRestaurantLocation, haversineKm, parseGeoPoint } from '../../shared/geo.utils.js';
import {
  getRestaurantAvailableWithdrawalBalance,
  getRestaurantLifetimeOrderEarnings,
} from './restaurantFinance.service.js';
import { backfillHubInventoryForOutlet } from './hubInventorySync.service.js';

/**
 * Multi-outlet / franchise hub. An outlet is just another FoodRestaurant
 * document with parentRestaurantId pointing at the hub owner's own id — every
 * existing menu/order/wallet query keyed on restaurantId keeps working
 * unchanged for both the hub doc and each outlet doc.
 */

const assertOwnsHub = async (mainRestaurantId) => {
  const hub = await FoodRestaurant.findById(mainRestaurantId);
  if (!hub) throw new NotFoundError('Restaurant not found');
  if (hub.isDeleted === true || hub.accountStatus === 'deleted') {
    throw new ValidationError('Restaurant account is deleted/deactivated');
  }
  return hub;
};

export const listHubOutlets = async (mainRestaurantId) => {
  await assertOwnsHub(mainRestaurantId);
  return FoodRestaurant.find({ parentRestaurantId: mainRestaurantId })
    .select('restaurantId restaurantName outletLabel franchiseLoginId location useMainHubInventory isActive status createdAt')
    .sort({ createdAt: -1 })
    .lean();
};

export const createHubOutlet = async (mainRestaurantId, payload) => {
  const hub = await assertOwnsHub(mainRestaurantId);

  const { outletLabel, franchiseLoginId, password, location, useMainHubInventory } = payload || {};
  if (!outletLabel) throw new ValidationError('Outlet label is required');
  if (!franchiseLoginId) throw new ValidationError('Franchise login ID is required');
  if (!password || String(password).length < 6) {
    throw new ValidationError('Password must be at least 6 characters');
  }

  const existing = await FoodRestaurant.findOne({ franchiseLoginId: String(franchiseLoginId).trim() });
  if (existing) throw new ConflictError('This franchise login ID is already in use');

  const salt = await bcrypt.genSalt(config.bcryptSaltRounds);
  const franchisePasswordHash = await bcrypt.hash(String(password), salt);

  // Outlet inherits the hub's compliance docs/business profile — it's the same
  // legal business at a different address, not a separately-onboarded restaurant.
  const outlet = await FoodRestaurant.create({
    restaurantName: hub.restaurantName,
    ownerName: hub.ownerName,
    pureVegRestaurant: hub.pureVegRestaurant,
    businessType: hub.businessType,
    cuisines: hub.cuisines,
    panImage: hub.panImage,
    gstImage: hub.gstImage,
    fssaiImage: hub.fssaiImage,
    commissionPercentage: hub.commissionPercentage,
    parentRestaurantId: hub._id,
    outletLabel,
    franchiseLoginId: String(franchiseLoginId).trim(),
    franchisePasswordHash,
    useMainHubInventory: Boolean(useMainHubInventory),
    location: location ? normalizeRestaurantLocation(location) : undefined,
    zoneId: hub.zoneId,
    status: 'approved',
    wasEverApproved: true,
    approvedAt: new Date(),
    isListed: true,
    isActive: true,
  });

  await ensureRestaurantWallet(outlet._id);

  if (!hub.isMainHub) {
    hub.isMainHub = true;
    await hub.save();
  }

  if (outlet.useMainHubInventory) {
    backfillHubInventoryForOutlet(hub._id, outlet._id).catch(() => {});
    backfillHubInventoryForOutlet(hub._id, outlet._id).catch(() => { });
  }

  return outlet.toObject();
};

export const updateHubOutlet = async (mainRestaurantId, outletId, payload) => {
  await assertOwnsHub(mainRestaurantId);

  const outlet = await FoodRestaurant.findOne({ _id: outletId, parentRestaurantId: mainRestaurantId });
  if (!outlet) throw new NotFoundError('Outlet not found');

  const { outletLabel, password, location, useMainHubInventory, isActive } = payload || {};
  const sharingJustEnabled = useMainHubInventory === true && outlet.useMainHubInventory !== true;

  if (outletLabel !== undefined) outlet.outletLabel = outletLabel;
  if (useMainHubInventory !== undefined) outlet.useMainHubInventory = Boolean(useMainHubInventory);
  if (isActive !== undefined) outlet.isActive = Boolean(isActive);
  if (location) outlet.location = normalizeRestaurantLocation(location);
  if (password) {
    if (String(password).length < 6) throw new ValidationError('Password must be at least 6 characters');
    const salt = await bcrypt.genSalt(config.bcryptSaltRounds);
    outlet.franchisePasswordHash = await bcrypt.hash(String(password), salt);
  }

  await outlet.save();

  if (sharingJustEnabled) {
    backfillHubInventoryForOutlet(mainRestaurantId, outlet._id).catch(() => {});
    backfillHubInventoryForOutlet(mainRestaurantId, outlet._id).catch(() => { });
  }

  return outlet.toObject();
};

/**
 * Read-only rollup across the hub + all its outlets. Reuses the same
 * per-restaurant earnings helpers the normal /finance page already calls —
 * no change to how a single restaurant's own earnings are computed.
 */
export const getHubEarnings = async (mainRestaurantId) => {
  const hub = await assertOwnsHub(mainRestaurantId);
  const outlets = await FoodRestaurant.find({ parentRestaurantId: mainRestaurantId })
    .select('restaurantId restaurantName outletLabel')
    .lean();

  const targets = [
    { _id: hub._id, restaurantId: hub.restaurantId, restaurantName: hub.restaurantName, outletLabel: 'Main hub' },
    ...outlets,
  ];

  const rows = await Promise.all(
    targets.map(async (t) => {
      const [{ availableBalance }, lifetimeEarnings] = await Promise.all([
        getRestaurantAvailableWithdrawalBalance(t._id, { skipSelfHeal: true }),
        getRestaurantLifetimeOrderEarnings(t._id),
      ]);
      return {
        restaurantId: t._id,
        businessId: t.restaurantId,
        name: t.outletLabel || t.restaurantName,
        availableBalance,
        lifetimeEarnings,
      };
    })
  );

  return {
    outlets: rows,
    totals: {
      availableBalance: rows.reduce((sum, r) => sum + (Number(r.availableBalance) || 0), 0),
      lifetimeEarnings: rows.reduce((sum, r) => sum + (Number(r.lifetimeEarnings) || 0), 0),
    },
  };
};

/**
 * Pick the nearest active location (hub itself, or one of its outlets) for a
 * given user lat/lng. Used before cart/order creation so order.service.js
 * always receives a single, already-resolved restaurantId — no changes to the
 * order engine itself.
 */
export const resolveNearestOutlet = async (restaurantIdOrCode, lat, lng) => {
  const byCode = mongoose.isValidObjectId(restaurantIdOrCode)
    ? { _id: restaurantIdOrCode }
    : { restaurantId: restaurantIdOrCode };

  const target = await FoodRestaurant.findOne(byCode).lean();
  if (!target) throw new NotFoundError('Restaurant not found');

  // Not a hub (or itself a franchise outlet) — nothing to resolve, return as-is.
  if (!target.isMainHub) {
    return { restaurantId: target._id, businessId: target.restaurantId, matchedBy: 'self' };
    return {
      restaurantId: target._id,
      businessId: target.restaurantId,
      name: target.restaurantName,
      location: target.location,
      area: target.area || target.location?.area,
      city: target.city || target.location?.city,
      address: target.address || target.location?.address || target.location?.formattedAddress,
      matchedBy: 'self',
    };
  }

  const outlets = await FoodRestaurant.find({
    parentRestaurantId: target._id,
    isActive: { $ne: false },
    isDeleted: { $ne: true },
    status: 'approved',
  }).lean();

  const candidates = [target, ...outlets];
  const userPoint = parseGeoPoint({ latitude: lat, longitude: lng });

  if (!userPoint) {
    return { restaurantId: target._id, businessId: target.restaurantId, matchedBy: 'default-hub' };
    return {
      restaurantId: target._id,
      businessId: target.restaurantId,
      name: target.restaurantName,
      location: target.location,
      area: target.area || target.location?.area,
      city: target.city || target.location?.city,
      address: target.address || target.location?.address || target.location?.formattedAddress,
      matchedBy: 'default-hub',
    };
  }

  let best = null;
  for (const candidate of candidates) {
    const point = parseGeoPoint(candidate);
    if (!point) continue;
    const distanceKm = haversineKm(userPoint.lat, userPoint.lng, point.lat, point.lng);
    if (distanceKm === null) continue;
    if (!best || distanceKm < best.distanceKm) {
      best = { candidate, distanceKm };
    }
  }

  if (!best) {
    return { restaurantId: target._id, businessId: target.restaurantId, matchedBy: 'default-hub' };
    return {
      restaurantId: target._id,
      businessId: target.restaurantId,
      name: target.restaurantName,
      location: target.location,
      area: target.area || target.location?.area,
      city: target.city || target.location?.city,
      address: target.address || target.location?.address || target.location?.formattedAddress,
      matchedBy: 'default-hub',
    };
  }

  return {
    restaurantId: best.candidate._id,
    businessId: best.candidate.restaurantId,
    name: best.candidate.outletLabel || best.candidate.restaurantName,
    outletLabel: best.candidate.outletLabel,
    location: best.candidate.location,
    area: best.candidate.area || best.candidate.location?.area,
    city: best.candidate.city || best.candidate.location?.city,
    address: best.candidate.address || best.candidate.location?.address || best.candidate.location?.formattedAddress,
    distanceKm: Math.round(best.distanceKm * 100) / 100,
    matchedBy: String(best.candidate._id) === String(target._id) ? 'main-hub' : 'nearest-outlet',
  };
};

export const deleteHubOutlet = async (mainRestaurantId, outletId) => {
  await assertOwnsHub(mainRestaurantId);

  const outlet = await FoodRestaurant.findOne({ _id: outletId, parentRestaurantId: mainRestaurantId });
  if (!outlet) throw new NotFoundError('Outlet not found');

  outlet.isActive = false;
  outlet.isListed = false;
  outlet.accountStatus = 'deleted';
  outlet.isDeleted = true;
  await outlet.save();
  return { success: true };
};
