/**
 * Smoke test: customer return API response optimization.
 * Usage: node scripts/verify-customer-return-response.js
 */
import {
  serializeReturnDocumentBase,
  serializeReturnForCustomer,
} from '../src/modules/quick-commerce/utils/return.helpers.js';

const assert = (label, condition) => {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`OK: ${label}`);
};

const mockReturnDoc = {
  _id: '6a3bba748efd659c22df1300',
  orderId: 'QC85167300',
  sellerId: '507f1f77bcf86cd799439011',
  userId: '507f1f77bcf86cd799439012',
  returnStatus: 'refund_completed',
  refundStatus: 'completed',
  refundMethod: 'bank',
  returnReason: 'Item damaged',
  returnRefundAmount: 28,
  calculatedPickupCharge: 60,
  riderEarning: 60,
  returnDeliveryCommission: 25,
  pickupDistanceKm: 3.2,
  pickupImages: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
  pickupImageEntries: [
    {
      url: 'https://cdn.example.com/a.jpg',
      uploadedAt: new Date().toISOString(),
      uploadedByRole: 'DELIVERY_PARTNER',
      uploadedBy: '507f1f77bcf86cd799439099',
      metadata: { internal: true },
    },
  ],
  pickupPricingBreakdown: { distanceKm: 3.2, earning: 60, basePayout: 40 },
  qualityCheck: { status: 'passed' },
  dispatch: {
    status: 'completed',
    deliveryPartnerId: '69b8053e60f4a642f86dcb62',
    assignedAt: new Date().toISOString(),
    acceptedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    dispatchingAt: new Date().toISOString(),
    modeAtCreation: 'auto',
    offeredTo: Array.from({ length: 10 }, (_, i) => ({
      partnerId: `507f1f77bcf86cd79943901${i}`,
      action: 'offered',
      at: new Date().toISOString(),
    })),
  },
  deliveryState: { status: 'reached_drop', completedAt: new Date().toISOString() },
  finance: {
    sellerLedgerApplied: true,
    pickupFeeDebited: 60,
    preSettlementDeducted: 28,
  },
  returnItems: [{ itemId: 'item1', name: 'Milk', returnedQty: 1, quantity: 1 }],
  refundAuditLog: [
    {
      at: new Date().toISOString(),
      action: 'REFUND_PAYOUT_CONFIRMED',
      refundStatus: 'completed',
      amount: 28,
      actorId: 'admin123',
      metadata: { internal: true },
    },
  ],
  returnHistory: [
    { at: new Date().toISOString(), action: 'RETURN_REQUESTED', byRole: 'USER' },
  ],
  updatedAt: new Date().toISOString(),
};

const before = serializeReturnDocumentBase(mockReturnDoc);
const after = serializeReturnForCustomer(mockReturnDoc);

const beforeBytes = Buffer.byteLength(JSON.stringify(before), 'utf8');
const afterBytes = Buffer.byteLength(JSON.stringify(after), 'utf8');
const reduction = (((beforeBytes - afterBytes) / beforeBytes) * 100).toFixed(1);

console.log('\n=== Customer Return Response Optimization ===\n');
console.log(`Payload before: ${beforeBytes} bytes`);
console.log(`Payload after:  ${afterBytes} bytes`);
console.log(`Reduction:      ${reduction}% (${beforeBytes - afterBytes} bytes saved)\n`);

assert('pickupCharge exposed', after.pickupCharge === 60);
assert('no calculatedPickupCharge', after.calculatedPickupCharge === undefined);
assert('no returnPickupCharge', after.returnPickupCharge === undefined);
assert('no pickupImages', after.pickupImages === undefined);
assert('pickupImageEntries trimmed', after.pickupImageEntries?.[0]?.uploadedById === undefined);
assert('pickupImageEntries has url', Boolean(after.pickupImageEntries?.[0]?.url));
assert('no dispatch.offeredTo', after.dispatch?.offeredTo === undefined);
assert('no dispatch.deliveryPartnerId', after.dispatch?.deliveryPartnerId === undefined);
assert('no dispatch.dispatchingAt', after.dispatch?.dispatchingAt === undefined);
assert('dispatch.status kept', after.dispatch?.status === 'completed');
assert('no finance', after.finance === undefined);
assert('no timeline history', after.timeline === undefined);
assert('no deliveryState', after.deliveryState === undefined);
assert('no qualityCheck object', after.qualityCheck === undefined);
assert('qualityCheckStatus kept', after.qualityCheckStatus === 'passed');
assert('timelineSteps kept', Array.isArray(after.timelineSteps) && after.timelineSteps.length === 9);
assert('refundStatus kept', after.refundStatus === 'completed');
assert('refund audit sanitized', after.refundAuditLog?.[0]?.actorId === undefined);

console.log('\nAll customer return response checks passed.');
