import mongoose from 'mongoose';

/**
 * ProcessedWebhookEvent — idempotency ledger for gateway webhooks.
 * Stores a unique dedupeKey per received webhook payload so retries are safe.
 */
const processedWebhookEventSchema = new mongoose.Schema(
    {
        source: { type: String, default: 'razorpay', trim: true, index: true },
        dedupeKey: { type: String, required: true, unique: true, index: true, trim: true },
        eventId: { type: String, default: null, index: true, trim: true },
        eventType: { type: String, required: true, index: true, trim: true },
        entityType: { type: String, default: null, trim: true },
        entityId: { type: String, default: null, index: true, trim: true },
        bodyHash: { type: String, default: null, trim: true }
    },
    { collection: 'processed_webhook_events', timestamps: true }
);

processedWebhookEventSchema.index({ source: 1, eventType: 1, createdAt: -1 });

export const ProcessedWebhookEvent = mongoose.model('ProcessedWebhookEvent', processedWebhookEventSchema);
