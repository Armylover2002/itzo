import { useNavigate, useLocation } from "react-router-dom"
import { Home, ShoppingBag, Store, Wallet, Menu } from "lucide-react"
import useKeyboardInset from "@food/hooks/useKeyboardInset"

export default function BottomNavbar({ onMenuClick }) {
  const navigate = useNavigate()
  const location = useLocation()
  const keyboardInset = useKeyboardInset()

  const isActive = (path) => {
    if (path === "/restaurant") {
      return location.pathname === "/restaurant"
    }
    return location.pathname.startsWith(path)
  }

  if (keyboardInset > 0) {
    return null
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="flex items-center justify-around py-2 px-4">
        <button
          onClick={() => navigate("/restaurant")}
          className={`flex flex-col items-center gap-1 p-2 transition-colors ${
            isActive("/restaurant") ? "text-[#ff8100]" : "text-gray-600"
          }`}
        >
          <Home className="w-6 h-6" />
        </button>
        <button
          onClick={() => navigate("/restaurant/orders/all")}
          className={`flex flex-col items-center gap-1 p-2 transition-colors ${
            isActive("/restaurant/orders/all") ? "text-[#ff8100]" : "text-gray-600"
          }`}
        >
          <ShoppingBag className="w-6 h-6" />
        </button>
        <button
          onClick={() => navigate("/restaurant/outlet-info")}
          className={`flex flex-col items-center gap-1 p-2 -mt-8 transition-colors ${
            isActive("/restaurant/outlet-info") ? "text-[#ff8100]" : "text-gray-600"
          }`}
        >
          <div
            className={`rounded-full p-3 shadow-lg border-2 transition-colors ${
              isActive("/restaurant/outlet-info")
                ? "bg-[#ff8100] border-white"
                : "bg-white border-gray-200"
            }`}
          >
            <Store
              className={`w-6 h-6 ${
                isActive("/restaurant/outlet-info") ? "text-white" : "text-gray-600"
              }`}
            />
          </div>
        </button>
        <button
          onClick={() => navigate("/restaurant/hub-finance")}
          className={`flex flex-col items-center gap-1 p-2 transition-colors ${
            isActive("/restaurant/hub-finance") ? "text-[#ff8100]" : "text-gray-600"
          }`}
        >
          <Wallet className="w-6 h-6" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            // Always call onMenuClick if provided, never navigate
            if (onMenuClick && typeof onMenuClick === 'function') {
              onMenuClick(e)
              return
            }
            // Fallback: only navigate if onMenuClick is not provided
            navigate("/restaurant/explore")
          }}
          className={`flex flex-col items-center gap-1 p-2 transition-colors ${
            isActive("/restaurant/explore") ? "text-[#ff8100]" : "text-gray-600"
          }`}
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>
    </div>
  )
}

