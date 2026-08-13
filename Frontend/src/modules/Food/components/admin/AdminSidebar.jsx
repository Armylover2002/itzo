import { useState, useEffect, useMemo } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  adminSidebarMenu,
} from "@food/utils/adminSidebarMenu"
import {
  quickAdminSidebarMenu,
} from "@food/utils/quickAdminSidebarMenu"

import {
  commonAdminSidebarMenu,
} from "@food/utils/commonAdminSidebarMenu"
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
  DollarSign,
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
  IndianRupee,
  PiggyBank,
  Lock,

  ClipboardCheck,
  CircleHelp,
  MessageCircle,
  Share2,
  Smartphone,
  Monitor,
  Briefcase,
  Headphones,

  ChevronDown as ChevronDownIcon,
  LayoutGrid,
} from "lucide-react"
import { cn } from "@food/utils/utils"
import { Input } from "@food/components/ui/input"
import { 
  getCachedSettings, 
  loadBusinessSettings,
  getCompanyName,
  getAppLogo,
  getAppFavicon,
  updateBrowserFavicon
} from "@common/utils/businessSettings"
import { adminAPI } from "@food/api"
import { getCurrentUser } from "@food/utils/auth"
import { useAuth } from "@core/context/AuthContext"
import { extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions, getFirstAccessibleAdminPath, hasAnyRootAccess } from "@food/utils/adminPermissions"

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


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
  DollarSign,
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
  IndianRupee,
  PiggyBank,
  Lock,

  ClipboardCheck,
  CircleHelp,
  MessageCircle,
  Share2,
  Smartphone,
  Monitor,
  Briefcase,
  Headphones,

  X,
  LayoutGrid,
}

