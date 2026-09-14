import { QuickProduct } from '../models/product.model.js';
import { QuickOrder } from '../models/order.model.js';
import { logger } from '../../../utils/logger.js';
import { matchProductVariant } from './variant.helpers.js';

export class InsufficientStockError extends Error {
  constructor(message = 'Some items are no longer available in stock') {
    super(message);
    this.name = 'InsufficientStockError';
    this.statusCode = 409;
  }
}

const recalculateParentStock = async (productId) => {
  // Atomic pipeline update: recompute the parent stock as the sum of variant
  // stocks (floored at 0) directly from the current document state. This is a
  // single round-trip and is race-free (no read-modify-write), so concurrent
  // stock adjustments to the same product can't clobber each other.
  await QuickProduct.updateOne(
    { _id: productId, variants: { $exists: true, $ne: [] } },
    [
      {
        $set: {
          stock: {
            $sum: {
              $map: {
                input: { $ifNull: ['$variants', []] },
                as: 'variant',
                in: { $max: [0, { $ifNull: ['$$variant.stock', 0] }] },
              },
            },
          },
        },
      },
    ],
  );
};

const applyVariantStockDelta = async (productId, variantName, delta) => {
  const filter = { _id: productId };
  const arrayFilters = [{ 'elem.name': variantName }];

  // Prevent oversell: only decrement when the variant has enough stock.
  if (delta < 0) {
    arrayFilters[0]['elem.stock'] = { $gte: Math.abs(delta) };
  }

  const result = await QuickProduct.updateOne(
    filter,
    { $inc: { 'variants.$[elem].stock': delta } },
    { arrayFilters },
  );

  if (result.modifiedCount > 0) return true;

  const product = await QuickProduct.findById(productId).select('variants').lean();
  const variant = matchProductVariant(product, { variantName });
  if (!variant?.name || variant.name === variantName) return false;

  const retryFilters = [{ 'elem.name': variant.name }];
  if (delta < 0) {
    retryFilters[0]['elem.stock'] = { $gte: Math.abs(delta) };
  }

  const retry = await QuickProduct.updateOne(
    { _id: productId },
    { $inc: { 'variants.$[elem].stock': delta } },
    { arrayFilters: retryFilters },
  );
  return retry.modifiedCount > 0;
};

/**
 * Adjust product/variant stock.
 * Decrements (delta < 0) throw InsufficientStockError on failure.
 * Restores (delta > 0) remain best-effort and return false on failure.
 */
export const adjustQuickProductStock = async (
  productId,
  quantity,
  { variantName = '', variantKey = '', variantSku = '' } = {},
) => {
  const delta = Number(quantity);
  if (!productId || !Number.isFinite(delta) || delta === 0) return true;

  const requireSuccess = delta < 0;
  const product = await QuickProduct.findById(productId).select('variants stock').lean();
  if (!product) {
    if (requireSuccess) {
      throw new InsufficientStockError(`Product ${productId} is unavailable`);
    }
    return false;
  }

  const variants = Array.isArray(product.variants) ? product.variants : [];

  if (variants.length > 0) {
    const variant = matchProductVariant(product, { variantName, variantKey, variantSku });
    if (!variant?.name) {
      const label = variantName || variantKey || variantSku || 'unknown';
      logger.warn(
        `[QuickStock] Variant not found for product ${productId} (${label})`,
      );
      if (requireSuccess) {
        throw new InsufficientStockError(
          `Selected variant is unavailable for product ${productId}`,
        );
      }
      return false;
    }

    const applied = await applyVariantStockDelta(productId, variant.name, delta);
    if (!applied) {
      logger.warn(
        `[QuickStock] Failed to adjust variant stock for product ${productId} (${variant.name})`,
      );
      if (requireSuccess) {
        throw new InsufficientStockError(
          `Insufficient stock for ${variant.name}`,
        );
      }
      return false;
    }

    await recalculateParentStock(productId);
    return true;
  }

  const parentFilter = { _id: productId };
  if (delta < 0) {
    parentFilter.stock = { $gte: Math.abs(delta) };
  }

  const result = await QuickProduct.updateOne(parentFilter, { $inc: { stock: delta } });
  if (result.modifiedCount === 0 && delta < 0) {
    logger.warn(`[QuickStock] Insufficient parent stock for product ${productId}`);
    throw new InsufficientStockError(`Insufficient stock for product ${productId}`);
  }
  return result.modifiedCount > 0 || delta > 0;
};

/**
 * Runs stock adjustments grouped by productId: items for the SAME product are
 * processed sequentially (preserving inc -> parent-recalc ordering per product),
 * while DIFFERENT products are processed in parallel. This removes the previous
 * fully-sequential N+1 (one item at a time) without introducing races between
 * variants of the same product.
 */
const runGroupedStockAdjustments = async (adjustments) => {
  const groups = new Map();
  for (const adjustment of adjustments) {
    if (!adjustment?.productId) continue;
    const key = String(adjustment.productId);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(adjustment);
  }

  await Promise.all(
    Array.from(groups.values()).map(async (group) => {
      for (const { productId, delta, options } of group) {
        await adjustQuickProductStock(productId, delta, options);
      }
    }),
  );
};

