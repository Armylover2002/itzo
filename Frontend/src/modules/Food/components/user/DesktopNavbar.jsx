import { Link, useLocation, useNavigate } from "react-router-dom"
import { useEffect, useState, useRef } from "react"
import { ChevronDown, ShoppingCart, Wallet, Search, Mic } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Switch } from "@food/components/ui/switch"
import { useLocation as useLocationHook } from "@food/hooks/useLocation"
import { useCart } from "@food/context/CartContext"
import { useLocationSelector, useSearchOverlay } from "./UserLayout"
import { useProfile } from "@food/context/ProfileContext"
import { FaLocationDot } from "react-icons/fa6"
import { AnimatePresence, motion } from "framer-motion"
import { useAuth } from "@core/context/AuthContext"

import { 
    loadBusinessSettings, 
    getCachedSettings, 
    getCompanyName,
    getAppLogo,
    getAppFavicon,
    updateBrowserFavicon 
} from "@common/utils/businessSettings"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function DesktopNavbar({ showLogo = true }) {
    const location = useLocation()
    const { isAuthenticated } = useAuth()
    const navigate = useNavigate()
    const { location: userLocation, loading: locationLoading } = useLocationHook()
    const { getCartCount } = useCart()
    const { openLocationSelector } = useLocationSelector()
    const { setSearchValue } = useSearchOverlay()
    const { vegMode, setVegMode } = useProfile()
    const [heroSearch, setHeroSearch] = useState("")
    const [logoUrl, setLogoUrl] = useState(() => getAppLogo('user'))
    const [companyName, setCompanyName] = useState(() => getCompanyName())
    const [hasScrolledPastBanner, setHasScrolledPastBanner] = useState(false)
    const navRef = useRef(null)
    const cartCount = getCartCount()


    const areaName = userLocation?.area && userLocation?.area.trim() ? userLocation.area.trim() : null
    const cityName = userLocation?.city || null
    const stateName = userLocation?.state || null
    // Saved addresses carry their label (Home / Office / Other) through the address
    // selector; a live "use current location" pick has none.
    const addressLabel = String(userLocation?.label || "").trim() || null

    // Headline is the label the customer recognises, with the actual street below it.
    // Showing only the area (the previous behaviour) meant a specific pick like
    // "Corporate House, 103, Film Colony Rd" collapsed to just "Chhoti Gwaltoli".
    const mainLocationName = addressLabel || areaName || cityName || "Select"

    const shortAddress = [userLocation?.street, areaName, cityName]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        // Street and area are sometimes the same value — don't repeat it.
        .filter((part, idx, all) => all.indexOf(part) === idx)
        .join(", ")

    const secondaryLocation = addressLabel
        ? (shortAddress || userLocation?.formattedAddress || cityName || "")
        : areaName
            ? (cityName || "")
            : (cityName && stateName ? `${cityName}, ${stateName}` : cityName || stateName || "")

    const handleLocationClick = () => {
        // Open location selector overlay
        openLocationSelector()
    }

    // Check active routes - support both /user/* and /* paths
    const normalizedPath =
        location.pathname.length > 1
            ? location.pathname.replace(/\/+$/, "")
            : location.pathname
    const profileSource = new URLSearchParams(location.search).get("from")
    const isQuick = normalizedPath === "/quick" || normalizedPath.startsWith("/quick/")
    const isUnder250 = location.pathname === "/food/user/under-250" || location.pathname === "/food/under-250"
    const isSharedFoodProfile =
        (normalizedPath === "/profile" || normalizedPath.startsWith("/profile/")) &&
        profileSource !== "quick"
    const isProfile =
        location.pathname.startsWith("/food/user/profile") ||
        location.pathname.startsWith("/food/profile") ||
        isSharedFoodProfile
    const isOrders =
        location.pathname === "/food/user/orders" ||
        location.pathname.startsWith("/food/user/orders") ||
        location.pathname === "/food/orders" ||
        normalizedPath === "/orders" ||
        normalizedPath.startsWith("/orders/")
    const isDelivery = !isUnder250 && !isOrders && !isProfile && !isQuick && (location.pathname === "/food/user" || location.pathname === "/food" || (location.pathname.startsWith("/food/user") && !location.pathname.includes("/under-250") && !location.pathname.includes("/orders") && !location.pathname.includes("/profile")))
    const isBannerRoute = false
    const searchPlaceholder = isQuick
        ? 'Search for milk, bread, eggs...'
        : "Search for restaurants, food..."

    // Load business settings logo
    useEffect(() => {
        const loadLogo = async () => {
            try {
                const cached = getCachedSettings()
                if (cached) {
                    const userLogo = getAppLogo('user')
                    if (userLogo) {
                        setLogoUrl(userLogo)
                    }
                    const userFav = getAppFavicon('user')
                    if (userFav) updateBrowserFavicon(userFav)
                    if (cached.companyName) {
                        setCompanyName(cached.companyName)
                    }
                } else {
                    const settings = await loadBusinessSettings()
                    if (settings) {
                        const userLogo = getAppLogo('user')
                        if (userLogo) {
                            setLogoUrl(userLogo)
                        }
                        const userFav = getAppFavicon('user')
                        if (userFav) updateBrowserFavicon(userFav)
                        if (settings.companyName) {
                            setCompanyName(settings.companyName)
                        }
                    }
                }
            } catch (error) {
                debugError('Error loading logo:', error)
            }
        }
        loadLogo()

        // Listen for business settings updates
        const handleSettingsUpdate = (e) => {
            const settings = e.detail || getCachedSettings()
            const userLogo = settings?.userLogo?.url || settings?.logo?.url
            const userFav = settings?.userFavicon?.url || settings?.favicon?.url
            if (userLogo) setLogoUrl(userLogo)
            if (userFav) updateBrowserFavicon(userFav)
            if (settings?.companyName) setCompanyName(settings.companyName)
        }
        window.addEventListener('businessSettingsUpdated', handleSettingsUpdate)

        return () => {
            window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate)
        }
    }, [])

    useEffect(() => {
        if (!isBannerRoute) {
            setHasScrolledPastBanner(true)
            return
        }

        const handleScroll = () => {
            const heroShell =
                document.querySelector('[data-home-hero-shell="true"]') ||
                document.querySelector('[data-banner-shell="true"]')
            const navElement = navRef.current

            if (!heroShell || !navElement) {
                setHasScrolledPastBanner(false)
                return
            }

            const heroRect = heroShell.getBoundingClientRect()
            const navHeight = navElement.getBoundingClientRect().height || 0
            setHasScrolledPastBanner(heroRect.bottom <= navHeight)
        }

        handleScroll()
        window.addEventListener("scroll", handleScroll, { passive: true })
        window.addEventListener("resize", handleScroll)

        return () => {
            window.removeEventListener("scroll", handleScroll)
            window.removeEventListener("resize", handleScroll)
        }
    }, [isBannerRoute])

    return (
        <nav
            ref={navRef}
            className={`hidden md:flex flex-col fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${(isBannerRoute && !hasScrolledPastBanner)
                ? "bg-transparent !bg-transparent border-0 shadow-none"
                : "bg-white dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-800 shadow-sm"
                }`}
        >
            {/* Single Header Row: Logo - Location - Search - Nav Tabs - Veg - Wallet - Cart */}
            <div className="w-full">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16 lg:h-18 gap-3 lg:gap-4">
                        {/* 1. Left Section: Logo, Location & Compact Search Bar */}
                        <div className="flex items-center gap-2.5 lg:gap-4 flex-shrink-0">
                            {/* Logo */}
                            {showLogo && (
                                <Link to="/food/user" className="flex items-center justify-center flex-shrink-0">
                                    <img
                                        src={logoUrl || "/itzo-logo-transparent.png"}
                                        alt={companyName || "Logo"}
                                        className="h-9 w-auto md:h-11 lg:h-12 object-contain"
                                        onError={(e) => {
                                            e.target.src = "/itzo-logo-transparent.png";
                                        }}
                                    />
                                </Link>
                            )}

                            {/* Location Selector */}
                            <Button
                                variant="ghost"
                                onClick={handleLocationClick}
                                disabled={locationLoading}
                                className="h-auto px-0 py-0 hover:bg-transparent transition-colors flex-shrink-0"
                            >
                                {locationLoading ? (
                                    <span className="text-xs font-bold text-black dark:text-white">
                                        Loading...
                                    </span>
                                ) : (
                                    <div className="flex flex-col items-start min-w-0">
                                        <div className="flex items-center gap-1">
                                            <FaLocationDot
                                                className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-black dark:text-white flex-shrink-0"
                                                fill="currentColor"
                                                strokeWidth={2}
                                            />
                                            <span className="text-xs lg:text-sm font-bold text-black dark:text-white whitespace-nowrap">
                                                {mainLocationName}
                                            </span>
                                            <ChevronDown className="h-3 w-3 lg:h-3.5 lg:w-3.5 text-black dark:text-white flex-shrink-0" strokeWidth={2.5} />
                                        </div>
                                        {secondaryLocation && (
                                            <span
                                                title={secondaryLocation}
                                                className="text-xs lg:text-sm font-bold text-gray-600 dark:text-gray-400 mt-0.5 whitespace-nowrap truncate max-w-[220px] lg:max-w-[300px]"
                                            >
                                                {secondaryLocation}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </Button>

                            {/* Compact Search Bar right next to Logo/Location */}
                            <div className="relative w-44 sm:w-52 md:w-60 lg:w-72 flex-shrink-0 ml-1">
                                <form 
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        if (heroSearch.trim()) {
                                            navigate(
                                                isQuick
                                                    ? `/quick/search?q=${encodeURIComponent(heroSearch.trim())}`
                                                    : `/food/user/search?q=${encodeURIComponent(heroSearch.trim())}`
                                            )
                                        }
                                    }}
                                    className="relative bg-gray-100 dark:bg-[#2a2a2a] rounded-lg transition-all duration-300 focus-within:ring-2 focus-within:ring-[#FE5502] focus-within:bg-white dark:focus-within:bg-[#1a1a1a] border border-transparent focus-within:border-[#FE5502]/20"
                                >
                                    <div className="flex items-center px-2.5 py-1.5">
                                        <Search className="h-3.5 w-3.5 text-gray-500 flex-shrink-0 mr-1.5" />
                                        <Input
                                            value={heroSearch}
                                            onChange={(e) => {
                                                const nextValue = e.target.value
                                                setHeroSearch(nextValue)
                                                setSearchValue(nextValue)
                                            }}
                                            className="h-5 p-0 border-0 bg-transparent text-xs font-medium placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                                            placeholder={searchPlaceholder}
                                        />
                                        {heroSearch && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-4 w-4 p-0 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full ml-1"
                                                onClick={() => setHeroSearch("")}
                                            >
                                                <span className="sr-only">Clear</span>
                                                <span aria-hidden="true">×</span>
                                            </Button>
                                        )}
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* 2. Middle Section: Navigation Tabs (Fit in space next to search bar) */}
                        <div className="flex items-center space-x-4 lg:space-x-8 mx-2 flex-shrink-0">
                            {/* Home Tab */}
                            <Link
                                to="/food/user"
                                className={`flex flex-col items-center gap-0.5 px-1.5 py-1 transition-colors relative group ${isDelivery
                                    ? "text-[#FE5502] dark:text-[#FE5502]"
                                    : "text-gray-600 dark:text-gray-400 hover:text-[#FE5502] dark:hover:text-[#FE5502]"
                                    }`}
                            >
                                <span className="text-xs lg:text-sm font-bold tracking-wide uppercase whitespace-nowrap">Home</span>
                                {isDelivery && (
                                    <motion.div
                                        layoutId="navIndicator"
                                        className="absolute -bottom-2 left-0 right-0 h-0.5 bg-[#FE5502] dark:bg-[#FE5502]"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.3 }}
                                    />
                                )}
                            </Link>

                            {/* Under 250 Tab */}
                            <Link
                                to="/food/user/under-250"
                                className={`flex flex-col items-center gap-0.5 px-1.5 py-1 transition-colors relative group ${isUnder250
                                    ? "text-[#FE5502] dark:text-[#FE5502]"
                                    : "text-gray-600 dark:text-gray-400 hover:text-[#FE5502] dark:hover:text-[#FE5502]"
                                    }`}
                            >
                                <span className="text-xs lg:text-sm font-bold tracking-wide uppercase whitespace-nowrap">Under 250</span>
                                {isUnder250 && (
                                    <motion.div
                                        layoutId="navIndicator"
                                        className="absolute -bottom-2 left-0 right-0 h-0.5 bg-[#FE5502] dark:bg-[#FE5502]"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.3 }}
                                    />
                                )}
                            </Link>

                            {/* Orders Tab */}
                            <Link
                                to={isAuthenticated ? "/food/user/orders" : "/user/auth/login"}
                                state={!isAuthenticated ? { redirectTo: "/food/user/orders" } : undefined}
                                className={`flex flex-col items-center gap-0.5 px-1.5 py-1 transition-colors relative group ${isOrders
                                    ? "text-[#FE5502] dark:text-[#FE5502]"
                                    : "text-gray-600 dark:text-gray-400 hover:text-[#FE5502] dark:hover:text-[#FE5502]"
                                    }`}
                            >
                                <span className="text-xs lg:text-sm font-bold tracking-wide uppercase whitespace-nowrap">Orders</span>
                                {isOrders && (
                                    <motion.div
                                        layoutId="navIndicator"
                                        className="absolute -bottom-2 left-0 right-0 h-0.5 bg-[#FE5502] dark:bg-[#FE5502]"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.3 }}
                                    />
                                )}
                            </Link>

                            {/* Profile Tab */}
                            <Link
                                to={isAuthenticated ? "/food/user/profile" : "/user/auth/login"}
                                state={!isAuthenticated ? { redirectTo: "/food/user/profile" } : undefined}
                                className={`flex flex-col items-center gap-0.5 px-1.5 py-1 transition-colors relative group ${isProfile
                                    ? "text-orange-600 dark:text-orange-500"
                                    : "text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-500"
                                    }`}
                            >
                                <span className="text-xs lg:text-sm font-bold tracking-wide uppercase whitespace-nowrap">Profile</span>
                                {isProfile && (
                                    <motion.div
                                        layoutId="navIndicator"
                                        className="absolute -bottom-2 left-0 right-0 h-0.5 bg-orange-600 dark:bg-orange-500"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.3 }}
                                    />
                                )}
                            </Link>
                        </div>

                        {/* 3. Right Section: Veg Mode + Wallet + Cart Icons */}
                        <div className="flex items-center gap-2.5 lg:gap-4 flex-shrink-0 ml-auto">
                            {/* VEG MODE Toggle */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                <div className="flex flex-col items-end">
                                    <span className="text-[9px] font-bold text-gray-700 dark:text-gray-300 leading-none">VEG</span>
                                    <span className="text-[7px] font-bold text-gray-500 dark:text-gray-400 leading-none">MODE</span>
                                </div>
                                <Switch
                                    checked={vegMode}
                                    onCheckedChange={setVegMode}
                                    className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-600 h-4.5 w-8"
                                />
                            </div>

                            {/* Wallet Icon */}
                            <Link to="/food/user/wallet">
                                <Button
                                    variant="ghost"
                                    className="h-9 w-9 lg:h-11 lg:w-11 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    title="Wallet"
                                >
                                    <Wallet className="!h-4.5 !w-4.5 lg:!h-5.5 lg:!w-5.5 text-gray-700 dark:text-gray-300" strokeWidth={2} />
                                </Button>
                            </Link>

                            {/* Cart Icon */}
                            <Link to="/food/user/cart">
                                <Button
                                    variant="ghost"
                                    className="relative h-9 w-9 lg:h-11 lg:w-11 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    title="Cart"
                                >
                                    <ShoppingCart className="!h-4.5 !w-4.5 lg:!h-5.5 lg:!w-5.5 text-gray-700 dark:text-gray-300" strokeWidth={2} />
                                    {cartCount > 0 && (
                                        <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-red-500 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                                            <span className="text-[9px] font-bold text-white">{cartCount > 99 ? "99+" : cartCount}</span>
                                        </span>
                                    )}
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    )
}


