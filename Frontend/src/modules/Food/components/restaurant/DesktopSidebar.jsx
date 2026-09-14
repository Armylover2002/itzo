import React, { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Store,
  FileText,
  History,
  Book,
  LayoutGrid,
  Truck,
  Receipt,
  MessageSquare,
  Clock,
  Map,
  Bell,
  LifeBuoy,
  ShieldCheck,
  LogOut,
  Gift,
  Star,
  Edit,
  Building2,
  FileCheck,
  IndianRupee,
  Info,
  Compass,
  Timer,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Wallet,
  UtensilsCrossed,
  CalendarCheck,
} from "lucide-react";
import { restaurantAPI } from "@food/api";
import { getAppLogo, getCompanyName } from "@common/utils/businessSettings";
import useNotificationInbox from "@food/hooks/useNotificationInbox";
import { clearModuleAuth } from "@food/utils/auth";
import RestaurantProfile from "@food/pages/restaurant/RestaurantProfile";

const extractRestaurantPayload = (response) =>
  response?.data?.data?.restaurant ||
  response?.data?.restaurant ||
  response?.data?.data?.user ||
  response?.data?.user ||
  response?.data?.data ||
  null;

export default function DesktopSidebar({ isCollapsed, onToggle }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [restaurantData, setRestaurantData] = useState(null);
  const [companyName, setCompanyName] = useState(() => getCompanyName() || "rj kitchen");
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo("restaurant"));
  const [profileOpen, setProfileOpen] = useState(false);
  const { unreadCount } = useNotificationInbox("restaurant", { limit: 20, pollMs: 5 * 60 * 1000 });

  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        const response = await restaurantAPI.getCurrentRestaurant();
        const data = extractRestaurantPayload(response);
        if (data) {
          setRestaurantData(data);
        }
      } catch (error) {
        // Silently handle
      }
    };
    fetchRestaurantData();
  }, []);

  const restaurantName = restaurantData?.name || companyName || "rj kitchen";
  const ownerName = restaurantData?.ownerName || restaurantData?.name || "Owner";
  const ownerImage = restaurantData?.profileImage?.url || restaurantData?.ownerImage?.url || "";

  const sections = [
    {
      title: "OPERATIONS",
      items: [
        { name: "Live orders", path: "/food/restaurant", icon: FileText, exact: true },
        { name: "Order history", path: "/food/restaurant/orders/all", icon: History },
        { name: "Complaints", path: "/food/restaurant/feedback?tab=complaints", icon: Star },
        { name: "Reviews", path: "/food/restaurant/feedback", icon: MessageSquare },
      ],
    },
    {
      title: "MENU",
      items: [
        { name: "Menu inventory", path: "/food/restaurant/inventory", icon: Book },
        { name: "Menu categories", path: "/food/restaurant/menu-categories", icon: LayoutGrid },
        { name: "Item slot timings", path: "/food/restaurant/item-slot-timings", icon: Timer },
        { name: "Create coupons", path: "/food/restaurant/create-coupons", icon: Gift },
      ],
    },
    {
      title: "MANAGE OUTLET",
      items: [
        { name: "Outlet info", path: "/food/restaurant/outlet-info", icon: Info },
        { name: "Outlet timings", path: "/food/restaurant/outlet-timings", icon: Clock },
        ...(restaurantData?.businessType === "Street Food Vendor"
          ? [{ name: "Live Location Control", path: "/food/restaurant/live-location", icon: Map }]
          : []),
      ],
    },
    {
      title: "SETTINGS",
      items: [
        { name: "Delivery settings", path: "/food/restaurant/delivery-settings", icon: Truck },
        { name: "Zone setup", path: "/food/restaurant/zone-setup", icon: Map },
        { name: "Refer & earn", path: "/food/restaurant/refer-earn", icon: Gift },
      ],
    },
    {
      title: "FINANCE",
      items: [
        { name: "Payout", path: "/food/restaurant/hub-finance", icon: IndianRupee },
        { name: "Invoices", path: "/food/restaurant/hub-finance?tab=invoices", icon: Receipt },
        { name: "Bank details", path: "/food/restaurant/update-bank-details", icon: Building2 },
        { name: "Subscription Wallet", path: "/food/restaurant/wallet", icon: Wallet },
      ],
    },
    {
      title: "SUBSCRIPTION",
      items: [
        { name: "Business Plan", path: "/food/restaurant/business-plan", icon: CreditCard },
      ],
    },
    {
      title: "DINING",
      items: [
        { name: "Dining Setup", path: "/food/restaurant/dining/setup", icon: UtensilsCrossed },
        { name: "Bookings & Billing", path: "/food/restaurant/dining/bookings", icon: CalendarCheck },
      ],
    },
    {
      title: "HELP",
      items: [
        { name: "Support", path: "/food/restaurant/help-centre/support", icon: LifeBuoy },
        { name: "Share feedback", path: "/food/restaurant/share-feedback", icon: Edit },
        { name: "Explore more", path: "/food/restaurant/explore", icon: Compass },
      ],
    },
    {
      title: "ACCOUNT",
      items: [
        { name: "Notifications", path: "/food/restaurant/notifications", icon: Bell, badge: unreadCount },
        { name: "FSSAI", path: "/food/restaurant/fssai", icon: ShieldCheck },
      ],
    },
  ];

  const onLogout = async () => {
    try {
      clearModuleAuth("restaurant");
      navigate("/food/restaurant/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <aside className={`hidden md:flex flex-col h-screen fixed left-0 top-0 bg-white border-r border-gray-100 shadow-[2px_0_10px_rgba(0,0,0,0.02)] z-50 transition-all duration-300 ${isCollapsed ? "w-20" : "w-64"}`}>
      {/* Header */}
      <div className={`p-5 flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0 relative group">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain rounded-xl p-1" />
            ) : (
              <Store className="w-5 h-5 text-green-600" />
            )}
            {isCollapsed && (
              <button
                onClick={onToggle}
                className="absolute -right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-white rounded-full p-1 border border-gray-200 shadow-sm z-10 transition-opacity"
              >
                <ChevronRight className="w-3 h-3 text-gray-600" />
              </button>
            )}
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-gray-900 text-sm truncate">{restaurantName}</span>
              <span className="text-xs text-gray-500 truncate">Restaurant panel</span>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => window.location.reload()}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors shrink-0"
              aria-label="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={onToggle}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors shrink-0"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 space-y-6 custom-scrollbar overscroll-none">
        {sections.map((section, idx) => (
          <div key={idx} className={isCollapsed ? "flex flex-col items-center" : ""}>
            {!isCollapsed ? (
              <h3 className="text-[11px] font-bold text-gray-400 mb-2 uppercase tracking-wider px-2">
                {section.title}
              </h3>
            ) : (
              <div className="h-4" /> // spacing when collapsed
            )}
            <ul className="space-y-1 w-full">
              {section.items.map((item, itemIdx) => {
                const itemPath = String(item.path || "").split("?")[0]
                const isActive = item.exact
                  ? location.pathname === itemPath || location.pathname === `${itemPath}/`
                  : location.pathname === itemPath || location.pathname.startsWith(`${itemPath}/`)
                  
                return (
                  <li key={itemIdx}>
                    <NavLink
                      to={item.path}
                      title={isCollapsed ? item.name : undefined}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 ${
                        isActive
                          ? "bg-green-50 text-green-700"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      } ${isCollapsed ? "justify-center" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className={`w-5 h-5 ${isActive ? "text-green-600" : "text-gray-400"}`} />
                        {!isCollapsed && (
                          <span className={`text-sm ${isActive ? "font-semibold" : "font-medium"}`}>
                            {item.name}
                          </span>
                        )}
                      </div>
                      {!isCollapsed && item.badge > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer Profile */}
      <div className="p-4 bg-white border-t border-gray-100">
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl bg-gray-50 p-2 mb-3 text-left transition-colors hover:bg-gray-100"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-green-600 text-sm font-bold text-white">
            {ownerImage ? (
              <img src={ownerImage} alt={ownerName} className="h-full w-full object-cover" />
            ) : (
              ownerName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex flex-col">
            <span className="truncate text-sm font-semibold text-gray-900">{ownerName}</span>
            <span className="truncate text-xs text-gray-500">My profile</span>
          </div>
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>

      <RestaurantProfile isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </aside>
  );
}
