/**
 * Food restaurant identity contract (Option B).
 *
 * Inbound customer / cart / coupon APIs MAY send:
 *   - business code `restaurantId` (e.g. REST000001), OR
 *   - Mongo `_id` (backward compatible)
 *
 * After a single resolve at order entry:
 *   - `sourceId` / persisted `FoodOrder.restaurantId` = Mongo `_id` only
 *   - `businessRestaurantId` = REST###### (or empty)
 *   - Downstream services consume the normalized restaurant object and must
 *     not re-resolve by business code via findById.
 *
 * Authenticated restaurant-panel / admin ObjectId paths are unchanged
 * (JWT / admin UI already use Mongo `_id`).
 */
import mongoose from 'mongoose';
import { FoodRestaurant } from '../restaurant/models/restaurant.model.js';
import { resolveRestaurantCommissionPercentage } from '../constants/commission.constants.js';

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

export function isMongoObjectIdString(value) {
  const id = String(value || '').trim();
  return OBJECT_ID_RE.test(id) && mongoose.Types.ObjectId.isValid(id);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolve any inbound restaurant identifier to a Mongo ObjectId.
 * Does not load the full document.
 */
export async function resolveRestaurantObjectId(restaurantId) {
  if (!restaurantId) return null;
  const idStr = String(restaurantId).trim();
  if (!idStr) return null;

  if (isMongoObjectIdString(idStr)) {
    return new mongoose.Types.ObjectId(idStr);
  }

  const rest = await FoodRestaurant.findOne({
    restaurantId: { $regex: new RegExp(`^${escapeRegex(idStr)}$`, 'i') },
  })
    .select('_id restaurantId')
    .lean();

  return rest?._id ? new mongoose.Types.ObjectId(String(rest._id)) : null;
}

const IDENTITY_SELECT = [
  'restaurantId',
  'restaurantName',
  'name',
  'location',
  'addressLine1',
  'area',
  'city',
  'state',
  'zoneId',
  'status',
  'commissionPercentage',
  'quickDeliveryEnabled',
  'scheduleOrderEnabled',
  'isAcceptingOrders',
  'kitchenPrepMinutes',
  'profileImage',
].join(' ');

/**
 * Single DB resolve for an inbound restaurant key (business or Mongo id).
 * @returns {Promise<object|null>} lean FoodRestaurant doc
 */
export async function resolveRestaurantDocument(restaurantId) {
  if (!restaurantId) return null;
  const idStr = String(restaurantId).trim();
  if (!idStr) return null;

  if (isMongoObjectIdString(idStr)) {
    return FoodRestaurant.findById(idStr).select(IDENTITY_SELECT).lean();
  }

  return FoodRestaurant.findOne({
    restaurantId: { $regex: new RegExp(`^${escapeRegex(idStr)}$`, 'i') },
  })
    .select(IDENTITY_SELECT)
    .lean();
}

/**
 * Canonical pickup / order-entry restaurant shape.
 * `sourceId` is ALWAYS the Mongo `_id` string.
 */
export function toNormalizedFoodRestaurantSource(restaurant) {
  if (!restaurant?._id) return null;
  const mongoId = String(restaurant._id);
  const businessId = restaurant.restaurantId
    ? String(restaurant.restaurantId).toUpperCase()
    : '';

  return {
    type: 'food',
    /** Mongo _id — use for Order.restaurantId, findById, dispatch, sockets */
    sourceId: mongoId,
    _id: mongoId,
    /** Business code REST###### when present */
    businessRestaurantId: businessId || null,
    restaurantId: businessId || null,
    sourceName: restaurant.restaurantName || restaurant.name || 'Restaurant',
    status: restaurant.status,
    location: restaurant.location,
    zoneId: restaurant.zoneId || null,
    commissionPercentage: resolveRestaurantCommissionPercentage(
      restaurant.commissionPercentage,
    ),
    quickDeliveryEnabled: restaurant.quickDeliveryEnabled === true,
    scheduleOrderEnabled: restaurant.scheduleOrderEnabled !== false,
    isAcceptingOrders: restaurant.isAcceptingOrders !== false,
    /** Quick ETA kitchen prep only — never listing estimatedDeliveryTime*. */
    kitchenPrepMinutes:
      restaurant.kitchenPrepMinutes == null || restaurant.kitchenPrepMinutes === ''
        ? null
        : Number(restaurant.kitchenPrepMinutes),
    address:
      restaurant.location?.address ||
      restaurant.location?.formattedAddress ||
      restaurant.addressLine1 ||
      [restaurant.area, restaurant.city, restaurant.state].filter(Boolean).join(', '),
    profileImage: restaurant.profileImage,
  };
}

/**
 * After loading restaurants into sourceMap, rewrite food item sourceIds
 * from business codes to Mongo `_id` so every downstream step shares one id.
 */
export function canonicalizeFoodItemSourceIds(items = [], sourceMap = new Map()) {
  for (const item of items) {
    if (!item || item.type !== 'food') continue;
    const raw = String(item.sourceId || '').trim();
    if (!raw) continue;
    const source =
      sourceMap.get(raw) ||
      sourceMap.get(raw.toUpperCase()) ||
      sourceMap.get(raw.toLowerCase());
    if (source?.sourceId) {
      item.sourceId = String(source.sourceId);
      if (source.sourceName && !item.sourceName) {
        item.sourceName = source.sourceName;
      }
    }
  }
  return items;
}
