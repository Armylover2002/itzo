import { useEffect } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import confetti from "canvas-confetti"

const RUPEE_SYMBOL = "₹"
const AUTO_CLOSE_MS = 3500
const BRAND_COLORS = ["#FB4F01", "#FFB800", "#256FEF", "#22C55E", "#EC4899"]

/** Two party-popper bursts from the bottom corners, drawn above the modal. */
const firePartyPoppers = () => {
  const shared = { particleCount: 90, spread: 70, startVelocity: 55, ticks: 220, zIndex: 10002, colors: BRAND_COLORS }
  confetti({ ...shared, angle: 60, origin: { x: 0, y: 0.9 } })
  confetti({ ...shared, angle: 120, origin: { x: 1, y: 0.9 } })
  setTimeout(() => {
    confetti({ ...shared, particleCount: 60, spread: 100, startVelocity: 35, origin: { x: 0.5, y: 0.35 } })
  }, 250)
}

/**
 * Zomato-style "coupon applied" moment: confetti + a card saying how much was saved.
 * `celebration` is { code, amount } or null; auto-closes after a few seconds.
 */
export default function CouponCelebration({ celebration, onClose }) {
  useEffect(() => {
    if (!celebration) return undefined
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    if (!reduceMotion) firePartyPoppers()
    const timer = setTimeout(onClose, AUTO_CLOSE_MS)
    return () => clearTimeout(timer)
  }, [celebration, onClose])

  if (typeof document === "undefined") return null

  return createPortal(
    <AnimatePresence>
      {celebration && (
        <motion.div
          key="coupon-celebration"
          className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-live="polite"
            className="w-full max-w-xs rounded-3xl bg-white px-6 pb-6 pt-8 text-center shadow-2xl dark:bg-[#1a1a1a]"
            initial={{ scale: 0.6, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="mx-auto mb-3 text-5xl"
              initial={{ rotate: -25, scale: 0.5 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.1 }}
              aria-hidden="true"
            >
              🎉
            </motion.div>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
              '{celebration.code}' applied
            </p>
            <p className="mt-1 text-3xl font-extrabold text-gray-900 dark:text-white">
              You saved {RUPEE_SYMBOL}{celebration.amount}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">with this coupon</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-xl bg-[#FB4F01] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#C83C00] active:scale-95"
            >
              Yay!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
