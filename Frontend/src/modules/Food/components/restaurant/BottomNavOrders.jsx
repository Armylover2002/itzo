import { useNavigate, useLocation } from "react-router-dom"
import { useMemo } from "react"
import { motion } from "framer-motion"
import {
  FileText,
  Package,
  MessageSquare,
  Compass,
} from "lucide-react"
import useKeyboardInset from "@food/hooks/useKeyboardInset"

const getOrdersTabs = (basePath = "/restaurant") => [
  { id: "orders", label: "Orders", icon: FileText, route: `${basePath}` },
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
  const keyboardInset = useKeyboardInset()

  const basePath = pathname.startsWith("/food/restaurant")
    ? "/food/restaurant"
    : pathname.startsWith("/restaurant")
    ? "/food/restaurant"
    : "/restaurant"

  const tabs = useMemo(() => getOrdersTabs(basePath), [basePath])

  const activeTab = useMemo(() => {
    const match = findActiveTab(tabs, pathname)
    return match?.id || "orders"
  }, [tabs, pathname])

  const isInternalPage = pathname.includes("/create-offers")
  if (isInternalPage) {
    return null
  }

  // Keep footer anchored under the keyboard — hide while typing so it does not cover inputs.
  if (keyboardInset > 0) {
    return null
  }

  const handleTabClick = (tab) => {
    if (tab.route && tab.route !== pathname) {
      navigate(tab.route)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60]">
      <div className="relative bg-white dark:bg-[#1a1a1a] border-t border-gray-200 dark:border-gray-800 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-around h-auto px-2 sm:px-4">
          {tabs.map((tab, index) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            const isLast = index === tabs.length - 1

            return (
              <div key={tab.id} className="flex flex-1 items-center">
                <button
                  onClick={() => handleTabClick(tab)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex flex-1 flex-col items-center gap-1.5 px-2 sm:px-3 py-2 transition-all duration-200 relative w-full ${
                    isActive
                      ? "text-green-600 dark:text-green-500"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      isActive
                        ? "text-green-600 dark:text-green-500 fill-green-600 dark:fill-green-500"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                    strokeWidth={isActive ? 2 : 2}
                  />
                  <span
                    className={`text-xs sm:text-sm font-medium ${
                      isActive
                        ? "text-green-600 dark:text-green-500 font-semibold"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {tab.label}
                  </span>
                  {isActive && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-green-600 dark:bg-green-500 rounded-b-full" />
                  )}
                </button>
                {!isLast && (
                  <div className="h-8 w-px bg-gray-300 dark:bg-gray-700" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
