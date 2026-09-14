import { DiningBill } from '../models/diningBill.model.js';
import { DiningReservation } from '../models/diningReservation.model.js';
import { DiningProfile } from '../models/diningProfile.model.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import { getDiningSettings } from './diningSettings.service.js';
import { creditWallet } from '../../../../core/payments/wallet.service.js';
import { createRazorpayOrder, verifyPaymentSignature, isRazorpayConfigured } from '../../orders/helpers/razorpay.helper.js';
import { logger } from '../../../../utils/logger.js';
import { notifyOwnerWithInbox } from '../../../../core/notifications/ownerInboxNotify.js';
import { resolveEffectiveCommission, computeCommissionAmount, roundMoney } from '../utils/dining.helpers.js';

async function resolveBillItems(restaurantId, items) {
    const foodItemIds = items.filter((i) => i.foodItemId).map((i) => i.foodItemId);
    const foodItems = foodItemIds.length
        ? await FoodItem.find({ _id: { $in: foodItemIds }, restaurantId, approvalStatus: 'approved' }).select('name price').lean()
        : [];
    const foodItemMap = new Map(foodItems.map((f) => [String(f._id), f]));

    return items.map((item) => {
        const resolved = item.foodItemId ? foodItemMap.get(String(item.foodItemId)) : null;
        const name = resolved?.name || item.name;
        const price = resolved ? resolved.price : item.price;
        const quantity = Number(item.quantity) || 1;
        return {
            foodItemId: item.foodItemId || null,
            name,
            price: roundMoney(price),
            quantity,
            total: roundMoney(price * quantity),
        };
    });
}

async function recomputeBillTotals(bill, restaurantId) {
    const settings = await getDiningSettings();
    const profile = await DiningProfile.findOne({ restaurantId }).lean();

    const subtotal = roundMoney(bill.items.reduce((sum, i) => sum + i.total, 0));
    const taxPercent = Number(settings?.taxPercent) || 0;
    const taxAmount = roundMoney(subtotal * taxPercent / 100);
    const discount = roundMoney(bill.discount || 0);
    const grandTotal = roundMoney(Math.max(0, subtotal + taxAmount - discount));

    const commission = resolveEffectiveCommission(profile, settings);
    const commissionAmount = computeCommissionAmount(grandTotal, commission);
    const restaurantPayout = roundMoney(Math.max(0, grandTotal - commissionAmount));

    bill.subtotal = subtotal;
    bill.taxPercent = taxPercent;
    bill.taxAmount = taxAmount;
    bill.discount = discount;
    bill.grandTotal = grandTotal;
    bill.commission = { type: commission.type, value: commission.value, amount: commissionAmount };
    bill.restaurantPayout = restaurantPayout;

    return bill;
}

export async function startOrUpdateBill(restaurantId, reservationId, { items, discount }, restaurantUserId) {
    const reservation = await DiningReservation.findOne({ _id: reservationId, restaurantId });
    if (!reservation) throw new ValidationError('Reservation not found');
    if (!['seated', 'completed'].includes(reservation.status)) {
        throw new ValidationError('Bill can only be created once the guest is seated');
    }

    const resolvedItems = await resolveBillItems(restaurantId, items);

    let bill = await DiningBill.findOne({ reservationId });
    if (!bill) {
        bill = new DiningBill({
            reservationId,
            restaurantId,
            userId: reservation.userId,
            createdByRole: 'RESTAURANT',
            createdById: restaurantUserId,
        });
    } else if (bill.status !== 'draft') {
        throw new ValidationError('This bill has already been finalized');
    }

    bill.items = resolvedItems;
    bill.discount = discount || 0;
    await recomputeBillTotals(bill, restaurantId);
    await bill.save();

    if (!reservation.billId) {
        reservation.billId = bill._id;
        await reservation.save();
    }

    return bill;
}

