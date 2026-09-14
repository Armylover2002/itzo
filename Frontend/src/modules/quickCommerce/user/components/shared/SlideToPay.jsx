import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, useAnimation, useMotionValue, useTransform } from "framer-motion";
import { ChevronRight, Check, ChevronsRight } from "lucide-react";

const SLIDER_WIDTH = 52;
const SLIDER_PADDING = 8;
const COMPLETE_THRESHOLD = 0.9;

/** Soft rose Slide-to-Pay — compact, no harsh red / no heavy bold. */
const SlideToPay = ({
  onSuccess,
  amount,
  isLoading = false,
  disabled = false,
  text = "Slide to Pay",
}) => {
  const [isCompleted, setIsCompleted] = useState(false);
  const controls = useAnimation();
  const x = useMotionValue(0);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const maxDrag = Math.max(0, containerWidth - SLIDER_WIDTH - SLIDER_PADDING);

  const textOpacity = useTransform(x, [0, maxDrag * 0.5], [1, 0]);
  const shimmerOpacity = useTransform(x, [0, maxDrag * 0.3], [1, 0]);
  const fillWidth = useTransform(x, [0, maxDrag], [0, containerWidth]);
  const rotate = useTransform(x, [0, maxDrag], [0, 360]);
  const arrowsOpacity = useTransform(x, [0, maxDrag * 0.8], [1, 0]);
  const checkOpacity = useTransform(x, [maxDrag * 0.5, maxDrag], [0, 1]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleDragEnd = useCallback(async () => {
    if (x.get() >= maxDrag * COMPLETE_THRESHOLD) {
      setIsCompleted(true);
      controls.start({ x: maxDrag });
      try {
        await onSuccess?.();
      } finally {
        setIsCompleted(false);
        controls.start({ x: 0 });
      }
    } else {
      controls.start({ x: 0 });
    }
  }, [x, maxDrag, controls, onSuccess]);

  const isDraggable = !isCompleted && !isLoading && !disabled;

  return (
    <div
      ref={containerRef}
      className="relative h-12 w-full rounded-full overflow-hidden select-none touch-none bg-rose-600/90 shadow-[0_10px_28px_rgba(190,18,60,0.22)] border border-rose-500/20"
    >
      <motion.div
        className="absolute inset-y-0 left-0 bg-white/15"
        style={{ width: fillWidth }}
      />

      <motion.div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ opacity: shimmerOpacity }}
      >
        <motion.div
          className="absolute inset-y-0 -inset-x-1 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-20deg]"
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
        />
      </motion.div>

      {!isCompleted && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
          style={{ opacity: textOpacity }}
        >
          <span className="text-white font-medium text-xs md:text-[13px] tracking-wide flex items-center gap-2">
            {text}
            <span className="text-white/40">|</span>
            <span className="text-rose-50 font-semibold tabular-nums tracking-normal">
              ₹{amount}
            </span>
          </span>
          <div className="absolute right-3 text-white/70">
            <ChevronsRight size={18} />
          </div>
        </motion.div>
      )}

      {isCompleted && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <span className="text-white font-medium text-sm tracking-wide flex items-center gap-2">
            Processing <span className="animate-pulse">...</span>
          </span>
        </div>
      )}

      <motion.div
        className="absolute left-1 top-1 bottom-1 w-[44px] h-[44px] bg-white rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing z-20 shadow-md border border-rose-100"
        drag={isDraggable ? "x" : false}
        dragConstraints={{ left: 0, right: maxDrag }}
        dragElastic={0.05}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x }}
        whileTap={{ scale: 0.95 }}
      >
        {isLoading || isCompleted ? (
          <div className="h-5 w-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <motion.div
            className="relative w-full h-full flex items-center justify-center"
            style={{ rotate }}
          >
            <motion.div className="text-rose-600" style={{ opacity: arrowsOpacity }}>
              <ChevronRight size={22} strokeWidth={2.5} />
            </motion.div>
            <motion.div
              className="absolute inset-0 flex items-center justify-center text-rose-600"
              style={{ opacity: checkOpacity }}
            >
              <Check size={20} strokeWidth={2.5} />
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default React.memo(SlideToPay);
