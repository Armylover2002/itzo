import { useState, useEffect, useMemo } from "react"
import { NavLink, useNavigate, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  FileText,
  Package,
  MessageSquare,
  Store,
  Clock,
  UtensilsCrossed,
  MapPin,
  Activity,
  History,
  IndianRupee,
  CreditCard,
  Receipt,
  Wallet,
  Bell,
  HelpCircle,
  Compass,
  Crown,
  Star,
  Truck,
  Gift,
  LogOut,
  CalendarCheck
} from "lucide-react"
import { cn } from "@food/utils/utils"
import { clearModuleAuth } from "@food/utils/auth"
import { useSubscriptionRequired } from "@common/hooks/useSubscriptionRequired"
import {
  loadBusinessSettings,
  getCachedSettings,
  getAppLogo
} from "@common/utils/businessSettings"

const getNavSections = (subscriptionRequired) => [
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
    // Mirrors the "Manage outlet" section on the Explore More page.
    title: "MANAGE OUTLET",
    items: [
      { label: "Outlet info", path: "/food/restaurant/outlet-info", icon: Store },
      { label: "Outlet timings", path: "/food/restaurant/outlet-timings", icon: Clock },
      { label: "Menu categories", path: "/food/restaurant/menu-categories", icon: UtensilsCrossed },
      // Hidden when the admin has switched off the subscription requirement —
      // matches the same condition used on the Explore More page.
      ...(subscriptionRequired
        ? [{ label: "Business Plan", path: "/food/restaurant/business-plan", icon: Crown }]
        : []),
      { label: "Outlet status", path: "/food/restaurant/status", icon: Activity },
    ],
  },
  {
    // Mirrors the "Orders" section on the Explore More page.
    title: "ORDERS",
    items: [
      { label: "Order history", path: "/food/restaurant/orders/history", icon: History },
      { label: "Complaints", path: "/food/restaurant/feedback?tab=complaints", icon: Star },
      { label: "Reviews", path: "/food/restaurant/feedback", icon: MessageSquare },
    ],
  },
  {
    title: "DINING",
    items: [
      { label: "Dining Setup", path: "/food/restaurant/dining/setup", icon: UtensilsCrossed },
      { label: "Bookings & Billing", path: "/food/restaurant/dining/bookings", icon: CalendarCheck },
    ],
  },
  {
    title: "FINANCE",
    items: [
      { label: "Payout", path: "/food/restaurant/hub-finance", icon: IndianRupee },
      { label: "Invoices", path: "/food/restaurant/hub-finance?tab=invoices", icon: Receipt },
      { label: "Bank details", path: "/food/restaurant/update-bank-details", icon: CreditCard },
      // Hidden when the admin has switched off the subscription requirement —
      // matches the same condition used on the Explore More page.
      ...(subscriptionRequired
        ? [{ label: "Subscription Center", path: "/food/restaurant/wallet", icon: Wallet }]
        : []),
    ],
  },
  {
    title: "SUPPORT",
    items: [
      { label: "Notifications", path: "/food/restaurant/notifications", icon: Bell },
      { label: "Help centre", path: "/food/restaurant/help-centre/support", icon: HelpCircle },
    ],
  },
  {
    // Mirrors the "Settings" section on the Explore More page.
    title: "SETTINGS",
    items: [
      { label: "Delivery settings", path: "/food/restaurant/delivery-settings", icon: Truck },
      { label: "Zone setup", path: "/food/restaurant/zone-setup", icon: MapPin },
      { label: "Refer & Earn", path: "/food/restaurant/refer-earn", icon: Gift },
      { label: "Live Location Control", path: "/food/restaurant/live-location", icon: MapPin },
    ],
  },
]

// Standalone link pinned to the bottom of the sidebar — opens the Explore More
// hub page, which itself lists Payout/Invoices/Withdrawal history/Support etc.
const EXPLORE_LINK = { label: "Explore", path: "/food/restaurant/explore", icon: Compass }

