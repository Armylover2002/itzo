import { Link, useLocation, useNavigate } from "react-router-dom"
import { useEffect, useState, useRef } from "react"
import { ChevronDown, ShoppingCart, Search, X, Tag, User, Wallet, Bell } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { useLocation as useLocationHook } from "@food/hooks/useLocation"
import { useCart } from "@food/context/CartContext"
import { useLocationSelector, useSearchOverlay } from "./UserLayout"
import { FaLocationDot } from "react-icons/fa6"
import { useAuth } from "@core/context/AuthContext"
import { cn } from "@/lib/utils"
import { useProfile } from "@food/context/ProfileContext"
import * as imgUtils from "@food/utils/imageUtils"
import { parseGeoPoint } from "@food/utils/geo"
import {
    getCachedSettings,
    getCompanyName,
    getAppLogo,
    getAppFavicon,
    updateBrowserFavicon,
    subscribeBusinessSettings,
} from "@common/utils/businessSettings"

const getStoredDeliveryAddressMode = () => {
    if (typeof window === "undefined") return "saved"
    return window.localStorage.getItem("deliveryAddressMode") || "saved"
}

export default function DesktopNavbar({ showLogo = true }) {
    const location = useLocation()
    const { isAuthenticated } = useAuth()
    const navigate = useNavigate()
    const { location: userLocation, loading: locationLoading } = useLocationHook()
    const { getCartCount } = useCart()
    const { openLocationSelector } = useLocationSelector()
    const { setSearchValue } = useSearchOverlay()
    const { getDefaultAddress, vegMode, setVegMode } = useProfile()
    const [heroSearch, setHeroSearch] = useState("")
    const [logoUrl, setLogoUrl] = useState(() => getAppLogo("user"))
    const [companyName, setCompanyName] = useState(() => getCompanyName())
    const navRef = useRef(null)
    const cartCount = getCartCount()

    const defaultSavedAddress = getDefaultAddress?.() || null
    const defaultSavedAddressLocation = defaultSavedAddress ? {
        ...defaultSavedAddress,
        latitude: parseGeoPoint(defaultSavedAddress)?.lat ?? null,
        longitude: parseGeoPoint(defaultSavedAddress)?.lng ?? null,
        area: defaultSavedAddress.additionalDetails || defaultSavedAddress.area || "",
        zipCode: defaultSavedAddress.zipCode || defaultSavedAddress.postalCode || "",
        postalCode: defaultSavedAddress.postalCode || defaultSavedAddress.zipCode || "",
    } : null

    const deliveryAddressMode = getStoredDeliveryAddressMode()
    const effectiveLocation = (deliveryAddressMode === "current" ? userLocation : defaultSavedAddressLocation) || userLocation
    const mainLocationName = imgUtils.formatSavedAddress(effectiveLocation) || "Select Location"

    const isQuick = location.pathname.startsWith("/quick")
    const searchPlaceholder = isQuick ? "Search milk, bread, eggs..." : "Search \"food\""

    useEffect(() => {
        const apply = (settings) => {
            const userLogo = getAppLogo("user")
            if (userLogo) setLogoUrl(userLogo)
            const userFav = getAppFavicon("user")
            if (userFav) updateBrowserFavicon(userFav)
            if (settings?.companyName) setCompanyName(settings.companyName)
            else setCompanyName(getCompanyName())
        }
        apply(getCachedSettings())
        return subscribeBusinessSettings(apply)
    }, [])

    const handleSearchSubmit = () => {
        if (!heroSearch.trim()) return
        navigate(
            isQuick
                ? `/quick/search?q=${encodeURIComponent(heroSearch.trim())}`
                : `/food/search?q=${encodeURIComponent(heroSearch.trim())}`,
        )
    }

    return (
        <nav
            ref={navRef}
            className="fixed top-0 left-0 right-0 z-50 hidden flex-col transition-all duration-300 md:flex border-b border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-[#1a1a1a] pt-[env(safe-area-inset-top,0px)]"
        >
            <div className="w-full border-b border-transparent">
                <div className="mx-auto w-full px-4 lg:px-8 max-w-[1920px]">
                    <div className="flex min-h-[4rem] items-center gap-4 py-2 pt-5 lg:pt-6">
                        {/* Logo */}
                        <div className="flex flex-shrink-0 items-center">
                            {showLogo && (
                                <Link to="/food/user" className="flex flex-shrink-0 items-center justify-center mr-6">
                                    {logoUrl ? (
                                        <img
                                            src={logoUrl}
                                            alt={companyName || "Logo"}
                                            className="h-10 w-auto object-contain lg:h-12"
                                            onError={(e) => {
                                                e.currentTarget.style.display = "none"
                                            }}
                                        />
                                    ) : (
                                        <span className="text-xl font-bold text-gray-900 dark:text-white">
                                            {companyName || "Appzeto"}
                                        </span>
                                    )}
                                </Link>
                            )}
                        </div>

                        <Button
                            variant="outline"
                            onClick={openLocationSelector}
                            disabled={locationLoading}
                            className="h-10 lg:h-12 rounded-lg border border-gray-200 px-2 lg:px-4 flex items-center justify-between min-w-0 md:w-28 lg:min-w-[140px] max-w-[140px] lg:max-w-[260px] hover:bg-gray-50 flex-shrink-0"
                        >
                            {locationLoading ? (
                                <span className="text-sm font-bold text-black">Loading...</span>
                            ) : (
                                <div className="flex items-center gap-2 w-full">
                                    <FaLocationDot className="h-4 w-4 text-[#FF0000]" />
                                    <span className="truncate text-sm font-semibold text-gray-800">
                                        {mainLocationName}
                                    </span>
                                    <ChevronDown className="h-4 w-4 ml-auto text-gray-500" strokeWidth={2} />
                                </div>
                            )}
                        </Button>

                        {/* Search Bar */}
                        <div className="flex-1 mx-2 lg:mx-4 max-w-3xl min-w-0">
                            <div className="flex items-center h-10 lg:h-12 w-full rounded-lg border border-gray-200 bg-white px-2 lg:px-4 focus-within:border-gray-400 focus-within:shadow-sm transition-all shadow-sm min-w-0">
                                <Search className="h-4 w-4 lg:h-5 lg:w-5 text-gray-400 mr-2 lg:mr-3 flex-shrink-0" />
                                <Input
                                    value={heroSearch}
                                    onChange={(e) => {
                                        setHeroSearch(e.target.value)
                                        setSearchValue(e.target.value)
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSearchSubmit()
                                    }}
                                    className="h-full border-0 bg-transparent p-0 text-xs lg:text-sm font-medium placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 min-w-0"
                                    placeholder={searchPlaceholder}
                                />
                                {heroSearch && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 rounded-full p-0 hover:bg-gray-100"
                                        onClick={() => setHeroSearch("")}
                                    >
                                        <X className="h-4 w-4 text-gray-500" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Right Actions */}
                        <div className="flex items-center gap-1.5 md:gap-2 lg:gap-4 ml-auto shrink-0">
                            {/* Veg toggle — food home only (not Quick) */}
                            {!location.pathname.startsWith("/quick") && (
                                <div className="flex items-center gap-1 lg:gap-1.5 px-2 lg:px-3 py-1 lg:py-1.5 rounded-full border border-gray-200 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
                                    onClick={() => setVegMode?.(!vegMode)}>
                                    <span className="text-[9px] lg:text-[10px] font-extrabold text-green-600 tracking-wide">VEG</span>
                                    <button
                                        type="button"
                                        className={`relative inline-flex h-3 w-6 lg:h-4 lg:w-7 items-center rounded-full transition-colors ${vegMode ? 'bg-green-500' : 'bg-[#e5e5e5]'
                                            }`}
                                    >
                                        <span className={`inline-block h-2.5 w-2.5 lg:h-3 lg:w-3 transform rounded-full bg-white transition-transform ${vegMode ? 'translate-x-3 lg:translate-x-3.5' : 'translate-x-0.5'
                                            }`} />
                                    </button>
                                </div>
                              )}

                            {/* Cart */}
                            <Link to="/food/user/cart" className="flex items-center justify-center relative w-8 h-8 lg:w-10 lg:h-10 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors group">
                                <ShoppingCart className="h-3.5 w-3.5 lg:h-5 lg:w-5 text-gray-700 group-hover:text-red-500 transition-colors" strokeWidth={2} />
                                {cartCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 lg:h-4 lg:w-4 items-center justify-center rounded-full bg-red-500 shadow-sm">
                                        <span className="text-[8px] lg:text-[10px] font-bold text-white">
                                            {cartCount > 99 ? "99+" : cartCount}
                                        </span>
                                    </span>
                                )}
                            </Link>

                            {/* Wallet */}
                            <Link to="/food/user/wallet" className="flex items-center justify-center w-8 h-8 lg:w-10 lg:h-10 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors">
                                <Wallet className="h-3.5 w-3.5 lg:h-5 lg:w-5 text-gray-700" strokeWidth={2} />
                            </Link>

                            {/* Notification */}
                            <button className="flex items-center justify-center w-8 h-8 lg:w-10 lg:h-10 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors relative">
                                <Bell className="h-3.5 w-3.5 lg:h-5 lg:w-5 text-gray-700" strokeWidth={2} />
                            </button>

                            {/* Profile */}
                            <Link to={isAuthenticated ? "/food/user/profile" : "/user/auth/login"} className="flex items-center justify-center w-8 h-8 lg:w-10 lg:h-10 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors">
                                <User className="h-3.5 w-3.5 lg:h-5 lg:w-5 text-gray-700" strokeWidth={2} />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    )
}
