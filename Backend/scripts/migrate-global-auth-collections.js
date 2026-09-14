import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const mongoUrl = process.env.MONGODB_URL || process.env.MONGODB_URI || process.env.DATABASE_URL;

const migrations = [
    { label: 'users', source: 'food_users', target: 'users' },
    { label: 'admins', source: 'food_admins', target: 'admins' }
];

const emptyStats = () => ({
    scanned: 0,
    matched: 0,
    modified: 0,
    upserted: 0,
    failed: 0,
    mergedByPhone: 0,
    insertedWithoutConflictingEmail: 0,
    unresolved: 0
});

const applyResult = (stats, result) => {
    stats.matched += result.matchedCount || 0;
    stats.modified += result.modifiedCount || 0;
    stats.upserted += result.upsertedCount || 0;
};

async function flushBatch(targetCollection, batch, stats) {
    if (!batch.length) return;

    const operations = batch.map((doc) => ({
        replaceOne: {
            filter: { _id: doc._id },
            replacement: doc,
            upsert: true
        }
    }));

    try {
        const result = await targetCollection.bulkWrite(operations, { ordered: false });
        applyResult(stats, result);
    } catch (error) {
        const partialResult = error.result;
        if (partialResult) {
            applyResult(stats, partialResult);
        }

        const writeErrors = error.writeErrors || error.result?.result?.writeErrors || [];
        stats.failed += writeErrors.length || batch.length;
        console.warn(`[global-auth-migration] ${writeErrors.length || batch.length} write(s) need conflict resolution while copying ${targetCollection.collectionName}.`);
    }
}

const isValuePresent = (value) => {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0;
    return true;
};

async function mergeByPhone(targetCollection, sourceDoc, existingDoc, stats) {
    const set = {};
    const addToSet = {};

    for (const key of ['countryCode', 'name', 'profileImage', 'dateOfBirth', 'anniversary', 'gender', 'referralCode', 'role']) {
        if (isValuePresent(sourceDoc[key]) && !isValuePresent(existingDoc[key])) {
            set[key] = sourceDoc[key];
        }
    }

    for (const key of ['isVerified']) {
        if (sourceDoc[key] === true && existingDoc[key] !== true) {
            set[key] = true;
        }
    }
    if (Array.isArray(sourceDoc.fcmTokens) && sourceDoc.fcmTokens.length && (!isValuePresent(existingDoc.fcmTokens) || Array.isArray(existingDoc.fcmTokens))) {
        addToSet.fcmTokens = { $each: sourceDoc.fcmTokens };
    }

    if (Array.isArray(sourceDoc.fcmTokenMobile) && sourceDoc.fcmTokenMobile.length && (!isValuePresent(existingDoc.fcmTokenMobile) || Array.isArray(existingDoc.fcmTokenMobile))) {
        addToSet.fcmTokenMobile = { $each: sourceDoc.fcmTokenMobile };
    }

    const update = {};
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(addToSet).length) update.$addToSet = addToSet;

    if (!Object.keys(update).length) {
        stats.mergedByPhone += 1;
        return;
    }

    await targetCollection.updateOne({ _id: existingDoc._id }, update);
    stats.mergedByPhone += 1;
}

async function resolveConflicts(sourceCollection, targetCollection, stats) {
    const cursor = sourceCollection.find({});

    for await (const sourceDoc of cursor) {
        const existingById = await targetCollection.findOne({ _id: sourceDoc._id }, { projection: { _id: 1 } });
        if (existingById) continue;

        const existingByPhone = sourceDoc.phone
            ? await targetCollection.findOne({ phone: sourceDoc.phone })
            : null;

        if (existingByPhone) {
            try {
                await mergeByPhone(targetCollection, sourceDoc, existingByPhone, stats);
            } catch (error) {
                stats.unresolved += 1;
                console.warn(`[global-auth-migration] unresolved phone merge for ${targetCollection.collectionName} source _id=${sourceDoc._id}: ${error.message}`);
            }
            continue;
        }

        const docToInsert = { ...sourceDoc };
        const existingByEmail = sourceDoc.email
            ? await targetCollection.findOne({ email: sourceDoc.email }, { projection: { _id: 1 } })
            : null;

        if (existingByEmail) {
            docToInsert.legacyEmailConflict = docToInsert.email;
            delete docToInsert.email;
        }

        try {
            await targetCollection.insertOne(docToInsert);
            if (existingByEmail) {
                stats.insertedWithoutConflictingEmail += 1;
            } else {
                stats.upserted += 1;
            }
        } catch (error) {
            stats.unresolved += 1;
            console.warn(`[global-auth-migration] unresolved ${targetCollection.collectionName} source _id=${sourceDoc._id}: ${error.message}`);
        }
    }
}

async function copyCollection(db, { label, source, target }) {
    const sourceCollection = db.collection(source);
    const targetCollection = db.collection(target);
    const stats = emptyStats();

    const beforeSource = await sourceCollection.countDocuments();
    const beforeTarget = await targetCollection.countDocuments();
    console.log(`[global-auth-migration] ${label}: ${source}=${beforeSource}, ${target}=${beforeTarget} before copy`);

    const cursor = sourceCollection.find({});
    let batch = [];

    for await (const doc of cursor) {
        stats.scanned += 1;
        batch.push(doc);

        if (batch.length >= 500) {
            await flushBatch(targetCollection, batch, stats);
            batch = [];
        }
    }

    await flushBatch(targetCollection, batch, stats);

    await resolveConflicts(sourceCollection, targetCollection, stats);

    const afterTarget = await targetCollection.countDocuments();
    console.log(
        `[global-auth-migration] ${label}: scanned=${stats.scanned}, upserted=${stats.upserted}, modified=${stats.modified}, matched=${stats.matched}, conflictWrites=${stats.failed}, mergedByPhone=${stats.mergedByPhone}, insertedWithoutConflictingEmail=${stats.insertedWithoutConflictingEmail}, unresolved=${stats.unresolved}, ${target}=${afterTarget} after copy`
    );
}

async function main() {
    if (!mongoUrl) {
        throw new Error('Missing MONGODB_URL, MONGODB_URI, or DATABASE_URL in Backend/.env');
    }

    await mongoose.connect(mongoUrl);
    const db = mongoose.connection.db;

    for (const migration of migrations) {
        await copyCollection(db, migration);
    }
}

main()
    .catch((error) => {
        console.error('[global-auth-migration] failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
