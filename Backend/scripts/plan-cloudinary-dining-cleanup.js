/**
 * PHASE E — Cloudinary Dining cleanup plan
 *
 * DO NOT delete shared uploads (restaurant logos, food images, landing non-dining, etc.).
 *
 * Dining-only folders (from former dining banner / category upload paths):
 *   - food/dining-banners
 *   - appzeto/dining/categories
 *
 * This script prints the cleanup checklist. It does NOT call Cloudinary APIs
 * (avoids accidental mass delete of shared assets).
 *
 * Optional: set CLOUDINARY_* env and CONFIRM_CLOUDINARY=YES only if you later
 * extend this script with Admin API deletes — currently print-only by design.
 */

const FOLDERS = [
  {
    folder: 'food/dining-banners',
    source: 'diningBanner.service.js uploadImageBufferDetailed(..., "food/dining-banners")',
    risk: 'Dining hero/landing banners only',
  },
  {
    folder: 'appzeto/dining/categories',
    source: 'DiningManagement.jsx uploadAPI.uploadMedia(..., { folder: "appzeto/dining/categories" })',
    risk: 'Dining category images only',
  },
];

console.log('=== Cloudinary Dining cleanup plan (Phase E) ===');
console.log('');
console.log('Prerequisites:');
console.log('  1. Dining code removed and deployed');
console.log('  2. Mongo dining banner/category collections dropped or empty');
console.log('  3. Confirm no other product writes to these folders');
console.log('');
console.log('Folders to purge (Dining-only):');
for (const item of FOLDERS) {
  console.log(`  - ${item.folder}`);
  console.log(`      source: ${item.source}`);
  console.log(`      risk:   ${item.risk}`);
}
console.log('');
console.log('Suggested Cloudinary Admin / CLI approach:');
console.log('  1. Media Library → search prefix food/dining-banners');
console.log('  2. Media Library → search prefix appzeto/dining/categories');
console.log('  3. Review sample URLs still referenced in production DB (should be none)');
console.log('  4. Delete resources by prefix / folder');
console.log('');
console.log('DO NOT delete:');
console.log('  - food/restaurants, food/products, food/banners (non-dining)');
console.log('  - appzeto/* shared folders unrelated to dining');
console.log('  - user/restaurant/delivery profile media');
console.log('');
console.log('Status: PLAN ONLY — no Cloudinary API calls executed.');
