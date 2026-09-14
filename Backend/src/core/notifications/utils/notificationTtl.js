/** Shared 24h TTL helper for Food notification collections. */
export const NOTIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

/** expiresAt = createdAt (or now) + 24 hours */
export function computeNotificationExpiresAt(createdAt = new Date()) {
    const base = createdAt instanceof Date ? createdAt : new Date(createdAt);
    const safeBase = Number.isNaN(base.getTime()) ? new Date() : base;
    return new Date(safeBase.getTime() + NOTIFICATION_TTL_MS);
}
