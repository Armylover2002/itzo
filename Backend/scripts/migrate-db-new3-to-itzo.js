// One-off data migration: copy ALL collections/documents from source DB into destination DB
// on the same MongoDB Atlas cluster.
//
// Behavior:
// - READ-ONLY on the source DB (no writes, no deletes there, ever).
// - INSERT-ONLY on the destination DB: existing documents/collections in the destination
//   are left untouched. Documents are inserted with insertMany({ ordered: false }); if a
//   document with the same _id already exists in the destination, that single document is
//   skipped (duplicate key error) and everything else still gets inserted. Safe to re-run.
// - Also recreates non-default indexes on the destination collections.
//
// Usage:
//   node scripts/migrate-db-new3-to-itzo.js
//
// Source/destination are hardcoded below per the requested migration
// (Blaze_new3 -> Blaze_itzo on the same cluster). Adjust SOURCE_URI/DEST_URI if needed.

import { MongoClient } from "mongodb";

const SOURCE_URI =
  "mongodb+srv://vishal211130cse_db_user:c6rLopYJBtPsK5go@blaze.fahlhq4.mongodb.net/Blaze_new3?appName=Blaze";
const DEST_URI =
  "mongodb+srv://vishal211130cse_db_user:c6rLopYJBtPsK5go@blaze.fahlhq4.mongodb.net/Blaze_itzo?appName=Blaze";

const BATCH_SIZE = 500;

function dbNameFromUri(uri) {
  const match = uri.match(/\.net\/([^/?]+)/);
  return match ? match[1] : "(unknown)";
}

async function migrateCollection(sourceDb, destDb, collectionName) {
  const sourceColl = sourceDb.collection(collectionName);
  const destColl = destDb.collection(collectionName);

  const totalDocs = await sourceColl.countDocuments();
  console.log(`\n[${collectionName}] source has ${totalDocs} document(s)`);

  let migrated = 0;
  let skippedDuplicates = 0;
  let batch = [];

  const cursor = sourceColl.find({});
  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= BATCH_SIZE) {
      const result = await insertBatch(destColl, batch);
      migrated += result.inserted;
      skippedDuplicates += result.skipped;
      batch = [];
    }
  }
  if (batch.length > 0) {
    const result = await insertBatch(destColl, batch);
    migrated += result.inserted;
    skippedDuplicates += result.skipped;
  }

  console.log(
    `[${collectionName}] inserted ${migrated}, skipped ${skippedDuplicates} already-existing (by _id)`
  );

  // Recreate non-default indexes on destination (ignore ones that already exist)
  const sourceIndexes = await sourceColl.indexes();
  const nonDefaultIndexes = sourceIndexes.filter((idx) => idx.name !== "_id_");
  for (const idx of nonDefaultIndexes) {
    const { key, name, ...options } = idx;
    try {
      await destColl.createIndex(key, { name, ...options });
    } catch (err) {
      console.warn(`[${collectionName}] could not create index "${name}": ${err.message}`);
    }
  }
  if (nonDefaultIndexes.length > 0) {
    console.log(`[${collectionName}] ensured ${nonDefaultIndexes.length} index(es)`);
  }
}

async function insertBatch(destColl, batch) {
  try {
    const result = await destColl.insertMany(batch, { ordered: false });
    return { inserted: result.insertedCount, skipped: batch.length - result.insertedCount };
  } catch (err) {
    // BulkWriteError: some docs may still have been inserted; duplicates are skipped.
    const insertedCount = err.result?.insertedCount ?? err.insertedDocs?.length ?? 0;
    const writeErrors = err.writeErrors || [];
    const nonDuplicateErrors = writeErrors.filter((we) => we.code !== 11000);
    if (nonDuplicateErrors.length > 0) {
      console.error(
        `  -> ${nonDuplicateErrors.length} non-duplicate insert error(s), e.g.: ${nonDuplicateErrors[0].errmsg}`
      );
    }
    return { inserted: insertedCount, skipped: batch.length - insertedCount };
  }
}

async function main() {
  console.log(`Source DB: ${dbNameFromUri(SOURCE_URI)}`);
  console.log(`Dest DB:   ${dbNameFromUri(DEST_URI)}`);

  const sourceClient = new MongoClient(SOURCE_URI);
  const destClient = new MongoClient(DEST_URI);

  try {
    await sourceClient.connect();
    await destClient.connect();
    console.log("Connected to both source and destination clusters.");

    const sourceDb = sourceClient.db();
    const destDb = destClient.db();

    const collections = await sourceDb.listCollections({}, { nameOnly: true }).toArray();
    const collectionNames = collections
      .map((c) => c.name)
      .filter((name) => !name.startsWith("system."));

    console.log(`Found ${collectionNames.length} collection(s) in source: ${collectionNames.join(", ")}`);

    for (const name of collectionNames) {
      await migrateCollection(sourceDb, destDb, name);
    }

    console.log("\nMigration complete. Source database was not modified.");
  } finally {
    await sourceClient.close();
    await destClient.close();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