export default function AdminSidebar({ isOpen = false, onClose, onCollapseChange }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [badges, setBadges] = useState({})
  const [enabledModules, setEnabledModules] = useState(() => {
    const cached = getCachedSettings()?.modules;
    return {
      food: cached?.food !== undefined ? !!cached.food : true,
      quickCommerce: cached?.quickCommerce !== undefined ? !!cached.quickCommerce : true,
    };
  });

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const res = await adminAPI.getSidebarBadges()
        if (res?.data?.success) {
          setBadges(res.data.counts || {})
        }
      } catch (error) {
        debugError("Error fetching sidebar badges:", error)
      }
    }
    fetchBadges()
    const timer = setInterval(fetchBadges, 60000)
    return () => clearInterval(timer)
  }, [])

  const getBadgeCount = (label = "", path = "") => {
    const l = label.toLowerCase()
    const p = path?.toLowerCase() || ""

    if (l.includes("food approval")) return badges.foodApprovals
    if (l === "foods") return badges.foods
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

  // Load business settings logo
  useEffect(() => {
    const loadLogo = async () => {
      try {
        // First check cache
        let cached = getCachedSettings()
        if (cached) {
          const adminLogo = getAppLogo('admin')
          if (adminLogo) {
            setLogoUrl(adminLogo)
          }
          const adminFav = getAppFavicon('admin')
          if (adminFav) {
            updateBrowserFavicon(adminFav)
          }
          if (cached.companyName) {
            setCompanyName(cached.companyName)
          }
        }

        // Always try to load fresh data to ensure we have the latest
        const settings = await loadBusinessSettings()
        if (settings) {
          const adminLogo = getAppLogo('admin')
          if (adminLogo) {
            setLogoUrl(adminLogo)
          }
          const adminFav = getAppFavicon('admin')
          if (adminFav) {
            updateBrowserFavicon(adminFav)
          }
          if (settings.companyName) {
            setCompanyName(settings.companyName)
          }
        }
      } catch (error) {
        debugError('Error loading logo:', error)
      }
    }

    // Load immediately
    loadLogo()

    // Also try after a small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      loadLogo()
    }, 100)

    // Listen for business settings updates
    const handleUpdate = (e) => {
      const settings = e?.detail || getCachedSettings()
      if (settings) {
        const adminLogo = getAppLogo('admin')
        if (adminLogo) {
          setLogoUrl(adminLogo)
        }
        const adminFav = getAppFavicon('admin')
        if (adminFav) {
          updateBrowserFavicon(adminFav)
        }
        if (settings.companyName) {
          setCompanyName(settings.companyName)
        }
        if (settings.modules) {
          setEnabledModules({
            food: settings.modules.food !== undefined ? !!settings.modules.food : true,
            quickCommerce: settings.modules.quickCommerce !== undefined ? !!settings.modules.quickCommerce : true,
          });
        } else {
          setEnabledModules({ food: true, quickCommerce: true });
        }
      }
    }
    window.addEventListener('businessSettingsUpdated', handleUpdate)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('businessSettingsUpdated', handleUpdate)
    }
  }, [])

  // Get initial states from consolidated admin_sidebar_state
  const getInitialStates = () => {
    try {
      const saved = localStorage.getItem('admin_sidebar_state')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (e) {
      debugError('Error loading sidebar state:', e)
    }
    return { isCollapsed: false, expandedSections: {} }
  }

  const [isCollapsed, setIsCollapsed] = useState(() => getInitialStates().isCollapsed)
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

            if (item.type === "link" && item.permissionKey === "dashboard" && (parentKey === "food" || parentKey === "quick")) {
              return null;
            }

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
            "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-300 ease-out menu-item-animate text-left",
            isInSection ? "text-sm font-semibold" : "text-sm",
            isActive(item.path)
              ? "bg-orange-50 text-[#FE5502] font-semibold"
              : "text-black hover:bg-gray-50",
            isCollapsed && "justify-center px-2"
          )}
          style={{ animationDelay: `${index * 0.05}s` }}
          title={isCollapsed ? item.label : undefined}
        >
          <Icon className={cn(
            "shrink-0 transition-all duration-300 text-left",
            isInSection ? "w-4 h-4" : "w-4 h-4",
            isActive(item.path) ? "text-[#FE5502] scale-110" : "text-black"
          )} />
          {!isCollapsed && (
            <div className="flex-1 flex items-center justify-between overflow-hidden">
              <span className={cn("text-left truncate", isInSection ? "font-semibold" : "font-medium")}>
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
                "w-full flex items-center justify-center px-2 py-2 rounded-lg transition-all duration-300 ease-out text-sm font-medium",
                "text-black hover:bg-gray-50"
              )}
              title={item.label}
            >
              <div className="relative">
                <Icon className="w-4 h-4 shrink-0 text-black transition-transform duration-300" />
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
              "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-all duration-300 ease-out text-sm font-medium text-left",
              "text-black hover:bg-gray-50"
            )}
          >
            <div className="flex items-center gap-2.5 text-left flex-1 min-w-0">
              <Icon className={cn("w-4 h-4 shrink-0 transition-transform duration-300", isExpanded ? "text-[#FE5502]" : "text-black")} />
              <span className="font-medium text-left truncate">{item.label}</span>
              {getBadgeCount(item.label, item.path) > 0 && (
                <span className="shrink-0 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 min-w-[18px] text-center">
                  {getBadgeCount(item.label, item.path) > 99 ? "99+" : getBadgeCount(item.label, item.path)}
                </span>
              )}
            </div>
            <div className="transition-transform duration-300 shrink-0" style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
              <ChevronDown className={cn("w-4 h-4 shrink-0 text-black")} />
            </div>
          </button>
          {isExpanded && item.subItems && (
            <div className="ml-5 mt-1 space-y-1 border-gray-100 pl-3 submenu-animate overflow-hidden">
              {item.subItems.map((subItem, subIndex) => {
                const allSubPaths = item.subItems.map(si => si.path)
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
                      "flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-300 ease-out text-sm font-normal text-left",
                      isActive(subItem.path, allSubPaths)
                        ? "bg-orange-50 text-[#FE5502] font-semibold"
                        : "text-black hover:bg-gray-50"
                    )}
                    style={{ animationDelay: `${subIndex * 0.03}s` }}
                  >
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-300",
                      isActive(subItem.path, allSubPaths) ? "bg-[#FE5502] scale-125" : "bg-gray-300"
                    )}></span>
                    <span className="text-left flex-1 truncate">{subItem.label}</span>
                    {getBadgeCount(subItem.label, subItem.path) > 0 && (
                      <span className="shrink-0 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 min-w-[18px] text-center">
                        {getBadgeCount(subItem.label, subItem.path) > 99 ? "99+" : getBadgeCount(subItem.label, subItem.path)}
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
          background: rgba(0, 0, 0, 0.02);
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
          scrollbar-color: rgba(0, 0, 0, 0.1) rgba(0, 0, 0, 0.02);
        }
      `}</style>
      <div
        className={cn(
          "bg-white border-r border-gray-100 h-screen fixed left-0 top-0 z-50 flex flex-col overflow-hidden",
          "transform transition-all duration-300 ease-in-out",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          isCollapsed ? "w-20" : "w-80"
        )}
      >
        {/* Header with Logo and Brand */}
        <div 
          className="shrink-0 px-3 py-3 border-b border-gray-100 bg-white animate-[fadeIn_0.4s_ease-out]"
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
                    <span className="text-xs font-semibold text-gray-900 px-2 truncate">
                      {companyName || "Appzeto"}
                    </span>
                  )}
                </div>
              </div>
            )}
            {isCollapsed && (
              <div className="w-full flex items-center justify-center">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shadow-lg shadow-black/20 ring-1 ring-white/10">
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
                    <span className="text-[10px] font-bold text-gray-900 uppercase">
                      {(companyName || "A")[0]}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleCollapse}
                className="text-gray-400 hover:text-gray-800 transition-all duration-200 hover:scale-110 p-1.5 rounded-lg hover:bg-gray-50"
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
                className="lg:hidden text-gray-400 hover:text-gray-800 transition-all duration-200 hover:scale-110"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Admin Panel Label */}
          {!isCollapsed && (
            <div className="mb-3 mt-5 lg:mt-0 animate-[slideIn_0.4s_ease-out_0.1s_both]">
              <h2 className="text-xs font-bold text-black uppercase tracking-wider text-left">
                ECS PANEL
              </h2>
              <div className="mt-2 rounded-xl border border-gray-100 bg-white shadow-sm p-1">
                <div className="grid grid-cols-2 gap-1">
                  {enabledModules.food && canAccessFoodModule && (
                    <button
                      key="food-module-btn"
                      type="button"
                      onClick={() => switchAdminModule("food")}
                      className={cn(
                        "rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all",
                        !isQuickAdmin && !isCommonAdmin
                          ? "bg-[#FE5502] text-white shadow"
                          : "text-gray-500 hover:text-gray-800"
                      )}
                    >
                      Food
                    </button>
                  )}
                  {enabledModules.quickCommerce && canAccessQuickModule && (
                    <button
                      key="quick-module-btn"
                      type="button"
                      onClick={() => switchAdminModule("quick")}
                      className={cn(
                        "rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all",
                        isQuickAdmin
                          ? "bg-[#FE5502] text-white shadow-[0_6px_20px_rgba(254,85,2,0.35)]"
                          : "text-gray-500 hover:text-gray-800"
                      )}
                    >
                      Quick
                    </button>
                  )}

                  {canAccessGlobalModule && (
                    <button
                      key="global-settings-btn"
                      type="button"
                      onClick={() => switchAdminModule("common")}
                      className={cn(
                        "rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all col-span-2",
                        isCommonAdmin
                          ? "bg-[#FE5502] text-white shadow-[0_6px_20px_rgba(254,85,2,0.35)]"
                          : "text-gray-500 hover:text-gray-800"
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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10 transition-colors duration-200" />
              <Input
                type="text"
                placeholder="Search Menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full pl-9 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FE5502]/40 focus:border-[#FE5502] transition-all duration-200 text-left",
                  searchQuery ? "pr-9" : "pr-3"
                )}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-800 transition-all duration-200 hover:scale-110 z-10"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="admin-sidebar-scroll flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-3 py-3 space-y-2">
          {filteredMenuData.length === 0 && searchQuery.trim() ? (
            <div className="px-3 py-12 text-left animate-[fadeIn_0.4s_ease-out]">
              <p className="text-gray-600 text-sm font-medium text-left">No menu items found</p>
              <p className="text-gray-400 text-sm mt-2 text-left">Try a different search term</p>
            </div>
          ) : (
            filteredMenuData.map((item, index) => {
              if (item.type === "link") {
                return renderMenuItem(item, index)
              }

              if (item.type === "section") {
                return (
                  <div
                    key={index}
                    className={cn(
                      index > 0 ? "mt-4 pt-4 border-t border-gray-100" : "",
                      "animate-[fadeIn_0.4s_ease-out]"
                    )}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {!isCollapsed && (
                      <div className="px-3 py-2 mb-2">
                        <span className="text-black font-bold text-xs uppercase tracking-wider text-left">
                          {item.label}
                        </span>
                      </div>
                    )}
                    <div className="space-y-1">
                      {item.items.map((subItem, subIndex) => renderMenuItem(subItem, `${index}-${subIndex}`, true))}
                    </div>
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

