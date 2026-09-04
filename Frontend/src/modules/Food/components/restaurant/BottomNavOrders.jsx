import { useNavigate, useLocation } from "react-router-dom"
import { useMemo } from "react"
import { motion } from "framer-motion"
import {
  FileText,
  Package,
  MessageSquare,
  Compass,
} from "lucide-react"

const getOrdersTabs = (basePath = "/restaurant") => [
  { id: "orders", label: "Orders", icon: FileText, route: `${basePath}/orders/all` },
  { id: "inventory", label: "Inventory", icon: Package, route: `${basePath}/inventory` },
  { id: "feedback", label: "Feedback", icon: MessageSquare, route: `${basePath}/feedback` },
  { id: "explore", label: "Explore", icon: Compass, route: `${basePath}/explore` },
]

const findActiveTab = (tabs, pathname) =>
  tabs
    .slice()
    .sort((a, b) => b.route.length - a.route.length)
    .find((tab) => pathname === tab.route || pathname.startsWith(tab.route + "/"))

export default function BottomNavOrders() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const basePath = pathname.startsWith("/food/restaurant")
    ? "/food/restaurant"
    : pathname.startsWith("/restaurant")
    ? "/food/restaurant"
    : "/restaurant"

  const tabs = useMemo(() => getOrdersTabs(basePath), [basePath])

  const isInternalPage = pathname.includes("/create-offers")
  if (isInternalPage) {
    return null
  }

  const activeTab = useMemo(() => {
    const match = findActiveTab(tabs, pathname)
    return match?.id || "orders"
  }, [tabs, pathname])

  const handleTabClick = (tab) => {
    if (tab.route && tab.route !== pathname) {
      navigate(tab.route)
    }
  }

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[60] px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-md items-end gap-2">
        <div className="flex-1 min-w-0">
          <div className="relative overflow-visible rounded-[30px] bg-[#0D315B] py-2 pl-3 pr-2 shadow-[0_16px_40px_rgba(254,85,2,0.3)]">
            <div className="relative flex items-end justify-around gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id

                return (
                  <motion.button
                    key={tab.id}
                    onClick={() => handleTabClick(tab)}
                    aria-current={isActive ? "page" : undefined}
                    className="relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center gap-1 overflow-visible rounded-full px-2 py-2"
                    whileTap={{ scale: 0.95 }}
                  >
                    <Icon
                      className={`relative z-10 h-[20px] w-[20px] transition-all duration-300 ${
                        isActive ? "text-white scale-110" : "text-white/60"
                      }`}
                    />
                    <span
                      className={`relative z-10 whitespace-nowrap text-[10px] font-bold transition-all duration-300 ${
                        isActive ? "text-white" : "text-white/60"
                      }`}
                    >
                      {tab.label}
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
