/**
 * Verifies the hub <-> outlet control flow on the real ritutest data.
 *
 * Non-destructive: nothing is deleted and no existing document is modified.
 * The only writes are ONE synthetic test order (dispatch mode "manual", so the
 * accept path never broadcasts an offer to real riders) which is accepted by
 * the hub and then cancelled at the end of the run.
 */
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../src/config/db.js";
import { FoodOrder } from "../src/modules/food/orders/models/order.model.js";
import { FoodRestaurant } from "../src/modules/food/restaurant/models/restaurant.model.js";
import {
  getHubScope,
  resolveScopeIds,
  assertCanActAsOutlet,
} from "../src/modules/food/restaurant/services/hubAccess.service.js";
import {
  switchToOutletSession,
  getHubEarnings,
} from "../src/modules/food/restaurant/services/hub.service.js";
import {
  listOrdersRestaurant,
  updateOrderStatusRestaurant,
  getOrderById,
} from "../src/modules/food/orders/services/order.service.js";
import { verifyAccessToken } from "../src/core/auth/token.util.js";

const HUB = "6ace1c4df30dfeab3a7363ae"; // ritutest (REST000034)
const OUTLET = "6ae1c832468606891dc8eef0"; // Ritutest Outlet 1 (REST000056)
const TEST_USER = "6ac36be2f4dca9ec2b67a335"; // FoodUser "og" / 9755633147

let pass = 0;
let fail = 0;
const ok = (name, extra = "") => {
  pass += 1;
  console.log(`  PASS  ${name}${extra ? " -- " + extra : ""}`);
};
const bad = (name, detail) => {
  fail += 1;
  console.log(`  FAIL  ${name} -- ${detail}`);
};
const section = (t) => console.log(`\n=== ${t} ===`);

const expectThrow = async (name, fn, matcher) => {
  try {
    await fn();
    bad(name, "expected a rejection but the call succeeded");
  } catch (err) {
    const msg = String(err?.message || err);
    if (!matcher || matcher.test(msg)) ok(name, msg);
    else bad(name, `rejected with unexpected message: ${msg}`);
  }
};

