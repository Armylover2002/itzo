import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import { connectDB } from '../src/config/db.js';
import { FoodRestaurant } from '../src/modules/food/restaurant/models/restaurant.model.js';
import { FoodUser } from '../src/core/users/user.model.js';
import { DiningProfile } from '../src/modules/food/dining/models/diningProfile.model.js';
import { DiningReservation } from '../src/modules/food/dining/models/diningReservation.model.js';
import { DiningSlotCapacity } from '../src/modules/food/dining/models/diningSlotCapacity.model.js';
import * as requestService from '../src/modules/food/dining/services/diningRequest.service.js';
import * as setupService from '../src/modules/food/dining/services/diningSetup.service.js';
import * as publicService from '../src/modules/food/dining/services/diningPublic.service.js';
import * as reservationService from '../src/modules/food/dining/services/diningReservation.service.js';
import { FoodRestaurantWallet } from '../src/modules/food/restaurant/models/restaurantWallet.model.js';
import { FoodRestaurantWithdrawal } from '../src/modules/food/restaurant/models/foodRestaurantWithdrawal.model.js';
import { creditWallet } from '../src/core/payments/wallet.service.js';
import { getRestaurantFinance } from '../src/modules/food/restaurant/services/restaurantFinance.service.js';
import { updateWithdrawalStatus } from '../src/modules/food/admin/services/admin.service.js';

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
    ok ? pass++ : fail++;
};

