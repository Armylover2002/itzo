import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../src/config/db.js";
import { FoodRestaurant } from "../src/modules/food/restaurant/models/restaurant.model.js";

const rawName = process.argv.slice(2).join(" ").trim();

if (!rawName) {
  console.error("Usage: node scripts/approve-restaurant-by-name.js <restaurant name>");
  process.exit(1);
}

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const run = async () => {
  await connectDB();

  try {
    const rx = new RegExp(`^${escapeRegex(rawName)}$`, "i");
    const restaurant = await FoodRestaurant.findOne({
      $or: [
        { restaurantName: rx },
        { restaurantNameNormalized: String(rawName).trim().toLowerCase().replace(/\s+/g, " ") },
      ],
    });

    if (!restaurant) {
      console.error(`Restaurant not found: ${rawName}`);
      process.exitCode = 1;
      return;
    }

    restaurant.status = "approved";
    restaurant.approvedAt = new Date();
    restaurant.rejectedAt = undefined;
    restaurant.rejectionReason = undefined;

    await restaurant.save({ validateBeforeSave: false });

    console.log(
      JSON.stringify(
        {
          message: "Restaurant approved successfully",
          restaurant: {
            id: String(restaurant._id),
            restaurantName: restaurant.restaurantName,
            status: restaurant.status,
            approvedAt: restaurant.approvedAt,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await disconnectDB();
  }
};

run().catch(async (error) => {
  console.error("Failed to approve restaurant:", error?.message || error);
  try {
    await disconnectDB();
  } catch {}
  process.exit(1);
});
