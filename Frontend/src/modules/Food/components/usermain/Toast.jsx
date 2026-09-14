import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle } from "lucide-react"

export default function Toast({ show, message, onClose }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 px-4 py-3 flex items-center gap-3 min-w-[280px] max-w-[90vw]">
            <div className="bg-green-500 rounded-full p-1.5 flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <p className="text-sm font-medium text-gray-900 flex-1">
              {message}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
