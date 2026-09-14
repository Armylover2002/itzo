import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

const DEFAULT_SHEET_CLASS =
  "fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:w-auto flex flex-col";

export default function BottomSheetPortal({
  open,
  onClose,
  children,
  sheetClassName = DEFAULT_SHEET_CLASS,
  backdropClassName = "fixed inset-0 bg-black/40 z-[9999]",
  transitionDuration = 0.2,
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={backdropClassName}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: transitionDuration }}
            onClick={onClose}
          />
          <motion.div
            className={sheetClassName}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: transitionDuration, type: "spring", damping: 30, stiffness: 400 }}
            style={{ willChange: "transform" }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