export default function RestaurantSidebar({ className }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo("restaurant"))
  const subscriptionRequired = useSubscriptionRequired("RESTAURANT")
  const NAV_SECTIONS = useMemo(() => getNavSections(subscriptionRequired), [subscriptionRequired])

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const cached = getCachedSettings()
        if (cached) {
          const restLogo = getAppLogo("restaurant")
          if (restLogo) setLogoUrl(restLogo)
        } else {
          const settings = await loadBusinessSettings()
          if (settings) {
            const restLogo = getAppLogo("restaurant")
            if (restLogo) setLogoUrl(restLogo)
          }
        }
      } catch (error) {
        console.error("Error loading business settings for sidebar:", error)
      }
    }
    loadSettings()

    const handleSettingsUpdate = (e) => {
      const settings = e.detail || getCachedSettings()
      if (settings) {
        const restLogo = settings.restaurantLogo?.url || settings.logo?.url
        if (restLogo) setLogoUrl(restLogo)
      }
    }
    window.addEventListener("businessSettingsUpdated", handleSettingsUpdate)
    return () => window.removeEventListener("businessSettingsUpdated", handleSettingsUpdate)
  }, [])

  const handleLogout = () => {
    clearModuleAuth("restaurant")
    navigate("/food/restaurant/login", { replace: true })
  }

  return (
    <div
      className={cn(
        "flex h-screen w-64 flex-col border-r border-gray-100 bg-white shadow-[4px_0_24px_rgba(0,0,0,0.02)]",
        className
      )}
    >
      {/* Brand Section with Live Logo */}
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 px-4 border-b border-gray-100 bg-white">
        {logoUrl ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={logoUrl}
              alt="ITZO Restaurant Logo"
              className="h-9 w-auto max-h-9 object-contain rounded-lg shrink-0 shadow-xs"
              onError={() => setLogoUrl(null)}
            />
            <span className="rounded-md bg-[#0f2d5a]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0f2d5a] border border-[#0f2d5a]/15 shrink-0">
              Restaurant
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-xl bg-[#0f2d5a] flex items-center justify-center p-1 shadow-sm shadow-[#0f2d5a]/25 shrink-0">
              <span className="text-white font-black text-xs">IT</span>
            </div>
            <h1 className="text-lg font-black text-[#0f2d5a] tracking-tight">
              ITZO
            </h1>
            <span className="rounded-md bg-[#0f2d5a]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0f2d5a] border border-[#0f2d5a]/15">
              Restaurant
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div
        data-lenis-prevent="true"
        className="flex flex-1 flex-col overflow-y-auto px-3 py-3 scrollbar-thin scrollbar-thumb-gray-200"
      >
        {NAV_SECTIONS.map((section, sectionIdx) => (
          <div key={section.title} className={cn("mb-5", sectionIdx === 0 ? "mt-1" : "")}>
            <h3 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {section.title}
            </h3>
            <div className="flex flex-col gap-1">
              {section.items.map((item) => {
                const isActive =
                  location.pathname === item.path ||
                  (item.path !== "/food/restaurant/dashboard" &&
                    item.path !== "/food/restaurant" &&
                    location.pathname.startsWith(item.path))

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200",
                      isActive
                        ? "bg-[#0f2d5a]/10 text-[#0f2d5a] shadow-xs"
                        : "text-slate-600 hover:bg-slate-100/70 hover:text-[#0f2d5a]"
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#0f2d5a]" />
                    )}
                    {item.icon && (
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
                          isActive
                            ? "bg-[#0f2d5a] text-white shadow-sm shadow-[#0f2d5a]/30"
                            : "bg-slate-100 text-[#0f2d5a] group-hover:bg-[#0f2d5a] group-hover:text-white group-hover:shadow-sm"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0 transition-colors" />
                      </div>
                    )}
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer / Explore + Logout Section */}
      <div className="border-t border-gray-100 p-3 shrink-0 space-y-1">
        <NavLink
          to={EXPLORE_LINK.path}
          className={cn(
            "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200",
            location.pathname === EXPLORE_LINK.path
              ? "bg-[#0f2d5a]/10 text-[#0f2d5a] shadow-xs"
              : "text-slate-600 hover:bg-slate-100/70 hover:text-[#0f2d5a]"
          )}
        >
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
              location.pathname === EXPLORE_LINK.path
                ? "bg-[#0f2d5a] text-white shadow-sm shadow-[#0f2d5a]/30"
                : "bg-slate-100 text-[#0f2d5a] group-hover:bg-[#0f2d5a] group-hover:text-white group-hover:shadow-sm"
            )}
          >
            <EXPLORE_LINK.icon className="h-4 w-4 shrink-0 transition-colors" />
          </div>
          <span className="truncate">{EXPLORE_LINK.label}</span>
        </NavLink>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition-all hover:bg-rose-50 hover:text-rose-600 group"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 group-hover:bg-rose-600 group-hover:text-white transition-all">
            <LogOut className="h-4 w-4 shrink-0" />
          </div>
          <span className="truncate">Logout</span>
        </button>
      </div>
    </div>
  )
}
