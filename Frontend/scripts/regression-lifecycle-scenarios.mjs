/**
 * 10 lifecycle scenario verification (Phase 1 acceptance).
 * Calls pure resolveOrderLifecycle (SSOT) — independent of feature flag.
 *
 * Run: node Frontend/scripts/regression-lifecycle-scenarios.mjs
 */
import assert from "node:assert/strict";
import { resolveOrderLifecycle } from "../src/modules/Food/utils/orderLifecycle.js";

const scenarios = [
  {
    id: 1,
    name: "Place Order",
    order: { orderStatus: "created", dispatch: { status: "unassigned" } },
    expectSubtitle: "Waiting for restaurant confirmation",
    expectHide: false,
  },
  {
    id: 2,
    name: "Restaurant Accept → preparing",
    order: { orderStatus: "preparing", dispatch: { status: "unassigned" } },
    expectSubtitle: "Preparing your order",
    expectHide: false,
  },
  {
    id: 3,
    name: "Restaurant Ready",
    order: { orderStatus: "ready_for_pickup", dispatch: { status: "unassigned" } },
    expectSubtitle: "Waiting for delivery partner",
    expectHide: false,
  },
  {
    id: 4,
    name: "Delivery Assigned",
    order: { orderStatus: "ready_for_pickup", dispatch: { status: "assigned" } },
    expectSubtitle: "Delivery partner assigned",
    expectHide: false,
  },
  {
    id: 5,
    name: "Delivery Accepted",
    order: {
      orderStatus: "ready_for_pickup",
      dispatch: { status: "accepted" },
      deliveryState: { currentPhase: "en_route_to_pickup" },
    },
    expectSubtitle: "Heading to restaurant",
    expectHide: false,
  },
  {
    id: 5.1,
    name: "False-positive guard: preparing + default en_route_to_pickup WITHOUT dispatch.accepted",
    order: {
      orderStatus: "preparing",
      dispatch: { status: "unassigned" },
      deliveryState: { currentPhase: "en_route_to_pickup" },
    },
    expectSubtitle: "Preparing your order",
    expectHide: false,
  },
  {
    id: 5.2,
    name: "False-positive guard: preparing + en_route phase, no dispatch object",
    order: {
      orderStatus: "preparing",
      deliveryState: { currentPhase: "en_route_to_pickup" },
    },
    expectSubtitle: "Preparing your order",
    expectHide: false,
  },
  {
    id: 5.3,
    name: "confirmed must not become heading from phase alone",
    order: {
      orderStatus: "confirmed",
      dispatch: { status: "unassigned" },
      deliveryState: { currentPhase: "en_route_to_pickup" },
    },
    expectSubtitle: "Restaurant accepted",
    expectHide: false,
  },
  {
    id: 5.4,
    name: "created + waiting_activation stays awaiting restaurant",
    order: {
      orderStatus: "created",
      dispatch: { status: "unassigned" },
      deliveryState: { currentPhase: "waiting_activation" },
    },
    expectSubtitle: "Waiting for restaurant confirmation",
    expectHide: false,
  },
  {
    id: 6,
    name: "Reached Restaurant",
    order: {
      orderStatus: "ready_for_pickup",
      dispatch: { status: "accepted" },
      deliveryState: { currentPhase: "at_pickup", status: "reached_pickup" },
    },
    expectSubtitle: "Delivery partner reached restaurant",
    expectHide: false,
  },
  {
    id: 7,
    name: "Picked Up",
    order: {
      orderStatus: "picked_up",
      dispatch: { status: "accepted" },
      deliveryState: { currentPhase: "en_route_to_delivery", status: "picked_up" },
    },
    expectSubtitle: "On the way",
    expectHide: false,
  },
  {
    id: 8,
    name: "Reached Customer",
    order: {
      orderStatus: "picked_up",
      dispatch: { status: "accepted" },
      deliveryState: { currentPhase: "at_drop", status: "reached_drop" },
    },
    expectSubtitle: "Arriving",
    expectHide: false,
  },
  {
    id: 9,
    name: "Delivered",
    order: {
      orderStatus: "delivered",
      deliveryState: { currentPhase: "delivered", status: "delivered" },
    },
    expectSubtitle: "Delivered",
    expectHide: true,
  },
  {
    id: 10,
    name: "Cancelled",
    order: { orderStatus: "cancelled_by_system" },
    expectSubtitle: "Cancelled",
    expectHide: true,
  },
];

const logs = [];
let failed = 0;

console.log("\n=== 10 LIFECYCLE SCENARIOS ===\n");

for (const s of scenarios) {
  const life = resolveOrderLifecycle(s.order, { audience: "user" });
  const okSubtitle = life.subtitle === s.expectSubtitle;
  const okHide = life.hideBanner === s.expectHide;
  const pass = okSubtitle && okHide;
  if (!pass) failed += 1;

  const row = {
    scenario: s.id,
    name: s.name,
    stage: life.stage,
    banner: life.hideBanner ? "(hidden)" : life.subtitle,
    tracking: `${life.title} | ${life.subtitle}`,
    history: life.timelineLabel,
    notification: life.title,
    hideBanner: life.hideBanner,
    pass,
  };
  logs.push(row);

  const mark = pass ? "PASS" : "FAIL";
  console.log(
    `${mark} S${s.id} ${s.name}\n` +
      `     stage=${life.stage}\n` +
      `     banner=${row.banner}\n` +
      `     tracking=${row.tracking}\n` +
      `     history=${row.history}\n` +
      `     hideBanner=${life.hideBanner}`,
  );

  if (!okSubtitle) {
    console.error(`     expected subtitle "${s.expectSubtitle}" got "${life.subtitle}"`);
  }
  if (!okHide) {
    console.error(`     expected hideBanner=${s.expectHide} got ${life.hideBanner}`);
  }
}

// Surfaces smoke: restaurant + admin facets resolve without throw
for (const audience of ["restaurant", "admin", "delivery"]) {
  const life = resolveOrderLifecycle(
    { orderStatus: "created", dispatch: { status: "unassigned" } },
    { audience },
  );
  assert.ok(life.stage === "awaiting_restaurant");
  assert.ok(life.title);
}

console.log("\n=== SCENARIO RESULT ===");
if (failed) {
  console.error(`${failed} scenario(s) failed. Do NOT enable feature flag default ON.`);
  process.exit(1);
}
console.log("All 10 scenarios PASS.");
console.log(JSON.stringify({ generatedAt: new Date().toISOString(), logs }, null, 2));
process.exit(0);
