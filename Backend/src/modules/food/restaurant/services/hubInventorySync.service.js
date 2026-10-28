import { FoodRestaurant } from '../models/restaurant.model.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { createRestaurantFood, updateRestaurantFood } from './restaurantFood.service.js';
import { logger } from '../../../../utils/logger.js';

/**
 * Best-effort mirroring for "useMainHubInventory" outlets. Each outlet keeps its
 * own FoodItem documents (so order.service.js's existing
 * "item.restaurantId must equal the order's restaurantId" check never has to
 * change), and this just keeps those copies in sync with the hub's items by
 * reusing the normal createRestaurantFood/updateRestaurantFood functions —
 * same category resolution, same admin-approval workflow as any other item.
 *
 * Failures here are logged and swallowed: a sync hiccup must never block the
 * hub owner's own item save.
 */

const toFoodBody = (hubItem) => ({
  name: hubItem.name,
  description: hubItem.description,
  price: hubItem.price,
  otherPrice: hubItem.otherPrice,
  variants: hubItem.variants,
  image: hubItem.image,
  images: hubItem.images,
  foodType: hubItem.foodType,
  isAvailable: hubItem.isAvailable,
  preparationTime: hubItem.preparationTime,
  discountType: hubItem.discountType,
  discountAmount: hubItem.discountAmount,
  discount: hubItem.discount,
  isRecommended: hubItem.isRecommended,
  tags: hubItem.tags,
  nutrition: hubItem.nutrition,
  allergies: hubItem.allergies,
  availabilityTimeStart: hubItem.availabilityTimeStart,
  availabilityTimeEnd: hubItem.availabilityTimeEnd,
  originalPrice: hubItem.originalPrice,
  // Category is matched by name against the outlet's own/global categories —
  // if the outlet has no equivalent category yet, the sync for that one item
  // is skipped (logged) rather than failing the whole batch.
  categoryName: hubItem.categoryName,
});

const getSharedOutlets = async (hubRestaurantId) =>
  FoodRestaurant.find({
    parentRestaurantId: hubRestaurantId,
    useMainHubInventory: true,
    isActive: { $ne: false },
    isDeleted: { $ne: true },
  })
    .select('_id')
    .lean();

export const syncHubItemToOutlets = async (hubRestaurantId, hubItem) => {
  try {
    const outlets = await getSharedOutlets(hubRestaurantId);
    if (!outlets.length) return;

    const body = toFoodBody(hubItem);

    await Promise.all(
      outlets.map(async (outlet) => {
        try {
          const existingMirror = await FoodItem.findOne({
            hubSourceItemId: hubItem._id,
            restaurantId: outlet._id,
          }).select('_id');

          if (existingMirror) {
            await updateRestaurantFood(outlet._id, existingMirror._id, body);
          } else {
            const created = await createRestaurantFood(outlet._id, body);
            await FoodItem.updateOne({ _id: created._id }, { $set: { hubSourceItemId: hubItem._id } });
          }
        } catch (err) {
          logger.warn(
            `[hubInventorySync] failed to mirror item ${hubItem._id} to outlet ${outlet._id}: ${err.message}`,
          );
        }
      }),
    );
  } catch (err) {
    logger.warn(`[hubInventorySync] sync skipped for hub item ${hubItem?._id}: ${err.message}`);
  }
};

/** Full backfill — used once when an outlet's useMainHubInventory is turned on. */
export const backfillHubInventoryForOutlet = async (hubRestaurantId, outletId) => {
  try {
    const hubItems = await FoodItem.find({ restaurantId: hubRestaurantId, isDeleted: { $ne: true } }).lean();
    for (const hubItem of hubItems) {
      try {
        const existingMirror = await FoodItem.findOne({
          hubSourceItemId: hubItem._id,
          restaurantId: outletId,
        }).select('_id');
        if (existingMirror) continue;
        const created = await createRestaurantFood(outletId, toFoodBody(hubItem));
        await FoodItem.updateOne({ _id: created._id }, { $set: { hubSourceItemId: hubItem._id } });
      } catch (err) {
        logger.warn(
          `[hubInventorySync] backfill failed for item ${hubItem._id} -> outlet ${outletId}: ${err.message}`,
        );
      }
    }
  } catch (err) {
    logger.warn(`[hubInventorySync] backfill skipped for outlet ${outletId}: ${err.message}`);
  }
};
