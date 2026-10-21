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
    // Floating rounded bar; the wrapper lets taps through around it.
    <div className="fixed bottom-0 left-0 right-0 z-[60] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md rounded-[28px] bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-gray-800 shadow-[0_4px_24px_rgba(0,0,0,0.12)] p-1.5">
        <div className="flex items-center justify-around gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-1 flex-col items-center gap-1 rounded-[22px] px-2 py-2 transition-all duration-200 ${
                  isActive
                    ? "bg-[var(--rt-primary-soft)] text-[var(--rt-primary)]"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} />
                <span className={`text-[11px] ${isActive ? "font-bold" : "font-medium"}`}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
