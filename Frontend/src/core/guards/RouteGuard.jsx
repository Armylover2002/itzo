import { Navigate, useLocation } from 'react-router-dom'
import { getCurrentUser, isModuleAuthenticated, isRestaurantPendingApproval } from '@food/utils/auth'

/**
 * MODULE ROUTE MAP
 * Har route prefix ka sahi module aur uska home path yahan define hai.
 * Pattern check karne ka order important hai — specific pehle, general baad mein.
 */
const MODULE_ROUTES = [
  // Admin portals
  { prefix: '/ecs',             module: 'admin',        home: '/ecs/food',          loginPath: '/ecs/login' },
  // Quick commerce seller
  { prefix: '/seller',            module: 'seller',       home: '/seller',              loginPath: '/seller/auth' },
  // Delivery partner
  { prefix: '/food/delivery',     module: 'delivery',     home: '/food/delivery',       loginPath: '/food/delivery/auth/login' },
  // Restaurant panel
  { prefix: '/food/restaurant',   module: 'restaurant',   home: '/food/restaurant',     loginPath: '/food/restaurant/auth/sign-in' },
  // User (food)
  { prefix: '/food/user',         module: 'user',         home: '/food/user',           loginPath: '/user/auth/login' },
  // Quick commerce user
  { prefix: '/quick',             module: 'user',         home: '/quick',               loginPath: '/user/auth/login' },
]

/**
 * Auth pages jinpar already-logged-in users ko nahi jaane dena chahiye.
 * Key = route prefix, value = us route ka module name
 */
const AUTH_PAGES = [
  { prefix: '/ecs/login',                         module: 'admin',       home: '/ecs/food' },
  { prefix: '/ecs/signup',                        module: 'admin',       home: '/ecs/food' },
  { prefix: '/ecs/forgot-password',               module: 'admin',       home: '/ecs/food' },
  { prefix: '/seller/auth',                         module: 'seller',      home: '/seller' },
  { prefix: '/food/restaurant/auth/sign-in',        module: 'restaurant',  home: '/food/restaurant' },
  { prefix: '/food/restaurant/login',               module: 'restaurant',  home: '/food/restaurant' },
  { prefix: '/food/restaurant/signup',              module: 'restaurant',  home: '/food/restaurant' },
  { prefix: '/food/restaurant/forgot-password',     module: 'restaurant',  home: '/food/restaurant' },
  { prefix: '/food/restaurant/otp',                 module: 'restaurant',  home: '/food/restaurant' },
  { prefix: '/food/restaurant/welcome',             module: 'restaurant',  home: '/food/restaurant' },
  { prefix: '/food/delivery/auth',                  module: 'delivery',    home: '/food/delivery' },
  { prefix: '/user/auth/login',                     module: 'user',        home: '/food/user' },
  { prefix: '/user/auth/register',                  module: 'user',        home: '/food/user' },
  { prefix: '/user/auth/otp',                       module: 'user',        home: '/food/user' },
]

/**
 * RouteGuard — Do kaam karta hai:
 *
 * 1. AUTH PAGE GUARD (alreadyLoggedIn redirect):
 *    Agar koi admin/restaurant/delivery/user APNE login page par jaaye jab wo already
 *    logged in hai, to usse seedha apne home page par bhej do.
 *
 * 2. PORTAL GUARD (cross-portal block):
 *    Agar koi galat role ka user kisi doosre portal ka protected route access karne ki
 *    koshish kare (e.g., restaurant ki token se /ecs/* jaana), to usse apne home par bhej do.
 *    Agar koi bhi logged in nahi hai, to usse us portal ke login page par bhejo.
 *
 * Usage:
 *   <RouteGuard>
 *     <YourComponent />
 *   </RouteGuard>
 *
 * Ya seedha route mein:
 *   element={<RouteGuard module="admin" loginPath="/ecs/login"><AdminPage /></RouteGuard>}
 */
