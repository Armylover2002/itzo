/**
 * Runtime smoke: quality-pass on a returned UPI/Bank return -> refund pending
 * Usage: node scripts/verify-quality-pass.js [returnMongoId]
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, disconnectDB, assertMongoConnected } from '../src/config/db.js';
import { SellerReturn } from '../src/modules/quick-commerce/seller/models/sellerReturn.model.js';
import { passReturnQualityCheckAndRefund } from '../src/modules/quick-commerce/services/quickReturnFinance.service.js';
import { RETURN_STATUSES, REFUND_STATUSES } from '../src/modules/quick-commerce/utils/return.helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  await connectDB();
  assertMongoConnected();

  const returnIdArg = process.argv[2] || '';
  const filter = returnIdArg
    ? { _id: returnIdArg }
    : {
        returnStatus: RETURN_STATUSES.RETURNED,
        refundMethod: { $in: ['upi', 'bank'] },
        'qualityCheck.status': { $ne: 'passed' },
      };

  const candidate = await SellerReturn.findOne(filter).sort({ updatedAt: -1 });
  if (!candidate) {
    console.log('No eligible return found for quality-pass smoke test');
    await disconnectDB();
    process.exit(0);
  }

  console.log('Testing quality-pass on return:', {
    _id: candidate._id,
    orderId: candidate.orderId,
    returnStatus: candidate.returnStatus,
    refundMethod: candidate.refundMethod,
    refundStatus: candidate.refundStatus,
  });

  const beforeStatus = candidate.refundStatus;
  const result = await passReturnQualityCheckAndRefund({
    returnId: String(candidate._id),
    actorId: null,
    actorRole: 'ADMIN',
    notes: 'Runtime smoke test',
    force: true,
  });

  const after = await SellerReturn.findById(candidate._id).lean();
  console.log('\n=== Result ===');
  console.log(JSON.stringify({
    qualityPassed: result.qualityPassed,
    refundQueued: result.refundQueued,
    message: result.message,
    beforeRefundStatus: beforeStatus,
    afterRefundStatus: after?.refundStatus,
    qualityCheckStatus: after?.qualityCheck?.status,
    success:
      after?.qualityCheck?.status === 'passed' &&
      (after?.refundStatus === REFUND_STATUSES.PENDING || after?.refundStatus === REFUND_STATUSES.COMPLETED),
  }, null, 2));

  await disconnectDB();
}

main().catch(async (error) => {
  console.error('Quality-pass smoke failed:', error);
  try {
    await disconnectDB();
  } catch {
    // ignore
  }
  process.exit(1);
});
