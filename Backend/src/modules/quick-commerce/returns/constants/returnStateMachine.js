/**
 * Return Management System — State Machine Constants
 *
 * Single source of truth for all return-related statuses, allowed transitions,
 * role-based permissions, and human-readable labels.
 *
 * Usage:
 *   import { MASTER_STATUS, LEG_STATUS, isValidTransition, ... } from './returnStateMachine.js';
 */

// ─── Master ReturnRequest Statuses (User/Admin Facing) ──────────────────────

export const MASTER_STATUS = Object.freeze({
  RETURN_REQUESTED:      'RETURN_REQUESTED',
  UNDER_ADMIN_REVIEW:    'UNDER_ADMIN_REVIEW',
  APPROVED:              'APPROVED',
  PARTIALLY_APPROVED:    'PARTIALLY_APPROVED',
  REJECTED:              'REJECTED',
  IN_PROGRESS:           'IN_PROGRESS',
  COMPLETED:             'COMPLETED',
  PARTIALLY_COMPLETED:   'PARTIALLY_COMPLETED',
  REFUND_PENDING:        'REFUND_PENDING',
  REFUND_COMPLETED:      'REFUND_COMPLETED',
  REFUND_FAILED:         'REFUND_FAILED',
  CANCELLED:             'CANCELLED',
  EXPIRED:               'EXPIRED',
});

export const MASTER_STATUS_VALUES = Object.values(MASTER_STATUS);

// ─── SellerReturn Leg Statuses ──────────────────────────────────────────────
// Includes ALL existing values (backward compat) + new granular values.

export const LEG_STATUS = Object.freeze({
  // Existing (preserved exactly):
  RETURN_REQUESTED:       'return_requested',
  RETURN_APPROVED:        'return_approved',
  RETURN_REJECTED:        'return_rejected',
  RETURN_PICKUP_ASSIGNED: 'return_pickup_assigned',
  RETURN_IN_TRANSIT:      'return_in_transit',       // backward compat alias
  RETURNED:               'returned',                 // backward compat alias
  REFUND_COMPLETED:       'refund_completed',

  // New granular statuses:
  UNDER_REVIEW:           'under_review',
  PARTIALLY_APPROVED:     'partially_approved',
  PICKUP_PENDING:         'pickup_pending',
  PICKUP_EN_ROUTE:        'pickup_en_route',
  PICKUP_REACHED:         'pickup_reached',
  PICKUP_OTP_PENDING:     'pickup_otp_pending',
  PICKED_UP:              'picked_up',
  RETURN_EN_ROUTE:        'return_en_route',
  RETURN_REACHED_SELLER:  'return_reached_seller',
  SELLER_OTP_PENDING:     'seller_otp_pending',
  RETURN_COMPLETED:       'return_completed',
  REFUND_PENDING:         'refund_pending',
  REFUND_FAILED:          'refund_failed',
  CANCELLED:              'cancelled',
  FAILED_PICKUP:          'failed_pickup',
  FAILED_RETURN:          'failed_return',
  EXPIRED:                'expired',
});

export const LEG_STATUS_VALUES = Object.values(LEG_STATUS);

// ─── Item Approval Statuses ─────────────────────────────────────────────────

