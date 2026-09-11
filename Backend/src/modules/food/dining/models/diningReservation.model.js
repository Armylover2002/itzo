import mongoose from 'mongoose';

/** Small, self-contained copy of the status-history entry shape used by
 * FoodOrder — kept local to the dining module rather than importing from
 * orders/models/order.model.js so the two modules stay fully decoupled. */
const diningStatusHistorySchema = new mongoose.Schema(
    {
        at: { type: Date, default: Date.now },
        byRole: { type: String, enum: ['USER', 'RESTAURANT', 'ADMIN', 'SYSTEM'] },
        byId: { type: mongoose.Schema.Types.ObjectId },
        from: { type: String },
        to: { type: String },
        note: { type: String, default: '' },
    },
    { _id: false },
);

const diningReservationSchema = new mongoose.Schema(
    {
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodUser', required: true, index: true },

        // Date-only semantics — time-of-day lives in slotStart/slotEnd, matching the
        // "HH:mm" string convention already used by FoodRestaurantOutletTimings.
        bookingDate: { type: Date, required: true, index: true },
        day: { type: String, required: true, trim: true }, // weekday name, cached for fast slot-capacity lookups
        slotStart: { type: String, required: true, trim: true }, // "HH:mm"
        slotEnd: { type: String, required: true, trim: true },   // "HH:mm"
        guests: { type: Number, required: true, min: 1 },

        status: {
            type: String,
            enum: ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'],
            default: 'pending',
            index: true,
        },
        specialRequest: { type: String, trim: true, default: '' },
        cancellationReason: { type: String, trim: true, default: '' },
        statusHistory: { type: [diningStatusHistorySchema], default: [] },

        // Set once the restaurant starts building a bill for this visit.
        billId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiningBill', default: null },

        // Snapshots for cheap list rendering without populate — never authoritative.
        restaurantNameSnapshot: { type: String, trim: true, default: '' },
        userNameSnapshot: { type: String, trim: true, default: '' },
        userPhoneSnapshot: { type: String, trim: true, default: '' },
    },
    { collection: 'dining_reservations', timestamps: true },
);

// Powers the availability-count query (sum guests already booked for a given
// restaurant/date/slot) and the restaurant's "today's bookings" list.
diningReservationSchema.index({ restaurantId: 1, bookingDate: 1, slotStart: 1 });
diningReservationSchema.index({ userId: 1, createdAt: -1 });

export const DiningReservation = mongoose.model('DiningReservation', diningReservationSchema, 'dining_reservations');
