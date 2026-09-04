import { useState, useEffect } from "react"
import { Menu, X } from "lucide-react"
import RestaurantSidebar from "./RestaurantSidebar"
import BottomNavOrders from "./BottomNavOrders"
import { cn } from "@food/utils/utils"

export default function RestaurantPageShell({ children, className }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(true)

  // Responsive check
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false)
  }, [children]) // Using children as a proxy for route change, or you can use useLocation

  // Listen for custom event to open sidebar from RestaurantNavbar
  useEffect(() => {
    const handleOpenSidebar = () => setIsMobileOpen(true)
    window.addEventListener("openRestaurantSidebar", handleOpenSidebar)
    return () => window.removeEventListener("openRestaurantSidebar", handleOpenSidebar)
  }, [])

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      {isDesktop && <RestaurantSidebar className="hidden lg:flex" />}

      {/* Mobile Sidebar Backdrop & Sidebar */}
      {!isDesktop && (
        <>
          {/* Backdrop */}
          {isMobileOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
              onClick={() => setIsMobileOpen(false)}
            />
          )}
          
          {/* Mobile Sidebar */}
          <div
            className={cn(
              "fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out",
              isMobileOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <RestaurantSidebar className="flex w-64 shadow-2xl" />
          </div>
        </>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">

        {/* Scrollable Content */}
        <main data-lenis-prevent="true" className="flex-1 overflow-y-auto">
          <div className={cn("container mx-auto p-4 lg:p-8 max-w-[1400px]", className)}>
            {children}
          </div>
        </main>
      </div>
      <BottomNavOrders />
    </div>
  )
}
