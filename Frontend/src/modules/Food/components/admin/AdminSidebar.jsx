import { useState, useEffect, useMemo } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  adminSidebarMenu,
} from "@food/utils/adminSidebarMenu"
import {
  quickAdminSidebarMenu,
} from "@food/utils/quickAdminSidebarMenu"

import { commonAdminSidebarMenu } from "@food/utils/commonAdminSidebarMenu"
import {
  Search,
  FileText,
  Calendar,
  Clock,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Link as LinkIcon,
  UtensilsCrossed,
  Building2,
  FolderTree,
  Plus,
  Utensils,
  Megaphone,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  X,
  LayoutDashboard,
  Gift,
  IndianRupee,
  Image,
  Bell,
  MessageSquare,
  Mail,
  Users,
  Wallet,
  Award,
  Truck,
  Package,
  CreditCard,
  Settings,
  UserCog,
  User,
  Globe,
  Palette,
  Camera,
  LogIn,
  Database,
  Zap,
  Phone,

  PiggyBank,
  Lock,

  ClipboardCheck,
  CircleHelp,
  MessageCircle,
  Share2,
  UserX,
  Smartphone,
  Monitor,
  TrendingUp,
  Briefcase,

  ChevronDown as ChevronDownIcon,
  LayoutGrid,
} from "lucide-react"
import { cn } from "@food/utils/utils"
import { Input } from "@food/components/ui/input"
import {
  getCachedSettings,
  getCompanyName,
  getAppLogo,
  getAppFavicon,
  updateBrowserFavicon,
  subscribeBusinessSettings,
} from "@common/utils/businessSettings"
import { adminAPI } from "@food/api"
import { getCurrentUser } from "@food/utils/auth"
import { useAuth } from "@core/context/AuthContext"
import { extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions, getFirstAccessibleAdminPath, hasAnyRootAccess } from "@food/utils/adminPermissions"
import { useAdminBadgeStore } from "@food/store/adminBadgeStore"

const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }

// Default enable-state used before settings load (sensible fallbacks). The
// backend `modules` object is the source of truth; any key it returns is
// normalized to a boolean, so new modules (pharmacy, taxi, hotel, ...) start
// working without touching this file.
const DEFAULT_ENABLED_MODULES = { food: true, quickCommerce: true, streetFood: true }

const normalizeEnabledModules = (modules) => {
  const result = { ...DEFAULT_ENABLED_MODULES }
  if (modules && typeof modules === "object") {
    for (const [key, value] of Object.entries(modules)) {
      // A module is enabled unless the backend explicitly disables it.
      result[key] = typeof value === "boolean" ? value : value !== false
    }
  }
  return result
}


// Icon mapping
const iconMap = {
  LayoutDashboard,
  UtensilsCrossed,
  Building2,
  FileText,
  Calendar,
  Clock,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Link: LinkIcon,
  FolderTree,
  Plus,
  Utensils,
  Megaphone,
  Gift,
  IndianRupee,
  Image,
  Bell,
  MessageSquare,
  Mail,
  Users,
  Wallet,
  Award,
  Truck,
  Package,
  CreditCard,
  Settings,
  UserCog,
  User,
  Globe,
  Palette,
  Camera,
  LogIn,
  Database,
  Zap,
  Phone,

  PiggyBank,
  Lock,

  ClipboardCheck,
  CircleHelp,
  MessageCircle,
  Share2,
  UserX,
  Smartphone,
  Monitor,
  TrendingUp,
  Briefcase,

  X,
  LayoutGrid,
}

