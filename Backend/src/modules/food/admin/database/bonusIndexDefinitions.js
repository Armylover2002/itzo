/**
 * Explicit MongoDB index specs for Food Delivery Bonus financial collections.
 * Used by the index manager (autoIndex is disabled in production).
 */

export const CRITICAL_INDEX_SPECS = {
    food_delivery_bonus_idempotency: [
        { key: { key: 1 }, options: { unique: true, name: 'key_1' } },
        { key: { requestHash: 1 }, options: { name: 'requestHash_1' } }
    ],
    food_delivery_bonus_transactions: [
        { key: { transactionId: 1 }, options: { unique: true, name: 'transactionId_1' } },
        {
            key: { idempotencyKey: 1 },
            options: {
                unique: true,
                name: 'idempotencyKey_1_unique_string',
                partialFilterExpression: { idempotencyKey: { $type: 'string' } }
            }
        }
    ],
    food_delivery_bonus_audit_logs: [
        { key: { transactionId: 1 }, options: { unique: true, name: 'transactionId_1' } }
    ]
};

export const SUPPORTING_INDEX_SPECS = {
    food_delivery_bonus_idempotency: [
        { key: { transactionId: 1 }, options: { name: 'transactionId_1' } }
    ],
    food_delivery_bonus_transactions: [
        { key: { deliveryPartnerId: 1 }, options: { name: 'deliveryPartnerId_1' } },
        { key: { createdAt: -1 }, options: { name: 'createdAt_-1' } },
        {
            key: { deliveryPartnerId: 1, createdAt: -1 },
            options: { name: 'deliveryPartnerId_1_createdAt_-1' }
        },
        { key: { createdAt: -1, _id: -1 }, options: { name: 'createdAt_-1__id_-1' } }
    ],
    food_delivery_bonus_audit_logs: [
        { key: { adminId: 1, createdAt: -1 }, options: { name: 'adminId_1_createdAt_-1' } },
        {
            key: { deliveryPartnerId: 1, createdAt: -1 },
            options: { name: 'deliveryPartnerId_1_createdAt_-1' }
        },
        { key: { requestId: 1 }, options: { name: 'requestId_1' } },
        { key: { createdAt: -1 }, options: { name: 'createdAt_-1' } }
    ]
};
