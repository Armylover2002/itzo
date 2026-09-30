import mongoose from "mongoose";

const shiftSchema = new mongoose.Schema(
  {
    openingTime: { type: String, trim: true }, // "HH:mm"
    closingTime: { type: String, trim: true }, // "HH:mm"
  },
  { _id: false },
);

const dayTimingSchema = new mongoose.Schema(
  {
    day: { type: String, required: true, trim: true },
    isOpen: { type: Boolean, default: true },
    // Back-compat mirror of shifts[0]. Kept in sync by outletTimings.service.js.
    openingTime: { type: String, trim: true }, // "HH:mm"
    closingTime: { type: String, trim: true }, // "HH:mm"
    // Richer source of truth: up to 3 shifts/day. Empty/absent -> callers fall back to
    // treating openingTime/closingTime above as a single implicit shift.
    shifts: {
      type: [shiftSchema],
      default: undefined,
      validate: {
        validator: (v) => !Array.isArray(v) || v.length <= 3,
        message: 'A maximum of 3 shifts is allowed per day',
      },
    },
  },
  { _id: false },
);

const outletTimingsSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FoodRestaurant",
      required: true,
      unique: true,
      index: true,
    },
    timings: {
      type: [dayTimingSchema],
      default: [],
    },
  },
  {
    collection: 'food_restaurant_outlet_timings',
    timestamps: true,
  },
);

export const FoodRestaurantOutletTimings = mongoose.model(
  "FoodRestaurantOutletTimings",
  outletTimingsSchema,
);
