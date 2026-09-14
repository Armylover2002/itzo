import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const sourceUri = process.env.SRC_MONGO_URI || process.env.SOURCE_MONGO_URI;
const targetUri = process.env.TGT_MONGO_URI || process.env.TARGET_MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URI;
const replaceExistingCollections =
  String(process.env.REPLACE_EXISTING_COLLECTIONS || '').toLowerCase() === 'true';

if (!sourceUri) {
  throw new Error('Missing SRC_MONGO_URI (or SOURCE_MONGO_URI)');
}

if (!targetUri) {
  throw new Error('Missing target Mongo URI');
}

const COLLECTION_MAPPINGS = [
  { source: 'categories', target: 'quick_categories' },
  { source: 'products', target: 'quick_products' },
  { source: 'settings', target: 'quick_settings' },
  { source: 'heroconfigs', target: 'quick_hero_configs' },
  { source: 'offersections', target: 'quick_offer_sections' },
  { source: 'experiencesections', target: 'quick_experience_sections' },
  { source: 'offers', target: 'quick_offers' },
  { source: 'coupons', target: 'quick_coupons' },
  { source: 'faqs', target: 'quick_faqs', optional: true },
  { source: 'notifications', target: 'quick_notifications', optional: true },
  { source: 'reviews', target: 'quick_reviews', optional: true },
];

function sanitizeProduct(doc) {
  const next = { ...doc };
  delete next.sellerId;
  if (!Array.isArray(next.tags)) next.tags = [];
  next.tags = next.tags.filter(Boolean);
  if (!Array.isArray(next.galleryImages)) next.galleryImages = [];
  if (!Array.isArray(next.variants)) next.variants = [];
  next.image = next.mainImage || next.image || next.galleryImages[0] || '';
  next.mrp = Number(next.mrp || next.salePrice || next.price || 0);
  next.price = Number(next.price || 0);
  next.salePrice = Number(next.salePrice || 0);
  next.stock = Number(next.stock || 0);
  next.lowStockAlert = Number(next.lowStockAlert || 5);
  next.isActive = (next.status || 'active') === 'active';
  return next;
}

function sanitizeCategory(doc) {
  const next = { ...doc };
  next.image = next.image || '';
  next.type = next.type || 'header';
  next.status = next.status || 'active';
  next.isActive = next.status === 'active';
  next.accentColor = next.accentColor || next.headerColor || '#0c831f';
  next.headerColor = next.headerColor || next.accentColor || '#0c831f';
  next.description = next.description || '';
  next.iconId = next.iconId || '';
  next.adminCommission = Number(next.adminCommission || 0);
  next.gst = Number(next.gst || 0);
  next.handlingFees = Number(next.handlingFees || 0);
  next.sortOrder = Number(next.sortOrder || 0);
  return next;
}

function sanitizeDoc(mapping, doc) {
  if (mapping.target === 'quick_products') return sanitizeProduct(doc);
  if (mapping.target === 'quick_categories') return sanitizeCategory(doc);
  return { ...doc };
}

async function copyCollection(sourceDb, targetDb, mapping) {
  const sourceCollections = await sourceDb.listCollections({ name: mapping.source }, { nameOnly: true }).toArray();
  if (sourceCollections.length === 0) {
    if (mapping.optional) {
      return { ...mapping, count: 0, skipped: true };
    }
    throw new Error(`Source collection not found: ${mapping.source}`);
  }

  const sourceDocs = await sourceDb.collection(mapping.source).find({}).toArray();
  const targetCollection = targetDb.collection(mapping.target);

  if (sourceDocs.length === 0) {
    return { ...mapping, count: 0 };
  }

  const docs = sourceDocs.map((doc) => sanitizeDoc(mapping, doc));
  if (replaceExistingCollections) {
    await targetCollection.deleteMany({});
    await targetCollection.insertMany(docs, { ordered: false });
  } else {
    await targetCollection.bulkWrite(
      docs.map((doc) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }
  return { ...mapping, count: docs.length };
}

async function main() {
  const sourceConn = await mongoose.createConnection(sourceUri).asPromise();
  const targetConn = await mongoose.createConnection(targetUri).asPromise();

  try {
    const results = [];
    for (const mapping of COLLECTION_MAPPINGS) {
      const result = await copyCollection(sourceConn.db, targetConn.db, mapping);
      results.push(result);
      const prefix = result.skipped ? 'Skipped' : 'Copied';
      console.log(`${prefix} ${result.count} docs: ${mapping.source} -> ${mapping.target}`);
    }

    console.log('\nImport complete.');
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await sourceConn.close();
    await targetConn.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
