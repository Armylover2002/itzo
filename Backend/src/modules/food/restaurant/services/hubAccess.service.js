import mongoose from 'mongoose';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../../../../core/auth/errors.js';

/**
 * Shared "who can this logged-in restaurant act for?" resolver.
 *
 * A franchise outlet is an ordinary FoodRestaurant doc whose parentRestaurantId
 * points at the hub owner. So:
 *  - hub owner  -> may act for itself AND every one of its outlets
 *  - outlet     -> may act ONLY for itself (never the hub, never a sibling)
 *  - standalone -> may act only for itself (old flow, unchanged)
 *
 * Everything else in the panel already keys off a single restaurantId, so each
 * caller just swaps its `restaurantId: X` filter for `restaurantId: { $in: ids }`
 * (or asks for one explicit outlet id) and nothing else has to change.
 */

const OUTLET_SELECT = 'restaurantId restaurantName outletLabel isActive status isDeleted parentRestaurantId isMainHub';

export const getHubScope = async (loginRestaurantId) => {
  if (!mongoose.Types.ObjectId.isValid(loginRestaurantId)) {
    throw new ValidationError('Invalid restaurant id');
  }

  const self = await FoodRestaurant.findById(loginRestaurantId).select(OUTLET_SELECT).lean();
  if (!self) throw new NotFoundError('Restaurant not found');

  const isOutlet = Boolean(self.parentRestaurantId);
  const outlets = isOutlet
    ? []
    : await FoodRestaurant.find({ parentRestaurantId: self._id, isDeleted: { $ne: true } })
        .select(OUTLET_SELECT)
        .sort({ createdAt: 1 })
        .lean();

  const members = [
    {
      restaurantId: String(self._id),
      businessId: self.restaurantId,
      name: isOutlet ? self.outletLabel || self.restaurantName : self.restaurantName,
      isMain: !isOutlet,
      isSelf: true,
    },
    ...outlets.map((outlet) => ({
      restaurantId: String(outlet._id),
      businessId: outlet.restaurantId,
      name: outlet.outletLabel || outlet.restaurantName,
      isMain: false,
      isSelf: false,
      isActive: outlet.isActive !== false,
    })),
  ];

  const labelMap = new Map(members.map((m) => [m.restaurantId, m]));

  return {
    self,
    isOutlet,
    isHubOwner: !isOutlet,
    hasOutlets: outlets.length > 0,
    outlets,
    members,
    scopeIds: members.map((m) => m.restaurantId),
    labelMap,
  };
};

/**
 * Which restaurantIds should a restaurant-panel read cover?
 *  outletId omitted / "all" -> the whole scope (hub sees itself + all outlets)
 *  outletId === "main"      -> the logged-in restaurant only
 *  outletId === <id>        -> that one id, only if it is inside the scope
 */
export const resolveScopeIds = async (loginRestaurantId, outletId) => {
  const scope = await getHubScope(loginRestaurantId);
  const requested = String(outletId || '').trim();

  if (!requested || requested === 'all') {
    return { scope, ids: scope.scopeIds };
  }
  if (requested === 'main' || requested === 'self') {
    return { scope, ids: [String(scope.self._id)] };
  }
  if (!scope.labelMap.has(requested)) {
    throw new ForbiddenError('This outlet does not belong to your restaurant');
  }
  return { scope, ids: [requested] };
};

/**
 * Hub owner acting on one specific outlet (switch session, withdraw-on-behalf).
 * Throws unless the caller is the hub owner of that outlet.
 */
export const assertCanActAsOutlet = async (loginRestaurantId, outletId) => {
  if (!mongoose.Types.ObjectId.isValid(outletId)) {
    throw new ValidationError('Invalid outlet id');
  }
  if (String(loginRestaurantId) === String(outletId)) {
    return FoodRestaurant.findById(outletId).lean();
  }

  const outlet = await FoodRestaurant.findOne({
    _id: outletId,
    parentRestaurantId: loginRestaurantId,
  }).lean();

  if (!outlet) throw new ForbiddenError('This outlet does not belong to your restaurant');
  if (outlet.isDeleted === true) throw new ValidationError('This outlet has been removed');

  return outlet;
};
