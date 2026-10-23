import { memo, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bike } from "lucide-react";
import { restaurantAPI } from "@food/api";

// One shared request for every mount of the banner (home re-renders / remounts).
let thresholdPromise = null;
const loadFreeDeliveryThreshold = () => {
  if (!thresholdPromise) {
    thresholdPromise = restaurantAPI
      .getPublicFeeSettings()
      .then((res) => Number(res?.data?.data?.feeSettings?.freeDeliveryThreshold) || 0)
      .catch(() => {
        thresholdPromise = null;
        return 0;
      });
  }
  return thresholdPromise;
};

/** Home-page strip advertising the admin-configured free delivery threshold. */
const FreeDeliveryBanner = memo(function FreeDeliveryBanner() {
  const [threshold, setThreshold] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadFreeDeliveryThreshold().then((value) => {
      if (!cancelled) setThreshold(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!(threshold > 0)) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative mx-4 mt-2 flex items-center gap-3 overflow-hidden rounded-2xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3"
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-12 -skew-x-12 bg-white/60"
        initial={{ x: "-150%" }}
        animate={{ x: "900%" }}
        transition={{ duration: 1.6, ease: "easeInOut", repeat: Infinity, repeatDelay: 2.5 }}
      />
      <motion.span
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-600 text-white"
        animate={{ x: [0, 3, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <Bike className="h-5 w-5" />
      </motion.span>
      <p className="relative text-[14px] font-bold leading-tight text-green-900">
        FREE delivery on orders above <span className="text-green-700">₹{Math.round(threshold)}</span>
      </p>
    </motion.div>
  );
});

export default FreeDeliveryBanner;