export async function finalizeBill(restaurantId, billId) {
    const bill = await DiningBill.findOne({ _id: billId, restaurantId });
    if (!bill) throw new ValidationError('Bill not found');
    if (bill.status !== 'draft') throw new ValidationError('Bill has already been finalized');
    if (!bill.items.length) throw new ValidationError('Add at least one item before finalizing');

    bill.status = 'finalized';
    bill.finalizedAt = new Date();
    await bill.save();

    try {
        await notifyOwnerWithInbox(
            { ownerType: 'USER', ownerId: bill.userId },
            {
                title: 'Your dining bill is ready',
                body: `Total amount: ₹${bill.grandTotal}. Please complete the payment to finish your visit.`,
                link: `/food/user/dining/bookings/${bill.reservationId}`,
                category: 'dining',
            }
        );
    } catch {
        // notification failure should not block finalization
    }

    return bill;
}

export async function getBillForRestaurant(restaurantId, billId) {
    const bill = await DiningBill.findOne({ _id: billId, restaurantId }).lean();
    if (!bill) throw new ValidationError('Bill not found');
    return bill;
}

export async function getBillForUser(userId, billId) {
    const bill = await DiningBill.findOne({ _id: billId, userId }).lean();
    if (!bill) throw new ValidationError('Bill not found');
    return bill;
}

export async function listAllBillsAdmin({ status, page = 1, limit = 20 } = {}) {
    const filter = status ? { status } : {};
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
        DiningBill.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
        DiningBill.countDocuments(filter),
    ]);
    return { items, total, page: Number(page), limit: Number(limit) };
}

export async function getDiningRevenueStats() {
    const [agg] = await DiningBill.aggregate([
        { $match: { status: { $in: ['paid', 'settled'] } } },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$grandTotal' },
                totalCommission: { $sum: '$commission.amount' },
                totalPayout: { $sum: '$restaurantPayout' },
                billCount: { $sum: 1 },
            },
        },
    ]);

    return {
        totalRevenue: roundMoney(agg?.totalRevenue || 0),
        totalCommission: roundMoney(agg?.totalCommission || 0),
        totalPayout: roundMoney(agg?.totalPayout || 0),
        billCount: agg?.billCount || 0,
    };
}

export async function createBillPaymentOrder(userId, billId) {
    if (!isRazorpayConfigured()) throw new ValidationError('Online payments are not configured right now');

    const bill = await DiningBill.findOne({ _id: billId, userId });
    if (!bill) throw new ValidationError('Bill not found');
    if (bill.status !== 'finalized') throw new ValidationError('Bill is not ready for payment');

    const amountPaise = Math.round(bill.grandTotal * 100);
    const order = await createRazorpayOrder(amountPaise, 'INR', `dining-bill-${bill._id}`);

    bill.payment = {
        ...bill.payment,
        status: 'created',
        razorpay: { ...bill.payment?.razorpay, orderId: order.id },
    };
    await bill.save();

    return { orderId: order.id, amount: order.amount, currency: order.currency, billId: String(bill._id) };
}

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
        logger.error(`[DiningBill] Wallet settlement failed for bill ${bill._id}: ${err.message}`);
        return false;
    }
}

export async function verifyBillPayment(userId, billId, { razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
    const bill = await DiningBill.findOne({ _id: billId, userId });
    if (!bill) throw new ValidationError('Bill not found');
    if (bill.payment?.status === 'paid') return bill;

    const valid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!valid) throw new ValidationError('Payment verification failed');

    const claimed = await DiningBill.findOneAndUpdate(
        { _id: billId, 'payment.status': { $ne: 'paid' } },
        {
            $set: {
                'payment.status': 'paid',
                'payment.razorpay.paymentId': razorpay_payment_id,
                'payment.razorpay.signature': razorpay_signature,
                status: 'paid',
                paidAt: new Date(),
            },
        },
        { new: true }
    );
    if (!claimed) return bill;

    await DiningReservation.updateOne({ _id: claimed.reservationId }, { $set: { status: 'completed' } });
    await settleBillWallets(claimed);

    return DiningBill.findById(billId).lean();
}
