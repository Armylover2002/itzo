import mongoose from 'mongoose';
import { logger } from '../../../../utils/logger.js';
import { FoodDeliveryPartnerSubmission } from '../models/deliveryPartnerSubmission.model.js';
import { FoodDeliveryPartner } from '../models/deliveryPartner.model.js';

async function createIndexSafe(collection, key, options = {}) {
    try {
        await collection.createIndex(key, options);
    } catch (err) {
        if (
            err?.code === 85 ||
            err?.code === 86 ||
            /already exists|equivalent index/i.test(String(err?.message || ''))
        ) {
            return;
        }
        throw err;
    }
}

async function assertSubmissionIndexes(db) {
    const missing = [];
    const indexes = await db.collection('food_delivery_partner_submissions').indexes();

    const hasUniqueVersion = indexes.some(
        (idx) =>
            idx?.unique === true &&
            idx?.key?.partnerId === 1 &&
            idx?.key?.submissionNumber === 1
    );
    if (!hasUniqueVersion) {
        missing.push('food_delivery_partner_submissions.{partnerId,submissionNumber} unique');
    }

    const hasPartnerStatus = indexes.some(
        (idx) => idx?.key?.partnerId === 1 && idx?.key?.status === 1
    );
    if (!hasPartnerStatus) {
        missing.push('food_delivery_partner_submissions.{partnerId,status,submittedAt}');
    }

    if (missing.length) {
        const err = new Error(
            `Critical delivery onboarding indexes missing: ${missing.join('; ')}`
        );
        err.code = 'DELIVERY_ONBOARDING_INDEX_MISSING';
        throw err;
    }
}

let ready = null;

/**
 * Ensure submission history indexes (autoIndex is disabled).
 * Must succeed on startup — unique versioning depends on these.
 */
export async function ensureDeliveryOnboardingIndexes() {
    if (ready) return ready;

    ready = (async () => {
        if (mongoose.connection.readyState !== 1) {
            throw new Error('MongoDB not connected; cannot ensure delivery onboarding indexes');
        }
        const db = mongoose.connection.db;

        await Promise.all([
            FoodDeliveryPartnerSubmission.createCollection().catch(() => {}),
            FoodDeliveryPartner.createCollection().catch(() => {})
        ]);

        const col = db.collection('food_delivery_partner_submissions');
        await createIndexSafe(
            col,
            { partnerId: 1, submissionNumber: 1 },
            { unique: true, name: 'partnerId_1_submissionNumber_1' }
        );
        await createIndexSafe(
            col,
            { partnerId: 1, status: 1, submittedAt: -1 },
            { name: 'partnerId_1_status_1_submittedAt_-1' }
        );
        await createIndexSafe(col, { status: 1, submittedAt: -1 }, { name: 'status_1_submittedAt_-1' });
        await createIndexSafe(col, { submittedAt: -1 }, { name: 'submittedAt_-1' });

        await createIndexSafe(
            db.collection('food_delivery_partners'),
            { latestSubmissionId: 1 },
            { name: 'latestSubmissionId_1', sparse: true }
        );

        await assertSubmissionIndexes(db);
        return true;
    })().catch((err) => {
        ready = null;
        throw err;
    });

    return ready;
}

export async function validateDeliveryOnboardingStartup() {
    await ensureDeliveryOnboardingIndexes();
    logger.info('Delivery onboarding submission indexes ensured and verified');
}
