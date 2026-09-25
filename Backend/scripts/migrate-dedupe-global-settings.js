/**
 * Dedupe common_global_settings (the single "global settings" doc, incl. module toggles).
 *
 * Root cause of "module toggle reverts on its own after 1-2 days": the collection had no
 * enforced singleton, and reads used findOne() with no filter/sort. If a race ever created
 * a second doc (e.g. two concurrent cold-start requests both doing findOne() -> null ->
 * create()), reads would non-deterministically alternate between the admin-edited doc and a
 * stale all-defaults doc (modules all `true`), making a saved toggle appear to "come back on".
 *
 * This keeps the most-recently-updated doc (the one the admin actually edited), re-inserts it
 * under the fixed _id "global" that the model now enforces, and deletes the rest.
 *
 * Usage:
 *   node scripts/migrate-dedupe-global-settings.js          # dry-run, reports only
 *   CONFIRM=YES node scripts/migrate-dedupe-global-settings.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const CONFIRM = String(process.env.CONFIRM || '').toUpperCase() === 'YES';
const mongoUrl = process.env.MONGODB_URL || process.env.MONGODB_URI || process.env.DATABASE_URL;

async function main() {
  if (!mongoUrl) {
    console.error('Missing MONGODB_URL / MONGODB_URI / DATABASE_URL');
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  const db = mongoose.connection.db;
  const coll = db.collection('common_global_settings');

  try {
    const docs = await coll.find({}).toArray();
    console.log(`Found ${docs.length} document(s) in common_global_settings`);
    docs.forEach((d) => {
      console.log(
        `  _id=${d._id} updatedAt=${d.updatedAt || 'n/a'} modules=${JSON.stringify(d.modules)}`
      );
    });

    if (docs.length <= 1) {
      const only = docs[0];
      if (only && String(only._id) !== 'global') {
        console.log(`Single doc found with _id=${only._id}, will rewrite as _id="global"`);
        if (CONFIRM) {
          await coll.insertOne({ ...only, _id: 'global' });
          await coll.deleteOne({ _id: only._id });
          console.log('Done.');
        }
      } else {
        console.log('Nothing to do.');
      }
      return;
    }

    const winner = docs
      .slice()
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0];
    console.log(`Keeping most-recently-updated doc _id=${winner._id} as the singleton "global" doc`);

    if (!CONFIRM) {
      console.log('Dry-run only. Re-run with CONFIRM=YES to apply.');
      return;
    }

    await coll.insertOne({ ...winner, _id: 'global' });
    const idsToDelete = docs.map((d) => d._id);
    await coll.deleteMany({ _id: { $in: idsToDelete } });
    console.log(`Deleted ${idsToDelete.length} old doc(s). Singleton "global" doc now in place.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
