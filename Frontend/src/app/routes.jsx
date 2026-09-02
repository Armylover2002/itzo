import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Suspense, lazy, useEffect } from 'react'
import {
  AppShellSkeleton,
  AuthPortalSkeleton,
  ContentPageSkeleton,
} from '@food/components/ui/loading-skeletons'

import ProtectedRoute from '@core/guards/ProtectedRoute'
import RoleGuard from '@core/guards/RoleGuard'
import { UserRole } from '@core/constants/roles'
import SellerAuthPage from '../modules/seller/pages/Auth'
import ItzoFoodLanding from '../modules/Food/pages/landing/ItzoFoodLanding'

const PublicAboutPage = lazy(() => import('../modules/Food/pages/landing/pages/AboutUs'))
const PublicContactPage = lazy(() => import('../modules/Food/pages/landing/pages/ContactUs'))
const PublicConsultingPage = lazy(() => import('../modules/Food/pages/landing/pages/RestaurantConsulting'))
const PublicHelpSupportPage = lazy(() => import('../modules/Food/pages/landing/pages/HelpSupport'))
const NATIVE_LAST_ROUTE_KEY = 'native_last_route'

// Lazy load the Food service module (Quick-spicy app)
const FoodApp = lazy(() => import('../modules/Food/routes'))
const AuthApp = lazy(() => import('../modules/auth/routes'))
const QuickCommerceApp = lazy(() => import('../modules/quickCommerce/routes'))
const SellerApp = lazy(() => import('../modules/seller/routes'))
const HrmsEmployeeApp = lazy(() => import('../modules/hrms/routes/index.jsx'))


const FoodUserLayout = lazy(() => import('../modules/Food/components/user/UserLayout'))
const FoodHomePage = lazy(() => import('../modules/Food/pages/user/Home'))
const GlobalCartPage = lazy(() => import('../modules/Food/pages/user/cart/Cart'))
const GlobalCheckoutPage = lazy(() => import('../modules/Food/pages/user/cart/Checkout'))
const GlobalSelectAddressPage = lazy(() => import('../modules/Food/pages/user/cart/SelectAddress'))
const GlobalAddressSelectorPage = lazy(() => import('../modules/Food/pages/user/cart/AddressSelectorPage'))
const SharedProfilePage = lazy(() => import('../modules/Food/pages/user/profile/Profile'))
const SharedProfileEditPage = lazy(() => import('../modules/Food/pages/user/profile/EditProfile'))
const SharedProfileSupportPage = lazy(() => import('../modules/Food/pages/user/profile/Support'))
const SharedProfileCouponsPage = lazy(() => import('../modules/Food/pages/user/profile/Coupons'))
const SharedProfileAboutPage = lazy(() => import('../modules/Food/pages/user/profile/About'))
const SharedProfileTermsPage = lazy(() => import('../modules/Food/pages/user/profile/Terms'))
const SharedProfilePrivacyPage = lazy(() => import('../modules/Food/pages/user/profile/Privacy'))
const SharedProfileRefundPage = lazy(() => import('../modules/Food/pages/user/profile/Refund'))
const SharedProfileShippingPage = lazy(() => import('../modules/Food/pages/user/profile/Shipping'))
const SharedProfileCancellationPage = lazy(() => import('../modules/Food/pages/user/profile/Cancellation'))
const SharedProfileSupportPolicyPage = lazy(() => import('../modules/Food/pages/user/profile/SupportPolicy'))

const RouteAwarePageLoader = () => {
  const location = useLocation()
  const pathname = location.pathname || ''

  if (pathname.startsWith('/user/auth')) {
    return <AuthPortalSkeleton />
  }



  if (pathname.startsWith('/ecs')) {
    return <ContentPageSkeleton hero={false} />
  }

  return <AppShellSkeleton />
}
/**
 * FoodAppWrapper — Quick-spicy App. को /food prefix के साथ render करता है.
 * 
 * Quick-spicy की App.jsx में routes /restaurant, /usermain, /admin, /delivery
 * जैसे hain (bina /food prefix ke). Yahan hum useLocation se /food ke baad wala
 * path nikalne ke baad FoodApp render karte hain. FoodApp internally BrowserRouter
 * nahi use karta (sirf Routes use karta hai), isliye ye directly kaam karta hai.
 */
const FoodAppWrapper = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <FoodApp />
    </Suspense>
  )
}

const SharedFoodHomeRoute = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <FoodUserLayout>
        <FoodHomePage />
      </FoodUserLayout>
    </Suspense>
  )
}

const RedirectToFood = () => {
  const location = useLocation();
  // We safely replace the exact current pathname with a /food prefixed pathname
  // This effectively catches programmatic navigation to absolute paths like '/restaurant/login'
  // and turns them into '/food/restaurant/login'
  return <Navigate to={`/food${location.pathname}${location.search}`} replace />;
};

const RedirectLegacyQuickCommerce = () => {
  const location = useLocation();
  const suffix = location.pathname
    .replace(/^\/quick-commerce(?:\/user)?/, '');
  const normalizedSuffix = suffix && suffix !== '/' ? suffix : '';
  return (
    <Navigate
      to={`/quick${normalizedSuffix}${location.search}`}
      replace
    />
  );
};

const SellerAuthEntry = () => {
  return <div className="seller-theme"><SellerAuthPage /></div>
}

const SellerAppWrapper = () => {
  return (
    <div className="seller-theme">
      <Suspense fallback={<PageLoader />}>
        <ProtectedRoute>
          <RoleGuard allowedRoles={[UserRole.SELLER]}>
            <SellerApp />
          </RoleGuard>
        </ProtectedRoute>
      </Suspense>
    </div>
  )
}

