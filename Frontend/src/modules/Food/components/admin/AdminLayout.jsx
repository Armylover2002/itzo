import { useState, useEffect } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { loadBusinessSettings, setAppType } from "@common/utils/businessSettings"
import AdminSidebar from "./AdminSidebar"
import AdminNavbar from "./AdminNavbar"
import { API_BASE_URL } from "@food/api/config"
import { ShieldAlert } from "lucide-react"
import { getCurrentUser } from "@food/utils/auth"
import { useMemo } from "react"
import { useAuth } from "@core/context/AuthContext"
import { canAccessAdminPath, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions, getAdminModuleConfig, getFirstAccessibleAdminPath, isSuperAdminUser } from "@food/utils/adminPermissions"
import { adminSidebarMenu } from "@food/utils/adminSidebarMenu"
import { quickAdminSidebarMenu } from "@food/utils/quickAdminSidebarMenu"
import { commonAdminSidebarMenu } from "@food/utils/commonAdminSidebarMenu"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const user = useMemo(() => authUser || getCurrentUser("admin"), [authUser]);
  const [hasAccess, setHasAccess] = useState(true);
  const [resolvedPermissions, setResolvedPermissions] = useState({});

  useEffect(() => {
    let isMounted = true;

    const resolvePermissions = async () => {
      if (!user || isSuperAdminUser(user)) {
        if (isMounted) setResolvedPermissions({});
        return;
      }

      const existingPermissions = extractAdminPermissions(user);
      if (Object.keys(existingPermissions).length > 0) {
        if (isMounted) setResolvedPermissions(existingPermissions);
        return;
      }

      const roleId = extractAdminRoleId(user);
      if (!roleId) {
        if (isMounted) setResolvedPermissions({});
        return;
      }

      try {
        const rolePermissions = await fetchAdminRolePermissions(roleId);
        if (isMounted) setResolvedPermissions(rolePermissions);
      } catch {
        if (isMounted) setResolvedPermissions({});
      }
    };

    resolvePermissions();
    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || isSuperAdminUser(user)) {
      setHasAccess(true);
      return;
    }

    const allowed = canAccessAdminPath(user, resolvedPermissions, location.pathname);
    setHasAccess(allowed);
  }, [location.pathname, resolvedPermissions, user]);

  useEffect(() => {
    if (!user || isSuperAdminUser(user)) return;
    if (hasAccess) return;

    const { rootKey } = getAdminModuleConfig(location.pathname);
    const menu =
      rootKey === "quick"
        ? quickAdminSidebarMenu
        : rootKey === "global"
          ? commonAdminSidebarMenu
          : adminSidebarMenu;

    const fallbackPath = getFirstAccessibleAdminPath(menu, resolvedPermissions, rootKey);
    if (!fallbackPath) return;

    const normalizedCurrentPath = String(location.pathname || "").replace(/\/+$/, "");
    const normalizedFallbackPath = String(fallbackPath || "").replace(/\/+$/, "");

    if (normalizedCurrentPath !== normalizedFallbackPath) {
      navigate(fallbackPath, { replace: true });
    }
  }, [hasAccess, location.pathname, navigate, resolvedPermissions, user]);

  // Get initial collapsed state from localStorage to set initial margin
  useEffect(() => {
    // Initialize admin app settings and favicon
    setAppType('admin')
    loadBusinessSettings()

    try {
      const saved = localStorage.getItem('admin_sidebar_state')
      if (saved !== null) {
        const state = JSON.parse(saved)
        if (state && typeof state.isCollapsed !== 'undefined') {
          setIsSidebarCollapsed(state.isCollapsed)
        }
      }
    } catch (e) {
      debugError('Error loading sidebar collapsed state:', e)
    }
  }, [])

  const handleCollapseChange = (collapsed) => {
    setIsSidebarCollapsed(collapsed)
  }

  return (
    <div className="admin-theme h-screen bg-neutral-200 flex overflow-hidden">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCollapseChange={handleCollapseChange}
      />

      {/* Main Content Area */}
      <div className={`
        flex-1 flex min-h-0 flex-col transition-all duration-300 ease-in-out min-w-0
        ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-80'}
      `}>
        {/* Top Navbar */}
        <AdminNavbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        {/* Backend disconnected banner */}
        {!API_BASE_URL && (
          <div className="w-full bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-sm text-amber-900">
            Backend disconnected. Data is not live.
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 min-h-0 w-full max-w-full overflow-x-hidden overflow-y-auto bg-neutral-100">
          <div style={{ marginLeft: '20px', padding: '20px 20px 48px 0px' }}>
            {!hasAccess ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-white rounded-2xl shadow-xs border border-gray-100 max-w-xl mx-auto my-12 animate-fade-in">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
                  <ShieldAlert className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h3>
                <p className="text-gray-500 max-w-md mb-6 text-sm">
                  You do not have permission to access this section. Please contact your administrator to request access.
                </p>
                <button
                  onClick={() => window.history.back()}
                  className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-semibold transition-all duration-200 shadow-xs"
                >
                  Go Back
                </button>
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