const run = async () => {
  await connectDB();
  let testOrderId = null;

  try {
    section("1. Hub scope resolution");
    const hubScope = await getHubScope(HUB);
    hubScope.isHubOwner && hubScope.hasOutlets
      ? ok("hub is recognised as an owner with outlets", `${hubScope.members.length} members`)
      : bad("hub scope", JSON.stringify({ isHubOwner: hubScope.isHubOwner, hasOutlets: hubScope.hasOutlets }));
    hubScope.members.find((m) => m.isMain)?.restaurantId === HUB
      ? ok("main restaurant is flagged isMain")
      : bad("main flag", JSON.stringify(hubScope.members));
    hubScope.scopeIds.includes(OUTLET)
      ? ok("outlet is inside the hub's scope")
      : bad("outlet in scope", JSON.stringify(hubScope.scopeIds));

    const outletScope = await getHubScope(OUTLET);
    outletScope.isOutlet && outletScope.scopeIds.length === 1 && outletScope.scopeIds[0] === OUTLET
      ? ok("outlet's own scope is itself only (no hub, no siblings)")
      : bad("outlet scope isolation", JSON.stringify(outletScope.scopeIds));

    section("2. Scope filters (?outletId=)");
    (await resolveScopeIds(HUB)).ids.length === hubScope.members.length
      ? ok("hub default = all branches")
      : bad("hub default", "unexpected id count");
    const mainOnly = await resolveScopeIds(HUB, "main");
    mainOnly.ids.length === 1 && mainOnly.ids[0] === HUB
      ? ok("outletId=main pins to the main restaurant")
      : bad("outletId=main", JSON.stringify(mainOnly.ids));
    const oneOutlet = await resolveScopeIds(HUB, OUTLET);
    oneOutlet.ids.length === 1 && oneOutlet.ids[0] === OUTLET
      ? ok("outletId=<id> pins to that outlet")
      : bad("outletId=<id>", JSON.stringify(oneOutlet.ids));
    await expectThrow(
      "outlet cannot filter to the hub's orders",
      () => resolveScopeIds(OUTLET, HUB),
      /does not belong/i,
    );
    const stranger = await FoodRestaurant.findOne({
      _id: { $nin: [HUB, OUTLET].map((id) => new mongoose.Types.ObjectId(id)) },
      parentRestaurantId: null,
    })
      .select("_id")
      .lean();
    if (stranger) {
      await expectThrow(
        "hub cannot filter to an unrelated restaurant",
        () => resolveScopeIds(HUB, String(stranger._id)),
        /does not belong/i,
      );
    }

    section("3. Order lists");
    const hubList = await listOrdersRestaurant(HUB, { limit: 50 });
    const hubRows = hubList.data || [];
    const fromOutlet = hubRows.filter((o) => String(o.outlet?.restaurantId) === OUTLET);
    const fromMain = hubRows.filter((o) => o.outlet?.isMain);
    fromOutlet.length > 0 && fromMain.length > 0
      ? ok(
          "hub list contains both its own and the outlet's orders",
          `${fromMain.length} main + ${fromOutlet.length} outlet`,
        )
      : bad("hub combined list", `main=${fromMain.length} outlet=${fromOutlet.length}`);
    hubRows.every((o) => o.outlet?.name)
      ? ok("every order carries the branch name shown on the card")
      : bad("outlet tag", "some orders have no outlet name");
    fromOutlet[0]?.outlet?.name === "Ritutest Outlet 1"
      ? ok("outlet orders are tagged with the outlet label", fromOutlet[0].outlet.name)
      : bad("outlet label", JSON.stringify(fromOutlet[0]?.outlet));

    const outletList = await listOrdersRestaurant(OUTLET, { limit: 50 });
    (outletList.data || []).every((o) => String(o.outlet?.restaurantId) === OUTLET)
      ? ok("outlet list contains ONLY its own orders", `${outletList.data.length} orders`)
      : bad("outlet list isolation", "hub orders leaked into the outlet list");

    const pinnedMain = await listOrdersRestaurant(HUB, { limit: 50, outletId: "main" });
    (pinnedMain.data || []).every((o) => o.outlet?.isMain)
      ? ok("hub filtered to outletId=main shows only its own orders")
      : bad("pinned main list", "outlet orders leaked");
    const pinnedOutlet = await listOrdersRestaurant(HUB, { limit: 50, outletId: OUTLET });
    (pinnedOutlet.data || []).length > 0 &&
    (pinnedOutlet.data || []).every((o) => String(o.outlet?.restaurantId) === OUTLET)
      ? ok("hub filtered to one outlet shows only that outlet's orders", `${pinnedOutlet.data.length} orders`)
      : bad("pinned outlet list", "unexpected contents");

    section("4. Order detail access");
    const anOutletOrder = fromOutlet[0];
    const detail = await getOrderById(anOutletOrder._id || anOutletOrder.orderId, {
      restaurantId: HUB,
      restaurantIds: (await resolveScopeIds(HUB)).ids,
    });
    detail
      ? ok("hub can open an outlet's order detail", anOutletOrder.orderId)
      : bad("hub detail read", "no order");
    const aMainOrder = fromMain[0];
    await expectThrow(
      "outlet cannot open the hub's order detail",
      () =>
        getOrderById(aMainOrder._id || aMainOrder.orderId, {
          restaurantId: OUTLET,
          restaurantIds: [OUTLET],
        }),
      /Not your restaurant order/i,
    );

    section("5. Switch session (hub -> outlet)");
    const session = await switchToOutletSession(HUB, OUTLET);
    const claims = verifyAccessToken(session.accessToken);
    claims?.userId === OUTLET && claims?.role === "RESTAURANT"
      ? ok("switch issues a RESTAURANT session for the outlet id", claims.userId)
      : bad("switch claims", JSON.stringify(claims));
    session.switchedFrom?.restaurantId === HUB
      ? ok("response names the hub to return to", session.switchedFrom.name)
      : bad("switchedFrom", JSON.stringify(session.switchedFrom));
    session.user?.franchisePasswordHash === undefined
      ? ok("outlet session payload does not leak the franchise password hash")
      : bad("password hash leak", "franchisePasswordHash present in session payload");
    await expectThrow(
      "outlet cannot switch into the hub (no privilege escalation)",
      () => switchToOutletSession(OUTLET, HUB),
      /does not belong|cannot switch/i,
    );

    section("6. Money is per-branch (act-as guard + earnings rows)");
    (await assertCanActAsOutlet(HUB, OUTLET))
      ? ok("hub may withdraw on behalf of its outlet")
      : bad("act-as", "guard returned nothing");
    await expectThrow(
      "outlet cannot act as the hub (no access to the hub's money)",
      () => assertCanActAsOutlet(OUTLET, HUB),
      /does not belong/i,
    );
    const earnings = await getHubEarnings(HUB);
    const mainRow = earnings.outlets.find((r) => r.isMain);
    const outletRow = earnings.outlets.find((r) => String(r.restaurantId) === OUTLET);
    mainRow && outletRow
      ? ok(
          "balances are listed separately per branch",
          `main ${mainRow.name}=${mainRow.availableBalance} vs ${outletRow.name}=${outletRow.availableBalance}`,
        )
      : bad("earnings rows", JSON.stringify(earnings.outlets));

    section("7. Delivery pickup comes from the outlet, not the hub");
    const outletDoc = await FoodRestaurant.findById(OUTLET).select("location").lean();
    const realOutletOrder = await FoodOrder.findOne({
      restaurantId: OUTLET,
      "pickupPoints.0.location.coordinates": { $exists: true },
    })
      .select("orderId pickupPoints")
      .sort({ createdAt: -1 })
      .lean();
    const pickup = realOutletOrder?.pickupPoints?.[0];
    const sameCoords =
      JSON.stringify(pickup?.location?.coordinates) ===
      JSON.stringify(outletDoc?.location?.coordinates);
    sameCoords
      ? ok(`pickup point of ${realOutletOrder.orderId} is the outlet's own address`, pickup.address)
      : bad(
          "pickup point",
          JSON.stringify({
            pickup: pickup?.location?.coordinates,
            outlet: outletDoc?.location?.coordinates,
          }),
        );

    section("8. Hub accepts and rejects an outlet's order (end-to-end)");
    const created = await FoodOrder.create({
      userId: TEST_USER,
      restaurantId: OUTLET,
      restaurantName: "Ritutest Outlet 1",
      customerName: "Outlet switch test",
      customerPhone: "9755633147",
      orderType: "food",
      orderStatus: "confirmed",
      orderId: `FOD-HUBTEST${Date.now().toString(36).toUpperCase()}`,
      items: [
        { itemId: "test-item", name: "Test item", type: "food", sourceId: OUTLET, price: 100, quantity: 1 },
      ],
      pickupPoints: [{ pickupType: "food", sourceId: OUTLET, sourceName: "Ritutest Outlet 1" }],
      deliveryAddress: { street: "Hub switch test", city: "Indore", state: "Madhya Pradesh" },
      pricing: { subtotal: 100, total: 100 },
      payment: { method: "cash", status: "cod_pending" },
      // "manual" keeps the accept path from broadcasting an offer to real riders.
      dispatch: { status: "unassigned", modeAtCreation: "manual" },
    });
    testOrderId = created._id;
    console.log(`  (created test order ${created.orderId} on the OUTLET)`);

    const accepted = await updateOrderStatusRestaurant(String(created._id), HUB, "preparing", "", {
      prepTimeMins: 20,
    });
    accepted.orderStatus === "preparing"
      ? ok("HUB accepted the OUTLET's order", `${created.orderId} -> preparing`)
      : bad("hub accept", `status is ${accepted.orderStatus}`);
    // The mutation response intentionally strips statusHistory, so read it back
    // from the stored document. Later SYSTEM entries can be appended after the
    // accept, so look for the RESTAURANT entry that performed the transition.
    const storedAfterAccept = await FoodOrder.findById(created._id).select("statusHistory").lean();
    const acceptEntry = (storedAfterAccept?.statusHistory || [])
      .filter((h) => h?.byRole === "RESTAURANT" && h?.to === "preparing")
      .slice(-1)[0];
    String(acceptEntry?.byId) === HUB
      ? ok("status history records the hub as the actor", `byRole=${acceptEntry.byRole}`)
      : bad("status history actor", JSON.stringify(storedAfterAccept?.statusHistory));

    await expectThrow(
      "OUTLET cannot change a status on the HUB's order",
      async () => {
        const hubOrder = await FoodOrder.findOne({ restaurantId: HUB }).select("_id").lean();
        return updateOrderStatusRestaurant(String(hubOrder._id), OUTLET, "preparing", "");
      },
      /Order not found/i,
    );

    const rejected = await updateOrderStatusRestaurant(
      String(created._id),
      HUB,
      "cancelled_by_restaurant",
      "Outlet-switch test cleanup",
    );
    rejected.orderStatus === "cancelled_by_restaurant"
      ? ok("HUB rejected/cancelled the OUTLET's order", `${created.orderId} -> cancelled_by_restaurant`)
      : bad("hub reject", `status is ${rejected.orderStatus}`);
  } finally {
    if (testOrderId) {
      const final = await FoodOrder.findById(testOrderId).select("orderId orderStatus").lean();
      console.log(`\n(test order left in terminal state: ${final?.orderId} = ${final?.orderStatus})`);
    }
    console.log(`\n==== ${pass} passed, ${fail} failed ====`);
    await disconnectDB();
    if (fail) process.exitCode = 1;
  }
};

run().catch(async (e) => {
  console.error("FATAL", e);
  await disconnectDB();
  process.exit(1);
});
