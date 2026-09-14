/**
 * PHASE C — Dining module data cleanup (Mongo)
 *
 * DO NOT run automatically in CI/deploy.
 * Run manually AFTER code deploy that removes Dining routes/UI.
 *
 * Usage:
 *   # Dry-run (default) — reports counts only
 *   node scripts/migrate-remove-dining-module.js
 *
 *   # Apply changes
 *   CONFIRM=YES node scripts/migrate-remove-dining-module.js
 *
 * Safe fields only:
 *   - $unset diningSettings on food_restaurants
 *   - $unset showDining on food_landing_settings
 *   - scrub food::dining_management* keys from admin_roles.permissions
 *   - optional delete food_notifications where category === 'dining_request'
 *
 * NEVER touches:
 *   pureVegRestaurant, food orders, wallet, coupons, QC, Porter, delivery
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const CONFIRM = String(process.env.CONFIRM || '').toUpperCase() === 'YES';
const PURGE_DINING_NOTIFICATIONS =
  String(process.env.PURGE_DINING_NOTIFICATIONS || 'YES').toUpperCase() !== 'NO';

const mongoUrl =
  process.env.MONGODB_URL || process.env.MONGODB_URI || process.env.DATABASE_URL;

const DINING_RBAC_KEYS = [
  'food::dining_management',
  'food::dining_management::banners',
  'food::dining_management::list',
];

const summary = {
  dryRun: !CONFIRM,
  restaurantsUnset: 0,
  landingUnset: 0,
  rolesScrubbed: 0,
  notificationsDeleted: 0,
};

async function unsetDiningSettings(db) {
  const filter = { diningSettings: { $exists: true } };
  const count = await db.collection('food_restaurants').countDocuments(filter);
  console.log(`[restaurants] docs with diningSettings: ${count}`);
  if (!CONFIRM) return;
  if (!count) return;
  const result = await db.collection('food_restaurants').updateMany(filter, {
    $unset: { diningSettings: '' },
  });
  summary.restaurantsUnset = result.modifiedCount || 0;
  console.log(`[restaurants] unset diningSettings: ${summary.restaurantsUnset}`);
}

async function unsetShowDining(db) {
  const filter = { showDining: { $exists: true } };
  const count = await db.collection('food_landing_settings').countDocuments(filter);
  console.log(`[landing] docs with showDining: ${count}`);
  if (!CONFIRM) return;
  if (!count) return;
  const result = await db.collection('food_landing_settings').updateMany(filter, {
    $unset: { showDining: '' },
  });
  summary.landingUnset = result.modifiedCount || 0;
  console.log(`[landing] unset showDining: ${summary.landingUnset}`);
}

async function scrubDiningRbac(db) {
  const unsetDoc = {};
  for (const key of DINING_RBAC_KEYS) {
    unsetDoc[`permissions.${key}`] = '';
  }

  // Also catch any other food::dining_management::* keys present on roles
  const roles = await db
    .collection('admin_roles')
    .find({ permissions: { $exists: true } })
    .project({ roleName: 1, permissions: 1 })
    .toArray();

  let rolesWithDining = 0;
  for (const role of roles) {
    const perms = role.permissions || {};
    const keys = Object.keys(perms).filter(
      (k) =>
        k === 'food::dining_management' ||
        k.startsWith('food::dining_management::') ||
        k.includes('dining_management')
    );
    if (keys.length) {
      rolesWithDining += 1;
      console.log(
        `[rbac] role="${role.roleName}" dining keys: ${keys.join(', ')}`
      );
      if (CONFIRM) {
        const dynamicUnset = { ...unsetDoc };
        for (const k of keys) {
          dynamicUnset[`permissions.${k}`] = '';
        }
        await db.collection('admin_roles').updateOne(
          { _id: role._id },
          { $unset: dynamicUnset }
        );
        summary.rolesScrubbed += 1;
      }
    }
  }
  console.log(`[rbac] roles with dining permissions: ${rolesWithDining}`);
}

async function purgeDiningNotifications(db) {
  if (!PURGE_DINING_NOTIFICATIONS) {
    console.log('[notifications] skipped (PURGE_DINING_NOTIFICATIONS=NO)');
    return;
  }
  const filter = { category: 'dining_request' };
  const count = await db.collection('food_notifications').countDocuments(filter);
  console.log(`[notifications] category=dining_request: ${count}`);
  if (!CONFIRM) return;
  if (!count) return;
  const result = await db.collection('food_notifications').deleteMany(filter);
  summary.notificationsDeleted = result.deletedCount || 0;
  console.log(`[notifications] deleted: ${summary.notificationsDeleted}`);
}

async function main() {
  if (!mongoUrl) {
    console.error('Missing MONGODB_URL / MONGODB_URI / DATABASE_URL');
    process.exit(1);
  }

  console.log('=== Dining removal migration (Phase C) ===');
  console.log(`Mode: ${CONFIRM ? 'APPLY' : 'DRY-RUN (set CONFIRM=YES to apply)'}`);
  console.log(`Purge dining_request notifications: ${PURGE_DINING_NOTIFICATIONS}`);

  await mongoose.connect(mongoUrl);
  const db = mongoose.connection.db;

  try {
    await unsetDiningSettings(db);
    await unsetShowDining(db);
    await scrubDiningRbac(db);
    await purgeDiningNotifications(db);
  } finally {
    await mongoose.disconnect();
  }

  console.log('=== Summary ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log(
    'Next: Phase D drop collections ONLY after code + this migration are live.'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
