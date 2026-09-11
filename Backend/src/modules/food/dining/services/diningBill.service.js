import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { DiningBill } from '../models/diningBill.model.js';
import { DiningReservation } from '../models/diningReservation.model.js';
import { DiningProfile } from '../models/diningProfile.model.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { getDiningSettings } from './diningSettings.service.js';
import { parseDateOnly } from './diningPublic.service.js';
import { resolveEffectiveCommission, computeCommissionAmount, roundMoney } from '../utils/dining.helpers.js';
import { createRazorpayOrder, getRazorpayKeyId, verifyOrderPayment } from '../../orders/helpers/razorpay.helper.js';
import { creditWallet } from '../../../../core/payments/wallet.service.js';
import { logger } from '../../../../utils/logger.js';

/** Resolves each requested line item's authoritative price server-side —
 * menu-sourced items are never trusted for price/name from the client, only
 * quantity. Custom (off-menu) items must supply their own name+price. */
async function resolveBillItems(restaurantId, rawItems = []) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
        throw new ValidationError('A bill needs at least one item');
    }

    const menuIds = rawItems
        .map((it) => it.foodItemId)
        .filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)));

    const menuItems = menuIds.length
        ? await FoodItem.find({ _id: { $in: menuIds }, restaurantId, approvalStatus: 'approved' })
            .select('name price')
            .lean()
        : [];
    const menuMap = new Map(menuItems.map((m) => [String(m._id), m]));

    return rawItems.map((raw) => {
        const quantity = Number(raw.quantity);
        if (!Number.isFinite(quantity) || quantity < 1) {
            throw new ValidationError('Every bill item needs a quantity of at least 1');
        }

        if (raw.foodItemId) {
            const menuItem = menuMap.get(String(raw.foodItemId));
            if (!menuItem) throw new ValidationError('One of the selected menu items is not available');
            return {
                foodItemId: menuItem._id,
                name: menuItem.name,
                price: menuItem.price,
                quantity,
                total: roundMoney(menuItem.price * quantity),
            };
        }

        // Custom / off-menu line.
        const name = String(raw.name || '').trim();
        const price = Number(raw.price);
        if (!name) throw new ValidationError('Custom bill items need a name');
        if (!Number.isFinite(price) || price < 0) throw new ValidationError('Custom bill items need a valid price');
        return { foodItemId: null, name, price, quantity, total: roundMoney(price * quantity) };
    });
}

/** Restaurant-side: create or edit a bill while it's still a draft. Recomputes
 * subtotal/tax/commission/grandTotal fresh every call so staff always sees an
 * accurate running total — nothing here is frozen until finalizeBill. */
export async function startOrUpdateBill(restaurantId, reservationId, { items, discount, createdById } = {}) {
    if (!mongoose.Types.ObjectId.isValid(String(reservationId))) throw new ValidationError('Invalid booking');

    const reservation = await DiningReservation.findOne({ _id: reservationId, restaurantId });
    if (!reservation) throw new ValidationError('Booking not found');
    if (reservation.status !== 'seated') {
        throw new ValidationError('Guests must be marked "seated" before building a bill');
    }

    let bill = reservation.billId
        ? await DiningBill.findOne({ _id: reservation.billId, restaurantId })
        : await DiningBill.findOne({ reservationId, restaurantId });

    if (bill && bill.status !== 'draft') {
        throw new ValidationError('This bill has already been sent to the guest and can no longer be edited');
    }

    const resolvedItems = await resolveBillItems(restaurantId, items);
    const subtotal = roundMoney(resolvedItems.reduce((sum, it) => sum + it.total, 0));
    const discountAmount = Math.min(Math.max(Number(discount) || 0, 0), subtotal);

    const [settings, profile] = await Promise.all([
        getDiningSettings(),
        DiningProfile.findOne({ restaurantId }).lean(),
    ]);
    const taxPercent = settings.taxPercent || 0;
    const taxAmount = roundMoney(((subtotal - discountAmount) * taxPercent) / 100);
    const grandTotal = roundMoney(subtotal - discountAmount + taxAmount);

    const commission = resolveEffectiveCommission(profile, settings);
    const commissionAmount = computeCommissionAmount(grandTotal, commission);
    const restaurantPayout = roundMoney(grandTotal - commissionAmount);

    const update = {
        restaurantId,
        userId: reservation.userId,
        items: resolvedItems,
        subtotal,
        taxPercent,
        taxAmount,
        discount: discountAmount,
        grandTotal,
        commission: { type: commission.type, value: commission.value, amount: commissionAmount },
        restaurantPayout,
        status: 'draft',
        createdByRole: 'RESTAURANT',
        createdById: createdById || null,
    };

    if (bill) {
        Object.assign(bill, update);
        await bill.save();
    } else {
        bill = await DiningBill.create({ reservationId, ...update });
        reservation.billId = bill._id;
        await reservation.save();
    }

    return bill.toObject();
}

