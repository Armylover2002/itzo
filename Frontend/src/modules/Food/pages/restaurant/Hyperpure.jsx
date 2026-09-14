import { motion } from "framer-motion"
import { Leaf } from "lucide-react"
import BottomNavOrders from "@food/components/restaurant/BottomNavOrders"

export default function Hyperpure() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col pb-24">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex-1 flex items-center justify-center"
      >
        <div className="text-center">
          <Leaf className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Hyperpure</h2>
          <p className="text-gray-600">This page is under development</p>
        </div>
      </motion.div>
      <BottomNavOrders />
    </div>
  )
}
