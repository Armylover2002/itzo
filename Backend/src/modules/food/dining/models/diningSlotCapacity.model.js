import mongoose from 'mongoose';

const { Schema } = mongoose;

const diningSlotCapacitySchema = new Schema(
    {
        restaurantId: { type: Schema.Types.ObjectId, ref: 'FoodRestaurant', required: true },
        bookingDateKey: { type: String, required: true },
        slotStart: { type: String, required: true },
        bookedGuests: { type: Number, default: 0 },
    },
    { timestamps: true }
);

diningSlotCapacitySchema.index(
    { restaurantId: 1, bookingDateKey: 1, slotStart: 1 },
    { unique: true }
);

export const DiningSlotCapacity = mongoose.model('DiningSlotCapacity', diningSlotCapacitySchema, 'dining_slot_capacity');
