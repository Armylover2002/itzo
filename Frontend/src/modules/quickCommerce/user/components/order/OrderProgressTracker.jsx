import React, { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Circle, Clock, Truck, Home } from "lucide-react";
import { getLegacyStatusFromOrder } from "@/shared/utils/orderStatus";

// ─── Constants (defined outside — no recreation per render) ───────────────────

const STATUS_TO_STAGE = {
  pending: "confirmed",
  confirmed: "confirmed",
  packed: "confirmed",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
};

// Static — never changes; no need to define inside component
const STEPS = [
  { id: "confirmed", label: "Order Confirmed", icon: CheckCircle },
  { id: "out_for_delivery", label: "Out for delivery", icon: Truck },
  { id: "delivered", label: "Delivered", icon: Home },
];

// Pre-computed step index map — O(1) lookup instead of findIndex() inside every render
const STEP_INDEX = Object.fromEntries(STEPS.map((s, i) => [s.id, i]));

// Static animation variants — avoids new object creation per render
const iconVariants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
};

const checkVariants = {
  initial: { scale: 0 },
  animate: { scale: 1 },
};

const spinTransition = { duration: 2, repeat: Infinity, ease: "linear" };

// ─── Pure helper — no closure deps, safe outside component ───────────────────
function getStepStatus(stepId, status) {
  if (status === "cancelled") return "cancelled";

  const idx = STEP_INDEX[stepId];

  switch (status) {
    case "pending":
      return idx === 0 ? "active" : "pending";
    case "confirmed":
    case "packed":
      return idx === 0 ? "completed" : "pending";
    case "out_for_delivery":
      if (idx === 0) return "completed";
      if (idx === 1) return "active";
      return "pending";
    case "delivered":
      return "completed";
    default:
      return stepId === "confirmed" ? "active" : "pending";
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Extracted so the cancelled branch never allocates step/icon logic
const CancelledState = () => (
  <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5">
    <p className="text-center text-rose-700 font-semibold">Order Cancelled</p>
  </div>
);

// Each step is memoized — only re-renders when its own status changes
const StepRow = memo(({ step, stepStatus, index, isLast }) => {
  const { icon: Icon, label } = step;
  const isCompleted = stepStatus === "completed";
  const isActive = stepStatus === "active";

  return (
    <div className="relative">
      <div className="flex items-center gap-4">
        {/* Icon Circle */}
        <motion.div
          variants={iconVariants}
          initial="initial"
          animate="animate"
          transition={{ delay: index * 0.1 }}
          className={`relative z-10 h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 ${isCompleted
            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200"
            : isActive
              ? "bg-amber-100 text-amber-600 border-2 border-amber-400"
              : "bg-slate-100 text-slate-400"
            }`}
        >
          {isCompleted ? (
            <CheckCircle size={24} className="fill-current" />
          ) : isActive ? (
            <motion.div animate={{ rotate: 360 }} transition={spinTransition}>
              <Icon size={22} />
            </motion.div>
          ) : (
            <Circle size={22} />
          )}
        </motion.div>

        {/* Label */}
        <div className="flex-1">
          <p
            className={`text-sm font-bold ${isCompleted ? "text-slate-900" : isActive ? "text-amber-700" : "text-slate-400"
              }`}
          >
            {label}
          </p>
          {isActive && (
            <p className="text-xs text-amber-600 font-medium mt-0.5">In progress...</p>
          )}
        </div>

        {/* Completed badge */}
        {isCompleted && (
          <motion.div
            variants={checkVariants}
            initial="initial"
            animate="animate"
            className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center"
          >
            <CheckCircle size={14} className="text-emerald-600" />
          </motion.div>
        )}
      </div>

      {/* Connecting line */}
      {!isLast && (
        <div className="absolute left-6 top-12 bottom-0 w-0.5 -mb-4">
          <div className={`h-full w-full ${isCompleted ? "bg-emerald-500" : "bg-slate-200"}`} />
        </div>
      )}
    </div>
  );
});
StepRow.displayName = "StepRow";

// ETA panel memoized separately — props rarely change
const EtaPanel = memo(({ estimatedArrivalText, arrivingInText, totalDistanceText }) => (
  <div className="mt-6 pt-5 border-t border-slate-100">
    <div className="flex items-center justify-between bg-amber-50 rounded-2xl p-4 gap-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-amber-100 rounded-xl flex items-center justify-center">
          <Clock size={20} className="text-amber-600" />
        </div>
        <div>
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">
            Estimated Time
          </p>
          <p className="text-lg font-black text-amber-900">{estimatedArrivalText}</p>
        </div>
      </div>
      <div className="text-right flex flex-col items-end gap-1">
        <div>
          <p className="text-xs text-amber-600 font-semibold">Arriving in</p>
          <p className="text-2xl font-black text-amber-900">{arrivingInText}</p>
        </div>
        <div className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200">
          Total distance: {totalDistanceText}
        </div>
      </div>
    </div>
  </div>
));
EtaPanel.displayName = "EtaPanel";

// ─── Main Component ───────────────────────────────────────────────────────────

const OrderProgressTracker = memo(({
  order,
  estimatedArrivalText = "12:45 PM",
  arrivingInText = "8 mins",
  totalDistanceText = "—",
}) => {
  const status = getLegacyStatusFromOrder(order);

  // Pre-compute all step statuses once per render — avoids repeated switch inside JSX
  const stepStatuses = useMemo(
    () => STEPS.map((step) => getStepStatus(step.id, status)),
    [status],
  );

  if (status === "cancelled") return <CancelledState />;

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
      <div className="space-y-4">
        {STEPS.map((step, index) => (
          <StepRow
            key={step.id}
            step={step}
            stepStatus={stepStatuses[index]}
            index={index}
            isLast={index === STEPS.length - 1}
          />
        ))}
      </div>

      {status !== "delivered" && (
        <EtaPanel
          estimatedArrivalText={estimatedArrivalText}
          arrivingInText={arrivingInText}
          totalDistanceText={totalDistanceText}
        />
      )}
    </div>
  );
});

OrderProgressTracker.displayName = "OrderProgressTracker";

export default OrderProgressTracker;