import React, { useState, useEffect, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/core/context/AuthContext";
import { useSettings } from "@/core/context/SettingsContext";
import { cn } from "@/lib/utils";
import { HiChevronDown } from "react-icons/hi2";
import { 
  loadBusinessSettings, 
  getCachedSettings,
  getAppLogo,
  getAppFavicon,
  getCompanyName,
  updateBrowserFavicon
} from "@/modules/common/utils/businessSettings";
import { motion, AnimatePresence } from "framer-motion";
import { X, LogOut, PanelLeftClose, PanelLeftOpen, ChevronLeft, ChevronRight } from "lucide-react";
import AdminModuleSwitcher from "@/shared/components/AdminModuleSwitcher";
import { sellerApi } from "@/modules/seller/services/sellerApi";

const colorMap = {
  indigo:
    "text-primary bg-[#fef4f4] border-[#fde8ea] group-hover:bg-[#fde8ea]/50",
  rose: "text-rose-600 bg-rose-50 border-rose-100 group-hover:bg-rose-100/50",
  amber:
    "text-amber-600 bg-amber-50 border-amber-100 group-hover:bg-amber-100/50",
  blue: "text-primary bg-[#fef4f4] border-[#fde8ea] group-hover:bg-[#fde8ea]/50",
  emerald:
    "text-emerald-600 bg-emerald-50 border-emerald-100 group-hover:bg-emerald-100/50",
  violet:
    "text-primary bg-[#fef4f4] border-[#fde8ea] group-hover:bg-[#fde8ea]/50",
  cyan: "text-primary bg-[#fef4f4] border-[#fde8ea] group-hover:bg-[#fde8ea]/50",
  orange:
    "text-[#c41922] bg-[#fef4f4] border-[#fde8ea] group-hover:bg-[#fde8ea]/50",
  green:
    "text-green-600 bg-green-50 border-green-100 group-hover:bg-green-100/50",
  sky: "text-primary bg-[#fef4f4] border-[#fde8ea] group-hover:bg-[#fde8ea]/50",
  pink: "text-pink-600 bg-pink-50 border-pink-100 group-hover:bg-pink-100/50",
  fuchsia:
    "text-fuchsia-600 bg-fuchsia-50 border-fuchsia-100 group-hover:bg-fuchsia-100/50",
  red: "text-red-600 bg-red-50 border-red-100 group-hover:bg-red-100/50",
  slate:
    "text-slate-600 bg-slate-50 border-slate-100 group-hover:bg-slate-100/50",
  dark: "text-gray-800 bg-gray-100 border-gray-200 group-hover:bg-gray-200/50",
};

const SidebarItem = ({
  item,
  isOpen,
  onToggle,
  isHovered,
  onMouseEnter,
  onMouseLeave,
}) => {
  const location = useLocation();
  const isSellerPanel = location.pathname.startsWith("/seller");

  const hasChildren = item.children && item.children.length > 0;
  const isChildActive =
    hasChildren &&
    item.children.some((child) => location.pathname === child.path);

  if (hasChildren) {
    return (
      <div className="space-y-1">
        <button
          onClick={onToggle}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className={cn(
            "w-full flex items-center justify-between rounded-xl px-3 py-2.5 transition-all duration-300 group relative overflow-hidden",
            isChildActive || isOpen
              ? isSellerPanel
                ? "bg-[#F3ECE0] text-slate-900 shadow-xs ring-1 ring-[#E8DEC8] font-bold"
                : "bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)] ring-1 ring-white/10"
              : isSellerPanel
                ? "text-slate-700 hover:text-slate-950"
                : "text-gray-400 hover:text-white",
          )}>
          <AnimatePresence>
            {isHovered && (
              <motion.div
                layoutId="hover-highlight"
                className={cn(
                  "absolute inset-0 rounded-xl -z-10",
                  isSellerPanel ? "bg-[#F5EFE4]" : "bg-white/5"
                )}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
              />
            )}
          </AnimatePresence>

          <div className="flex items-center space-x-2.5 z-10">
            <div
              className={cn(
                "p-1.5 rounded-lg transition-all duration-500 shadow-sm",
                isChildActive || isOpen
                  ? "bg-[#E71D28] text-white shadow-[#E71D28]/30 ring-2 ring-[#E71D28]/20"
                  : isSellerPanel
                    ? "bg-[#EFE7D8] text-slate-700 group-hover:bg-[#E6DCC8] group-hover:text-slate-900"
                    : "bg-white/5 text-gray-500 group-hover:bg-white/10 group-hover:text-gray-300",
              )}>
              {item.icon && <item.icon className="h-4 w-4" />}
            </div>
            <span
              className={cn(
                "text-xs tracking-tight transition-all duration-300",
                isChildActive || isOpen ? "font-bold" : "font-semibold",
              )}>
              {item.label}
            </span>
          </div>
          <div
            className={cn(
              "transition-all duration-300 z-10",
              isOpen
                ? "rotate-180 text-[#E71D28]"
                : isSellerPanel
                  ? "rotate-0 text-slate-500 group-hover:text-slate-800"
                  : "rotate-0 text-gray-600 group-hover:text-gray-400",
            )}>
            <HiChevronDown className="h-4 w-4" />
          </div>
        </button>
        {isOpen && (
          <div className={cn(
            "pl-9 pr-3 py-1 space-y-1 animate-in slide-in-from-top-2 fade-in duration-500 rounded-xl",
            isSellerPanel && "bg-[#FAF5EC]/90 border border-[#EAE2D0]"
          )}>
            {item.children.map((child) => (
              <NavLink
                key={child.path}
                to={child.path}
                end={child.end !== undefined ? child.end : false}
                className={({ isActive }) =>
                  cn(
                    "block text-xs py-1.5 px-2.5 rounded-lg transition-all duration-300 relative",
                    isActive
                      ? isSellerPanel
                        ? "text-[#E71D28] font-bold bg-[#F3E8DC] shadow-xs"
                        : "text-white font-bold bg-white/10 shadow-sm ring-1 ring-white/5"
                      : isSellerPanel
                        ? "text-slate-600 hover:text-slate-900 hover:bg-[#F3ECE0]"
                        : "text-gray-500 hover:text-gray-300 hover:bg-white/5",
                  )
                }>
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-full bg-[#E71D28] shadow-[0_0_10px_rgba(231,29,40,0.5)]" />
                    )}
                    {child.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={item.path}
      end={item.end !== undefined ? item.end : false}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={({ isActive }) =>
        cn(
          "flex items-center space-x-2.5 rounded-xl px-3 py-2.5 transition-all duration-300 group relative overflow-hidden",
          isActive
            ? "bg-[#E71D28] text-white shadow-[0_6px_20px_rgba(231,29,40,0.25)] font-bold"
            : isSellerPanel
              ? "text-slate-700 hover:text-slate-950 font-semibold"
              : "text-gray-400 hover:text-white font-semibold",
        )
      }>
      {({ isActive }) => (
        <>
          <AnimatePresence>
            {isHovered && !isActive && (
              <motion.div
                layoutId="hover-highlight"
                className={cn(
                  "absolute inset-0 rounded-xl -z-10",
                  isSellerPanel ? "bg-[#F5EFE4]" : "bg-white/5"
                )}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
              />
            )}
          </AnimatePresence>

          <div
            className={cn(
              "p-1.5 rounded-lg transition-all duration-500 z-10",
              isActive
                ? "bg-white/20 text-white shadow-xs"
                : isSellerPanel
                  ? "bg-[#EFE7D8] text-slate-700 group-hover:bg-[#E6DCC8] group-hover:text-slate-900"
                  : "bg-white/5 text-gray-500 group-hover:bg-white/10 group-hover:text-gray-300",
            )}>
            {item.icon && <item.icon className="h-4 w-4" />}
          </div>
          <span
            className={cn(
              "text-xs tracking-tight transition-all duration-300 z-10 flex-1 text-left truncate",
              isActive ? "font-bold" : "font-semibold",
            )}>
            {item.label}
          </span>
          {item.badge != null && Number(item.badge) > 0 && (
            <span
              className={cn(
                "text-[10px] font-black px-1.5 py-0.5 rounded-full z-10 shadow-sm leading-none shrink-0",
                isActive ? "bg-white text-[#E71D28]" : "bg-[#E71D28] text-white",
              )}>
              {item.badge}
            </span>
          )}
          {isActive && (
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/40 rounded-l-full animate-in slide-in-from-right-1" />
          )}
        </>
      )}
    </NavLink>
  );
};

const SidebarContent = ({ items, title, onClose, onToggleCollapse, isCollapsed, openMenu, handleToggle, hoveredIdx, setHoveredIdx }) => {
  const { logout } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();
  const isAdminPanel = location.pathname.startsWith("/ecs");
  const isSellerPanel = location.pathname.startsWith("/seller");
  const appType = isAdminPanel ? 'admin' : (isSellerPanel ? 'seller' : 'user');

  const [logoUrl, setLogoUrl] = useState(() => getAppLogo(appType));
  const [companyName, setCompanyName] = useState(() => getCompanyName());

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const cached = getCachedSettings();
        if (cached) {
          setLogoUrl(getAppLogo(appType));
          setCompanyName(getCompanyName());
          const appFav = getAppFavicon(appType);
          if (appFav) updateBrowserFavicon(appFav);
        } else {
          const fresh = await loadBusinessSettings();
          if (fresh) {
            setLogoUrl(getAppLogo(appType));
            setCompanyName(getCompanyName());
            const appFav = getAppFavicon(appType);
            if (appFav) updateBrowserFavicon(appFav);
          }
        }
      } catch (err) {
        console.error("Error loading sidebar settings:", err);
      }
    };
    loadSettings();

    const handleUpdate = (e) => {
      const settings = e.detail;
      setLogoUrl(getAppLogo(appType));
      if (settings?.companyName) setCompanyName(settings.companyName);
      const appFav = getAppFavicon(appType);
      if (appFav) updateBrowserFavicon(appFav);
    };

    window.addEventListener('businessSettingsUpdated', handleUpdate);
    return () => window.removeEventListener('businessSettingsUpdated', handleUpdate);
  }, [appType]);

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!isSellerPanel) return;
    let isMounted = true;
    const fetchUnread = async () => {
      try {
        const res = await sellerApi.getNotifications();
        if (isMounted && res?.data?.success) {
          setUnreadCount(Number(res.data.result.unreadCount) || 0);
        }
      } catch (e) {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    const onUpdate = () => fetchUnread();
    window.addEventListener('sellerNotificationsUpdated', onUpdate);
    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('sellerNotificationsUpdated', onUpdate);
    };
  }, [isSellerPanel]);

  const enhancedItems = useMemo(() => {
    return items.map((it) => {
      if (it.path?.includes('notifications')) {
        return { ...it, badge: unreadCount > 0 ? unreadCount : null };
      }
      return it;
    });
  }, [items, unreadCount]);

  const displayLogoUrl = logoUrl;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={cn(
        "flex-shrink-0 flex h-16 items-center justify-between px-4 sm:px-5 border-b z-10",
        isSellerPanel
          ? "border-[#EAE3D2] bg-gradient-to-b from-[#F7F3EB]/90 to-transparent"
          : "border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent"
      )}>
        <div className="flex items-center space-x-2.5 min-w-0">
          {displayLogoUrl ? (
            <img 
              src={displayLogoUrl} 
              alt={companyName} 
              className="h-9 md:h-11 w-auto object-contain shrink-0" 
              onError={(e) => { e.target.src = '/itzo-logo-transparent.png'; }}
            />
          ) : (
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30 transform -rotate-6 hover:rotate-0 transition-all duration-500 ease-out shrink-0">
              <span className="text-lg font-black italic">{companyName?.charAt(0) || 'Z'}</span>
            </div>
          )}
          {!isCollapsed && (
            <div className="truncate">
              <h1 className={cn(
                "text-base font-black tracking-tight leading-none truncate",
                isSellerPanel ? "text-slate-900" : "text-white"
              )}>
                {companyName || 'App'}
              </h1>
              <span className="text-[9px] font-black text-[#E71D28] uppercase tracking-[0.2em] mt-1 block truncate">
                {title}
              </span>
            </div>
          )}
        </div>

        {/* Sidebar Open/Close Toggle Button */}
        <button
          onClick={onToggleCollapse || onClose}
          className={cn(
            "p-1.5 rounded-lg transition-all duration-200 border-0 bg-transparent hover:bg-slate-200/60 text-slate-700 hover:text-slate-950 flex items-center justify-center cursor-pointer shrink-0 ml-1"
          )}
          title={isCollapsed ? "Open Sidebar" : "Close Sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5 stroke-[2.5] text-[#E71D28] hover:scale-110 transition-transform" />
          ) : (
            <ChevronLeft className="h-5 w-5 stroke-[2.5] hover:scale-110 transition-transform" />
          )}
        </button>
      </div>

      <nav
        data-lenis-prevent
        onMouseLeave={() => setHoveredIdx(null)}
        className={cn(
          "mt-4 px-3 space-y-1.5 flex-1 overflow-y-auto overscroll-contain min-h-0 pb-6 relative z-20",
          isSellerPanel ? "custom-scrollbar" : "custom-scrollbar-dark"
        )}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {isAdminPanel && (
          <div className="mb-4 px-1">
            <p className="px-3 text-[9px] font-black text-gray-600 uppercase tracking-[0.3em] mb-2">
              Module
            </p>
            <AdminModuleSwitcher className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/5 p-1 shadow-none [&>button]:justify-center [&>button]:px-2 [&>button]:py-2 [&>button]:text-[10px] [&>button]:tracking-[0.18em]" />
          </div>
        )}
        <p className={cn(
          "px-3 text-[9px] font-black uppercase tracking-[0.3em] mb-3",
          isSellerPanel ? "text-slate-500/80" : "text-gray-600"
        )}>
          Core Management
        </p>
        <AnimatePresence>
          {enhancedItems.map((item, idx) => (
            <SidebarItem
              key={idx}
              item={item}
              isOpen={openMenu === item.label}
              onToggle={() => handleToggle(item.label)}
              isHovered={hoveredIdx === idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseEnterWithClose={() => {
                setHoveredIdx(idx);
              }}
              onMouseLeave={() => { }} // Handle in nav container
            />
          ))}
        </AnimatePresence>
      </nav>

      {/* Sidebar Footer with Sign Out */}
      <div className={cn(
        "flex-shrink-0 p-3 border-t backdrop-blur-md z-20",
        isSellerPanel
          ? "border-[#EAE3D2] bg-[#F8F4EC]/90"
          : "border-white/5 bg-[#0a0c10]/95"
      )}>
        <button
          onClick={() => {
            onClose?.();
            logout();
          }}
          className={cn(
            "w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 group text-xs font-bold shadow-xs",
            isSellerPanel
              ? "text-rose-700 hover:text-rose-800 bg-rose-100/60 hover:bg-rose-100/90 active:bg-rose-200/90 border border-rose-200/80"
              : "text-rose-400 hover:text-white hover:bg-rose-500/15 active:bg-rose-500/25 border border-rose-500/20 hover:border-rose-500/40"
          )}
        >
          <div className={cn(
            "p-1.5 rounded-lg transition-all duration-200",
            isSellerPanel
              ? "bg-rose-200/60 text-rose-700 group-hover:bg-rose-600 group-hover:text-white"
              : "bg-rose-500/10 text-rose-400 group-hover:bg-rose-600 group-hover:text-white"
          )}>
            <LogOut className="h-4 w-4" />
          </div>
          <span className="flex-1 text-left font-semibold">Sign Out</span>
        </button>
      </div>
    </div>
  );
};

