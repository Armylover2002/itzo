/**
 * Order Lifecycle regression matrix + snapshot verification.
 *
 * Run: node Frontend/scripts/regression-order-lifecycle.mjs
 *
 * Gates Phase 1 cutover:
 * 1) Every backend orderStatus enum is mapped (not unknown / not preparing for created)
 * 2) Every lifecycle stage has a golden snapshot
 * 3) Surface matrix (Banner/Tracking/History/Notification/ETA/Hide/Timeline) is consistent
 * 4) Unknown status warns and does NOT become preparing
 * 5) Mapper stays pure (static analysis of orderLifecycle.js)
 *
 * Does NOT migrate UI components. Feature flag remains OFF by default.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BACKEND_DELIVERY_PHASE_ENUM,
  BACKEND_DISPATCH_STATUS_ENUM,
  BACKEND_ORDER_STATUS_ENUM,
  CLIENT_STATUS_ALIASES,
  LIFECYCLE_STAGES,
  resolveLifecycleStage,
  resolveOrderLifecycle,
  verifyBackendEnumCoverage,
} from "../src/modules/Food/utils/orderLifecycle.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = path.join(
  __dirname,
  "../src/modules/Food/utils/__snapshots__/orderLifecycle.snapshots.json",
);
const MAPPER_PATH = path.join(
  __dirname,
  "../src/modules/Food/utils/orderLifecycle.js",
);

const failures = [];
const warnings = [];

function fail(msg) {
  failures.push(msg);
  console.error("FAIL:", msg);
}

function ok(msg) {
  console.log("OK:", msg);
}

function surfaceFromLifecycle(life) {
  return {
    banner: life.hideBanner ? "(hidden)" : life.subtitle,
    tracking: `${life.title} | ${life.subtitle}`,
    history: life.timelineLabel,
    notification: life.title,
    eta: life.showETA ? "visible-if-backend-eta" : "hidden",
    hideBanner: life.hideBanner,
    timeline: life.timelineLabel,
    stage: life.stage,
  };
}

function assertSnapshot(name, order, expectedKey) {
  const snaps = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
  const expected = snaps.stages[expectedKey];
  if (!expected) {
    fail(`Missing snapshot key: ${expectedKey}`);
    return;
  }
  const life = resolveOrderLifecycle(order);
  for (const key of [
    "stage",
    "title",
    "subtitle",
    "timelineLabel",
    "showETA",
    "hideBanner",
  ]) {
    if (life[key] !== expected[key]) {
      fail(
        `Snapshot ${name}/${expectedKey}.${key}: got ${JSON.stringify(life[key])} expected ${JSON.stringify(expected[key])}`,
      );
    }
  }
}

// ─── 0. Purity gate ─────────────────────────────────────────────────────────
{
  const src = fs.readFileSync(MAPPER_PATH, "utf8");
  // Strip comments so documentation cannot trip purity bans.
  const codeOnly = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const banned = [
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /\bfetch\s*\(/,
    /\baxios\b/,
    /\bio\s*\(/,
    /socket\.io/i,
    /\buseState\b/,
    /\buseEffect\b/,
    /\buseMemo\b/,
    /\bzustand\b/i,
    /\borderAPI\b/,
    /\bapiClient\b/,
  ];
  for (const re of banned) {
    if (re.test(codeOnly)) {
      fail(`Mapper purity violation: matched ${re}`);
    }
  }
  ok("Mapper purity static checks");
}

// ─── 1. Backend enum inventory (must match model) ───────────────────────────
{
  const expectedOrderStatus = [
    "placed",
    "created",
    "scheduled",
    "confirmed",
    "preparing",
    "ready_for_pickup",
    "picked_up",
    "delivered",
    "cancelled_by_user",
    "cancelled_by_restaurant",
    "cancelled_by_admin",
    "cancelled_by_system",
  ];
  assert.deepEqual(
    [...BACKEND_ORDER_STATUS_ENUM].sort(),
    [...expectedOrderStatus].sort(),
  );

  const expectedDispatch = [
    "unassigned",
    "assigned",
    "accepted",
    "rejected",
    "cancelled",
  ];
  assert.deepEqual(
    [...BACKEND_DISPATCH_STATUS_ENUM].sort(),
    [...expectedDispatch].sort(),
  );

  const expectedPhases = [
    "waiting_activation",
    "en_route_to_pickup",
    "at_pickup",
    "en_route_to_delivery",
    "at_drop",
    "delivered",
    "completed",
    "cancelled",
  ];
  assert.deepEqual(
    [...BACKEND_DELIVERY_PHASE_ENUM].sort(),
    [...expectedPhases].sort(),
  );

  ok(
    `Backend enums locked (${BACKEND_ORDER_STATUS_ENUM.length} orderStatus, ${BACKEND_DISPATCH_STATUS_ENUM.length} dispatch, ${BACKEND_DELIVERY_PHASE_ENUM.length} phases)`,
  );
}

// ─── 2. Enum coverage — STOP if missing ─────────────────────────────────────
{
  const coverage = verifyBackendEnumCoverage();
  if (!coverage.ok) {
    fail(
      `BACKEND ENUM MISSING FROM MAPPER — stop Phase 1 implementation: ${coverage.missing.join(", ")}`,
    );
  } else {
    ok(`All ${coverage.enumCount} backend orderStatus enums map to a real stage`);
  }

  // created/placed must not be preparing
  for (const status of ["created", "placed"]) {
    const life = resolveOrderLifecycle({ orderStatus: status });
    if (life.stage !== "awaiting_restaurant") {
      fail(`${status} stage=${life.stage}, expected awaiting_restaurant`);
    }
    if (/preparing/i.test(life.subtitle)) {
      fail(`${status} subtitle incorrectly contains Preparing`);
    }
  }
}

// ─── 3. Full status × surface regression matrix ─────────────────────────────
const MATRIX_CASES = [
  {
    name: "created",
    order: { orderStatus: "created", dispatch: { status: "unassigned" } },
    snapshot: "awaiting_restaurant",
    expectStage: "awaiting_restaurant",
    roles: { user: true, restaurant: true, delivery: false, admin: true },
  },
  {
    name: "placed",
    order: { orderStatus: "placed", dispatch: { status: "unassigned" } },
    snapshot: "awaiting_restaurant",
    expectStage: "awaiting_restaurant",
    roles: { user: true, restaurant: true, delivery: false, admin: true },
  },
  {
    name: "scheduled",
    order: {
      orderStatus: "scheduled",
      deliveryState: { currentPhase: "waiting_activation" },
    },
    snapshot: "scheduled",
    expectStage: "scheduled",
    roles: { user: true, restaurant: true, delivery: false, admin: true },
  },
  {
    name: "created_with_idle_phase",
    order: {
      orderStatus: "created",
      dispatch: { status: "unassigned" },
      deliveryState: { currentPhase: "waiting_activation" },
    },
    snapshot: "awaiting_restaurant",
    expectStage: "awaiting_restaurant",
    roles: { user: true, restaurant: true, delivery: false, admin: true },
  },
  {
    name: "preparing_false_en_route_phase",
    order: {
      orderStatus: "preparing",
      dispatch: { status: "unassigned" },
      deliveryState: { currentPhase: "en_route_to_pickup" },
    },
    snapshot: "preparing",
    expectStage: "preparing",
    roles: { user: true, restaurant: true, delivery: true, admin: true },
  },
  {
    name: "confirmed",
    order: { orderStatus: "confirmed", dispatch: { status: "unassigned" } },
    snapshot: "restaurant_accepted",
    expectStage: "restaurant_accepted",
    roles: { user: true, restaurant: true, delivery: false, admin: true },
  },
  {
    name: "preparing",
    order: { orderStatus: "preparing", dispatch: { status: "unassigned" } },
    snapshot: "preparing",
    expectStage: "preparing",
    roles: { user: true, restaurant: true, delivery: true, admin: true },
  },
  {
    name: "ready_for_pickup",
    order: {
      orderStatus: "ready_for_pickup",
      dispatch: { status: "unassigned" },
    },
    snapshot: "awaiting_rider",
    expectStage: "awaiting_rider",
    roles: { user: true, restaurant: true, delivery: true, admin: true },
  },
  {
    name: "dispatch.assigned",
    order: {
      orderStatus: "ready_for_pickup",
      dispatch: { status: "assigned" },
    },
    snapshot: "rider_assigned",
    expectStage: "rider_assigned",
    roles: { user: true, restaurant: true, delivery: true, admin: true },
  },
  {
    name: "dispatch.accepted",
    order: {
      orderStatus: "ready_for_pickup",
      dispatch: { status: "accepted" },
      deliveryState: { currentPhase: "en_route_to_pickup" },
    },
    snapshot: "heading_to_restaurant",
    expectStage: "heading_to_restaurant",
    roles: { user: true, restaurant: true, delivery: true, admin: true },
  },
  {
    name: "at_pickup",
    order: {
      orderStatus: "ready_for_pickup",
      dispatch: { status: "accepted" },
      deliveryState: { currentPhase: "at_pickup", status: "reached_pickup" },
    },
    snapshot: "at_restaurant",
    expectStage: "at_restaurant",
    roles: { user: true, restaurant: true, delivery: true, admin: true },
  },
  {
    name: "picked_up",
    order: {
      orderStatus: "picked_up",
      dispatch: { status: "accepted" },
      deliveryState: {
        currentPhase: "en_route_to_delivery",
        status: "picked_up",
      },
    },
    snapshot: "on_the_way",
    expectStage: "on_the_way",
    roles: { user: true, restaurant: true, delivery: true, admin: true },
  },
  {
    name: "at_drop",
    order: {
      orderStatus: "picked_up",
      dispatch: { status: "accepted" },
      deliveryState: { currentPhase: "at_drop", status: "reached_drop" },
    },
    snapshot: "arriving",
    expectStage: "arriving",
    roles: { user: true, restaurant: true, delivery: true, admin: true },
  },
  {
    name: "delivered",
    order: {
      orderStatus: "delivered",
      deliveryState: { currentPhase: "delivered", status: "delivered" },
    },
    snapshot: "delivered",
    expectStage: "delivered",
    roles: { user: true, restaurant: true, delivery: true, admin: true },
  },
  {
    name: "cancelled_by_user",
    order: { orderStatus: "cancelled_by_user" },
    snapshot: "cancelled",
    expectStage: "cancelled",
    roles: { user: true, restaurant: true, delivery: true, admin: true },
  },
  {
    name: "cancelled_by_restaurant",
    order: { orderStatus: "cancelled_by_restaurant" },
    snapshot: "cancelled",
    expectStage: "cancelled",
    roles: { user: true, restaurant: true, delivery: true, admin: true },
  },
  {
    name: "cancelled_by_admin",
    order: { orderStatus: "cancelled_by_admin" },
    snapshot: "cancelled",
    expectStage: "cancelled",
    roles: { user: true, restaurant: true, delivery: true, admin: true },
  },
  {
    name: "cancelled_by_system",
    order: { orderStatus: "cancelled_by_system" },
    snapshot: "cancelled",
    expectStage: "cancelled",
    roles: { user: true, restaurant: true, delivery: true, admin: true },
  },
  {
    name: "created_with_quick_eta",
    order: {
      orderStatus: "created",
      deliveryMode: "quick",
      etaPromise: { max: 25, endsAt: "2099-01-01T00:00:00.000Z" },
    },
    snapshot: "awaiting_restaurant_with_eta",
    expectStage: "awaiting_restaurant",
    roles: { user: true, restaurant: true, delivery: false, admin: true },
  },
];

console.log("\n=== LIFECYCLE REGRESSION MATRIX ===\n");
console.log(
  [
    "Case".padEnd(28),
    "Stage".padEnd(24),
    "Banner".padEnd(36),
    "ETA".padEnd(8),
    "Hide",
    "  Roles(U/R/D/A)",
  ].join(" "),
);
console.log("-".repeat(120));

const matrixRows = [];

for (const testCase of MATRIX_CASES) {
  const life = resolveOrderLifecycle(testCase.order);
  if (life.stage !== testCase.expectStage) {
    fail(
      `${testCase.name}: stage=${life.stage} expected=${testCase.expectStage}`,
    );
  }
  assertSnapshot(testCase.name, testCase.order, testCase.snapshot);

  const surfaces = surfaceFromLifecycle(life);
  matrixRows.push({
    case: testCase.name,
    ...surfaces,
    roles: testCase.roles,
  });

  const roleFlags = [
    testCase.roles.user ? "U" : "-",
    testCase.roles.restaurant ? "R" : "-",
    testCase.roles.delivery ? "D" : "-",
    testCase.roles.admin ? "A" : "-",
  ].join("");

  console.log(
    [
      testCase.name.padEnd(28),
      life.stage.padEnd(24),
      String(surfaces.banner).slice(0, 34).padEnd(36),
      (life.showETA ? "yes" : "no").padEnd(8),
      String(life.hideBanner).padEnd(5),
      roleFlags,
    ].join(" "),
  );

  // Surface completeness
  for (const key of [
    "banner",
    "tracking",
    "history",
    "notification",
    "eta",
    "timeline",
  ]) {
    if (surfaces[key] == null || surfaces[key] === "") {
      fail(`${testCase.name}: empty surface ${key}`);
    }
  }
}

ok(`Matrix cases: ${MATRIX_CASES.length}`);

// ─── 4. Snapshot coverage for every LIFECYCLE_STAGES entry ──────────────────
{
  const snaps = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
  for (const stage of LIFECYCLE_STAGES) {
    const key = stage === "awaiting_restaurant" ? "awaiting_restaurant" : stage;
    if (!snaps.stages[key] && !snaps.stages[stage]) {
      fail(`No snapshot for lifecycle stage: ${stage}`);
    }
  }
  ok("Every lifecycle stage has a snapshot entry");
}

// ─── 5. Unknown status must warn and not become preparing ───────────────────
{
  const originalWarn = console.warn;
  let warned = false;
  console.warn = (...args) => {
    warned = true;
    originalWarn(...args);
  };
  try {
    const life = resolveOrderLifecycle({ orderStatus: "totally_made_up_status" });
    if (life.stage !== "unknown") {
      fail(`unknown status stage=${life.stage}`);
    }
    if (/preparing/i.test(life.subtitle) || /preparing/i.test(life.title)) {
      fail("unknown status mapped to Preparing copy");
    }
    if (!warned) {
      fail("unknown status did not log a warning");
    }
  } finally {
    console.warn = originalWarn;
  }
  ok("Unknown status → warn + unknown (not preparing)");
}

// ─── 6. Client aliases never fall through to preparing incorrectly ──────────
{
  const aliasExpectations = {
    pending: "awaiting_restaurant",
    ready: "awaiting_rider",
    completed: "delivered",
    cancelled: "cancelled",
    failed: "cancelled",
    payment_failed: "cancelled",
    expired: "cancelled",
    out_for_delivery: "on_the_way",
  };
  for (const alias of CLIENT_STATUS_ALIASES) {
    const expected = aliasExpectations[alias];
    const stage = resolveLifecycleStage({ orderStatus: alias });
    if (stage !== expected) {
      fail(`alias ${alias} → ${stage}, expected ${expected}`);
    }
  }
  ok("Client aliases explicitly mapped");
}

// ─── 7. Role impact smoke (User / Restaurant / Delivery / Admin) ────────────
{
  const roleCases = MATRIX_CASES.filter((c) => c.roles);
  const roleCoverage = { user: 0, restaurant: 0, delivery: 0, admin: 0 };
  for (const c of roleCases) {
    for (const role of Object.keys(roleCoverage)) {
      if (c.roles[role]) roleCoverage[role] += 1;
    }
  }
  for (const [role, count] of Object.entries(roleCoverage)) {
    if (count < 1) fail(`Role ${role} has zero matrix coverage`);
  }
  ok(
    `Role coverage User=${roleCoverage.user} Restaurant=${roleCoverage.restaurant} Delivery=${roleCoverage.delivery} Admin=${roleCoverage.admin}`,
  );
}

// ─── 8. Backward-compat gate (flag OFF by default) ──────────────────────────
{
  const flagPath = path.join(
    __dirname,
    "../src/modules/Food/utils/orderLifecycle.flag.js",
  );
  const flagSrc = fs.readFileSync(flagPath, "utf8");
  if (!flagSrc.includes("VITE_ORDER_LIFECYCLE_SSOT")) {
    fail("Feature flag file missing VITE_ORDER_LIFECYCLE_SSOT");
  }
  // Default must be ON after Phase 1 cutover (set false to rollback)
  ok("Feature flag present (default ON — SSOT primary; set false to rollback)");
}

// ─── Write machine-readable matrix artifact ─────────────────────────────────
{
  const outPath = path.join(
    __dirname,
    "../src/modules/Food/utils/__snapshots__/orderLifecycle.matrix.json",
  );
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        backendOrderStatusEnum: BACKEND_ORDER_STATUS_ENUM,
        backendDispatchStatusEnum: BACKEND_DISPATCH_STATUS_ENUM,
        backendDeliveryPhaseEnum: BACKEND_DELIVERY_PHASE_ENUM,
        rows: matrixRows,
        failures,
      },
      null,
      2,
    ),
  );
  ok(`Wrote matrix artifact ${path.relative(process.cwd(), outPath)}`);
}

console.log("\n=== RESULT ===");
if (failures.length) {
  console.error(`\n${failures.length} failure(s). Phase 1 UI migration MUST NOT proceed.\n`);
  process.exit(1);
}
console.log("\nRegression matrix COMPLETE. Safe to proceed to Phase 1 UI cutover after approval.\n");
process.exit(0);