/** Restaurant-side: lock the bill and send it to the guest. No further edits after this. */
export async function finalizeBill(restaurantId, billId, { byId } = {}) {
    if (!mongoose.Types.ObjectId.isValid(String(billId))) throw new ValidationError('Invalid bill');

    const bill = await DiningBill.findOne({ _id: billId, restaurantId, status: 'draft' });
    if (!bill) throw new ValidationError('Bill not found, or it has already been finalized');
    if (!bill.items.length) throw new ValidationError('Add at least one item before finalizing the bill');

    bill.status = 'finalized';
    bill.finalizedAt = new Date();
    await bill.save();

    try {
        const { notifyOwnersSafely } = await import('../../../../core/notifications/firebase.service.js');
        await notifyOwnersSafely(
            [{ ownerType: 'USER', ownerId: bill.userId }],
            { title: 'Your bill is ready', body: `₹${bill.grandTotal} — tap to review and pay.` },
        );
    } catch {
        // Push failures must never block finalizing the bill.
    }

    return bill.toObject();
}

/** Admin-side: every bill across every restaurant, filterable. */
export async function listAllBillsAdmin(query = {}) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 100, 1), 500);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.restaurantId && mongoose.Types.ObjectId.isValid(String(query.restaurantId))) {
        filter.restaurantId = query.restaurantId;
    }

    const [bills, total] = await Promise.all([
        DiningBill.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        DiningBill.countDocuments(filter),
    ]);

    const restaurantIds = [...new Set(bills.map((b) => String(b.restaurantId)))];
    const reservationIds = bills.map((b) => b.reservationId).filter(Boolean);
    const [restaurants, reservations] = await Promise.all([
        restaurantIds.length
            ? FoodRestaurant.find({ _id: { $in: restaurantIds } }).select('restaurantName city area').lean()
            : [],
        reservationIds.length
            ? DiningReservation.find({ _id: { $in: reservationIds } })
                .select('userNameSnapshot userPhoneSnapshot restaurantNameSnapshot bookingDate slotStart guests')
                .lean()
            : [],
    ]);
    const restaurantMap = new Map(restaurants.map((r) => [String(r._id), r]));
    const reservationMap = new Map(reservations.map((r) => [String(r._id), r]));

    const billsOut = bills.map((bill) => ({
        ...bill,
        restaurant: restaurantMap.get(String(bill.restaurantId)) || null,
        reservation: reservationMap.get(String(bill.reservationId)) || null,
    }));

    return { bills: billsOut, total, page, limit };
}

/** Admin dashboard: revenue + commission earned, optionally scoped to a date range. */
export async function getDiningRevenueStats({ from, to } = {}) {
    const match = { status: { $in: ['paid', 'settled'] } };
    if (from || to) {
        match.paidAt = {};
        if (from) match.paidAt.$gte = parseDateOnly(from);
        if (to) {
            const end = parseDateOnly(to);
            end.setHours(23, 59, 59, 999);
            match.paidAt.$lte = end;
        }
    }

    const [agg] = await DiningBill.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$grandTotal' },
                totalCommission: { $sum: '$commission.amount' },
                totalRestaurantPayout: { $sum: '$restaurantPayout' },
                billCount: { $sum: 1 },
            },
        },
    ]);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const bookingsToday = await DiningReservation.countDocuments({
        bookingDate: { $gte: today, $lt: tomorrow },
        status: { $ne: 'cancelled' },
    });

    return {
        totalRevenue: roundMoney(agg?.totalRevenue || 0),
        totalCommission: roundMoney(agg?.totalCommission || 0),
        totalRestaurantPayout: roundMoney(agg?.totalRestaurantPayout || 0),
        billCount: agg?.billCount || 0,
        bookingsToday,
    };
}

export async function getBillForRestaurant(restaurantId, billId) {
    if (!mongoose.Types.ObjectId.isValid(String(billId))) throw new ValidationError('Invalid bill');
    const bill = await DiningBill.findOne({ _id: billId, restaurantId }).lean();
    if (!bill) throw new ValidationError('Bill not found');
    return bill;
}

export async function getBillForUser(userId, billId) {
    if (!mongoose.Types.ObjectId.isValid(String(billId))) throw new ValidationError('Invalid bill');
    const bill = await DiningBill.findOne({ _id: billId, userId }).lean();
    if (!bill) throw new ValidationError('Bill not found');
    return bill;
}

