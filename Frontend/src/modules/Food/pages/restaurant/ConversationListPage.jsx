import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import Lenis from "lenis"
import { ArrowLeft, Search, Utensils, User, ShoppingBag, X, Truck } from "lucide-react"
import { Input } from "@food/components/ui/input"
import BottomNavbar from "@food/components/restaurant/BottomNavbar"
import MenuOverlay from "@food/components/restaurant/MenuOverlay"

export default function ConversationListPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("Customer")
  const [showMenu, setShowMenu] = useState(false)

  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  const customerConversations = []

  const deliveryManConversations = []

  // Get conversations based on active tab
  const currentConversations = activeTab === "Customer" 
    ? customerConversations 
    : deliveryManConversations

  const filteredConversations = currentConversations.filter((conv) =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-white overflow-x-hidden pb-24 md:pb-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 md:py-3 flex items-center gap-4 rounded-b-3xl md:rounded-b-none fixed top-0 left-0 right-0 z-50">
        <button
          onClick={() => navigate("/restaurant")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg md:text-xl font-bold text-gray-900 flex-1 text-center">
          Conversation List
        </h1>
        <div className="w-9" /> {/* Spacer for centering */}
      </div>

      {/* Spacer for fixed header */}
      <div className="h-16 md:h-14"></div>

      {/* Search Bar */}
      <div className="px-4 mb-4">
        <div className="relative">
          <Input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-gray-200 bg-white focus:border-[#ff8100] focus:ring-1 focus:ring-[#ff8100]"
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className="flex gap-6 border-b border-gray-200">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab("Customer")}
            className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
              activeTab === "Customer"
                ? "text-gray-900"
                : "text-gray-400"
            }`}
          >
            Customer
            {activeTab === "Customer" && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff8100]"
                initial={false}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab("Delivery Man")}
            className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
              activeTab === "Delivery Man"
                ? "text-gray-900"
                : "text-gray-400"
            }`}
          >
            Delivery Man
            {activeTab === "Delivery Man" && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff8100]"
                initial={false}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </motion.button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="px-4 space-y-3">
        {filteredConversations.length > 0 ? (
          filteredConversations.map((conversation, index) => (
            <motion.div
              key={conversation.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                navigate(`/restaurant/conversation/${conversation.id}`)
              }}
            >
              <div className="flex items-start gap-3">
                {/* Avatar/Icon */}
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-[#ff8100] flex items-center justify-center">
                    {activeTab === "Customer" ? (
                      <Utensils className="w-6 h-6 text-white" />
                    ) : (
                      <Truck className="w-6 h-6 text-white" />
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-gray-900 font-semibold text-sm md:text-base truncate">
                        {conversation.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {conversation.role && (
                        <span className="bg-red-100 text-[#ff8100] text-xs font-medium px-2 py-0.5 rounded-md whitespace-nowrap">
                          {conversation.role}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-gray-500 text-sm truncate flex-1">
                      {conversation.lastMessage}
                    </p>
                    <span className="text-gray-400 text-xs flex-shrink-0">
                      {conversation.date}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <div className="relative mb-4">
              <div className="flex items-center gap-2">
                <User className="w-8 h-8 text-gray-400" />
                <div className="relative">
                  <ShoppingBag className="w-8 h-8 text-gray-400" />
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <X className="w-3 h-3 text-white" />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-gray-400 text-sm font-medium">
              {activeTab === "Customer" ? "No Customer Found" : "No Delivery Man Found"}
            </p>
          </motion.div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <BottomNavbar onMenuClick={() => setShowMenu(true)} />

      {/* Menu Overlay */}
      <MenuOverlay showMenu={showMenu} setShowMenu={setShowMenu} />
    </div>
  )
}

