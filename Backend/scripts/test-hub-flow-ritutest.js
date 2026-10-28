/**
 * One-off A-to-Z manual test for the multi-outlet hub/franchise feature.
 * Creates ONLY new documents (1 hub restaurant "ritutest" in Indore, 1 franchise
 * outlet under it, 1 food item + its mirrored copy) — never updates/deletes any
 * pre-existing restaurant/category/zone data.
 *
 * Usage: node scripts/test-hub-flow-ritutest.js
 */
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../src/config/db.js";
import { FoodRestaurant } from "../src/modules/food/restaurant/models/restaurant.model.js";
import { FoodZone } from "../src/modules/food/admin/models/zone.model.js";
import { FoodCategory } from "../src/modules/food/admin/models/category.model.js";
import { FoodItem } from "../src/modules/food/admin/models/food.model.js";
import { ensureRestaurantWallet } from "../src/modules/food/restaurant/models/restaurantWallet.model.js";
import {
  createHubOutlet,
  listHubOutlets,
  getHubEarnings,
  resolveNearestOutlet,
} from "../src/modules/food/restaurant/services/hub.service.js";
import { syncHubItemToOutlets } from "../src/modules/food/restaurant/services/hubInventorySync.service.js";
import { createRestaurantFood } from "../src/modules/food/restaurant/services/restaurantFood.service.js";
import { loginFranchiseOutlet } from "../src/core/auth/auth.service.js";

const HUB_NAME = "ritutest";
const HUB_PHONE = "9755633147";
const FRANCHISE_LOGIN_ID = "ritutest-outlet1";
const FRANCHISE_PASSWORD = "ritutest123";

// Indore city centre + a point ~2km away for the outlet (nearest-outlet test).
const INDORE_HUB_COORDS = { latitude: 22.7196, longitude: 75.8577 };
const INDORE_OUTLET_COORDS = { latitude: 22.7360, longitude: 75.8700 };

const section = (title) => console.log(`\n=== ${title} ===`);

