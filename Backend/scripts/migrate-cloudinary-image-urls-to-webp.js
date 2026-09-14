import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { getOptimizedCloudinaryImageUrl } from '../src/services/cloudinary.service.js';

dotenv.config();

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
const isDryRun = process.argv.includes('--dry-run');

const shouldRewriteCloudinaryImageUrl = (value) =>
  typeof value === 'string' &&
  value.includes('/res.cloudinary.com/') &&
  value.includes('/image/upload/');

const collectUrlUpdates = (value, currentPath = '') => {
  const updates = [];

  if (typeof value === 'string') {
    if (shouldRewriteCloudinaryImageUrl(value)) {
      const nextValue = getOptimizedCloudinaryImageUrl(value);
      if (nextValue !== value) {
        updates.push({ path: currentPath, from: value, to: nextValue });
      }
    }
    return updates;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const nextPath = currentPath ? `${currentPath}.${index}` : String(index);
      updates.push(...collectUrlUpdates(item, nextPath));
    });
    return updates;
  }

  if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof mongoose.Types.ObjectId)) {
    Object.entries(value).forEach(([key, nestedValue]) => {
      if (key === '_id') return;
      const nextPath = currentPath ? `${currentPath}.${key}` : key;
      updates.push(...collectUrlUpdates(nestedValue, nextPath));
    });
  }

  return updates;
};

const summarizeValue = (value) => {
  if (typeof value !== 'string') return '';
  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
};

const run = async () => {
  if (!uri) {
    throw new Error('Missing MONGO_URI / MONGODB_URI');
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const collections = await db
    .listCollections({}, { nameOnly: true })
    .toArray();

  const targetCollections = collections
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('system.'));

  let totalDocsScanned = 0;
  let totalDocsChanged = 0;
  let totalFieldsChanged = 0;

  for (const collectionName of targetCollections) {
    const collection = db.collection(collectionName);
    const cursor = collection.find({});

    let collectionDocsScanned = 0;
    let collectionDocsChanged = 0;
    let collectionFieldsChanged = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (!doc) continue;

      collectionDocsScanned += 1;
      totalDocsScanned += 1;

      const updates = collectUrlUpdates(doc).filter((entry) => entry.path);
      if (!updates.length) continue;

      const setPayload = Object.fromEntries(updates.map((entry) => [entry.path, entry.to]));

      if (!isDryRun) {
        await collection.updateOne({ _id: doc._id }, { $set: setPayload });
      }

      collectionDocsChanged += 1;
      totalDocsChanged += 1;
      collectionFieldsChanged += updates.length;
      totalFieldsChanged += updates.length;

      console.log(
        `[${isDryRun ? 'DRY-RUN' : 'UPDATED'}] ${collectionName} ${String(doc._id)} fields=${updates.length}`,
      );

      updates.slice(0, 5).forEach((entry) => {
        console.log(`  - ${entry.path}`);
        console.log(`    from: ${summarizeValue(entry.from)}`);
        console.log(`    to:   ${summarizeValue(entry.to)}`);
      });

      if (updates.length > 5) {
        console.log(`  ...and ${updates.length - 5} more field(s)`);
      }
    }

    if (collectionDocsChanged) {
      console.log(
        `[SUMMARY] ${collectionName}: scanned=${collectionDocsScanned}, changedDocs=${collectionDocsChanged}, changedFields=${collectionFieldsChanged}`,
      );
    }
  }

  console.log('');
  console.log(
    `${isDryRun ? 'Dry run complete' : 'Migration complete'}: scanned=${totalDocsScanned}, changedDocs=${totalDocsChanged}, changedFields=${totalFieldsChanged}`,
  );
};

run()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {}
  });