export default function RouteGuard({ children, module: forcedModule, loginPath: forcedLoginPath }) {
  const location = useLocation()
  const pathname = location.pathname

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 1: AUTH PAGE CHECK — already logged in? redirect to home
  // ──────────────────────────────────────────────────────────────────────────
  const matchedAuthPage = AUTH_PAGES.find(ap => pathname.startsWith(ap.prefix))
  if (matchedAuthPage && isModuleAuthenticated(matchedAuthPage.module)) {
    return <Navigate to={matchedAuthPage.home} replace />
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 2: PORTAL GUARD — forced module (explicit usage in routes)
  // ──────────────────────────────────────────────────────────────────────────
  if (forcedModule) {
    if (!isModuleAuthenticated(forcedModule)) {
      const lp = forcedLoginPath || MODULE_ROUTES.find(r => r.module === forcedModule)?.loginPath || '/user/auth/login'
      return <Navigate to={lp} state={{ from: location }} replace />
    }

    // Logged in, but do other logged-in modules also have wrong role?
    // Cross-portal check: if I'm trying to access admin but I'm only restaurant-auth'd
    const wrongPortal = detectWrongPortal(pathname, forcedModule)
    if (wrongPortal) {
      return <Navigate to={wrongPortal} replace />
    }

    return <>{children}</>
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 3: AUTO-DETECT MODULE from current pathname
  // ──────────────────────────────────────────────────────────────────────────
  const routeConfig = MODULE_ROUTES.find(r => pathname.startsWith(r.prefix))
  if (!routeConfig) {
    // Not a portal route — let it render normally
    return <>{children}</>
  }

  const { module, home, loginPath } = routeConfig

  if (!isModuleAuthenticated(module)) {
    // Not authenticated for this module — go to login
    return <Navigate to={loginPath} state={{ from: location }} replace />
  }

  // Cross-portal: authenticated but for a different module?
  const wrongPortal = detectWrongPortal(pathname, module)
  if (wrongPortal) {
    return <Navigate to={wrongPortal} replace />
  }

  return <>{children}</>
}

/**
 * detectWrongPortal
 * Agar koi ek module (jaise "restaurant") ka token lekar doosre module (jaise "admin")
 * ka route access karne ki koshish kare, to usse uske correct home par bhejo.
 *
 * Returns: redirect path string | null
 */
function detectWrongPortal(pathname, allowedModule) {
  // All modules jinke tokens exist hain (excluding the allowed one)
  const ALL_MODULES = ['admin', 'restaurant', 'delivery', 'user', 'seller']

  for (const mod of ALL_MODULES) {
    if (mod === allowedModule) continue

    // Agar is module ki route pe koi jaane ki koshish kar raha hai
    const routeConf = MODULE_ROUTES.find(r => r.module === mod && pathname.startsWith(r.prefix))
    if (!routeConf) continue

    // Check: allowedModule authenticated hai? Agar han, cross-portal block karo
    if (isModuleAuthenticated(allowedModule)) {
      // Redirect the user back to their correct module home
      const correctHome = MODULE_ROUTES.find(r => r.module === allowedModule)?.home
      if (correctHome && correctHome !== pathname) {
        return correctHome
      }
    }
  }

  return null
}

/**
 * AuthPageGuard — Specifically sirf auth/login pages ke liye.
 * Agar user already logged in hai to home par redirect karo.
 *
 * Usage:
 *   <Route path="login" element={<AuthPageGuard module="admin" home="/ecs/food"><AdminLogin /></AuthPageGuard>} />
 */
export function AuthPageGuard({ children, module, home }) {
  if (isModuleAuthenticated(module)) {
    if (module === 'restaurant') {
      const user = getCurrentUser('restaurant')
      if (isRestaurantPendingApproval(user)) {
        return <Navigate to="/food/restaurant/pending-verification" replace />
      }
    }
    return <Navigate to={home} replace />
  }
  return <>{children}</>
}