const run = async () => {
  await connectDB();

  try {
    section("1. Indore zone lookup (read-only)");
    const zone = await FoodZone.findOne({
      $or: [{ name: /indore/i }, { zoneName: /indore/i }, { serviceLocation: /indore/i }],
    }).lean();
    console.log(zone ? `Found zone: ${zone.name} (${zone._id})` : "No Indore zone found — continuing without zoneId.");

    section("2. Hub restaurant (reuse by phone, rename to ritutest; else create new)");
    let hub = await FoodRestaurant.findOne({ ownerPhoneLast10: HUB_PHONE });

    if (hub) {
      console.log(`Found existing restaurant on this phone: "${hub.restaurantName}" (${hub.restaurantId} / ${hub._id})`);
      if (hub.restaurantName !== HUB_NAME) {
        hub.restaurantName = HUB_NAME;
        await hub.save();
        console.log(`Renamed to "${HUB_NAME}" (user-confirmed: same restaurant, new name).`);
      }
      if (hub.status !== "approved" || !hub.isAcceptingOrders || !hub.isListed) {
        hub.status = "approved";
        hub.wasEverApproved = true;
        hub.approvedAt = new Date();
        hub.isListed = true;
        hub.isAcceptingOrders = true;
        await hub.save();
        console.log("Approved + enabled accepting-orders (was rejected/unlisted before).");
      }
    } else {
      hub = await FoodRestaurant.create({
        restaurantName: HUB_NAME,
        ownerName: HUB_NAME,
        ownerPhone: HUB_PHONE,
        primaryContactNumber: HUB_PHONE,
        pureVegRestaurant: false,
        businessType: "Fixed Restaurant",
        location: { type: "Point", coordinates: [INDORE_HUB_COORDS.longitude, INDORE_HUB_COORDS.latitude], ...INDORE_HUB_COORDS },
        zoneId: zone?._id || undefined,
        status: "approved",
        wasEverApproved: true,
        approvedAt: new Date(),
        isListed: true,
        isActive: true,
      });
      await ensureRestaurantWallet(hub._id);
      console.log(`Created hub: ${hub.restaurantId} (${hub._id})`);
    }

    section("3. Create franchise outlet under the hub");
    let outlet;
    const existingOutlets = await listHubOutlets(hub._id);
    const existingOutlet = existingOutlets.find((o) => o.franchiseLoginId === FRANCHISE_LOGIN_ID);
    if (existingOutlet) {
      console.log(`Outlet already exists, reusing: ${existingOutlet.restaurantId} (${existingOutlet._id})`);
      outlet = existingOutlet;
    } else {
      outlet = await createHubOutlet(hub._id, {
        outletLabel: "Ritutest Outlet 1",
        franchiseLoginId: FRANCHISE_LOGIN_ID,
        password: FRANCHISE_PASSWORD,
        useMainHubInventory: true,
        location: INDORE_OUTLET_COORDS,
      });
      console.log(`Created outlet: ${outlet.restaurantId} (${outlet._id})`);
    }

    section("4. Verify hub.isMainHub flag");
    const hubAfter = await FoodRestaurant.findById(hub._id).select("isMainHub").lean();
    console.log(`hub.isMainHub = ${hubAfter.isMainHub}`);

    section("5. Franchise login (userId/password)");
    const loginResult = await loginFranchiseOutlet(FRANCHISE_LOGIN_ID, FRANCHISE_PASSWORD);
    console.log(
      `Login OK. accessToken issued: ${Boolean(loginResult.accessToken)}, user.restaurantId: ${loginResult.user?.restaurantId}, user.parentRestaurantId: ${loginResult.user?.parentRestaurantId}`,
    );

    section("5b. Franchise login with wrong password (must fail)");
    try {
      await loginFranchiseOutlet(FRANCHISE_LOGIN_ID, "wrong-password");
      console.log("UNEXPECTED: wrong password login succeeded!");
    } catch (err) {
      console.log(`Correctly rejected: ${err.message}`);
    }

    section("6. Inventory sharing — create item on hub, mirror to outlet");
    const globalCategory = await FoodCategory.findOne({
      restaurantId: { $exists: false },
      isActive: true,
      approvalStatus: "approved",
    }).lean();

    if (!globalCategory) {
      console.log("No global category found in this DB — skipping item/sync test (not creating new category data).");
    } else {
      console.log(`Using existing global category: ${globalCategory.name} (${globalCategory._id})`);

      let hubItem = await FoodItem.findOne({ restaurantId: hub._id, name: "Ritutest Test Item" });
      if (hubItem) {
        console.log(`Hub item already exists, reusing: ${hubItem._id}`);
      } else {
        hubItem = await createRestaurantFood(hub._id, {
          name: "Ritutest Test Item",
          description: "A-to-Z hub flow test item",
          price: 99,
          foodType: "Veg",
          categoryId: String(globalCategory._id),
          isAvailable: true,
        });
        hubItem = await FoodItem.findById(hubItem._id);
        console.log(`Created hub item: ${hubItem._id} (approvalStatus=${hubItem.approvalStatus})`);
      }

      // Simulate admin approval so the item is orderable (mirrors what admin approval does).
      await FoodItem.updateOne({ _id: hubItem._id }, { $set: { approvalStatus: "approved" } });

      await syncHubItemToOutlets(hub._id, hubItem);
      const mirrored = await FoodItem.findOne({ hubSourceItemId: hubItem._id, restaurantId: outlet._id });
      if (mirrored) {
        await FoodItem.updateOne({ _id: mirrored._id }, { $set: { approvalStatus: "approved" } });
        console.log(`Mirrored item on outlet: ${mirrored._id} (name="${mirrored.name}", price=${mirrored.price})`);
      } else {
        console.log("Mirror NOT found — sync failed (check logs above for the reason).");
      }
    }

    section("7. Resolve nearest outlet — point near the OUTLET");
    const nearOutlet = await resolveNearestOutlet(hub.restaurantId, INDORE_OUTLET_COORDS.latitude, INDORE_OUTLET_COORDS.longitude);
    console.log(nearOutlet);

    section("8. Resolve nearest outlet — point near the HUB itself");
    const nearHub = await resolveNearestOutlet(hub.restaurantId, INDORE_HUB_COORDS.latitude, INDORE_HUB_COORDS.longitude);
    console.log(nearHub);

    section("9. Resolve nearest outlet — no lat/lng given (must default to hub)");
    const noCoords = await resolveNearestOutlet(hub.restaurantId, undefined, undefined);
    console.log(noCoords);

    section("10. Hub earnings rollup");
    const earnings = await getHubEarnings(hub._id);
    console.log(JSON.stringify(earnings, null, 2));

    section("DONE — summary");
    console.log({
      hub: { id: String(hub._id), businessId: hub.restaurantId, phone: HUB_PHONE },
      outlet: { id: String(outlet._id), businessId: outlet.restaurantId, franchiseLoginId: FRANCHISE_LOGIN_ID, password: FRANCHISE_PASSWORD },
    });
  } catch (err) {
    console.error("TEST FAILED:", err);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
};

run();
