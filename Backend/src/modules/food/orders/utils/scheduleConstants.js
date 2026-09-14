/**
 * Food Schedule Order — business constants (not feature flags).
 * ASAP = no scheduledAt. Schedule = validated scheduledAt + restaurant.scheduleOrderEnabled.
 *
 * Activation primary path = BullMQ delayed job (NOTIFY_SCHEDULED_ORDER).
 * Mongo reconciler is fallback-only when the job is missing/stuck/failed.
 */

/** Minutes before scheduledAt when restaurant is notified (activation). */
export const SCHEDULE_ACTIVATE_LEAD_MINUTES = 15;

/** Minimum minutes from now until scheduledAt. */
export const SCHEDULE_MIN_LEAD_MINUTES = 30;

/** Max calendar days ahead from today (1 = today + tomorrow). */
export const SCHEDULE_MAX_DAYS_AHEAD = 1;

/**
 * When BullMQ still reports a delayed/waiting job but activation is this far past due,
 * the Mongo reconciler may intervene (stuck worker / lost Redis event).
 */
export const SCHEDULE_FALLBACK_GRACE_MS = 120_000;
