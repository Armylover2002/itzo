/**
 * Shared Food Quick Delivery migration core (idempotent).
 *
 * Combines prior phase2 / phase2.1 / eta-v2 steps:
 * 1) Seed missing fee_settings.quickDelivery with full QUICK_DELIVERY_DEFAULTS
 * 2) Fill missing keys on existing quickDelivery objects (never overwrite set values)
 * 3) restaurant.quickDeliveryEnabled = false when field missing
 * 4) zone.quickDeliveryEnabled = false when field missing
 * 5) order.deliveryMode = 'basic' when field missing
 *
 * Does NOT touch estimatedDeliveryTime* or restaurant.kitchenPrepMinutes.
 */

import { QUICK_DELIVERY_DEFAULTS } from '../../src/modules/food/orders/utils/quickDeliveryConstants.js';

/** Keys that older migrations may have omitted; fill-only when null/undefined. */
const ENSURE_FEE_KEYS = [
  'enabled',
  'charge',
  'platformSharePct',
  'riderSharePct',
  /** Fill-only default 0 — never overwrite an existing restaurantSharePct. */
  'restaurantSharePct',
  'maxDistanceKm',
  'maxRadiusKm',
  'maxEtaMinutes',
  'defaultKitchenPrepMinutes',
  'etaBufferMinutes',
  'riderAssignmentMinutes',
  'pickupMinutes',
  'avgRiderSpeedKmh',
  'fallbackTravelMinutes',
  'minOrderValue',
  'dispatchStartRadiusKm',
  'dispatchTimeoutSec',
  'maxDispatchWaves',
  'slaCompensationPct',
  'slaCompensationMode',
];

/**
 * @param {import('mongodb').Db} db
 * @param {{ backfillOrderDeliveryMode?: boolean }} [options]
 */
export async function runFoodQuickDeliveryMigration(db, options = {}) {
  const backfillOrderDeliveryMode = options.backfillOrderDeliveryMode !== false;

  const feeCol = db.collection('food_fee_settings');
  const restCol = db.collection('food_restaurants');
  const zoneCol = db.collection('food_zones');

  // 1) Seed entirely missing quickDelivery
  const seedResult = await feeCol.updateMany(
    { $or: [{ quickDelivery: { $exists: false } }, { quickDelivery: null }] },
    {
      $set: {
        quickDelivery: { ...QUICK_DELIVERY_DEFAULTS, enabled: false },
      },
    },
  );

  // 2) Fill missing keys on existing objects (eta-v2 + any stale phase2 docs)
  const feeDocs = await feeCol.find({ quickDelivery: { $type: 'object' } }).toArray();
  let feeKeysFilled = 0;
  for (const doc of feeDocs) {
    const qd =
      doc.quickDelivery && typeof doc.quickDelivery === 'object'
        ? { ...doc.quickDelivery }
        : {};
    let changed = false;
    for (const key of ENSURE_FEE_KEYS) {
      if (qd[key] === undefined || qd[key] === null) {
        qd[key] = QUICK_DELIVERY_DEFAULTS[key];
        changed = true;
      }
    }
    if (changed) {
      await feeCol.updateOne({ _id: doc._id }, { $set: { quickDelivery: qd } });
      feeKeysFilled += 1;
    }
  }

  const restResult = await restCol.updateMany(
    { quickDeliveryEnabled: { $exists: false } },
    { $set: { quickDeliveryEnabled: false } },
  );

  const zoneResult = await zoneCol.updateMany(
    { quickDeliveryEnabled: { $exists: false } },
    { $set: { quickDeliveryEnabled: false } },
  );

  let ordersBackfilledBasic = 0;
  if (backfillOrderDeliveryMode) {
    const orderResult = await db.collection('food_orders').updateMany(
      { deliveryMode: { $exists: false } },
      { $set: { deliveryMode: 'basic' } },
    );
    ordersBackfilledBasic = orderResult.modifiedCount;
  }

  return {
    feeSettingsSeeded: seedResult.modifiedCount,
    feeSettingsKeysFilled: feeKeysFilled,
    feeSettingsScanned: feeDocs.length,
    restaurantsUpdated: restResult.modifiedCount,
    zonesUpdated: zoneResult.modifiedCount,
    ordersBackfilledBasic,
    note: 'Quick remains OFF until Global∧Restaurant∧Zone enabled; estimatedDeliveryTime* untouched; kitchenPrepMinutes not bulk-set',
  };
}
