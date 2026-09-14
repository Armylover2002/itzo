/**
 * Verifies return timeline step statuses align with refundStatus.
 * Usage: node scripts/verify-return-timeline.js
 */
import {
  serializeReturnTimelineSteps,
  applyRefundTimelineGuards,
  RETURN_TIMELINE_STEPS,
} from '../src/modules/quick-commerce/utils/return.helpers.js';

const assert = (label, condition) => {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`OK: ${label}`);
};

const lastStep = RETURN_TIMELINE_STEPS.length - 1;

const completedDoc = {
  returnStatus: 'refund_completed',
  refundStatus: 'completed',
  qualityCheck: { status: 'passed' },
};
const completed = serializeReturnTimelineSteps(completedDoc);
assert('completed refund → all steps completed', completed.every((s) => s.status === 'completed'));
assert('completed refund → last step not active', completed[lastStep].status !== 'active');

const guarded = applyRefundTimelineGuards(completedDoc, [
  { id: 'quality_check', label: 'Quality Check', status: 'active' },
  { id: 'refund_processing', label: 'Refund Processing', status: 'active' },
  { id: 'refund_completed', label: 'Refund Completed', status: 'active' },
]);
assert('guards fix stale active refund steps', guarded.every((s) => s.status === 'completed'));

const pending = serializeReturnTimelineSteps({
  returnStatus: 'returned',
  refundStatus: 'pending',
  qualityCheck: { status: 'passed' },
});
assert('pending refund → processing active', pending[7].status === 'active');
assert('pending refund → completed step pending', pending[8].status === 'pending');
assert('pending refund → QC completed', pending[6].status === 'completed');

const processing = serializeReturnTimelineSteps({
  returnStatus: 'returned',
  refundStatus: 'processing',
  qualityCheck: { status: 'passed' },
});
assert('processing refund → processing active', processing[7].status === 'active');

const wallet = serializeReturnTimelineSteps({
  returnStatus: 'refund_completed',
  refundStatus: 'completed',
  qualityCheck: { status: 'passed' },
});
assert('wallet instant complete → all green', wallet.every((s) => s.status === 'completed'));

console.log('\nAll return timeline checks passed.');