const AdminRouter = lazy(() => import('../modules/Food/components/admin/AdminRouter'))

const AppRoutes = () => {
  const location = useLocation()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const protocol = String(window.location?.protocol || '').toLowerCase()
    const userAgent = String(window.navigator?.userAgent || '').toLowerCase()
    const isNativeLikeShell =
      Boolean(window.flutter_inappwebview) ||
      Boolean(window.ReactNativeWebView) ||
      protocol === 'file:' ||
      userAgent.includes(' wv') ||
      userAgent.includes('; wv')

    if (!isNativeLikeShell) return

    const route = `${location.pathname || ''}${location.search || ''}`
    if (route.startsWith('/food/') || route.startsWith('/ecs') || route.startsWith('/hrms') || route.startsWith('/seller')) {
      localStorage.setItem(NATIVE_LAST_ROUTE_KEY, route)
    }
  }, [location.pathname, location.search])

  return (
    <Routes>
        {/* Root now lands on the premium ItzoFood landing page */}
        <Route path="/" element={<ItzoFoodLanding />} />

        {/* Public Landing Pages */}
        <Route path="/about" element={
          <Suspense fallback={<PageLoader />}>
            <PublicAboutPage />
          </Suspense>
        } />
        <Route path="/contact" element={
          <Suspense fallback={<PageLoader />}>
            <PublicContactPage />
          </Suspense>
        } />
        <Route path="/consulting" element={
          <Suspense fallback={<PageLoader />}>
            <PublicConsultingPage />
          </Suspense>
        } />
        <Route path="/support" element={
          <Suspense fallback={<PageLoader />}>
            <PublicHelpSupportPage />
          </Suspense>
        } />
        {/* Auth Module */}
        <Route path="/user/auth/*" element={<AuthApp />} />
        {/* Portal redirect handles the post-login flow, now pointing to the authenticated dashboard */}
        <Route path="/portal" element={<Navigate to={`/food/user${location.search}`} replace />} />
        <Route path="/login" element={<Navigate to={`/user/auth/login${location.search}`} replace />} />

        {/* Shared home entry so /food/user <-> /quick doesn't remount through different app trees */}
        <Route path="/food/user" element={<SharedFoodHomeRoute />} />

        {/* Food Module */}
        <Route path="/food/*" element={<FoodAppWrapper />} />



        {/* Quick storefront landing keeps the shared food layout */}
        <Route path="/quick" element={<SharedFoodHomeRoute />} />

        {/* Global shared cart */}
        <Route
          element={
            <Suspense fallback={<PageLoader />}>
              <FoodUserLayout />
            </Suspense>
          }
        >
          <Route path="/cart" element={<GlobalCartPage />} />
          <Route path="/cart/checkout" element={<GlobalCheckoutPage />} />
          <Route path="/cart/select-address" element={<GlobalSelectAddressPage />} />
          <Route path="/cart/address-selector" element={<GlobalAddressSelectorPage />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute requiredRole="user">
                <SharedProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/edit"
            element={
              <ProtectedRoute requiredRole="user">
                <SharedProfileEditPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/support"
            element={
              <ProtectedRoute requiredRole="user">
                <SharedProfileSupportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/coupons"
            element={
              <ProtectedRoute requiredRole="user">
                <SharedProfileCouponsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/about"
            element={
              <ProtectedRoute requiredRole="user">
                <SharedProfileAboutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/terms"
            element={<SharedProfileTermsPage />}
          />
          <Route
            path="/profile/privacy"
            element={<SharedProfilePrivacyPage />}
          />
          <Route
            path="/profile/refund"
            element={<SharedProfileRefundPage />}
          />
          <Route
            path="/profile/shipping"
            element={<SharedProfileShippingPage />}
          />
          <Route
            path="/profile/cancellation"
            element={<SharedProfileCancellationPage />}
          />
          <Route
            path="/profile/support-policy"
            element={<SharedProfileSupportPolicyPage />}
          />
        </Route>

        {/* Quick storefront */}
        <Route
          path="/quick/*"
          element={
            <Suspense fallback={<PageLoader />}>
              <QuickCommerceApp />
            </Suspense>
          }
        />
        <Route path="/quick-commerce/*" element={<RedirectLegacyQuickCommerce />} />
        <Route path="/qc/*" element={<Navigate to="/quick" replace />} />



        {/* Seller Module */}
        <Route path="/seller/auth" element={<SellerAuthEntry />} />
        <Route path="/seller/*" element={<SellerAppWrapper />} />

        {/* HRMS Employee Portal */}
        <Route path="/hrms/*" element={
          <Suspense fallback={<PageLoader />}>
            <HrmsEmployeeApp />
          </Suspense>
        } />

        {/* Global Admin Portal - wrap lazy router in Suspense to avoid blank/crash on direct admin URLs */}
        <Route
          path="/ecs/*"
          element={
            <Suspense fallback={<PageLoader />}>
              <AdminRouter />
            </Suspense>
          }
        />
        
        {/* Dynamic intercept redirects for bare paths (accessed programmatically) */}
        <Route path="/user/*" element={<RedirectToFood />} />
        <Route path="/restaurant/*" element={<RedirectToFood />} />
        <Route path="/delivery/*" element={<RedirectToFood />} />
        <Route path="/usermain/*" element={<RedirectToFood />} />
        <Route path="/profile/*" element={<Navigate to="/profile" replace />} />
        <Route path="/orders/*" element={<RedirectToFood />} />

        {/* Fallback 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
  )
}

const PageLoader = () => <RouteAwarePageLoader />

export default AppRoutes