const Sidebar = ({ items, title, isOpen, isCollapsed, onClose, onToggleCollapse }) => {
  const { role } = useAuth();
  const location = useLocation();
  const isSellerPanel = location.pathname.startsWith("/seller");
  const [openMenu, setOpenMenu] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const handleToggle = (label) => {
    setOpenMenu((prev) => (prev === label ? null : label));
  };

  const commonProps = {
    items,
    title,
    onClose,
    onToggleCollapse,
    isCollapsed,
    openMenu,
    handleToggle,
    hoveredIdx,
    setHoveredIdx
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={cn(
        "fixed left-0 inset-y-0 z-50 transition-all duration-300 md:flex flex-col",
        isCollapsed ? "w-20 overflow-hidden" : "w-64",
        isSellerPanel
          ? "bg-[#FAF8F5] text-slate-700 border-r border-[#EAE3D2] shadow-[10px_0_40px_rgba(0,0,0,0.04)]"
          : "bg-[#0a0c10] text-gray-400 border-r border-white/5 shadow-[20px_0_60px_rgba(0,0,0,0.4)]",
        (role === "admin" || role === "seller") ? (isCollapsed ? "flex" : "hidden md:flex") : "flex",
      )}>
        <SidebarContent {...commonProps} />
      </aside>

      {/* Mobile Sidebar (Drawer) */}
      <AnimatePresence mode="wait">
        {isOpen && (
          <div className="fixed inset-0 z-[100] md:hidden">
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
            />

            {/* Outer Container (Fixed Shell - NO TRANSFORM) */}
            <div className="absolute left-0 inset-y-0 w-64 flex flex-col pointer-events-none">
              {/* Inner Animation Wrapper (TRANSFORM APPLIED HERE) */}
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
                className={cn(
                  "flex-1 shadow-2xl flex flex-col pointer-events-auto min-h-0",
                  isSellerPanel ? "bg-[#FAF8F5] border-r border-[#EAE3D2]" : "bg-[#0a0c10]"
                )}
              >
                <SidebarContent {...commonProps} />
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
