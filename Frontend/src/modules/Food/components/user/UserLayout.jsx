import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { useEffect, useState, createContext, useContext } from "react"
import { ProfileProvider } from "@food/context/ProfileContext"
import { setAppType } from "@common/utils/businessSettings"
import LocationPrompt from "./LocationPrompt"
import { LocationProvider } from "@food/hooks/useLocation"
import { CartProvider } from "@food/context/CartContext"
import { OrdersProvider } from "@food/context/OrdersContext"
const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }

import { cn } from "@/lib/utils"
import SearchOverlay from "./SearchOverlay"
import BottomNavigation from "./BottomNavigation"
import DesktopNavbar from "./DesktopNavbar"
import QuickFooter from "@/modules/quickCommerce/user/components/layout/Footer"
import QuickBottomNav from "@/modules/quickCommerce/user/components/layout/BottomNav"
import { useUserNotifications } from "../../hooks/useUserNotifications"

// Create SearchOverlay context with default value
const SearchOverlayContext = createContext({
  isSearchOpen: false,
  searchValue: "",
  setSearchValue: () => {
    debugWarn("SearchOverlayProvider not available")
  },
  openSearch: () => {
    debugWarn("SearchOverlayProvider not available")
  },
  closeSearch: () => { }
})

export function useSearchOverlay() {
  const context = useContext(SearchOverlayContext)
  // Always return context, even if provider is not available (will use default values)
  return context
}

function SearchOverlayProvider({ children }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  const openSearch = () => {
    setIsSearchOpen(true)
  }

  const closeSearch = () => {
    setIsSearchOpen(false)
    setSearchValue("")
  }

  return (
    <SearchOverlayContext.Provider value={{ isSearchOpen, searchValue, setSearchValue, openSearch, closeSearch }}>
      {children}
      {isSearchOpen && (
        <SearchOverlay
          isOpen={isSearchOpen}
          onClose={closeSearch}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
        />
      )}
    </SearchOverlayContext.Provider>
  )
}

// Create LocationSelector context with default value
const LocationSelectorContext = createContext({
  isLocationSelectorOpen: false,
  openLocationSelector: () => {
    debugWarn("LocationSelectorProvider not available")
  },
  closeLocationSelector: () => { }
})

export function useLocationSelector() {
  const context = useContext(LocationSelectorContext)
  // Use the default value when this hook is called outside the food user layout.
  return context
}

function LocationSelectorProvider({ children }) {
  const navigate = useNavigate()
  const location = useLocation()

  const openLocationSelector = () => {
    const currentPath = `${location.pathname || ""}${location.search || ""}${location.hash || ""}` || "/food/user"
    navigate("/cart/address-selector", {
      state: {
        from: currentPath,
        backTo: currentPath,
      },
    })
  }

  const closeLocationSelector = () => { }

  const value = {
    isLocationSelectorOpen: false,
    openLocationSelector,
    closeLocationSelector
  }

  return (
    <LocationSelectorContext.Provider value={value}>
      {children}
    </LocationSelectorContext.Provider>
  )
}

export default function UserLayout({ children }) {
  const location = useLocation()

  useEffect(() => {
    setAppType('user')
  }, [])

  useEffect(() => {
    // Reset scroll to top whenever location changes (pathname, search, or hash)
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname, location.search, location.hash])

  useUserNotifications()

  // Note: Authentication checks and redirects are handled by ProtectedRoute components
  // UserLayout should not interfere with authentication redirects

  // Show bottom navigation only on home page, under-250 page, and profile page
  const path = location.pathname.startsWith("/food")
    ? location.pathname.substring(5) || "/"
    : location.pathname
  const normalizedPath =
    path.length > 1 ? path.replace(/\/+$/, "") : path
  const profileSource = new URLSearchParams(location.search).get("from")
  const isSharedQuickProfile =
    normalizedPath === "/profile" &&
    profileSource === "quick"

  const isSharedFoodProfile =
    normalizedPath === "/profile" &&
    profileSource !== "quick"

  const isProfileRoot =
    normalizedPath === "/user/profile" ||
    isSharedFoodProfile

  const isDining =
    normalizedPath === "/dining" ||
    normalizedPath.startsWith("/dining/") ||
    normalizedPath === "/user/dining" ||
    normalizedPath.startsWith("/user/dining/")

  const showBottomNav = normalizedPath === "/" ||
    normalizedPath === "/user" ||
    normalizedPath === "/under-250" ||
    normalizedPath === "/user/under-250" ||
    normalizedPath === "/orders" ||
    normalizedPath === "/user/orders" ||
    isDining ||
    isProfileRoot ||
    normalizedPath === "" // Handle empty string case for root relative to /food

  const isQuickHome =
    location.pathname === "/quick" || location.pathname === "/quick/"

  const showQuickBottomNav = isQuickHome || isSharedQuickProfile
  const showFoodBottomNav =
    showBottomNav && !showQuickBottomNav
  const showAnyMobileBottomNav =
    showFoodBottomNav || showQuickBottomNav

  const footerColor = location.pathname.startsWith("/quick")
    ? "#ea580c"
    : "#FE5502"

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f5] dark:bg-[#0a0a0a] transition-colors duration-200">
      <CartProvider>
        <ProfileProvider>
          <OrdersProvider>
            <SearchOverlayProvider>
              <LocationSelectorProvider>
                <LocationProvider>
                  {/* <Navbar /> */}
                  <div className="hidden md:block">
                    {!isSharedQuickProfile && <DesktopNavbar showLogo={true} />}
                  </div>
                  <LocationPrompt />
                  <main className={cn(
                    "flex-1",
                    !isSharedQuickProfile ? "md:pt-[5.5rem]" : "",
                    showAnyMobileBottomNav ? "pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0" : ""
                  )}>
                    {children || <Outlet />}
                  </main>
                  <div className="hidden md:block w-full">
                    {!isSharedQuickProfile && <QuickFooter themeColor={footerColor} />}
                  </div>
                  <div className="block md:hidden">
                    {showFoodBottomNav && <BottomNavigation />}
                    {showQuickBottomNav && <QuickBottomNav />}
                  </div>
                </LocationProvider>
              </LocationSelectorProvider>
            </SearchOverlayProvider>
          </OrdersProvider>
        </ProfileProvider>
      </CartProvider>
    </div>
  )
}
