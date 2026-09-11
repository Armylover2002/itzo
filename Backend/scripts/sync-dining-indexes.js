/**
 * The app connects with autoIndex disabled (see src/config/db.js), so a
 * schema-declared index — like DiningSlotCapacity's unique
 * (restaurantId, bookingDateKey, slotStart) index that the booking-capacity
 * guard depends on — is never actually created in MongoDB just by deploying
 * the model. Run this once after deploying the Dining feature (same pattern
 * already used by verify-finance-integrity.js for SellerTransaction /
 * ProcessedWebhookEvent).
 *
 * Run: npm run sync:dining-indexes
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import { connectDB } from '../src/config/db.js';
import { DiningSlotCapacity } from '../src/modules/food/dining/models/diningSlotCapacity.model.js';
import { DiningProfile } from '../src/modules/food/dining/models/diningProfile.model.js';
import { DiningBill } from '../src/modules/food/dining/models/diningBill.model.js';

const run = async () => {
    await connectDB();

    for (const [name, Model] of [
        ['DiningSlotCapacity', DiningSlotCapacity],
        ['DiningProfile', DiningProfile],
        ['DiningBill', DiningBill],
    ]) {
        try {
            await Model.syncIndexes();
            console.log(`OK   ${name} indexes in sync`);
        } catch (err) {
            console.log(`FAIL ${name} index sync: ${err.message}`);
            console.log('     (usually means duplicate rows already exist and must be merged first)');
        }
    }

    await mongoose.disconnect();
};

run().catch((e) => { console.error('FATAL', e); process.exit(1); });
