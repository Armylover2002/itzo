import mongoose from 'mongoose';

/**
 * One counter document per (restaurant, date, slot) — the ONLY atomic source
 * of truth for "how many guests are already booked into this slot". A
 * booking can only be created by an atomically-guarded $inc against this
 * counter (see diningReservation.service.js), the same "claim via a single
 * document field, never read-then-write" principle used for the wallet debit
 * guard and the delivery-settlement claim elsewhere in this codebase —
 * without it, two concurrent booking requests can both read "5 seats free"
 * and both succeed, overbooking the slot.
 */
const diningSlotCapacitySchema = new mongoose.Schema(
    {
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', required: true },
        bookingDateKey: { type: String, required: true, trim: true }, // "YYYY-MM-DD"
        slotStart: { type: String, required: true, trim: true }, // "HH:mm"
        bookedGuests: { type: Number, default: 0, min: 0 },
    },
    { collection: 'dining_slot_capacity', timestamps: true },
);

diningSlotCapacitySchema.index({ restaurantId: 1, bookingDateKey: 1, slotStart: 1 }, { unique: true });

export const DiningSlotCapacity = mongoose.model('DiningSlotCapacity', diningSlotCapacitySchema, 'dining_slot_capacity');
