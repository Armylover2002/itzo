/**
 * Places 2 REAL orders (full order engine: createOrder) from a test FoodUser
 * on phone 9755633147, proving the nearest-outlet resolver picks a different
 * restaurantId depending on the delivery address:
 *   Order 1 -> delivery address near the HUB  -> should land on the hub itself.
 *   Order 2 -> delivery address near the OUTLET -> should land on the outlet.
 *
 * Only creates NEW documents (1 FoodUser if missing, 2 orders + their
 * transactions). Does not touch any pre-existing data.
 *
 * Usage: node scripts/test-hub-orders-ritutest.js
 */
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../src/config/db.js";
import { FoodUser } from "../src/core/users/user.model.js";
import { FoodRestaurant } from "../src/modules/food/restaurant/models/restaurant.model.js";
import { FoodItem } from "../src/modules/food/admin/models/food.model.js";
import { resolveNearestOutlet } from "../src/modules/food/restaurant/services/hub.service.js";
import { createOrder } from "../src/modules/food/orders/services/order.service.js";

const CUSTOMER_PHONE = "9755633147";
const HUB_BUSINESS_ID = "REST000034"; // ritutest hub

// Two delivery points: one essentially at the hub's own address, one at the outlet's.
const NEAR_HUB = { lat: 22.7244, lng: 75.8839 };
const NEAR_OUTLET = { lat: 22.736, lng: 75.87 };

const section = (t) => console.log(`\n=== ${t} ===`);

const buildAddress = (label, point) => ({
  label: "Other",
  street: `Test delivery point — ${label}`,
  city: "Indore",
  state: "Madhya Pradesh",
  zipCode: "452001",
  phone: CUSTOMER_PHONE,
  location: { type: "Point", coordinates: [point.lng, point.lat] },
});

const run = async () => {
  await connectDB();
  try {
    section("1. Test customer (FoodUser) — reuse or create");
    let user = await FoodUser.findOne({ phone: CUSTOMER_PHONE });
    if (user) {
      console.log(`Reusing existing FoodUser: ${user._id}`);
    } else {
      user = await FoodUser.create({ phone: CUSTOMER_PHONE, name: "Ritutest Customer" });
      console.log(`Created FoodUser: ${user._id}`);
    }

    const hub = await FoodRestaurant.findOne({ restaurantId: HUB_BUSINESS_ID }).lean();
    if (!hub) throw new Error(`Hub ${HUB_BUSINESS_ID} not found — run test-hub-flow-ritutest.js first`);

    const hubItem = await FoodItem.findOne({ restaurantId: hub._id, name: "Ritutest Test Item" }).lean();
    if (!hubItem) throw new Error("Hub test item not found");
    const outletItem = await FoodItem.findOne({ hubSourceItemId: hubItem._id }).lean();
    if (!outletItem) throw new Error("Mirrored outlet item not found");

    const placeOrder = async (label, point, itemDoc) => {
      section(`Resolving nearest outlet for "${label}" point (${point.lat}, ${point.lng})`);
      const resolved = await resolveNearestOutlet(HUB_BUSINESS_ID, point.lat, point.lng);
      console.log(resolved);

      section(`Placing order for "${label}" against resolved restaurant ${resolved.businessId}`);
      const dto = {
        orderType: "food",
        restaurantId: String(resolved.restaurantId),
        items: [
          {
            type: "food",
            itemId: String(itemDoc._id),
            quantity: 1,
            restaurantId: String(resolved.restaurantId),
          },
        ],
        address: buildAddress(label, point),
        paymentMethod: "cash",
      };

      const order = await createOrder(String(user._id), dto);
      console.log(
        `Order created: ${order?.orderId || order?._id} | restaurantId on order: ${order?.restaurantId} | total: ${order?.pricing?.total ?? order?.pricing?.grandTotal}`,
      );
      return order;
    };

    const order1 = await placeOrder("near hub", NEAR_HUB, hubItem);
    const order2 = await placeOrder("near outlet", NEAR_OUTLET, outletItem);

    section("DONE — summary");
    console.log({
      order1: { orderId: order1?.orderId, restaurantId: String(order1?.restaurantId) },
      order2: { orderId: order2?.orderId, restaurantId: String(order2?.restaurantId) },
      hubMongoId: String(hub._id),
    });
  } catch (err) {
    console.error("TEST FAILED:", err);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
};

run();
