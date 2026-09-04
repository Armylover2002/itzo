import { NavLink, useNavigate, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  FileText,
  Package,
  MessageSquare,
  LogOut
} from "lucide-react"
import { cn } from "@food/utils/utils"

const NAV_SECTIONS = [
  {
    title: "MAIN",
    items: [
      { label: "Dashboard", path: "/food/restaurant/dashboard", icon: LayoutDashboard },
      { label: "Orders", path: "/food/restaurant/orders/all", icon: FileText },
      { label: "Inventory", path: "/food/restaurant/inventory", icon: Package },
      { label: "Feedback", path: "/food/restaurant/feedback", icon: MessageSquare },
    ],
  },
  {
    title: "OUTLET",
    items: [
      { label: "Outlet info", path: "/food/restaurant/outlet-info" },
      { label: "Outlet timings", path: "/food/restaurant/outlet-timings" },
      { label: "Menu categories", path: "/food/restaurant/menu-categories" },
      { label: "Promo codes", path: "/food/restaurant/promo-codes" },
      { label: "Zone setup", path: "/food/restaurant/zone-setup" },
      { label: "Outlet status", path: "/food/restaurant/status" },
    ],
  },
  {
    title: "ORDERS & REVIEWS",
    items: [
      { label: "Order history", path: "/food/restaurant/orders/history" },
      { label: "Ratings & reviews", path: "/food/restaurant/ratings-reviews" },
    ],
  },
  {
    title: "FINANCE",
    items: [
      { label: "Payout", path: "/food/restaurant/finance-details" },
      { label: "Bank details", path: "/food/restaurant/update-bank-details" },
      { label: "Withdrawal history", path: "/food/restaurant/withdrawal-history" },
    ],
  },
  {
    title: "SUPPORT",
    items: [
      { label: "Notifications", path: "/food/restaurant/notifications" },
      { label: "Help centre", path: "/food/restaurant/help-centre/support" },
      { label: "Share feedback", path: "/food/restaurant/share-feedback" },
    ],
  },
]

export default function RestaurantSidebar({ className }) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    navigate("/food/restaurant/login")
  }

  return (
    <div
      className={cn(
        "flex h-screen w-64 flex-col border-r border-gray-100 bg-white shadow-[4px_0_24px_rgba(0,0,0,0.02)]",
        className
      )}
    >
      {/* Brand Section */}
      <div className="flex h-16 shrink-0 items-center px-6">
        <h1 className="text-2xl font-black bg-gradient-to-br from-[#B80B3D] to-[#66001D] bg-clip-text text-transparent tracking-tight">
          ITZO
        </h1>
        <span className="ml-2 rounded-md bg-[#fdf2f5] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#B80B3D]">
          Partner
        </span>
      </div>

      {/* Navigation */}
      <div data-lenis-prevent="true" className="flex flex-1 flex-col overflow-y-auto px-4 py-2 scrollbar-thin scrollbar-thumb-gray-200">
        {NAV_SECTIONS.map((section, sectionIdx) => (
          <div key={section.title} className={cn("mb-6", sectionIdx === 0 ? "mt-2" : "")}>
            <h3 className="mb-3 px-3 text-[11px] font-bold uppercase tracking-widest text-gray-500/80">
              {section.title}
            </h3>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const isActive = location.pathname === item.path || 
                                (item.path !== "/food/restaurant" && location.pathname.startsWith(item.path))
                
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-[#fdf2f5] text-[#900018]"
                        : "text-[#334155] hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    {item.icon && (
                      <item.icon
                        className={cn(
                          "h-5 w-5 shrink-0 transition-colors",
                          isActive ? "text-[#900018]" : "text-[#475569] group-hover:text-gray-900"
                        )}
                      />
                    )}
                    <span className={cn(!item.icon && "pl-1")}>{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer / Profile Section */}
      <div className="border-t border-gray-100 p-4 shrink-0">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-gray-500 transition-all hover:bg-rose-50 hover:text-rose-600 group"
        >
          <LogOut className="h-5 w-5 shrink-0 text-gray-400 group-hover:text-rose-500" />
          <span className="pl-1">Logout</span>
        </button>
      </div>
    </div>
  )
}