export const ITEM_APPROVAL = Object.freeze({
  PENDING:  'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

export const ITEM_APPROVAL_VALUES = Object.values(ITEM_APPROVAL);

// ─── Terminal Statuses (no further transitions allowed) ─────────────────────

export const MASTER_TERMINAL = new Set([
  MASTER_STATUS.REJECTED,
  MASTER_STATUS.REFUND_COMPLETED,
  MASTER_STATUS.CANCELLED,
  MASTER_STATUS.EXPIRED,
]);

export const LEG_TERMINAL = new Set([
  LEG_STATUS.RETURN_REJECTED,
  LEG_STATUS.REFUND_COMPLETED,
  LEG_STATUS.CANCELLED,
  LEG_STATUS.EXPIRED,
]);

// ─── Active (non-terminal) Status Sets — for duplicate-prevention queries ───

export const MASTER_ACTIVE_STATUSES = MASTER_STATUS_VALUES.filter(
  (s) => !MASTER_TERMINAL.has(s),
);

export const LEG_ACTIVE_STATUSES = LEG_STATUS_VALUES.filter(
  (s) => !LEG_TERMINAL.has(s),
);

// ─── Cancellable statuses (user can cancel before physical pickup) ──────────

export const USER_CANCELLABLE = new Set([
  MASTER_STATUS.RETURN_REQUESTED,
  MASTER_STATUS.UNDER_ADMIN_REVIEW,
  MASTER_STATUS.APPROVED,
  MASTER_STATUS.PARTIALLY_APPROVED,
  MASTER_STATUS.IN_PROGRESS,       // only if no leg has reached picked_up
]);

// Leg-level: user cancel propagates only if leg hasn't reached picked_up
export const LEG_CANCELLABLE_BY_USER = new Set([
  LEG_STATUS.RETURN_REQUESTED,
  LEG_STATUS.UNDER_REVIEW,
  LEG_STATUS.RETURN_APPROVED,
  LEG_STATUS.PARTIALLY_APPROVED,
  LEG_STATUS.PICKUP_PENDING,
  LEG_STATUS.RETURN_PICKUP_ASSIGNED,
  LEG_STATUS.PICKUP_EN_ROUTE,
  LEG_STATUS.PICKUP_REACHED,
  LEG_STATUS.PICKUP_OTP_PENDING,
]);

// ─── Allowed Transition Maps (server-side enforcement) ──────────────────────

export const MASTER_TRANSITIONS = Object.freeze({
  [MASTER_STATUS.RETURN_REQUESTED]:    [MASTER_STATUS.UNDER_ADMIN_REVIEW, MASTER_STATUS.CANCELLED],
  [MASTER_STATUS.UNDER_ADMIN_REVIEW]:  [MASTER_STATUS.APPROVED, MASTER_STATUS.PARTIALLY_APPROVED, MASTER_STATUS.REJECTED, MASTER_STATUS.CANCELLED],
  [MASTER_STATUS.APPROVED]:            [MASTER_STATUS.IN_PROGRESS, MASTER_STATUS.CANCELLED],
  [MASTER_STATUS.PARTIALLY_APPROVED]:  [MASTER_STATUS.IN_PROGRESS, MASTER_STATUS.CANCELLED],
  [MASTER_STATUS.REJECTED]:            [],
  [MASTER_STATUS.IN_PROGRESS]:         [MASTER_STATUS.COMPLETED, MASTER_STATUS.PARTIALLY_COMPLETED, MASTER_STATUS.CANCELLED],
  [MASTER_STATUS.COMPLETED]:           [MASTER_STATUS.REFUND_PENDING],
  [MASTER_STATUS.PARTIALLY_COMPLETED]: [MASTER_STATUS.REFUND_PENDING, MASTER_STATUS.CANCELLED],
  [MASTER_STATUS.REFUND_PENDING]:      [MASTER_STATUS.REFUND_COMPLETED, MASTER_STATUS.REFUND_FAILED],
  [MASTER_STATUS.REFUND_COMPLETED]:    [],
  [MASTER_STATUS.REFUND_FAILED]:       [MASTER_STATUS.REFUND_PENDING],
  [MASTER_STATUS.CANCELLED]:           [],
  [MASTER_STATUS.EXPIRED]:             [],
});

export const LEG_TRANSITIONS = Object.freeze({
  [LEG_STATUS.RETURN_REQUESTED]:       [LEG_STATUS.UNDER_REVIEW, LEG_STATUS.CANCELLED],
  [LEG_STATUS.UNDER_REVIEW]:           [LEG_STATUS.RETURN_APPROVED, LEG_STATUS.PARTIALLY_APPROVED, LEG_STATUS.RETURN_REJECTED, LEG_STATUS.CANCELLED],
  [LEG_STATUS.RETURN_APPROVED]:        [LEG_STATUS.PICKUP_PENDING, LEG_STATUS.CANCELLED],
  [LEG_STATUS.PARTIALLY_APPROVED]:     [LEG_STATUS.PICKUP_PENDING, LEG_STATUS.CANCELLED],
  [LEG_STATUS.RETURN_REJECTED]:        [],
  [LEG_STATUS.PICKUP_PENDING]:         [LEG_STATUS.RETURN_PICKUP_ASSIGNED, LEG_STATUS.CANCELLED, LEG_STATUS.EXPIRED],
  [LEG_STATUS.RETURN_PICKUP_ASSIGNED]: [LEG_STATUS.PICKUP_EN_ROUTE, LEG_STATUS.PICKUP_PENDING, LEG_STATUS.CANCELLED],
  [LEG_STATUS.PICKUP_EN_ROUTE]:        [LEG_STATUS.PICKUP_REACHED, LEG_STATUS.FAILED_PICKUP],
  [LEG_STATUS.PICKUP_REACHED]:         [LEG_STATUS.PICKUP_OTP_PENDING, LEG_STATUS.FAILED_PICKUP],
  [LEG_STATUS.PICKUP_OTP_PENDING]:     [LEG_STATUS.PICKED_UP, LEG_STATUS.FAILED_PICKUP],
  [LEG_STATUS.PICKED_UP]:              [LEG_STATUS.RETURN_EN_ROUTE, LEG_STATUS.RETURN_IN_TRANSIT],
  [LEG_STATUS.RETURN_EN_ROUTE]:        [LEG_STATUS.RETURN_REACHED_SELLER, LEG_STATUS.FAILED_RETURN],
  [LEG_STATUS.RETURN_IN_TRANSIT]:      [LEG_STATUS.RETURN_REACHED_SELLER, LEG_STATUS.FAILED_RETURN],
  [LEG_STATUS.RETURN_REACHED_SELLER]:  [LEG_STATUS.SELLER_OTP_PENDING, LEG_STATUS.FAILED_RETURN],
  [LEG_STATUS.SELLER_OTP_PENDING]:     [LEG_STATUS.RETURN_COMPLETED, LEG_STATUS.RETURNED, LEG_STATUS.FAILED_RETURN],
  [LEG_STATUS.RETURN_COMPLETED]:       [LEG_STATUS.REFUND_PENDING],
  [LEG_STATUS.RETURNED]:               [LEG_STATUS.REFUND_PENDING, LEG_STATUS.REFUND_COMPLETED],
  [LEG_STATUS.REFUND_PENDING]:         [LEG_STATUS.REFUND_COMPLETED, LEG_STATUS.REFUND_FAILED],
  [LEG_STATUS.REFUND_COMPLETED]:       [],
  [LEG_STATUS.REFUND_FAILED]:          [LEG_STATUS.REFUND_PENDING],
  [LEG_STATUS.CANCELLED]:              [],
  [LEG_STATUS.FAILED_PICKUP]:          [LEG_STATUS.PICKUP_PENDING, LEG_STATUS.CANCELLED],
  [LEG_STATUS.FAILED_RETURN]:          [LEG_STATUS.RETURN_EN_ROUTE, LEG_STATUS.CANCELLED],
  [LEG_STATUS.EXPIRED]:                [],
});

// ─── Transition Validators ──────────────────────────────────────────────────

/**
 * Returns true if transitioning from `from` to `to` is a legal move
 * according to the master transition map.
 */
export function isValidMasterTransition(from, to) {
  const allowed = MASTER_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/**
 * Returns true if transitioning from `from` to `to` is a legal move
 * according to the seller-return leg transition map.
 */
export function isValidLegTransition(from, to) {
  const allowed = LEG_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/**
 * Asserts a transition is valid. Throws a descriptive error if not.
 * @param {'master' | 'leg'} type
 * @param {string} from
 * @param {string} to
 */
export function assertTransition(type, from, to) {
  const isValid = type === 'master'
    ? isValidMasterTransition(from, to)
    : isValidLegTransition(from, to);

  if (!isValid) {
    const err = new Error(
      `Invalid ${type} status transition: '${from}' → '${to}' is not allowed.`,
    );
    err.statusCode = 400;
    err.code = 'INVALID_STATUS_TRANSITION';
    throw err;
  }
}

// ─── Human-Readable Labels ──────────────────────────────────────────────────

export const MASTER_STATUS_LABELS = Object.freeze({
  [MASTER_STATUS.RETURN_REQUESTED]:    'Return Requested',
  [MASTER_STATUS.UNDER_ADMIN_REVIEW]:  'Under Review',
  [MASTER_STATUS.APPROVED]:            'Approved',
  [MASTER_STATUS.PARTIALLY_APPROVED]:  'Partially Approved',
  [MASTER_STATUS.REJECTED]:            'Rejected',
  [MASTER_STATUS.IN_PROGRESS]:         'In Progress',
  [MASTER_STATUS.COMPLETED]:           'Return Completed',
  [MASTER_STATUS.PARTIALLY_COMPLETED]: 'Partially Completed',
  [MASTER_STATUS.REFUND_PENDING]:      'Refund Processing',
  [MASTER_STATUS.REFUND_COMPLETED]:    'Refund Completed',
  [MASTER_STATUS.REFUND_FAILED]:       'Refund Failed',
  [MASTER_STATUS.CANCELLED]:           'Cancelled',
  [MASTER_STATUS.EXPIRED]:             'Expired',
});

export const LEG_STATUS_LABELS = Object.freeze({
  [LEG_STATUS.RETURN_REQUESTED]:       'Return Requested',
  [LEG_STATUS.UNDER_REVIEW]:           'Under Review',
  [LEG_STATUS.RETURN_APPROVED]:        'Approved',
  [LEG_STATUS.PARTIALLY_APPROVED]:     'Partially Approved',
  [LEG_STATUS.RETURN_REJECTED]:        'Rejected',
  [LEG_STATUS.PICKUP_PENDING]:         'Awaiting Pickup Assignment',
  [LEG_STATUS.RETURN_PICKUP_ASSIGNED]: 'Pickup Assigned',
  [LEG_STATUS.PICKUP_EN_ROUTE]:        'Rider En Route to You',
  [LEG_STATUS.PICKUP_REACHED]:         'Rider Reached You',
  [LEG_STATUS.PICKUP_OTP_PENDING]:     'Verify Pickup OTP',
  [LEG_STATUS.PICKED_UP]:              'Items Picked Up',
  [LEG_STATUS.RETURN_EN_ROUTE]:        'Heading to Seller',
  [LEG_STATUS.RETURN_IN_TRANSIT]:      'In Transit to Seller',
  [LEG_STATUS.RETURN_REACHED_SELLER]:  'Reached Seller',
  [LEG_STATUS.SELLER_OTP_PENDING]:     'Verify Seller OTP',
  [LEG_STATUS.RETURN_COMPLETED]:       'Return Completed',
  [LEG_STATUS.RETURNED]:               'Returned',
  [LEG_STATUS.REFUND_PENDING]:         'Refund Processing',
  [LEG_STATUS.REFUND_COMPLETED]:       'Refund Completed',
  [LEG_STATUS.REFUND_FAILED]:          'Refund Failed',
  [LEG_STATUS.CANCELLED]:              'Cancelled',
  [LEG_STATUS.FAILED_PICKUP]:          'Pickup Failed',
  [LEG_STATUS.FAILED_RETURN]:          'Return Delivery Failed',
  [LEG_STATUS.EXPIRED]:                'Expired',
});

// ─── Leg → Master Status Derivation Rules ───────────────────────────────────

/**
 * Derives the master ReturnRequest status from the aggregate of its seller legs.
 * @param {Array<{ returnStatus: string }>} legs - SellerReturn leg documents
 * @returns {string} Computed master status
 */
export function deriveMasterStatus(legs) {
  if (!Array.isArray(legs) || legs.length === 0) {
    return MASTER_STATUS.RETURN_REQUESTED;
  }

  const statuses = legs.map((l) => l.returnStatus || l.status || '');

  // All cancelled
  if (statuses.every((s) => s === LEG_STATUS.CANCELLED)) {
    return MASTER_STATUS.CANCELLED;
  }

  // All expired
  if (statuses.every((s) => s === LEG_STATUS.EXPIRED)) {
    return MASTER_STATUS.EXPIRED;
  }

  // All rejected
  if (statuses.every((s) => s === LEG_STATUS.RETURN_REJECTED)) {
    return MASTER_STATUS.REJECTED;
  }

  // All refund completed (or returned+refund_completed for backward compat)
  const refundDone = new Set([LEG_STATUS.REFUND_COMPLETED]);
  if (statuses.every((s) => refundDone.has(s))) {
    return MASTER_STATUS.REFUND_COMPLETED;
  }

  // Any refund pending/failed (and no legs still in progress)
  const refundPhase = new Set([LEG_STATUS.REFUND_PENDING, LEG_STATUS.REFUND_FAILED]);
  const completionPhase = new Set([
    LEG_STATUS.RETURN_COMPLETED, LEG_STATUS.RETURNED,
    LEG_STATUS.REFUND_PENDING, LEG_STATUS.REFUND_COMPLETED, LEG_STATUS.REFUND_FAILED,
  ]);
  const terminalOrComplete = new Set([
    ...completionPhase,
    LEG_STATUS.RETURN_REJECTED, LEG_STATUS.CANCELLED, LEG_STATUS.EXPIRED,
  ]);

  if (statuses.some((s) => refundPhase.has(s)) && statuses.every((s) => terminalOrComplete.has(s))) {
    return MASTER_STATUS.REFUND_PENDING;
  }

  // All approved legs completed (+ terminal legs)
  const doneStatuses = new Set([
    LEG_STATUS.RETURN_COMPLETED, LEG_STATUS.RETURNED,
    LEG_STATUS.REFUND_PENDING, LEG_STATUS.REFUND_COMPLETED,
  ]);
  const failedStatuses = new Set([LEG_STATUS.FAILED_PICKUP, LEG_STATUS.FAILED_RETURN]);
  const nonRejectedLegs = statuses.filter((s) => s !== LEG_STATUS.RETURN_REJECTED && s !== LEG_STATUS.CANCELLED && s !== LEG_STATUS.EXPIRED);

  if (nonRejectedLegs.length > 0 && nonRejectedLegs.every((s) => doneStatuses.has(s))) {
    return MASTER_STATUS.COMPLETED;
  }

  if (nonRejectedLegs.length > 0 && nonRejectedLegs.some((s) => doneStatuses.has(s)) && nonRejectedLegs.some((s) => failedStatuses.has(s) || s === LEG_STATUS.CANCELLED)) {
    return MASTER_STATUS.PARTIALLY_COMPLETED;
  }

  // Any leg in pickup/return progress
  const progressStatuses = new Set([
    LEG_STATUS.PICKUP_PENDING, LEG_STATUS.RETURN_PICKUP_ASSIGNED,
    LEG_STATUS.PICKUP_EN_ROUTE, LEG_STATUS.PICKUP_REACHED,
    LEG_STATUS.PICKUP_OTP_PENDING, LEG_STATUS.PICKED_UP,
    LEG_STATUS.RETURN_EN_ROUTE, LEG_STATUS.RETURN_IN_TRANSIT,
    LEG_STATUS.RETURN_REACHED_SELLER, LEG_STATUS.SELLER_OTP_PENDING,
    LEG_STATUS.FAILED_PICKUP, LEG_STATUS.FAILED_RETURN,
  ]);
  if (statuses.some((s) => progressStatuses.has(s))) {
    return MASTER_STATUS.IN_PROGRESS;
  }

  // All approved (none rejected among non-terminal)
  const approvedStatuses = new Set([LEG_STATUS.RETURN_APPROVED, LEG_STATUS.PARTIALLY_APPROVED]);
  if (nonRejectedLegs.length > 0 && nonRejectedLegs.every((s) => approvedStatuses.has(s))) {
    const hasRejected = statuses.some((s) => s === LEG_STATUS.RETURN_REJECTED);
    return hasRejected ? MASTER_STATUS.PARTIALLY_APPROVED : MASTER_STATUS.APPROVED;
  }

  // Mix of approved + rejected
  if (statuses.some((s) => approvedStatuses.has(s)) && statuses.some((s) => s === LEG_STATUS.RETURN_REJECTED)) {
    return MASTER_STATUS.PARTIALLY_APPROVED;
  }

  // Any under review
  if (statuses.some((s) => s === LEG_STATUS.UNDER_REVIEW)) {
    return MASTER_STATUS.UNDER_ADMIN_REVIEW;
  }

  // Default: return requested
  return MASTER_STATUS.RETURN_REQUESTED;
}

// ─── Default Return Settings ────────────────────────────────────────────────

export const DEFAULT_RETURN_SETTINGS = Object.freeze({
  returnWindowDays: 7,
  pickupOtpExpiryMinutes: 10,
  sellerOtpExpiryMinutes: 10,
  maxOtpAttempts: 5,
  maxOtpResends: 3,
  otpResendCooldownSeconds: 60,
  maxAutoReassignAttempts: 3,
  autoReassignTimeoutMinutes: 10,
  maxReturnImages: 5,
  maxReturnImageSizeMb: 5,
  returnReasons: [
    'Damaged product',
    'Wrong item received',
    'Quality not as expected',
    'Expired product',
    'Missing items',
    'Size/color mismatch',
    'Changed mind',
    'Other',
  ],
  enabled: true,
});

// ─── Predefined Return Reason Keys ──────────────────────────────────────────

export const RETURN_REASONS = DEFAULT_RETURN_SETTINGS.returnReasons;

// ─── Actor Roles (for status history) ───────────────────────────────────────

export const ACTOR_ROLES = Object.freeze({
  USER:             'USER',
  ADMIN:            'ADMIN',
  SELLER:           'SELLER',
  DELIVERY_PARTNER: 'DELIVERY_PARTNER',
  SYSTEM:           'SYSTEM',
});