/** User-side: create the Razorpay order for a finalized, unpaid bill. */
export async function createBillPaymentOrder(userId, billId) {
    if (!mongoose.Types.ObjectId.isValid(String(billId))) throw new ValidationError('Invalid bill');

    const bill = await DiningBill.findOne({ _id: billId, userId });
    if (!bill) throw new ValidationError('Bill not found');
    if (bill.status !== 'finalized') {
        throw new ValidationError(bill.status === 'draft' ? 'This bill is not ready yet' : 'This bill has already been paid');
    }

    const amountPaise = Math.round(bill.grandTotal * 100);
    if (amountPaise < 100) throw new ValidationError('Bill amount is too small to pay online');

    const rzOrder = await createRazorpayOrder(amountPaise, 'INR', String(bill._id));
    bill.payment.razorpay.orderId = rzOrder.id;
    bill.payment.status = 'created';
    await bill.save();

    return {
        key: getRazorpayKeyId(),
        orderId: rzOrder.id,
        amount: rzOrder.amount,
        currency: rzOrder.currency || 'INR',
        billId: String(bill._id),
    };
}

/**
 * User-side: verify the Razorpay checkout result and settle the money.
 *
 * The claim (payment.status !== 'paid' -> 'paid') happens in one atomic
 * findOneAndUpdate, so a retried verify call (double-tap, browser refresh, or
 * Razorpay's own client retry) can never re-run the wallet credits below —
 * it simply finds the bill already paid and returns the current state.
 */
export async function verifyBillPayment(userId, billId, { razorpayOrderId, razorpayPaymentId, razorpaySignature } = {}) {
    if (!mongoose.Types.ObjectId.isValid(String(billId))) throw new ValidationError('Invalid bill');

    const bill = await DiningBill.findOne({ _id: billId, userId }).lean();
    if (!bill) throw new ValidationError('Bill not found');
    if (bill.status === 'paid' || bill.status === 'settled') {
        return bill; // already processed — idempotent no-op
    }
    if (bill.status !== 'finalized') throw new ValidationError('This bill is not ready to be paid');

    await verifyOrderPayment({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        expectedOrderId: bill.payment?.razorpay?.orderId,
        expectedAmount: bill.grandTotal,
    });

    const claimed = await DiningBill.findOneAndUpdate(
        { _id: billId, 'payment.status': { $ne: 'paid' } },
        {
            $set: {
                status: 'paid',
                'payment.status': 'paid',
                'payment.razorpay.paymentId': razorpayPaymentId,
                'payment.razorpay.signature': razorpaySignature,
                paidAt: new Date(),
                settlementClaimedAt: new Date(),
            },
        },
        { new: true },
    );

    if (!claimed) {
        // Lost the race to a concurrent verify call — that call already did the work.
        return DiningBill.findById(billId).lean();
    }

    await DiningReservation.updateOne(
        { _id: claimed.reservationId, status: { $ne: 'completed' } },
        { $set: { status: 'completed' } },
    ).catch(() => {});

    await settleBillWallets(claimed);

    return DiningBill.findById(billId).lean();
}

/**
 * Credits the restaurant payout + admin commission for a "paid" bill and
 * flips it to "settled". Split out from verifyBillPayment so a reconciliation
 * script can retry it for bills that got stuck at "paid" because the wallet
 * credit failed (e.g. a bad category value) — never throws past this point,
 * since the payment itself is already captured and claimed.
 */
export async function settleBillWallets(bill) {
    try {
        if (bill.restaurantPayout > 0) {
            await creditWallet({
                entityType: 'restaurant',
                entityId: String(bill.restaurantId),
                amount: bill.restaurantPayout,
                description: `Dining bill payout — ${bill._id}`,
                category: 'other',
                orderId: String(bill.reservationId),
            });
        }
        if (bill.commission?.amount > 0) {
            await creditWallet({
                entityType: 'admin',
                entityId: 'platform',
                amount: bill.commission.amount,
                description: `Dining commission — ${bill._id}`,
                category: 'commission',
                orderId: String(bill.reservationId),
            });
        }
        await DiningBill.updateOne({ _id: bill._id }, { $set: { status: 'settled', settledAt: new Date() } });
        return true;
    } catch (err) {
        // The bill stays "paid" but not "settled"; a reconciliation pass can find
        // and retry these later (same pattern as unsettled order deliveries).
        logger.error(`[DiningBill] Wallet settlement failed for bill ${bill._id}: ${err.message}`);
        return false;
    }
}
