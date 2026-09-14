/**
 * Lightweight regression checks for Active Order Banner utilities.
 * Run: node Frontend/scripts/regression-active-order-utils.mjs
 */
import assert from "node:assert/strict";
import {
  TERMINAL_STATUSES,
  computeEtaMinutes,
  isActiveOrderCandidate,
  isTerminalOrder,
  isTerminalStatus,
  mergeUniqueOrders,
  pickActiveOrderFromList,
} from "../src/modules/Food/utils/activeOrderUtils.js";

const now = Date.parse("2026-07-20T12:00:00.000Z");

for (const status of TERMINAL_STATUSES) {
  assert.equal(isTerminalStatus(status), true, `expected terminal: ${status}`);
}
assert.equal(isTerminalStatus("cancelled_by_system"), true);
assert.equal(isTerminalStatus("preparing"), false);

{
  const order = {
    createdAt: "2026-07-20T11:00:00.000Z",
    etaPromise: { max: 60, endsAt: "2026-07-20T12:10:00.000Z" },
  };
  assert.equal(computeEtaMinutes(order, now), 10);
}

{
  const order = {
    createdAt: "2026-07-20T11:30:00.000Z",
    etaPromise: { max: 45 },
  };
  assert.equal(computeEtaMinutes(order, now), 15);
}

{
  const order = { createdAt: "2026-07-20T11:30:00.000Z" };
  assert.equal(computeEtaMinutes(order, now), null);
}

{
  const order = {
    etaPromise: { endsAt: "2026-07-20T12:00:00.000Z" },
  };
  assert.equal(computeEtaMinutes(order, now), 0);
}

{
  const orders = [
    { _id: "1", orderStatus: "delivered" },
    { _id: "2", orderStatus: "preparing" },
  ];
  assert.equal(pickActiveOrderFromList(orders)?._id, "2");
}

{
  const order = { _id: "x", orderStatus: "cancelled_by_system" };
  assert.equal(isActiveOrderCandidate(order), false);
  assert.equal(isTerminalOrder(order), true);
}

{
  assert.equal(
    isActiveOrderCandidate({ _id: "a", deliveryState: { currentPhase: "preparing" } }),
    true,
  );
  assert.equal(
    isActiveOrderCandidate({ _id: "b", deliveryState: { currentPhase: "unknown_phase" } }),
    false,
  );
  assert.equal(isActiveOrderCandidate({ _id: "c" }), false);
}

{
  const api = [{ _id: "aaaaaaaaaaaaaaaaaaaaaaaa", orderStatus: "preparing" }];
  const ctx = [
    { _id: "bbbbbbbbbbbbbbbbbbbbbbbb", orderStatus: "preparing" },
    { id: "ORD-local", orderStatus: "confirmed" },
  ];
  const merged = mergeUniqueOrders(api, ctx, { hasFetchedApi: true });
  assert.equal(merged.length, 2);
  assert.ok(merged.some((o) => o._id === "aaaaaaaaaaaaaaaaaaaaaaaa"));
  assert.ok(merged.some((o) => o.id === "ORD-local"));
  assert.ok(!merged.some((o) => o._id === "bbbbbbbbbbbbbbbbbbbbbbbb"));
}

console.log("activeOrderUtils regression: OK");
