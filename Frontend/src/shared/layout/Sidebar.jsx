import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/core/context/AuthContext";
import { cn } from "@/lib/utils";
import { HiChevronDown, HiOutlineBars3, HiOutlineArrowRightOnRectangle } from "react-icons/hi2";
import {
  getAppLogo,
  getAppFavicon,
  getCompanyName,
  updateBrowserFavicon,
  subscribeBusinessSettings,
} from "@/modules/common/utils/businessSettings";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import AdminModuleSwitcher from "@/shared/components/AdminModuleSwitcher";

const SidebarItem = ({
  item,
  isOpen,
  onToggle,
  onMouseEnter,
  onMouseLeave,
  collapsed,
}) => {
  const location = useLocation();

  const hasChildren = item.children && item.children.length > 0;
  const isChildActive =
    hasChildren &&
    item.children.some((child) => location.pathname === child.path);

  const isSellerPanel = location.pathname.startsWith("/seller");
  const isAdminPanel = location.pathname.startsWith("/ecs");
  const isLightSidebar = isSellerPanel || isAdminPanel;

  if (hasChildren) {
    return (
      <div className="space-y-1">
        <button
          onClick={onToggle}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          title={collapsed ? item.label : undefined}
          className={cn(
            "w-full flex items-center rounded-lg py-2 transition-all duration-200 group relative overflow-hidden",
            collapsed ? "justify-center px-1.5" : "justify-between px-3",
            isChildActive || isOpen
              ? (isLightSidebar
                    ? "bg-slate-100/80 text-[#1c1c1e] font-semibold"
                    : "bg-white/10 text-white font-semibold")
              : (isLightSidebar ? "text-slate-700 hover:text-[#1c1c1e] hover:bg-slate-50" : "text-gray-400 hover:text-white"),
          )}>
          <div className={cn("flex items-center z-10", collapsed ? "" : "space-x-2.5")}>
            <div
              className={cn(
                "p-1.5 rounded-lg transition-all duration-200 shadow-xs",
                isChildActive || isOpen
                  ? (isSellerPanel ? "bg-red-600 text-white" : "bg-primary text-white")
                  : (isLightSidebar
                        ? "bg-slate-100 text-slate-500 group-hover:bg-slate-200/70 group-hover:text-slate-900"
                        : "bg-white/5 text-gray-400 group-hover:bg-white/10 group-hover:text-white"),
              )}>
              {item.icon && <item.icon className="h-4 w-4" />}
            </div>
            {!collapsed && (
              <span className="text-xs font-semibold tracking-tight">
                {item.label}
              </span>
            )}
          </div>
          {!collapsed && (
            <div
              className={cn(
                "transition-transform duration-200 z-10",
                isOpen
                  ? "rotate-180 text-red-500"
                  : (isLightSidebar ? "rotate-0 text-slate-400 group-hover:text-slate-600" : "rotate-0 text-gray-500 group-hover:text-gray-300"),
              )}>
              <HiChevronDown className="h-4 w-4" />
            </div>
          )}
        </button>
        {isOpen && !collapsed && (
          <div className="pl-9 pr-3 py-1 space-y-1">
            {item.children.map((child) => (
              <NavLink
                key={child.path}
                to={child.path}
                end={child.end !== undefined ? child.end : false}
                className={({ isActive }) =>
                  cn(
                    "block text-xs py-1.5 px-2.5 rounded-lg transition-all duration-200 relative",
                    isActive
                      ? (isSellerPanel
                          ? "text-red-600 font-semibold bg-red-50"
                          : isLightSidebar
                            ? "text-primary font-semibold bg-slate-100"
                            : "text-white font-semibold bg-white/10")
                      : (isLightSidebar ? "text-slate-600 hover:text-slate-900 hover:bg-slate-50" : "text-gray-400 hover:text-white hover:bg-white/5"),
                  )
                }>
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className={cn("absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-full", isSellerPanel ? "bg-red-600" : "bg-primary")} />
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
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          "flex items-center rounded-lg py-2 transition-all duration-200 group relative overflow-hidden",
          collapsed ? "justify-center px-1.5" : "space-x-2.5 px-3",
          isActive
            ? (isSellerPanel
                ? cn("bg-red-50/90 text-red-600 font-semibold", !collapsed && "border-r-2 border-red-600")
                : "bg-primary text-white shadow-xs")
            : (isLightSidebar ? "text-slate-700 hover:text-[#1c1c1e] hover:bg-slate-50/80" : "text-gray-400 hover:text-white"),
        )
      }>
      {({ isActive }) => (
        <>
          <div
            className={cn(
              "p-1.5 rounded-lg transition-all duration-200 shrink-0 z-10",
              isActive
                ? (isSellerPanel ? "bg-red-600 text-white shadow-xs" : "bg-white/20 text-white")
                : (isLightSidebar
                      ? "bg-slate-100 text-slate-500 group-hover:bg-slate-200/70 group-hover:text-slate-900"
                      : "bg-white/5 text-gray-400 group-hover:bg-white/10 group-hover:text-white"),
            )}>
            {item.icon && <item.icon className="h-4 w-4" />}
          </div>
          {!collapsed && (
            <span className="text-xs font-semibold tracking-tight z-10">
              {item.label}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
};

const SidebarContent = ({
  items,
  title,
  onClose,
  openMenu,
  handleToggle,
  hoveredIdx,
  setHoveredIdx,
  collapsed,
  onToggleCollapse,
}) => {
  const { logout } = useAuth();
  const location = useLocation();
  const isAdminPanel = location.pathname.startsWith("/ecs");
  const isSellerPanel = location.pathname.startsWith("/seller");
  const isLightSidebar = isSellerPanel || isAdminPanel;
  const appType = isAdminPanel ? 'admin' : (isSellerPanel ? 'seller' : 'user');

  const [logoUrl, setLogoUrl] = useState(() => getAppLogo(appType));
  const [companyName, setCompanyName] = useState(() => getCompanyName());

  useEffect(() => {
    const apply = () => {
      setLogoUrl(getAppLogo(appType));
      setCompanyName(getCompanyName());
      const appFav = getAppFavicon(appType);
      if (appFav) updateBrowserFavicon(appFav);
    };
    apply();
    return subscribeBusinessSettings(apply);
  }, [appType]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      <div className={cn(
        "flex-shrink-0 flex h-16 items-center border-b z-10",
        collapsed ? "justify-center px-1.5" : "justify-between px-4",
        isLightSidebar ? "border-slate-200/80 bg-white" : "border-white/5 bg-slate-900"
      )}>
        {!collapsed && (
          <div className="flex flex-col justify-center min-w-0">
            <div className="flex items-center space-x-2">
              {logoUrl ? (
                <img src={logoUrl} alt={companyName} className="h-8 w-auto object-contain" />
              ) : (
                <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center text-white font-bold shadow-xs", isSellerPanel ? "bg-red-600" : "bg-primary")}>
                  <span className="text-sm italic">{companyName?.charAt(0) || 'B'}</span>
                </div>
              )}
              {!logoUrl && (
                <h1 className={cn("text-base font-semibold tracking-tight leading-none", isLightSidebar ? "text-[#1c1c1e]" : "text-white")}>
                  {companyName || 'ItzoFood'}
                </h1>
              )}
            </div>
            <span className={cn(
              "text-[10px] font-semibold uppercase tracking-wider mt-1 inline-block w-fit px-2 py-0.5 rounded-md",
              isLightSidebar ? "bg-[#1c1c1e] text-white" : "bg-primary text-white"
            )}>
              {title}
            </span>
          </div>
        )}

        <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
          {/* Desktop collapse / expand hamburger */}
          {typeof onToggleCollapse === "function" && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "hidden md:inline-flex p-1.5 rounded-lg transition-colors",
                isLightSidebar
                  ? "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  : "text-gray-400 hover:text-white hover:bg-white/10"
              )}
            >
              <HiOutlineBars3 className="h-5 w-5" />
            </button>
          )}

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={onClose}
            className={cn("p-1.5 rounded-lg md:hidden transition-colors", isLightSidebar ? "text-slate-500 hover:text-slate-900 hover:bg-slate-100" : "text-gray-400 hover:text-white")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <nav
        data-lenis-prevent
        onMouseLeave={() => setHoveredIdx(null)}
        className={cn(
          "mt-3 space-y-1 flex-1 overflow-y-auto overscroll-contain min-h-0 pb-6 relative z-20 custom-scrollbar",
          collapsed ? "px-1.5" : "px-3"
        )}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {isAdminPanel && !collapsed && (
          <div className="mb-3 px-1">
            <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">
              Module
            </p>
            <AdminModuleSwitcher className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1" />
          </div>
        )}
        {!collapsed && (
          <p className={cn("px-3 text-[10px] font-semibold uppercase tracking-widest mb-2 mt-1", isLightSidebar ? "text-slate-500" : "text-gray-500")}>
            Core Management
          </p>
        )}
        <AnimatePresence>
          {items.map((item, idx) => (
            <SidebarItem
              key={idx}
              item={item}
              isOpen={openMenu === item.label}
              onToggle={() => handleToggle(item.label)}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => { }}
              collapsed={collapsed}
            />
          ))}
        </AnimatePresence>
      </nav>

      {isSellerPanel && (
        <div
          className={cn(
            "flex-shrink-0 border-t mt-auto",
            collapsed ? "px-1.5 py-3" : "px-3 py-3",
            isLightSidebar ? "border-slate-200/80 bg-white" : "border-white/5",
          )}
        >
          <button
            type="button"
            onClick={() => {
              logout();
              onClose?.();
            }}
            title="Sign out"
            className={cn(
              "w-full flex items-center rounded-lg py-2 transition-all duration-200 group",
              collapsed ? "justify-center px-1.5" : "justify-start gap-2.5 px-3",
              isLightSidebar
                ? "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                : "text-rose-400 hover:bg-white/10 hover:text-rose-300",
            )}
          >
            <div
              className={cn(
                "p-1.5 rounded-lg transition-all duration-200",
                isLightSidebar
                  ? "bg-rose-50 text-rose-600 group-hover:bg-rose-100"
                  : "bg-white/5 text-rose-400",
              )}
            >
              <HiOutlineArrowRightOnRectangle className="h-4 w-4" />
            </div>
            {!collapsed && (
              <span className="text-xs font-semibold tracking-tight">Sign out</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

const Sidebar = ({ items, title, isOpen, onClose, collapsed = false, onToggleCollapse }) => {
  const { role } = useAuth();
  const location = useLocation();
  const isSellerPanel = location.pathname.startsWith("/seller");
  const isAdminPanel = location.pathname.startsWith("/ecs");
  const isLightSidebar = isSellerPanel || isAdminPanel;
  const [openMenu, setOpenMenu] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const handleToggle = (label) => {
    if (collapsed && onToggleCollapse) {
      onToggleCollapse();
      setOpenMenu(label);
      return;
    }
    setOpenMenu((prev) => (prev === label ? null : label));
  };

  useEffect(() => {
    if (collapsed) setOpenMenu(null);
  }, [collapsed]);

  const commonProps = {
    items,
    title,
    onClose,
    openMenu,
    handleToggle,
    hoveredIdx,
    setHoveredIdx,
    collapsed: false,
    onToggleCollapse: undefined,
  };

  const desktopProps = {
    ...commonProps,
    collapsed,
    onToggleCollapse,
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed left-0 inset-y-0 border-r shadow-[10px_0_30px_rgba(0,0,0,0.04)] md:flex flex-col z-50 transition-all duration-300",
          collapsed ? "w-[4.5rem]" : "w-80",
          isLightSidebar
              ? "bg-white text-slate-800 border-slate-200/80"
              : "bg-[#0a0c10] text-gray-400 border-white/5",
          (role === "admin" || role === "seller") ? "hidden md:flex" : "flex",
        )}
      >
        <SidebarContent {...desktopProps} />
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
              className="absolute inset-0 bg-black/50 backdrop-blur-xs pointer-events-auto"
            />

            {/* Outer Container */}
            <div className="absolute left-0 inset-y-0 w-72 sm:w-80 flex flex-col pointer-events-none">
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
                className={cn(
                  "flex-1 shadow-2xl flex flex-col pointer-events-auto min-h-0 bg-white",
                  isLightSidebar ? "bg-white text-slate-800 border-r border-slate-200/80" : "bg-[#0a0c10] text-gray-400"
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
