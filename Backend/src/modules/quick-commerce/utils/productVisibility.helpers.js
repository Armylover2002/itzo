/**
 * Shared visibility rules for customer-facing quick-commerce product queries.
 *
 * Inactive listings must never appear even when `isActive` was historically
 * stripped by the dual SellerProduct schema. Legacy docs without
 * approvalStatus / isActive remain visible (pre-approval catalog).
 */
export const escapeRegex = (value = '') =>
  String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const publicProductVisibilityFilter = {
  $and: [
    {
      $or: [
        { approvalStatus: 'approved' },
        { approvalStatus: { $exists: false } },
      ],
    },
    { status: { $ne: 'inactive' } },
    { isActive: { $ne: false } },
  ],
};

/** Effective stock = max(parent stock, sum of variant stocks). */
export const effectiveStockExpr = {
  $let: {
    vars: {
      variantSum: {
        $sum: {
          $map: {
            input: { $ifNull: ['$variants', []] },
            as: 'v',
            in: { $max: [0, { $ifNull: ['$$v.stock', 0] }] },
          },
        },
      },
      parentStock: { $max: [0, { $ifNull: ['$stock', 0] }] },
    },
    in: { $max: ['$$parentStock', '$$variantSum'] },
  },
};
