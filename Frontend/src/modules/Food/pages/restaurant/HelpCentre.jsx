import { useState } from "react"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { motion } from "framer-motion"
import { 
  ChevronLeft, 
  Search, 
  Power, 
  Utensils, 
  Building2, 
  FileText, 
  Wallet,
  LifeBuoy,
  ChevronRight,
} from "lucide-react"
import BottomNavOrders from "@food/components/restaurant/BottomNavOrders"

const helpTopics = [
  {
    id: 1,
    icon: Power,
    title: "Outlet online / offline status",
    subtitle: "Current status & details",
    path: "/restaurant/delivery-settings"
  },
  {
    id: 2,
    icon: Utensils,
    title: "Order related issues",
    subtitle: "Cancellations & delivery related concerns",
    path: "/restaurant/orders/all"
  },
  {
    id: 3,
    icon: Building2,
    title: "Restaurant",
    subtitle: "Timings, contacts, FSSAI, bank details, location etc.",
    path: "/restaurant/outlet-info"
  },
  {
    id: 6,
    icon: Wallet,
    title: "Payments",
    subtitle: "Statement of account, invoices etc.",
    path: "/restaurant/hub-finance"
  },
  {
    id: 7,
    icon: LifeBuoy,
    title: "Support",
    subtitle: "Raise ticket and get admin response",
    path: "/restaurant/help-centre/support"
  }
]

export default function HelpCentre() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [searchQuery, setSearchQuery] = useState("")

  const filteredTopics = helpTopics.filter(topic =>
    topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    topic.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-white z-50 border-b border-gray-200">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-gray-900" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Help Center</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* How can we help you section */}
        <div className="mb-6">
          <h2 className="text-base font-bold text-gray-900 mb-3">
            How can we help you
          </h2>
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by issue"
              className="w-full pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
        </div>

        {/* Help Topics List */}
        <div className="space-y-1">
          {filteredTopics.map((topic, index) => {
            const IconComponent = topic.icon
            return (
              <motion.button
                key={topic.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="w-full flex items-center gap-4 px-0 py-4 border-b border-gray-200 hover:bg-gray-50 transition-colors text-left"
                onClick={() => {
                  if (topic.path) {
                    navigate(topic.path)
                  }
                }}
              >
                {/* Icon */}
                <div className="flex-shrink-0">
                  <IconComponent className="w-6 h-6 text-gray-900" />
                </div>

                {/* Text Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1.5">
                    {topic.title}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {topic.subtitle}
                  </p>
                </div>

                {/* Navigation Arrow */}
                <div className="flex-shrink-0">
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </motion.button>
            )
          })}
        </div>

        {/* No results message */}
        {filteredTopics.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">
              No help topics found matching "{searchQuery}"
            </p>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNavOrders />
    </div>
  )
}