export const decrementQuickOrderItemsStock = async (items = []) => {
  const applied = [];

  try {
    for (const item of items) {
      const productId = item?.productId;
      const quantity = Number(item?.quantity || 0);
      if (!productId || !Number.isFinite(quantity) || quantity <= 0) continue;

      const options = {
        variantName: item.variantName || '',
        variantKey: item.variantKey || '',
        variantSku: item.variantSku || '',
      };

      await adjustQuickProductStock(productId, -quantity, options);
      applied.push({ productId, quantity, options });
    }
    await notifySellersOfInventoryChange(applied.map((entry) => entry.productId));
  } catch (error) {
    for (const entry of applied.reverse()) {
      try {
        await adjustQuickProductStock(entry.productId, entry.quantity, entry.options);
      } catch (rollbackErr) {
        logger.error(
          `[QuickStock] Rollback restore failed for product ${entry.productId}: ${
            rollbackErr?.message || rollbackErr
          }`,
        );
      }
    }
    throw error;
  }
};

export const restoreQuickOrderItemsStock = async (orderItems = []) => {
  const adjustments = orderItems.map((item) => ({
    productId: item.itemId || item.productId,
    delta: Number(item.quantity || 0),
    options: {
      variantName: item.variantName || item.notes || '',
      variantKey: item.variantKey || '',
      variantSku: item.variantSku || '',
    },
  }));
  await runGroupedStockAdjustments(adjustments);
  await notifySellersOfInventoryChange(adjustments.map((row) => row.productId));
};

const notifySellersOfInventoryChange = async (productIds = []) => {
  const ids = [...new Set((productIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return;
  try {
    const { syncSellerInventoryNotification } = await import(
      '../seller/services/sellerCatalog.service.js'
    );
    const products = await QuickProduct.find({ _id: { $in: ids } })
      .select('_id name stock lowStockAlert variants sellerId')
      .lean();
    await Promise.all(
      products.map((product) =>
        syncSellerInventoryNotification(product.sellerId, product).catch((error) => {
          logger.warn(
            `[QuickStock] Inventory notify failed for ${product._id}: ${error?.message || error}`,
          );
        }),
      ),
    );
  } catch (error) {
    logger.warn(`[QuickStock] Inventory notify skipped: ${error?.message || error}`);
  }
};

/**
 * Atomically claim inventory restore for a parent order.
 * Returns the updated order doc when this caller won the claim; null if already restored.
 */
export const claimQuickOrderStockRestore = async (orderId) => {
  if (!orderId) return null;
  return QuickOrder.findOneAndUpdate(
    {
      _id: orderId,
      $or: [{ stockRestoredAt: null }, { stockRestoredAt: { $exists: false } }],
    },
    { $set: { stockRestoredAt: new Date() } },
    { new: true },
  );
};

export const restoreQuickOrderStockOnce = async (order) => {
  if (!order?._id) return false;
  const claimed = await claimQuickOrderStockRestore(order._id);
  if (!claimed) return false;

  // Keep caller's document version in sync so a later .save() does not VersionError.
  if (order.$__ && claimed.__v != null) {
    order.$__.version = claimed.__v;
  }
  order.stockRestoredAt = claimed.stockRestoredAt;

  await restoreQuickOrderItemsStock(order.items || claimed.items || []);
  return true;
};

/**
 * Restore inventory for returned line items only (partial-return safe).
 * Idempotent via SellerReturn.finance.stockRestoredAt.
 */
export const restoreReturnItemsStockOnce = async (returnDoc) => {
  if (!returnDoc?._id) return false;

  const { SellerReturn } = await import('../seller/models/sellerReturn.model.js');
  const claimed = await SellerReturn.findOneAndUpdate(
    {
      _id: returnDoc._id,
      $or: [
        { 'finance.stockRestoredAt': null },
        { 'finance.stockRestoredAt': { $exists: false } },
      ],
    },
    { $set: { 'finance.stockRestoredAt': new Date() } },
    { new: true },
  );

  if (!claimed) return false;

  if (returnDoc.finance) {
    returnDoc.finance.stockRestoredAt = claimed.finance?.stockRestoredAt || new Date();
  }

  const rawItems = Array.isArray(claimed.returnItems)
    ? claimed.returnItems
    : Array.isArray(returnDoc.returnItems)
      ? returnDoc.returnItems
      : [];

  const stockItems = rawItems
    .map((item) => ({
      productId: item?.productId || item?.itemId,
      itemId: item?.productId || item?.itemId,
      quantity: Number(item?.returnedQty ?? item?.quantity ?? 0),
      variantName: item?.variantName || item?.variantId || item?.notes || '',
      variantKey: item?.variantKey || '',
      variantSku: item?.variantSku || '',
    }))
    .filter((item) => item.productId && Number(item.quantity) > 0);

  if (!stockItems.length) {
    logger.warn(
      `[QuickStock] Return ${returnDoc._id} claimed stock restore but had no restorable items`,
    );
    return true;
  }

  try {
    await restoreQuickOrderItemsStock(stockItems);
    logger.info(
      `[QuickStock] Restored stock for return ${returnDoc._id} (${stockItems.length} line(s))`,
    );
    return true;
  } catch (error) {
    // Allow retry on next refund/finance pass.
    await SellerReturn.updateOne(
      { _id: returnDoc._id },
      { $unset: { 'finance.stockRestoredAt': 1 } },
    );
    if (returnDoc.finance) returnDoc.finance.stockRestoredAt = null;
    logger.error(
      `[QuickStock] Return stock restore failed for ${returnDoc._id}: ${error?.message || error}`,
    );
    throw error;
  }
};
