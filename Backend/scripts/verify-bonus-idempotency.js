/**
 * Manual / CI proof script for bonus idempotency.
 *
 * Usage (from Backend/, with .env loaded / server DB reachable):
 *   node scripts/verify-bonus-idempotency.js
 *
 * Requires env:
 *   MONGODB_URI
 *   VERIFY_BONUS_PARTNER_ID   (approved delivery partner ObjectId)
 *   VERIFY_BONUS_ADMIN_ID     (optional admin ObjectId for performer)
 */
import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { addDeliveryPartnerBonus } from '../src/modules/food/admin/services/admin.service.js';
import { DeliveryBonusTransaction } from '../src/modules/food/admin/models/deliveryBonusTransaction.model.js';
import { DeliveryBonusIdempotency } from '../src/modules/food/admin/models/deliveryBonusIdempotency.model.js';
import { FoodDeliveryWallet } from '../src/modules/food/delivery/models/deliveryWallet.model.js';
import { ensureDeliveryBonusIdempotencyIndexes } from '../src/modules/food/admin/database/bonusIndexManager.js';

const partnerId = process.env.VERIFY_BONUS_PARTNER_ID;
const adminId = process.env.VERIFY_BONUS_ADMIN_ID || null;

async function main() {
  if (!partnerId) {
    console.error('Set VERIFY_BONUS_PARTNER_ID');
    process.exit(1);
  }

  await mongoose.connect(config.mongodbUri, { autoIndex: false });
  await ensureDeliveryBonusIdempotencyIndexes();

  const key = `bonus-verify-${Date.now()}-a53c-4e2b-831e-0ed0502bb125`;
  const adminUser = adminId ? { userId: adminId, role: 'ADMIN' } : null;

  const walletBefore = await FoodDeliveryWallet.findOne({ deliveryPartnerId: partnerId }).lean();
  const balBefore = Number(walletBefore?.balance || 0);

  const body = {
    deliveryPartnerId: partnerId,
    amount: 1,
    reference: 'idempotency-verify',
    idempotencyKey: key
  };

  const r1 = await addDeliveryPartnerBonus(body, adminUser, { idempotencyKey: key, requestId: 'verify-1' });
  const r2 = await addDeliveryPartnerBonus(body, adminUser, { idempotencyKey: key, requestId: 'verify-2' });

  const txnCount = await DeliveryBonusTransaction.countDocuments({ idempotencyKey: key });
  const claimCount = await DeliveryBonusIdempotency.countDocuments({ key });
  const walletAfter = await FoodDeliveryWallet.findOne({ deliveryPartnerId: partnerId }).lean();
  const balAfter = Number(walletAfter?.balance || 0);

  const ok =
    txnCount === 1 &&
    claimCount === 1 &&
    balAfter === balBefore + 1 &&
    r1.transaction.transactionId === r2.transaction.transactionId &&
    r2.idempotentReplay === true;

  console.log(
    JSON.stringify(
      {
        ok,
        key,
        txnCount,
        claimCount,
        balBefore,
        balAfter,
        expectedBalance: balBefore + 1,
        firstTxn: r1.transaction.transactionId,
        secondTxn: r2.transaction.transactionId,
        secondReplay: r2.idempotentReplay
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
  process.exit(ok ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
