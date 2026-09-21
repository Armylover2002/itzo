import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

/**
 * ActionSlider - Professional "Swipe to Confirm" UI Component.
 */
export const ActionSlider = ({ 
  label = "Slide to Confirm", 
  lockedLabel = "Action Locked",
  onConfirm, 
  disabled = false,
  color = "bg-[#FE5502]",
  successLabel = "Confirmed ✓",
  timeProgress = null
}) => {
  const [progress, setProgress] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);
  const containerRef = useRef(null);
  const controls = useAnimation();

  // Confirm only at the very end of the track — a partial swipe must never fire.
  const CONFIRM_THRESHOLD = 0.98;
  const HANDLE_WIDTH = 48; // w-12
  const TRACK_PADDING = 12; // p-1.5 on both sides
  const dragDistance = Math.max(1, trackWidth - HANDLE_WIDTH - TRACK_PADDING);

  // Reset when disabled state changes
  useEffect(() => {
    if (disabled) {
      setProgress(0);
      setIsSuccess(false);
    }
  }, [disabled]);

  // Measure the track so drag distance and constraints always agree.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    const measure = () => setTrackWidth(element.offsetWidth || 0);
    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const getDragProgress = (info) =>
    Math.min(1, Math.max(0, (info?.offset?.x || 0) / dragDistance));

  const handleDrag = (event, info) => {
    if (disabled || isSuccess) return;
    setProgress(getDragProgress(info));
  };

  const handleDragEnd = async (event, info) => {
    if (disabled || isSuccess) return;

    if (getDragProgress(info) >= CONFIRM_THRESHOLD) {
      setIsSuccess(true);
      setProgress(1);
      if (onConfirm) {
        try {
          await onConfirm();
        } catch (error) {
          setIsSuccess(false);
          setProgress(0);
          controls.start({ x: 0 });
        }
      }
    } else {
      setProgress(0);
      controls.start({ x: 0 });
    }
  };

  const trackClasses = disabled
    ? 'bg-red-50 border border-red-200 shadow-none'
    : timeProgress !== null
      ? 'bg-gray-900 shadow-inner'
      : `${color} shadow-lg shadow-black/10`;

  return (
    <div 
      ref={containerRef}
      className={`relative w-full rounded-full p-1.5 overflow-hidden flex items-center transition-all duration-300 ${trackClasses} ${
        disabled ? 'h-[58px]' : 'h-[60px]'
      }`}
    >
      {/* Time Progress Background — CSS only (avoid Framer Motion re-animate every second) */}
      {timeProgress !== null && !isSuccess && !disabled && (
        <div
          className={`absolute inset-y-0 left-0 ${color} rounded-full`}
          style={{
            width: `${Math.max(0, Math.min(100, Number(timeProgress) || 0))}%`,
            transition: "width 1s linear",
          }}
        />
      )}

      {/* Background Track Text */}
      <div className={`absolute inset-y-0 left-[68px] right-5 flex items-center justify-center text-center font-bold text-[11px] uppercase tracking-[0.14em] leading-tight px-2 transition-opacity duration-300 ${
        isSuccess
          ? 'opacity-0'
          : disabled
            ? 'text-red-700/80 z-10'
            : timeProgress !== null 
              ? 'text-white drop-shadow-md z-10'
              : 'text-white/88 z-10'
      }`}>
        {disabled ? lockedLabel : label}
      </div>

      {/* Dynamic Progress Fill for Swipe */}
      <motion.div 
        className={`absolute inset-0 bg-black/20 rounded-full z-10`}
        initial={{ width: 0 }}
        animate={{ 
          width: isSuccess ? '100%' : `${progress * 100}%`,
          opacity: disabled ? 0 : 1
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />

      {/* Success View */}
      <AnimatePresence>
        {isSuccess && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-y-0 left-[68px] right-5 flex items-center justify-center text-center text-white font-bold text-sm uppercase tracking-[0.14em] leading-none z-30"
          >
            {successLabel}
          </motion.div>
        )}
      </AnimatePresence>

      {/* The Handle */}
      <motion.div
        drag={disabled || isSuccess ? false : "x"}
        dragConstraints={{ left: 0, right: dragDistance }}
        dragElastic={0.1}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        animate={controls}
        className={`relative rounded-full flex items-center justify-center z-20 shadow-xl transition-colors ${
          disabled ? 'w-10 h-10' : 'w-12 h-12'
        } ${
          disabled
            ? 'bg-white text-red-300 border border-red-200 cursor-not-allowed'
            : isSuccess
              ? 'bg-white text-[#FE5502] cursor-grab active:cursor-grabbing'
              : 'bg-white text-gray-950 cursor-grab active:cursor-grabbing'
        }`}
      >
        <ChevronRight className={`w-6 h-6 transition-transform duration-300 ${isSuccess ? 'scale-110' : ''}`} />
      </motion.div>
    </div>
  );
};

export default ActionSlider;
