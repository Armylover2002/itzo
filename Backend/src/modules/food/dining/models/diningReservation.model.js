import mongoose from 'mongoose';

const { Schema } = mongoose;

const statusHistorySchema = new Schema(
    {
        at: { type: Date, default: Date.now },
        byRole: { type: String, enum: ['USER', 'RESTAURANT', 'ADMIN', 'SYSTEM'] },
        byId: { type: Schema.Types.ObjectId },
        from: { type: String },
        to: { type: String },
        note: { type: String },
    },
    { _id: false }
);

const diningReservationSchema = new Schema(
    {
        restaurantId: { type: Schema.Types.ObjectId, ref: 'FoodRestaurant', required: true, index: true },
        userId: { type: Schema.Types.ObjectId, ref: 'FoodUser', required: true, index: true },
        bookingDate: { type: Date, required: true },
        day: { type: String, required: true },
        slotStart: { type: String, required: true },
        slotEnd: { type: String, required: true },
        guests: { type: Number, required: true, min: 1 },
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'],
            default: 'pending',
            index: true,
        },
        specialRequest: { type: String, default: '' },
        cancellationReason: { type: String, default: '' },
        statusHistory: { type: [statusHistorySchema], default: [] },
        billId: { type: Schema.Types.ObjectId, ref: 'DiningBill' },
        restaurantNameSnapshot: { type: String, default: '' },
        userNameSnapshot: { type: String, default: '' },
        userPhoneSnapshot: { type: String, default: '' },
    },
    { timestamps: true }
);

diningReservationSchema.index({ restaurantId: 1, bookingDate: 1, slotStart: 1 });
diningReservationSchema.index({ userId: 1, createdAt: -1 });

export const DiningReservation = mongoose.model('DiningReservation', diningReservationSchema, 'dining_reservations');