export default function AdminSidebar({ isOpen = false, onClose, onCollapseChange }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [enabledModules, setEnabledModules] = useState(() =>
    normalizeEnabledModules(getCachedSettings()?.modules)
  );
  const badges = useAdminBadgeStore((state) => state.badges);
  const fetchBadges = useAdminBadgeStore((state) => state.fetchBadges);



  const getBadgeCount = (label = "", path = "") => {
    const l = label.toLowerCase()
    const p = path?.toLowerCase() || ""

    if (l.includes("food approval")) return badges.foodApprovals
    if (l === "foods") return badges.foods
    if (l === "restaurant foods list") return badges.pendingFoodsCount
    if (l === "restaurant addons list") return badges.pendingAddonsCount
    if (l === "categories" || l === "category") return badges.categories
    if (l === "restaurants" || l.includes("new joining request")) return badges.restaurants
    if (l.includes("restaurant complaints")) return badges.restaurantComplaints
    if (p.includes("orders/pending")) return badges.orders
    if (p.includes("offline-payments")) return badges.offlinePayments
    if (l.includes("support tickets")) return l.includes("delivery") ? badges.deliverySupportTickets : badges.userSupportTickets
    if (l.includes("withdrawal")) return l.includes("delivery") ? badges.deliveryWithdrawals : badges.restaurantWithdrawals
    if (l.includes("emergency help")) return badges.emergencyHelp
    if (l.includes("earning addon history")) return badges.earningAddons
    if (l.includes("safety emergency reports")) return badges.safetyReports
    if (l === "deliveryman" && !p.includes("join-request")) return badges.deliveryPartners // expandable parent
    if (l.includes("join request") || p.includes("join-request")) return badges.deliveryPartners
    return 0
  }
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo('admin'))
  const [companyName, setCompanyName] = useState(() => getCompanyName())

  // Apply business settings from cache (logo, favicon, modules)
  useEffect(() => {
    const apply = (settings) => {
      const adminLogo = getAppLogo('admin')
      if (adminLogo) setLogoUrl(adminLogo)
      const adminFav = getAppFavicon('admin')
      if (adminFav) updateBrowserFavicon(adminFav)
      if (settings?.companyName) {
        setCompanyName(settings.companyName)
      } else {
        setCompanyName(getCompanyName())
      }
      if (settings?.modules) {
        setEnabledModules(normalizeEnabledModules(settings.modules))
      }
    }

    apply(getCachedSettings())
    return subscribeBusinessSettings(apply)
  }, [])

  // Keep only the first expanded key `true` (accordion invariant: at most one open)
  const enforceAccordionInvariant = (expandedSections) => {
    if (!expandedSections || typeof expandedSections !== "object") return {}
    const next = {}
    let foundOpen = false
    Object.keys(expandedSections).forEach((key) => {
      if (expandedSections[key] && !foundOpen) {
        next[key] = true
        foundOpen = true
      } else {
        next[key] = false
      }
    })
    return next
  }

  // Get initial states from consolidated admin_sidebar_state
  const getInitialStates = () => {
    try {
      const saved = localStorage.getItem('admin_sidebar_state')
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          ...parsed,
          expandedSections: enforceAccordionInvariant(parsed.expandedSections),
        }
      }
    } catch (e) {
      debugError('Error loading sidebar state:', e)
    }
    return { isCollapsed: false, expandedSections: {} }
  }

  const [isCollapsed, setIsCollapsed] = useState(() => getInitialStates().isCollapsed)
  const [expandedGroups, setExpandedGroups] = useState(() => getInitialStates().expandedGroups || {})
  const [expandedSections, setExpandedSections] = useState(() => {
    const initialState = getInitialStates().expandedSections
    if (Object.keys(initialState || {}).length > 0) return initialState

    // Generate defaults if empty
    const state = {}
    adminSidebarMenu.forEach((item) => {
      if (item.type === "section") {
        item.items.forEach((subItem) => {
          if (subItem.type === "expandable") {
            state[subItem.label.toLowerCase().replace(/\s+/g, "")] = false
          }
        })
      }
    })
    return state
  })

  // Save states to consolidated localStorage and notify parent
  useEffect(() => {
    try {
      const currentState = JSON.parse(localStorage.getItem('admin_sidebar_state') || '{}')
      localStorage.setItem('admin_sidebar_state', JSON.stringify({
        ...currentState,
        isCollapsed
      }))
      if (onCollapseChange) {
        onCollapseChange(isCollapsed)
      }
    } catch (e) {
      debugError('Error saving sidebar collapsed state:', e)
    }
  }, [isCollapsed, onCollapseChange])

  // Notify parent on initial load
  useEffect(() => {
    if (onCollapseChange) {
      onCollapseChange(isCollapsed)
    }
  }, [])

  const toggleCollapse = () => {
    setIsCollapsed(prev => !prev)
  }

  // Persist group (top-level "section") expanded/collapsed state
  useEffect(() => {
    try {
      const currentState = JSON.parse(localStorage.getItem('admin_sidebar_state') || '{}')
      localStorage.setItem('admin_sidebar_state', JSON.stringify({
        ...currentState,
        expandedGroups
      }))
    } catch (e) {
      debugError('Error saving sidebar group state:', e)
    }
  }, [expandedGroups])

  const toggleGroup = (groupKey) => {
    setExpandedGroups(prev => ({ ...prev, [groupKey]: !(prev[groupKey] !== false) }))
  }

  const getExpandableSectionKeys = (menuData = []) => {
    const keys = []
    menuData.forEach((item) => {
      if (item.type === "section" && Array.isArray(item.items)) {
        item.items.forEach((subItem) => {
          if (subItem.type === "expandable" && subItem.label) {
            keys.push(subItem.label.toLowerCase().replace(/\s+/g, ""))
          }
        })
      }
    })
    return keys
  }

  const isQuickAdmin = location.pathname.startsWith("/ecs/quick-commerce")
  const isCommonAdmin = location.pathname.startsWith("/ecs/global-settings")

  const { user: authUser } = useAuth()
  const user = useMemo(() => authUser || getCurrentUser("admin"), [authUser])
  const [resolvedPermissions, setResolvedPermissions] = useState({})

  useEffect(() => {
    let isMounted = true

    const resolvePermissions = async () => {
      if (!user || user.role === "ADMIN") {
        if (isMounted) setResolvedPermissions({})
        return
      }

      const existingPermissions = extractAdminPermissions(user)
      if (Object.keys(existingPermissions).length > 0) {
        if (isMounted) setResolvedPermissions(existingPermissions)
        return
      }

      const roleId = extractAdminRoleId(user)
      if (!roleId) {
        if (isMounted) setResolvedPermissions({})
        return
      }

      try {
        const rolePermissions = await fetchAdminRolePermissions(roleId)
        if (isMounted) setResolvedPermissions(rolePermissions)
      } catch {
        if (isMounted) setResolvedPermissions({})
      }
    }

    resolvePermissions()
    return () => {
      isMounted = false
    }
  }, [user])

  const activeMenuData = useMemo(() => {
    let menu = adminSidebarMenu
    let rootKey = "food"
    if (isQuickAdmin) {
      menu = quickAdminSidebarMenu
      rootKey = "quick"
    } else if (isCommonAdmin) {
      menu = commonAdminSidebarMenu
      rootKey = "global"
    } else {
      menu = adminSidebarMenu
      rootKey = "food"
    }

    // Special case for the "Module Switcher" or shared links if they exist
    // But since we are filtering the WHOLE menu based on the active admin context:
    if (isQuickAdmin && !enabledModules.quickCommerce) return []

    if (!isQuickAdmin && !isCommonAdmin && !enabledModules.food) return []

    // Filter by permissions if employee
    if (user && user.role !== "ADMIN") {
      const permissions = resolvedPermissions;
      const filterMenuByPermissions = (menuList, parentKey) => {
        return menuList
          .map((item) => {
            if (!item.permissionKey) return null;
            const currentKey = `${parentKey}::${item.permissionKey}`;
            const hasView = permissions[currentKey]?.view === true;
            if (item.type === "section" && item.items) {
              if (!hasView) return null;
              const filteredItems = filterMenuByPermissions(item.items, currentKey);
              if (filteredItems.length === 0) return null;
              return { ...item, items: filteredItems };
            }

            if (item.type === "expandable" && item.subItems) {
              if (!hasView) return null;
              const filteredSubItems = filterMenuByPermissions(item.subItems, currentKey);
              if (filteredSubItems.length === 0) return null;
              return { ...item, subItems: filteredSubItems };
            }

            if (!hasView) return null;

            return item;
          })
          .filter(Boolean);
      };
      return filterMenuByPermissions(menu, rootKey);
    }

    return menu
  }, [isQuickAdmin, isCommonAdmin, enabledModules, resolvedPermissions, user])

  // Ensure expandable keys exist for whichever admin module is active (food/quick)
  useEffect(() => {
    const activeKeys = getExpandableSectionKeys(activeMenuData)
    setExpandedSections((prev) => {
      const next = { ...prev }
      activeKeys.forEach((key) => {
        if (typeof next[key] !== "boolean") {
          next[key] = false
        }
      })
      return next
    })
  }, [activeMenuData])

  const canAccessFoodModule = user?.role === "ADMIN" || hasAnyRootAccess(resolvedPermissions, "food")
  const canAccessQuickModule = user?.role === "ADMIN" || hasAnyRootAccess(resolvedPermissions, "quick")
  const canAccessGlobalModule = user?.role === "ADMIN" || hasAnyRootAccess(resolvedPermissions, "global")

  const switchAdminModule = (target) => {
    if (target === "quick") {
      const targetPath =
        user?.role === "ADMIN"
          ? "/ecs/quick-commerce"
          : getFirstAccessibleAdminPath(quickAdminSidebarMenu, resolvedPermissions, "quick") || "/ecs/quick-commerce"
      navigate(targetPath)

    } else if (target === "common") {
      const targetPath =
        user?.role === "ADMIN"
          ? "/ecs/global-settings"
          : getFirstAccessibleAdminPath(commonAdminSidebarMenu, resolvedPermissions, "global") || "/ecs/global-settings"
      navigate(targetPath)
    } else {
      const targetPath =
        user?.role === "ADMIN"
          ? "/ecs/food"
          : getFirstAccessibleAdminPath(adminSidebarMenu, resolvedPermissions, "food") || "/ecs/food"
      navigate(targetPath)
    }
    if (window.innerWidth < 1024 && onClose) {
      onClose()
    }
  }

  // Filter menu items based on search query
  const filteredMenuData = useMemo(() => {
    if (!searchQuery.trim()) {
      return activeMenuData
    }

    const query = searchQuery.toLowerCase().trim()
    const filtered = []

    activeMenuData.forEach((item) => {
      if (item.type === "link") {
        if (item.label.toLowerCase().includes(query)) {
          filtered.push(item)
        }
      } else if (item.type === "section") {
        const filteredItems = []

        item.items.forEach((subItem) => {
          if (subItem.type === "link") {
            if (subItem.label.toLowerCase().includes(query)) {
              filteredItems.push(subItem)
            }
          } else if (subItem.type === "expandable") {
            const matchesLabel = subItem.label.toLowerCase().includes(query)
            const matchingSubItems = subItem.subItems?.filter(
              (si) => si.label.toLowerCase().includes(query)
            ) || []

            if (matchesLabel || matchingSubItems.length > 0) {
              filteredItems.push({
                ...subItem,
                subItems: matchesLabel ? subItem.subItems : matchingSubItems,
              })
            }
          }
        })

        if (filteredItems.length > 0) {
          filtered.push({
            ...item,
            items: filteredItems,
          })
        }
      }
    })

    return filtered
  }, [searchQuery, activeMenuData])

  // Auto-expand sections with matches when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()

      setExpandedSections((prev) => {
        const newExpandedState = { ...prev }

        activeMenuData.forEach((item) => {
          if (item.type === "section") {
            item.items.forEach((subItem) => {
              if (subItem.type === "expandable") {
                const matchesLabel = subItem.label.toLowerCase().includes(query)
                const hasMatchingSubItems = subItem.subItems?.some(
                  (si) => si.label.toLowerCase().includes(query)
                )

                if (matchesLabel || hasMatchingSubItems) {
                  const sectionKey = subItem.label.toLowerCase().replace(/\s+/g, "")
                  newExpandedState[sectionKey] = true
                }
              }
            })
          }
        })

        return newExpandedState
      })
    }
  }, [searchQuery, activeMenuData])

  const isActive = (path, allPaths = []) => {
    const currentPath = location.pathname.replace(/\/+$/, "") || "/"
    const targetPath = String(path || "").replace(/\/+$/, "") || "/"
    const matchesPath = (candidatePath) =>
      currentPath === candidatePath || currentPath.startsWith(`${candidatePath}/`)

    if (targetPath === "/ecs" || targetPath === "/ecs/food") {
      return currentPath === targetPath
    }

    // For subItems, check if this is the most specific match
    if (allPaths.length > 0) {
      // Sort paths by length (longest first) to find most specific match
      const sortedPaths = [...allPaths].sort((a, b) => b.length - a.length)
      const bestMatch = sortedPaths.find((candidatePath) =>
        matchesPath(String(candidatePath || "").replace(/\/+$/, "") || "/")
      )
      return (String(bestMatch || "").replace(/\/+$/, "") || "/") === targetPath
    }

    return matchesPath(targetPath)
  }

  useEffect(() => {
    try {
      const currentState = JSON.parse(localStorage.getItem('admin_sidebar_state') || '{}')
      localStorage.setItem('admin_sidebar_state', JSON.stringify({
        ...currentState,
        expandedSections
      }))
    } catch (e) {
      debugError('Error saving sidebar state:', e)
    }
  }, [expandedSections])

  const toggleSection = (sectionKey) => {
    setExpandedSections((prev) => {
      const isCurrentlyOpen = Boolean(prev[sectionKey])
      const keys = Array.from(new Set([...Object.keys(prev), sectionKey]))

      // Accordion behavior:
      // 1) If current section is open -> close it.
      // 2) If current section is closed -> open it and close all others.
      if (isCurrentlyOpen) {
        return {
          ...prev,
          [sectionKey]: false,
        }
      }

      const next = {}
      keys.forEach((key) => {
        next[key] = key === sectionKey
      })
      return next
    })
  }

  const renderMenuItem = (item, index, isInSection = false) => {
    if (item.type === "link") {
      const Icon = iconMap[item.icon] || Utensils
      return (
        <Link
          key={index}
          to={item.path}
          onClick={() => {
            if (window.innerWidth < 1024 && onClose) {
              onClose()
            }
          }}
          className={cn(
            "flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-200 ease-out menu-item-animate text-left group",
            isInSection ? "text-xs font-semibold" : "text-xs",
            isActive(item.path)
              ? "bg-[#F3E8FF] text-[#6412C6] border border-[#F3E8FF]/30 font-semibold shadow-xs"
              : "text-[#5C5247] hover:bg-[#FAF7F2] hover:text-[#1A1A1A]",
            isCollapsed && "justify-center px-2"
          )}
          style={{ animationDelay: `${index * 0.05}s` }}
          title={isCollapsed ? item.label : undefined}
        >
          <Icon className={cn(
            "shrink-0 transition-all duration-200 text-left w-3.5 h-3.5",
            isActive(item.path) ? "text-[#6412C6] scale-110" : "text-[#5C5247] group-hover:text-[#1A1A1A]"
          )} />
          {!isCollapsed && (
            <div className="flex-1 flex items-center justify-between overflow-hidden">
              <span className={cn("text-left truncate text-xs", isInSection ? "font-semibold" : "font-medium")}>
                {item.label}
              </span>
              {getBadgeCount(item.label, item.path) > 0 && (
                <span className="shrink-0 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 min-w-[18px] text-center">
                  {getBadgeCount(item.label, item.path) > 99 ? "99+" : getBadgeCount(item.label, item.path)}
                </span>
              )}
            </div>
          )}
          {isCollapsed && getBadgeCount(item.label, item.path) > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-neutral-950" />
          )}
        </Link>
      )
    }

    if (item.type === "expandable") {
      const Icon = iconMap[item.icon] || Utensils
      const sectionKey = item.label.toLowerCase().replace(/\s+/g, "")
      const isExpanded = expandedSections[sectionKey] || false

      if (isCollapsed) {
        return (
          <div key={index} className="menu-item-animate" style={{ animationDelay: `${index * 0.05}s` }}>
            <button
              onClick={() => toggleSection(sectionKey)}
              className={cn(
                "w-full flex items-center justify-center px-2 py-1.5 rounded-lg transition-all duration-200 ease-out text-xs font-medium",
                "text-[#5C5247] hover:bg-[#FAF7F2] hover:text-[#1A1A1A]"
              )}
              title={item.label}
            >
              <div className="relative">
                <Icon className="w-3.5 h-3.5 shrink-0 text-[#5C5247] transition-transform duration-200" />
                {getBadgeCount(item.label, item.path) > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-neutral-950" />
                )}
              </div>
            </button>
          </div>
        )
      }

      return (
        <div key={index} className="menu-item-animate" style={{ animationDelay: `${index * 0.05}s` }}>
          <button
            onClick={() => toggleSection(sectionKey)}
            className={cn(
              "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-200 ease-out text-xs font-medium text-left",
              "text-[#5C5247] hover:bg-[#FAF7F2] hover:text-[#1A1A1A]"
            )}
          >
            <div className="flex items-center gap-2 text-left flex-1 min-w-0">
              <Icon className="w-3.5 h-3.5 shrink-0 text-[#5C5247] transition-transform duration-200" />
              <span className="font-medium text-left truncate text-xs">{item.label}</span>
              {getBadgeCount(item.label, item.path) > 0 && (
                <span className="shrink-0 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 min-w-[18px] text-center">
                  {getBadgeCount(item.label, item.path) > 99 ? "99+" : getBadgeCount(item.label, item.path)}
                </span>
              )}
            </div>
            <div className="transition-transform duration-200 shrink-0" style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
              <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[#5C5247]" />
            </div>
          </button>
          {isExpanded && item.subItems && (
            <div className="ml-4 mt-0.5 space-y-0.5 border-neutral-800/60 pl-2.5 submenu-animate overflow-hidden">
              {item.subItems.map((subItem, subIndex) => {
                const allSubPaths = item.subItems.map(si => si.path)
                const subItemLabel = subItem.label || subItem.title || subItem.name || (subItem.permissionKey === "modules" ? "Modules" : "")
                return (
                  <Link
                    key={subIndex}
                    to={subItem.path}
                    onClick={() => {
                      if (window.innerWidth < 1024 && onClose) {
                        onClose()
                      }
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-2.5 py-1 rounded-md transition-all duration-200 ease-out text-xs font-normal text-left",
                      isActive(subItem.path, allSubPaths)
                        ? "bg-[#F3E8FF] text-[#6412C6] font-semibold shadow-xs"
                        : "text-[#5C5247] hover:bg-[#FAF7F2] hover:text-[#1A1A1A]"
                    )}
                    style={{ animationDelay: `${subIndex * 0.03}s` }}
                    title={subItemLabel}
                  >
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-200",
                      isActive(subItem.path, allSubPaths) ? "bg-[#6412C6] scale-125" : "bg-[#5C5247]"
                    )}></span>
                    <span className="block min-w-0 flex-1 text-left text-xs font-medium leading-4 text-current truncate">
                      {subItemLabel}
                    </span>
                    {getBadgeCount(subItemLabel, subItem.path) > 0 && (
                      <span className="shrink-0 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 min-w-[18px] text-center">
                        {getBadgeCount(subItemLabel, subItem.path) > 99 ? "99+" : getBadgeCount(subItemLabel, subItem.path)}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )
    }

    return null
  }

  const moduleTabs = [
    {
      key: "food",
      label: "Food",
      enabled: enabledModules.food,
      visible: canAccessFoodModule,
      active: !isQuickAdmin && !isCommonAdmin,
      onClick: () => switchAdminModule("food")
    },
    {
      key: "quick",
      label: "Quick",
      enabled: enabledModules.quickCommerce,
      visible: canAccessQuickModule,
      active: isQuickAdmin,
      onClick: () => switchAdminModule("quick")
    }
  ];

  const visibleModuleTabs = moduleTabs.filter(tab => tab.enabled && tab.visible);

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes expandDown {
          from {
            opacity: 0;
            max-height: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            max-height: 500px;
            transform: translateY(0);
          }
        }
        
        .menu-item-animate {
          animation: slideIn 0.3s ease-out forwards;
        }
        
        .submenu-animate {
          animation: expandDown 0.3s ease-out forwards;
        }
        
        .admin-sidebar-scroll {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
        }
        
        .admin-sidebar-scroll::-webkit-scrollbar {
          width: 2px;
        }
        .admin-sidebar-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .admin-sidebar-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 10px;
          transition: background 0.2s ease;
        }
        .admin-sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.2);
        }
        .admin-sidebar-scroll:hover::-webkit-scrollbar {
          width: 6px;
        }
        .admin-sidebar-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
        }
        
        .admin-sidebar-responsive-bg {
          background-color: #ffffff !important;
        }
        @media (min-width: 1024px) {
          .admin-sidebar-responsive-bg {
            background-color: #ffffffcc !important;
          }
        }
      `}</style>
      <div
        className={cn(
          "admin-sidebar-responsive-bg backdrop-blur-md border-r border-[#EDE8E0] h-screen fixed left-0 top-0 z-[100] flex flex-col overflow-hidden shadow-xs",
          "transform transition-all duration-300 ease-in-out",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          isCollapsed ? "w-20" : "w-80"
        )}
      >
        {/* Header with Logo and Brand */}
        <div
          className="shrink-0 px-3 py-3 border-b border-[#EDE8E0] bg-transparent animate-[fadeIn_0.4s_ease-out]"
        >
          <div className="flex items-center justify-between mb-3">
            {!isCollapsed && (
              <div className="flex items-center gap-2 animate-[slideIn_0.3s_ease-out]">
                <div className="w-24 h-12 rounded-lg flex items-center justify-center shadow-black/20">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={companyName || "Company"}
                      className="w-24 h-10 object-contain"
                      loading="lazy"
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                  ) : (
                    <span className="text-xs font-semibold text-[#1A1A1A] px-2 truncate">
                      {companyName || "Appzeto"}
                    </span>
                  )}
                </div>
              </div>
            )}
            {isCollapsed && (
              <div className="w-full flex items-center justify-center">
                <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center shadow-md shadow-neutral-200/50 ring-1 ring-neutral-200">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={companyName || "Company"}
                      className="w-10 h-10 object-contain"
                      loading="lazy"
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-[#1A1A1A] uppercase">
                      {(companyName || "A")[0]}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleCollapse}
                className="text-[#5C5247] hover:text-[#1A1A1A] transition-all duration-200 hover:scale-110 p-1.5 rounded-lg hover:bg-neutral-100"
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={onClose}
                className="lg:hidden text-[#5C5247] hover:text-[#1A1A1A] transition-all duration-200 hover:scale-110"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ECS Panel Label */}
          {!isCollapsed && (
            <div className="mb-3 animate-[slideIn_0.4s_ease-out_0.1s_both] bg-transparent">
              <h2 className="text-xs font-bold text-[#5C5247] uppercase tracking-wider text-left">
                ECS Panel
              </h2>
              <div className="mt-2 rounded-xl border border-[#EDE8E0] bg-[#ffffffcc] p-1">
                <div 
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `repeat(${visibleModuleTabs.length}, minmax(0, 1fr))` }}
                >
                  {visibleModuleTabs.map(tab => (
                    <button
                      key={`${tab.key}-module-btn`}
                      type="button"
                      onClick={tab.onClick}
                      className={cn(
                        "rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all",
                        tab.active
                          ? "bg-[#6412C6] text-white shadow-[0_4px_12px_rgba(100,18,198,0.2)]"
                          : "text-[#5C5247] hover:text-[#1A1A1A] hover:bg-white/50"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}

                  {canAccessGlobalModule && (
                    <button
                      key="global-settings-btn"
                      type="button"
                      onClick={() => switchAdminModule("common")}
                      style={{ gridColumn: `span ${visibleModuleTabs.length} / span ${visibleModuleTabs.length}` }}
                      className={cn(
                        "rounded-lg px-2 py-1.5 mt-1 text-[11px] font-bold uppercase tracking-wide transition-all",
                        isCommonAdmin
                          ? "bg-[#6412C6] text-white shadow-[0_4px_12px_rgba(100,18,198,0.2)]"
                          : "text-[#5C5247] hover:text-[#1A1A1A] hover:bg-white/50"
                      )}
                    >
                      Global Settings
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Search Bar */}
          {!isCollapsed && (
            <div className="relative animate-[slideIn_0.4s_ease-out_0.2s_both]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#5C5247] w-4 h-4 z-10 transition-colors duration-200" />
              <Input
                type="text"
                placeholder="Search Menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full pl-9 py-2 bg-[#ffffffcc] border border-[#EDE8E0] rounded-lg text-sm text-[#1A1A1A] placeholder:text-[#7C7062] focus:outline-none focus:ring-2 focus:ring-[#6412C6]/40 focus:border-[#6412C6]/40 transition-all duration-200 text-left",
                  searchQuery ? "pr-9" : "pr-3"
                )}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#5C5247] hover:text-[#1A1A1A] transition-all duration-200 hover:scale-110 z-10"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="admin-sidebar-scroll flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-2.5 py-2 space-y-1">
          {filteredMenuData.length === 0 && searchQuery.trim() ? (
            <div className="px-3 py-12 text-left animate-[fadeIn_0.4s_ease-out]">
              <p className="text-[#5C5247] text-sm font-medium text-left">No menu items found</p>
              <p className="text-neutral-400 text-sm mt-2 text-left">Try a different search term</p>
            </div>
          ) : (
            filteredMenuData.map((item, index) => {
              if (item.type === "link") {
                return renderMenuItem(item, index)
              }

              if (item.type === "section") {
                const groupKey = (item.label || item.title || `section-${index}`).toLowerCase().replace(/\s+/g, "")
                const isGroupOpen = isCollapsed || expandedGroups[groupKey] !== false

                return (
                  <div
                    key={index}
                    className={cn(
                      index > 0 ? "mt-2 pt-2 border-t border-[#EDE8E0]" : "",
                      "animate-[fadeIn_0.4s_ease-out]"
                    )}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {!isCollapsed && (item.label || item.title) && (
                      <button
                        type="button"
                        onClick={() => toggleGroup(groupKey)}
                        className="w-full flex items-center justify-between px-3 py-1 mb-1 group"
                      >
                        <span className="text-[#5C5247] font-bold text-[10px] uppercase tracking-wider text-left">
                          {item.label || item.title}
                        </span>
                        <ChevronDown
                          className="w-3 h-3 shrink-0 text-[#5C5247] transition-transform duration-200"
                          style={{ transform: isGroupOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                        />
                      </button>
                    )}
                    {isGroupOpen && (
                      <div className="space-y-1">
                        {item.items.map((subItem, subIndex) => renderMenuItem(subItem, `${index}-${subIndex}`, true))}
                      </div>
                    )}
                  </div>
                )
              }

              return null
            })
          )}
        </nav>
      </div>
    </>
  )
}

