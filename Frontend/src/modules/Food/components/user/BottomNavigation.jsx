import { Link, useLocation } from "react-router-dom"
import { Tag, User, Home, ShoppingBag, UtensilsCrossed } from "lucide-react"
import { useAuth } from "@core/context/AuthContext"

export default function BottomNavigation() {
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const pathname = location.pathname
  const profileSource = new URLSearchParams(location.search).get("from")
  const redirectTo = `${location.pathname || "/food/user"}${location.search || ""}${location.hash || ""}`

  // Check active routes - support both /user/* and /* paths
  const isDining = pathname === "/food/dining" || pathname.startsWith("/food/user/dining")
  const isUnder250 = pathname === "/food/under-250" || pathname.startsWith("/food/user/under-250")
  const isOrders =
    pathname === "/food/orders" ||
    pathname.startsWith("/food/user/orders") ||
    pathname === "/orders" ||
    pathname.startsWith("/orders/")
  const isSharedFoodProfile =
    (pathname === "/profile" || pathname.startsWith("/profile/")) &&
    profileSource !== "quick"
  const isProfile =
    pathname.startsWith("/food/profile") ||
    pathname.startsWith("/food/user/profile") ||
    isSharedFoodProfile
  const isHome =
    !isDining &&
    !isUnder250 &&
    !isOrders &&
    !isProfile &&
    (pathname === "/food" ||
      pathname === "/food/" ||
      pathname === "/food/user" ||
      (pathname.startsWith("/food/user") &&
        !pathname.includes("/dining") &&
        !pathname.includes("/under-250") &&
        !pathname.includes("/orders") &&
        !pathname.includes("/profile")))

  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-50"
    >
      <div
        className="relative bg-white dark:bg-[#1a1a1a] border-t border-gray-200 dark:border-gray-800 shadow-lg"
      >
        <div className="flex items-center justify-around h-auto px-2 sm:px-4">
          {/* Home Tab */}
          <Link
            to="/food/user"
            className={`flex flex-1 flex-col items-center gap-1.5 px-2 sm:px-3 py-2 transition-all duration-200 relative ${isHome
                ? "text-primary-orange dark:text-primary-orange"
                : "text-gray-600 dark:text-gray-400"
              }`}
          >
            <Home className={`h-5 w-5 ${isHome ? "text-primary-orange dark:text-primary-orange fill-primary-orange/20 dark:fill-primary-orange/20" : "text-gray-600 dark:text-gray-400"}`} strokeWidth={2} />
            <span className={`text-xs sm:text-sm font-medium ${isHome ? "text-primary-orange dark:text-primary-orange font-semibold" : "text-gray-600 dark:text-gray-400"}`}>
              Home
            </span>
            {isHome && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary-orange dark:bg-primary-orange rounded-b-full" />
            )}
          </Link>

          {/* Divider */}
          <div className="h-8 w-px bg-gray-300 dark:bg-gray-700" />

          {/* Under 250 Tab */}
          <Link
            to="/food/user/under-250"
            className={`flex flex-1 flex-col items-center gap-1.5 px-2 sm:px-3 py-2 transition-all duration-200 relative ${isUnder250
                ? "text-primary-orange dark:text-primary-orange"
                : "text-gray-600 dark:text-gray-400"
              }`}
          >
            <Tag className={`h-5 w-5 ${isUnder250 ? "text-primary-orange dark:text-primary-orange fill-primary-orange dark:fill-primary-orange" : "text-gray-600 dark:text-gray-400"}`} strokeWidth={2} />
            <span className={`text-xs sm:text-sm font-medium ${isUnder250 ? "text-primary-orange dark:text-primary-orange font-semibold" : "text-gray-600 dark:text-gray-400"}`}>
              Under 250
            </span>
            {isUnder250 && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary-orange dark:bg-primary-orange rounded-b-full" />
            )}
          </Link>

          {/* Divider */}
          <div className="h-8 w-px bg-gray-300 dark:bg-gray-700" />

          {/* Orders Tab */}
          <Link
            to={isAuthenticated ? "/food/user/orders" : "/user/auth/login"}
            state={!isAuthenticated ? { redirectTo: "/food/user/orders" } : undefined}
            className={`flex flex-1 flex-col items-center gap-1.5 px-2 sm:px-3 py-2 transition-all duration-200 relative ${isOrders
                ? "text-primary-orange dark:text-primary-orange"
                : "text-gray-600 dark:text-gray-400"
              }`}
          >
            <ShoppingBag className={`h-5 w-5 ${isOrders ? "text-primary-orange dark:text-primary-orange fill-primary-orange/20 dark:fill-primary-orange/20" : "text-gray-600 dark:text-gray-400"}`} strokeWidth={2} />
            <span className={`text-xs sm:text-sm font-medium ${isOrders ? "text-primary-orange dark:text-primary-orange font-semibold" : "text-gray-600 dark:text-gray-400"}`}>
              Orders
            </span>
            {isOrders && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary-orange dark:bg-primary-orange rounded-b-full" />
            )}
          </Link>

          {/* Divider */}
          <div className="h-8 w-px bg-gray-300 dark:bg-gray-700" />

          {/* Profile Tab */}
          <Link
            to={isAuthenticated ? "/food/user/profile" : "/user/auth/login"}
            state={!isAuthenticated ? { redirectTo: "/food/user/profile" } : undefined}
            className={`flex flex-1 flex-col items-center gap-1.5 px-2 sm:px-3 py-2 transition-all duration-200 relative ${isProfile
                ? "text-primary-orange dark:text-primary-orange"
                : "text-gray-600 dark:text-gray-400"
              }`}
          >
            <User className={`h-5 w-5 ${isProfile ? "text-primary-orange dark:text-primary-orange fill-primary-orange dark:fill-primary-orange" : "text-gray-600 dark:text-gray-400"}`} />
            <span className={`text-xs sm:text-sm font-medium ${isProfile ? "text-primary-orange dark:text-primary-orange font-semibold" : "text-gray-600 dark:text-gray-400"}`}>
              Profile
            </span>
            {isProfile && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary-orange dark:bg-primary-orange rounded-b-full" />
            )}
          </Link>
        </div>
      </div>
    </div>
  )
}
