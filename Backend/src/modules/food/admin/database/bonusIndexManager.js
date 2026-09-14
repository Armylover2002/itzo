import mongoose from 'mongoose';
import { DeliveryBonusIdempotency } from '../models/deliveryBonusIdempotency.model.js';
import { DeliveryBonusTransaction } from '../models/deliveryBonusTransaction.model.js';
import { DeliveryBonusAuditLog } from '../models/deliveryBonusAuditLog.model.js';
import {
    CRITICAL_INDEX_SPECS,
    SUPPORTING_INDEX_SPECS
} from './bonusIndexDefinitions.js';

async function createIndexSafe(collection, key, options = {}) {
    try {
        await collection.createIndex(key, options);
    } catch (err) {
        const isConflict =
            err?.code === 85 ||
            err?.code === 86 ||
            /already exists|equivalent index/i.test(String(err?.message || ''));
        if (!isConflict) throw err;

        // A conflict under the same index name means a stale index (built with
        // older options — e.g. missing partialFilterExpression) is occupying the
        // name. Drop and rebuild it so the declared spec stays authoritative.
        if (options.name) {
            await collection.dropIndex(options.name).catch(() => {});
            await collection.createIndex(key, options);
        }
    }
}

function indexCovers(existingIndexes, keySpec, { requireUnique = false, partial = null } = {}) {
    const want = JSON.stringify(keySpec);
    return existingIndexes.some((idx) => {
        if (JSON.stringify(idx.key) !== want) return false;
        if (requireUnique && !idx.unique) return false;
        if (partial) {
            return (
                JSON.stringify(idx.partialFilterExpression || null) === JSON.stringify(partial)
            );
        }
        return true;
    });
}

async function assertCriticalIndexes(db) {
    const missing = [];

    // Idempotency: unique key + requestHash
    {
        const indexes = await db.collection('food_delivery_bonus_idempotency').indexes();
        if (!indexCovers(indexes, { key: 1 }, { requireUnique: true })) {
            missing.push('food_delivery_bonus_idempotency.key unique');
        }
        if (!indexCovers(indexes, { requestHash: 1 })) {
            missing.push('food_delivery_bonus_idempotency.requestHash');
        }
    }

    // Transactions: unique transactionId + partial unique idempotencyKey
    {
        const indexes = await db.collection('food_delivery_bonus_transactions').indexes();
        if (!indexCovers(indexes, { transactionId: 1 }, { requireUnique: true })) {
            missing.push('food_delivery_bonus_transactions.transactionId unique');
        }
        if (
            !indexCovers(indexes, { idempotencyKey: 1 }, {
                requireUnique: true,
                partial: { idempotencyKey: { $type: 'string' } }
            })
        ) {
            missing.push(
                'food_delivery_bonus_transactions.idempotencyKey unique(partial string)'
            );
        }
    }

    // Audit: unique transactionId
    {
        const indexes = await db.collection('food_delivery_bonus_audit_logs').indexes();
        if (!indexCovers(indexes, { transactionId: 1 }, { requireUnique: true })) {
            missing.push('food_delivery_bonus_audit_logs.transactionId unique');
        }
    }

    if (missing.length) {
        const err = new Error(
            `Critical delivery-bonus indexes missing after create: ${missing.join('; ')}`
        );
        err.code = 'BONUS_CRITICAL_INDEX_MISSING';
        throw err;
    }
}

let bonusIndexesReady = null;

/**
 * Explicitly create all bonus financial indexes (autoIndex is disabled).
 * Throws if critical indexes cannot be verified — callers must fail startup.
 *
 * Exported name kept for backward-compatible imports.
 */
export async function ensureDeliveryBonusIdempotencyIndexes() {
    if (bonusIndexesReady) return bonusIndexesReady;

    bonusIndexesReady = (async () => {
        if (mongoose.connection.readyState !== 1) {
            throw new Error('MongoDB not connected; cannot ensure delivery bonus indexes');
        }
        const db = mongoose.connection.db;

        // Ensure collections exist so createIndex succeeds on empty DBs.
        await Promise.all([
            DeliveryBonusIdempotency.createIndexes().catch(() => {}),
            DeliveryBonusTransaction.createCollection().catch(() => {}),
            DeliveryBonusAuditLog.createCollection().catch(() => {})
        ]);

        const allSpecs = [
            ...Object.entries(CRITICAL_INDEX_SPECS),
            ...Object.entries(SUPPORTING_INDEX_SPECS)
        ];

        for (const [collectionName, specs] of allSpecs) {
            const col = db.collection(collectionName);
            for (const spec of specs) {
                // eslint-disable-next-line no-await-in-loop
                await createIndexSafe(col, spec.key, spec.options);
            }
        }

        await assertCriticalIndexes(db);
        return true;
    })().catch((err) => {
        bonusIndexesReady = null;
        throw err;
    });

    return bonusIndexesReady;
}

/** Preferred alias used by startup validation. */
export const ensureDeliveryBonusIndexes = ensureDeliveryBonusIdempotencyIndexes;
