/**
 * Finds DiningBill docs stuck at status "paid" — the guest was charged
 * successfully but the restaurant-payout / admin-commission wallet credit
 * failed (e.g. the `category: 'dining_payout'` enum bug fixed alongside this
 * script) — and retries the settlement for each one.
 *
 * Safe to re-run any time: settleBillWallets only flips a bill to "settled"
 * once the wallet credits succeed, so a bill that fails again just stays
 * "paid" and gets picked up again next run.
 *
 * Run: node scripts/settle-unsettled-dining-bills.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import { connectDB } from '../src/config/db.js';
import { DiningBill } from '../src/modules/food/dining/models/diningBill.model.js';
import { settleBillWallets } from '../src/modules/food/dining/services/diningBill.service.js';

const run = async () => {
    await connectDB();

    const unsettled = await DiningBill.find({ status: 'paid' }).lean();
    console.log(`Found ${unsettled.length} paid-but-unsettled dining bill(s).`);

    let settled = 0;
    let stillFailing = 0;
    for (const bill of unsettled) {
        const ok = await settleBillWallets(bill);
        if (ok) {
            settled += 1;
            console.log(`OK   settled bill ${bill._id} — restaurant +₹${bill.restaurantPayout}, commission +₹${bill.commission?.amount || 0}`);
        } else {
            stillFailing += 1;
            console.log(`FAIL bill ${bill._id} still could not settle — check logs above`);
        }
    }

    console.log(`\n${settled} settled, ${stillFailing} still failing.`);
    await mongoose.disconnect();
    process.exit(stillFailing === 0 ? 0 : 1);
};

run().catch((e) => { console.error('FATAL', e); process.exit(1); });