const run = async () => {
    await connectDB();

    const restaurant = await FoodRestaurant.findOne({ status: 'approved' }).select('_id restaurantName').lean();
    const user = await FoodUser.findOne({ role: 'USER' }).select('_id name').lean();
    if (!restaurant || !user) {
        console.log('Need at least one approved restaurant and one user in the DB to run this test.');
        process.exit(1);
    }
    console.log(`Using restaurant "${restaurant.restaurantName}" (${restaurant._id}) and user "${user.name || user._id}"`);

    // Clean slate for this restaurant's dining profile before testing.
    await DiningProfile.deleteMany({ restaurantId: restaurant._id });
    await DiningReservation.deleteMany({ restaurantId: restaurant._id, specialRequest: '__DIAG_TEST__' });
    await DiningSlotCapacity.deleteMany({ restaurantId: restaurant._id });

    let withdrawalIdToClean = null;

    try {
        // 1. Request -> approve -> configure a tiny 4-seat slot -> enable.
        const requested = await requestService.requestDining(restaurant._id);
        check('request creates status=pending', requested.status === 'pending');

        const profileDoc = await DiningProfile.findOne({ restaurantId: restaurant._id });
        const approved = await requestService.reviewDiningRequest(profileDoc._id, { approve: true, adminId: null });
        check('admin approval sets status=approved', approved.status === 'approved');

        // Pick tomorrow so "minAdvanceBookingMinutes" never rejects the test.
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][tomorrow.getDay()];
        const dateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

        await setupService.updateDiningSetup(restaurant._id, {
            slots: [{ day, isOpen: true, openingTime: '18:00', closingTime: '19:00', slotDurationMinutes: 60, capacityPerSlot: 4 }],
            ambienceImages: ['https://example.com/test-ambience.jpg'],
        });
        const enabled = await setupService.toggleDiningEnabled(restaurant._id, true);
        check('restaurant can enable dining after setting capacity', enabled.isDiningEnabled === true);

        // 2. Availability should show 4 remaining seats in the one slot.
        const availability = await publicService.getDiningAvailability(restaurant._id, dateStr);
        check('one slot generated with 4 remaining seats', availability.slots.length === 1 && availability.slots[0].remaining === 4,
            JSON.stringify(availability.slots));

        // 3. THE KEY TEST: 3 concurrent bookings of 2 guests each against a 4-seat slot.
        // Exactly 2 should succeed (4 seats used), 1 must be rejected as full.
        const attempt = () => reservationService.createReservation(user._id, {
            restaurantId: restaurant._id,
            date: dateStr,
            slotStart: availability.slots[0].start,
            guests: 2,
            specialRequest: '__DIAG_TEST__',
        });
        const results = await Promise.allSettled([attempt(), attempt(), attempt()]);
        const succeeded = results.filter((r) => r.status === 'fulfilled').length;
        const rejected = results.filter((r) => r.status === 'rejected');
        check('concurrent overbooking is prevented (exactly 2 of 3 succeed)', succeeded === 2 && rejected.length === 1,
            `succeeded=${succeeded}, rejectedReasons=${rejected.map((r) => r.reason?.message).join(' | ')}`);

        const capacityDoc = await DiningSlotCapacity.findOne({ restaurantId: restaurant._id, bookingDateKey: dateStr, slotStart: availability.slots[0].start }).lean();
        check('capacity counter reflects exactly 4 booked guests (not 6)', capacityDoc?.bookedGuests === 4, `bookedGuests=${capacityDoc?.bookedGuests}`);

        // 4. A 4th attempt for the now-full slot must also be rejected.
        let fourthRejected = false;
        try { await attempt(); } catch (e) { fourthRejected = /no longer has enough seats/i.test(e.message); }
        check('booking a fully-booked slot is rejected', fourthRejected);

        // 5. Cancelling a reservation frees the seats back up.
        const remaining = await DiningReservation.findOne({ restaurantId: restaurant._id, specialRequest: '__DIAG_TEST__' });
        const cancelled = await reservationService.cancelReservationByUser(user._id, remaining._id, 'test cleanup');
        check('cancellation succeeds', cancelled.status === 'cancelled');
        const capacityAfterCancel = await DiningSlotCapacity.findOne({ restaurantId: restaurant._id, bookingDateKey: dateStr, slotStart: availability.slots[0].start }).lean();
        check('cancellation releases the seats back to the counter', capacityAfterCancel?.bookedGuests === 2, `bookedGuests=${capacityAfterCancel?.bookedGuests}`);

        // 6. Dining payouts must be visible on the restaurant's earnings page and
        // actually withdrawable — this is the bug where wallet.balance (the only
        // thing Dining payouts touch) was excluded from availableBalance.
        const walletBefore = await FoodRestaurantWallet.findOne({ restaurantId: restaurant._id }).select('balance').lean();
        const baselineBalance = Number(walletBefore?.balance || 0);
        await creditWallet({
            entityType: 'restaurant',
            entityId: String(restaurant._id),
            amount: 250,
            description: '__DIAG_TEST__ dining payout',
            category: 'other',
        });

        const financeAfterCredit = await getRestaurantFinance(restaurant._id);
        check('dining payout shows up in restaurant earnings.diningEarnings', financeAfterCredit?.earnings?.diningEarnings === baselineBalance + 250,
            `diningEarnings=${financeAfterCredit?.earnings?.diningEarnings}`);
        check('dining payout is included in availableBalance (withdrawable)', financeAfterCredit?.earnings?.availableBalance >= baselineBalance + 250,
            `availableBalance=${financeAfterCredit?.earnings?.availableBalance}`);

        // 7. Approving a withdrawal request must debit the wallet so the same
        // Dining money can't be withdrawn twice.
        const withdrawal = await FoodRestaurantWithdrawal.create({
            restaurantId: restaurant._id,
            amount: baselineBalance + 250,
            status: 'pending',
        });
        withdrawalIdToClean = withdrawal._id;
        await updateWithdrawalStatus(withdrawal._id, { status: 'approved' });
        const walletAfterApproval = await FoodRestaurantWallet.findOne({ restaurantId: restaurant._id }).select('balance').lean();
        check('approving the withdrawal debits the dining wallet balance', Number(walletAfterApproval?.balance || 0) === 0,
            `balance=${walletAfterApproval?.balance}`);

        console.log(`\n${pass} passed, ${fail} failed`);
    } finally {
        await DiningReservation.deleteMany({ restaurantId: restaurant._id, specialRequest: { $in: ['__DIAG_TEST__', 'test cleanup'] } });
        await DiningSlotCapacity.deleteMany({ restaurantId: restaurant._id });
        await DiningProfile.deleteMany({ restaurantId: restaurant._id });
        if (withdrawalIdToClean) {
            await FoodRestaurantWithdrawal.deleteOne({ _id: withdrawalIdToClean });
        }
        await mongoose.disconnect();
    }
    process.exit(fail === 0 ? 0 : 1);
};

run().catch((e) => { console.error('FATAL', e); process.exit(1); });
