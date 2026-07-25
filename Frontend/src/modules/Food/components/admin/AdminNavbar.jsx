import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  Search,
  User,
  ChevronDown,
  UtensilsCrossed,
  LogOut,
  Settings,
  FileText,
  Package,
  Users,
  AlertCircle,
  ArrowRight,
  Building2,
  Utensils,
  Grid,
  PlusCircle,
  Bell,
  BellOff,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@food/components/ui/dropdown-menu";
import { Input } from "@food/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@food/components/ui/popover";

import { adminAPI } from "@food/api";
import { clearModuleAuth } from "@food/utils/auth";
import { 
  loadBusinessSettings, 
  getCachedSettings, 
  getCompanyName,
  getAppLogo 
} from "@common/utils/businessSettings";
import useAdminNotifications from "@food/hooks/useAdminNotifications";
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function AdminNavbar({ onMenuClick }) {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo('admin'));
  const [companyName, setCompanyName] = useState(() => getCompanyName());
  const searchInputRef = useRef(null);
  const { items: adminNotifications } = useAdminNotifications();

  // Load business settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const cached = getCachedSettings();
        if (cached) {
          const adminLogo = getAppLogo('admin');
          if (adminLogo) setLogoUrl(adminLogo);
          setCompanyName(getCompanyName());
        } else {
          const settings = await loadBusinessSettings();
          if (settings) {
            const adminLogo = getAppLogo('admin');
            if (adminLogo) setLogoUrl(adminLogo);
            setCompanyName(getCompanyName());
          }
        }
      } catch (error) {
        debugError('Error loading settings:', error);
      }
    };
    loadSettings();

    // Listen for business settings updates
    const handleSettingsUpdate = (e) => {
      const settings = e.detail || getCachedSettings();
      if (settings) {
        const adminLogo = getAppLogo('admin');
        if (adminLogo) setLogoUrl(adminLogo);
        setCompanyName(getCompanyName());
      }
    };
    window.addEventListener('businessSettingsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate);
  }, []);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('admin_recent_searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        setRecentSearches([]);
      }
    }
  }, []);

  // Universal Search logic
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length > 1) {
        setIsSearching(true);
        try {
          const response = await adminAPI.globalSearch(searchQuery);
          if (response?.data?.success) {
            setSearchResults(response.data.data || []);
          }
        } catch (error) {
          debugError('Error searching:', error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const groupedResults = useMemo(() => {
    const groups = {};
    searchResults.forEach((res) => {
      if (!groups[res.type]) groups[res.type] = [];
      groups[res.type].push(res);
    });
    return groups;
  }, [searchResults]);

  const handleResultClick = (result) => {
    // Save to recent searches
    const updatedRecent = [
      result.title,
      ...recentSearches.filter(s => s !== result.title)
    ].slice(0, 5);
    setRecentSearches(updatedRecent);
    localStorage.setItem('admin_recent_searches', JSON.stringify(updatedRecent));

    setSearchOpen(false);
    setSearchQuery("");
    navigate(result.path);
  };

  const handleRecentClick = (term) => {
    setSearchQuery(term);
  };

  const clearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem('admin_recent_searches');
  };

  // Load admin data from localStorage
  useEffect(() => {
    const loadAdminData = () => {
      try {
        const adminUserStr = localStorage.getItem('admin_user');
        if (adminUserStr) {
          const adminUser = JSON.parse(adminUserStr);
          setAdminData(adminUser);
        }
      } catch (error) {
        debugError('Error loading admin data:', error);
      }
    };

    loadAdminData();

    // Listen for auth changes
    const handleAuthChange = () => {
      loadAdminData();
    };
    window.addEventListener('adminAuthChanged', handleAuthChange);

    return () => {
      window.removeEventListener('adminAuthChanged', handleAuthChange);
    };
  }, []);

  // Keyboard shortcut for search (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen]);

  // Focus search input when modal opens
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [searchOpen]);

  // Handle logout
  const handleLogout = async () => {
    try {
      // Call backend logout API to clear refresh token cookie
      try {
        await adminAPI.logout();
      } catch (apiError) {
        // Continue with logout even if API call fails (network issues, etc.)
        debugWarn("Logout API call failed, continuing with local cleanup:", apiError);
      }

      // Clear admin authentication and preference data from localStorage
      clearModuleAuth('admin');
      localStorage.removeItem('admin_accessToken');
      localStorage.removeItem('admin_authenticated');
      localStorage.removeItem('admin_user');
      localStorage.removeItem('admin_sidebar_state');
      localStorage.removeItem('admin_recent_searches');

      // Clear sessionStorage if any
      sessionStorage.removeItem('adminAuthData');

      // Dispatch auth change event to notify other components
      window.dispatchEvent(new Event('adminAuthChanged'));

      // Navigate to admin login page
      navigate('/ecs/login', { replace: true });
    } catch (error) {
      // Even if there's an error, we should still clear local data and logout
      debugError("Error during logout:", error);

      // Clear local data anyway
      clearModuleAuth('admin');
      localStorage.removeItem('admin_accessToken');
      localStorage.removeItem('admin_authenticated');
      localStorage.removeItem('admin_user');
      localStorage.removeItem('admin_sidebar_state');
      localStorage.removeItem('admin_recent_searches');
      sessionStorage.removeItem('adminAuthData');
      window.dispatchEvent(new Event('adminAuthChanged'));

      // Navigate to login
      navigate('/ecs/login', { replace: true });
    }
  };

  const notificationCount = adminNotifications.length;
  const openNotificationsPage = () => {
    setNotificationsOpen(false);
    navigate("/ecs/food/notifications");
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b border-neutral-200 shadow-sm">
        <div className="flex items-center justify-between px-3 md:px-6 py-3 gap-2">
          {/* Left: Logo and Mobile Menu */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 rounded-md text-neutral-700 hover:bg-neutral-100 hover:text-black transition-colors"
              aria-label="Toggle menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-24 h-12 rounded-lg bg-white flex items-center justify-center ring-neutral-200">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={companyName || "Company"}
                    className="w-24 h-10 object-contain"
                    loading="lazy"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <span className="text-sm font-semibold text-neutral-700 px-2 truncate">
                    {companyName || "Appzeto"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Center: Search Bar */}
          <div className="flex-1 flex justify-center max-w-md mx-2 md:mx-8">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-100 text-neutral-600 cursor-pointer hover:bg-neutral-200 transition-colors w-full border border-neutral-200"
            >
              <Search className="w-4 h-4 text-neutral-700" />
              <span className="text-sm flex-1 text-left text-neutral-700">Search</span>
              <span className="text-xs px-2 py-0.5 rounded bg-white text-neutral-600 border border-neutral-200 hidden sm:block">
                Ctrl+K
              </span>
            </button>
          </div>

          {/* Right: User Profile */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="relative h-11 w-11 rounded-full border border-neutral-200 bg-neutral-50 text-neutral-700 flex items-center justify-center hover:bg-neutral-100 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {notificationCount > 0 && (
                    <span className="absolute top-2 right-2 min-w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0 mt-2 border border-neutral-200 shadow-2xl rounded-2xl overflow-hidden" align="end">
                <div className="bg-white">
                  <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">Notifications</p>
                      <p className="text-xs text-neutral-500">Approval and support alerts</p>
                    </div>
                    <button
                      type="button"
                      onClick={openNotificationsPage}
                      className="text-xs font-semibold text-amber-600 hover:text-amber-700"
                    >
                      View all
                    </button>
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {adminNotifications.length === 0 ? (
                      <div className="px-6 py-10 text-center flex flex-col items-center gap-2">
                        <BellOff className="w-9 h-9 text-neutral-300" />
                        <p className="text-sm text-neutral-500">No notifications yet</p>
                      </div>
                    ) : (
                      adminNotifications.slice(0, 8).map((item) => (
                        <button
                          key={item?.id}
                          type="button"
                          onClick={openNotificationsPage}
                          className="w-full text-left px-4 py-4 border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-neutral-900 truncate">
                                {item?.title || "Notification"}
                              </p>
                              <p className="text-xs text-neutral-600 mt-1 line-clamp-2">
                                {item?.message || "-"}
                              </p>
                              <p className="text-[11px] text-neutral-400 mt-2">
                                {item?.metaLabel || item?.category || "ECS alert"}
                              </p>
                            </div>
                            <span className="shrink-0 text-[10px] text-neutral-400">
                              {item?.timeLabel || "Now"}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* User Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-2 pl-3 border-l border-neutral-200 cursor-pointer hover:bg-neutral-100 rounded-md px-2 py-1 transition-colors">

                  <div className="hidden md:block">
                    <p className="text-sm font-medium text-neutral-900">
                      {adminData?.name || "ECS User"}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {adminData?.email
                        ? (() => {
                          const [local, domain] = adminData.email.split("@");
                          return (
                            local[0] +
                            "*".repeat(Math.min(local.length - 1, 5)) +
                            "@" +
                            domain
                          );
                        })()
                        : "admin@example.com"}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-neutral-700 hidden md:block" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 text-neutral-900 animate-in fade-in-0 zoom-in-95 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
              >
                <div className="p-4 border-b border-neutral-200">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center overflow-hidden border border-neutral-300">
                      {adminData?.profileImage ? (
                        <img
                          src={
                            typeof adminData.profileImage === "string"
                              ? adminData.profileImage.trim() || undefined
                              : adminData.profileImage?.url || undefined
                          }
                          alt={adminData.name || "ECS"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-semibold text-neutral-600">
                          {adminData?.name
                            ? adminData.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .substring(0, 2)
                            : "AD"}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">
                        {adminData?.name || "ECS User"}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {adminData?.email
                          ? (() => {
                            const [local, domain] = adminData.email.split("@");
                            return (
                              local[0] +
                              "*".repeat(Math.min(local.length - 1, 5)) +
                              "@" +
                              domain
                            );
                          })()
                          : "admin@example.com"}
                      </p>
                    </div>
                  </div>
                </div>
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-neutral-100 focus:bg-neutral-100"
                    onClick={() => navigate("/ecs/food/profile")}
                  >
                    <User className="mr-2 w-4 h-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-neutral-100 focus:bg-neutral-100"
                    onClick={() => navigate("/ecs/food/settings")}
                  >
                    <Settings className="mr-2 w-4 h-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-red-600 hover:bg-red-50 focus:bg-red-50"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 w-4 h-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Search Modal */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-2xl p-0 bg-white opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 ease-in-out data-[state=open]:scale-100 data-[state=closed]:scale-100 border border-neutral-200">
          <DialogHeader className="p-6 pb-4 border-b border-neutral-200">
            <DialogTitle className="text-xl font-semibold text-neutral-900">
              Universal Search
            </DialogTitle>
          </DialogHeader>
          <div className="p-6">
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search orders, users, products, reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-3 text-base border-neutral-300 bg-white text-neutral-900 placeholder:text-neutral-500 focus:border-black focus:ring-black"
              />
            </div>

            {searchQuery.trim() === "" ? (
              <div className="space-y-4">
                <div className="text-sm text-neutral-500 mb-4">Quick Actions</div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Package, label: "Orders", path: "/ecs/food/orders/all" },
                    { icon: Users, label: "Users", path: "/ecs/food/customers" },
                    { icon: AlertCircle, label: "Recovery Requests", path: "/ecs/food/recovery-requests" },
                    { icon: UtensilsCrossed, label: "Products", path: "/ecs/food/foods" },
                    { icon: FileText, label: "Reports", path: "/ecs/food/transaction-report" },
                  ].map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSearchOpen(false);
                        navigate(action.path);
                      }}
                      className="flex items-center gap-3 p-4 rounded-lg border border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50 transition-all"
                    >
                      <div className="p-2 rounded-md bg-black text-white">
                        <action.icon className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium text-neutral-900">{action.label}</span>
                    </button>
                  ))}
                </div>
                {recentSearches.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-neutral-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-neutral-500">Recent Searches</p>
                      <button onClick={clearRecent} className="text-[10px] text-red-500 hover:underline">Clear All</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((term, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleRecentClick(term)}
                          className="px-3 py-1 text-xs bg-neutral-100 hover:bg-neutral-200 rounded-full text-neutral-700 transition-colors"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {isSearching ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-3"></div>
                    <p className="text-sm text-neutral-500">Searching...</p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                    <p className="text-sm text-neutral-500">No results found for "{searchQuery}"</p>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-neutral-600 mb-3 ml-1">
                      {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} found
                    </div>
                    {Object.entries(groupedResults).map(([type, results]) => (
                      <div key={type} className="mb-4">
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                            {type}s
                          </span>
                          <div className="h-px flex-1 bg-neutral-100"></div>
                        </div>
                        <div className="space-y-2">
                          {results.map((result, idx) => (
                            <button
                              key={`${type}-${idx}`}
                              onClick={() => handleResultClick(result)}
                              className="w-full flex items-center gap-3 p-3 rounded-xl border border-neutral-100 hover:border-neutral-200 hover:bg-neutral-50 transition-all text-left group"
                            >
                              <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-500 group-hover:bg-white group-hover:text-black transition-colors">
                                {result.type === 'Order' && <Package className="w-5 h-5" />}
                                {result.type === 'User' && <User className="w-5 h-5" />}
                                {result.type === 'Restaurant' && <Building2 className="w-5 h-5" />}
                                {result.type === 'Product' && <Utensils className="w-5 h-5" />}
                                {result.type === 'Category' && <Grid className="w-5 h-5" />}
                                {result.type === 'Addon' && <PlusCircle className="w-5 h-5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-neutral-900 truncate">
                                  {result.title}
                                </p>
                                <p className="text-xs text-neutral-500 truncate mt-0.5">
                                  {result.description}
                                </p>
                              </div>
                              <ArrowRight className="w-4 h-4 text-neutral-300 group-hover:text-black group-hover:translate-x-0.5 transition-all" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

