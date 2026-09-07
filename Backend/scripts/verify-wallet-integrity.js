import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { connectDB } from '../src/config/db.js';
import { FoodUserWallet } from '../src/modules/food/user/models/userWallet.model.js';
import { deductWalletBalance, refundWalletBalance } from '../src/modules/food/user/services/userWallet.service.js';

const TEST_USER = new mongoose.Types.ObjectId();
const bal = async () => Number((await FoodUserWallet.findOne({ userId: TEST_USER }).lean())?.balance || 0);
const txCount = async () => ((await FoodUserWallet.findOne({ userId: TEST_USER }).lean())?.transactions || []).length;

const run = async () => {
  await connectDB();
  let pass = 0, fail = 0;
  const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
    ok ? pass++ : fail++;
  };

  try {
    await FoodUserWallet.create({ userId: TEST_USER, balance: 500, transactions: [] });

    // 1. Debit within balance
    await deductWalletBalance(TEST_USER, 200, 'test debit');
    check('debit within balance', await bal() === 300, `balance=${await bal()}`);

    // 2. Debit exceeding balance must be rejected and must not change balance
    let rejected = false;
    try { await deductWalletBalance(TEST_USER, 1000, 'over debit'); }
    catch (e) { rejected = /insufficient/i.test(e.message); }
    check('over-balance debit rejected', rejected && (await bal()) === 300, `balance=${await bal()}`);

    // 3. Concurrency: 5 parallel debits of 100 against a balance of 300 → exactly 3 succeed
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => deductWalletBalance(TEST_USER, 100, 'concurrent debit'))
    );
    const ok = results.filter(r => r.status === 'fulfilled').length;
    const endBal = await bal();
    check('concurrent debits do not overdraw', ok === 3 && endBal === 0, `succeeded=${ok}/5, balance=${endBal}`);

    // 4. Refund credits
    await refundWalletBalance(TEST_USER, 150, 'test refund');
    check('refund credits wallet', await bal() === 150, `balance=${await bal()}`);

    // 5. Refund inside an ABORTED transaction must leave balance untouched
    const before = await bal();
    const beforeTx = await txCount();
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await refundWalletBalance(TEST_USER, 999, 'rollback refund', {}, { session });
        throw new Error('intentional-rollback');
      });
    } catch (e) { /* expected */ }
    finally { await session.endSession(); }
    const after = await bal();
    check('aborted refund rolls back', after === before && (await txCount()) === beforeTx,
          `before=${before} after=${after}`);

    // 6. Debit inside an ABORTED transaction must leave balance untouched
    const b2 = await bal();
    const s2 = await mongoose.startSession();
    try {
      await s2.withTransaction(async () => {
        await deductWalletBalance(TEST_USER, 50, 'rollback debit', {}, { session: s2 });
        throw new Error('intentional-rollback');
      });
    } catch (e) { /* expected */ }
    finally { await s2.endSession(); }
    check('aborted debit rolls back', (await bal()) === b2, `before=${b2} after=${await bal()}`);

    console.log(`\n${pass} passed, ${fail} failed`);
  } finally {
    await FoodUserWallet.deleteMany({ userId: TEST_USER });
    await mongoose.connection.collection('foodusers').deleteOne({ _id: TEST_USER }).catch(() => {});
    await mongoose.disconnect();
  }
  process.exit(fail === 0 ? 0 : 1);
};

run().catch(e => { console.error('FATAL', e); process.exit(1); });
