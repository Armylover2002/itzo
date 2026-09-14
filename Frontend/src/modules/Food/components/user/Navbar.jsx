import { Link } from "react-router-dom"
import { MapPin, ShoppingCart, Trophy } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Avatar, AvatarFallback } from "@food/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@food/components/ui/dropdown-menu"
import { useLocation } from "@food/hooks/useLocation"
import { useCart } from "@food/context/CartContext"
import { useLocationSelector } from "./UserLayout"
import { useAppBranding } from "@common/hooks/useBusinessSettingsCache"


export default function Navbar() {
  const { location, loading } = useLocation()
  const { getCartCount } = useCart()
  const { openLocationSelector } = useLocationSelector()
  const cartCount = getCartCount()
  const { logoUrl, companyName } = useAppBranding("user")

  // Show area if available, otherwise show city
  const areaName = location?.area && location?.area !== location?.city ? location.area : null
  const cityName = areaName || location?.city || "Select"
  const stateName = location?.state || "Location"

  const handleLocationClick = () => {
    // Open location selector overlay
    openLocationSelector()
  }

  // Mock points value - replace with actual points from context/store
  const userPoints = 99

  return (
    <nav className="z-50 w-full backdrop-blur-md bg-gradient-to-b from-page-bg/80 via-page-bg/50 to-page-bg/20 border-b border-gray-200/50">
      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex h-16 sm:h-18 md:h-20 items-center justify-between gap-2 sm:gap-3 md:gap-4">
          {/* Location Section */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {/* Location - 2 Row Layout */}
            <Button
              variant="ghost"
              onClick={handleLocationClick}
              disabled={loading}
            >
              {loading ? (
                <span className="text-xs sm:text-sm font-semibold text-left text-black">
                  Loading...
                </span>
              ) : (
                <div className="flex flex-col items-start w-full min-w-0">
                  <span className="text-xs sm:text-sm flex flex-row items-center gap-1 font-semibold text-left text-foreground truncate w-full">
                    <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-black flex-shrink-0" />
                    {cityName}
                  </span>
                  {location?.state && (
                    <span className="text-[10px] sm:text-xs text-black pt-1 text-left truncate w-full">
                      {stateName}
                    </span>
                  )}
                </div>
              )}
            </Button>
          </div>

          {/* Company Logo or Name - Centered between sections */}
          <Link to="/food/user" className="flex items-center justify-center flex-shrink-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={companyName || "Logo"}
                className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 object-contain"
                onError={(e) => {
                  e.target.style.display = 'none'
                }}
              />
            ) : (
              <span className="text-sm sm:text-base md:text-lg font-bold text-gray-900">
                {companyName || "Appzeto"}
              </span>
            )}
          </Link>

          {/* Right Side Actions - Profile, Points, Cart */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Points */}
            <Button
              variant="ghost"


              size="icon"
              className="relative h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 hover:bg-gray-100"
              title={`${userPoints} Points`}
            >
              <Trophy className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-primary-orange dark:text-red-400" />
              <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-primary-orange text-white text-[10px] sm:text-xs flex items-center justify-center font-semibold">
                {userPoints > 999 ? "999+" : userPoints}
              </span>
            </Button>

            {/* Cart */}
            <Link to="/food/cart">
              <Button variant="ghost" size="icon" className="relative h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 hover:bg-gray-100">
                <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-gray-300" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-primary-orange text-white text-[10px] sm:text-xs flex items-center justify-center font-semibold">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </Button>
            </Link>

            {/* Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 hover:bg-gray-100">
                  <Avatar className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9">
                    <AvatarFallback className="bg-primary-orange text-white text-xs sm:text-sm md:text-base">
                      A
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <Link to="/food/user/cart">
                  <DropdownMenuItem>YOUR CART</DropdownMenuItem>
                </Link>
                <Link to="/food/user/profile">
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                </Link>
                <Link to="/food/user/orders">
                  <DropdownMenuItem>My Orders</DropdownMenuItem>
                </Link>
                <Link to="/food/user/offers">
                  <DropdownMenuItem>Offers</DropdownMenuItem>
                </Link>
                <Link to="/food/user/profile/support">
                  <DropdownMenuItem>Help</DropdownMenuItem>
                </Link>
                <Link to="/user/auth/login">
                  <DropdownMenuItem>Sign Out</DropdownMenuItem>
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  )
}

