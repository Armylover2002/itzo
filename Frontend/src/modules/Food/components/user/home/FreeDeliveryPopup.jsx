import { memo, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { restaurantAPI } from "@food/api";

const SEEN_KEY = "freeDeliveryPopupSeen";

const wasSeen = () => {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
};

const markSeen = () => {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // storage unavailable — popup may show again, harmless
  }
};

/** App-open popup advertising the admin-configured free delivery threshold (once per session). */
const FreeDeliveryPopup = memo(function FreeDeliveryPopup() {
  const [threshold, setThreshold] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (wasSeen()) return undefined;
    let cancelled = false;
    restaurantAPI
      .getPublicFeeSettings()
      .then((res) => {
        const value = Number(res?.data?.data?.feeSettings?.freeDeliveryThreshold) || 0;
        if (cancelled || !(value > 0)) return;
        setThreshold(value);
        setOpen(true);
        markSeen();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const close = () => setOpen(false);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 px-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-gradient-to-b from-pink-500 to-fuchsia-600 px-6 pb-6 pt-10 text-center shadow-2xl"
            initial={{ scale: 0.85, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={close}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/30 text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-5xl font-black uppercase leading-none text-yellow-300">Free</h2>
            <h3 className="mt-1 text-4xl font-black uppercase leading-none text-white">Delivery</h3>
            <p className="mt-5 text-lg font-bold text-yellow-200">
              on all orders above{" "}
              <span className="text-yellow-300">₹{Math.round(threshold)}</span>
            </p>
            <button
              type="button"
              onClick={close}
              className="mt-7 w-full rounded-full bg-yellow-300 py-3.5 text-base font-extrabold uppercase text-indigo-950 shadow-lg active:scale-95"
            >
              Order now
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default FreeDeliveryPopup;
