import { Suspense, lazy, useEffect } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import { loadBusinessSettings, setAppType } from "@common/utils/businessSettings"
import ProtectedRoute from "@food/components/ProtectedRoute"
import SubscriptionGate from "@common/components/SubscriptionGate"
import Loader from "@food/components/Loader"
import { LiveLocationProvider } from "@food/contexts/LiveLocationContext"
import RestaurantPageShell from "@food/components/restaurant/RestaurantPageShell"

// Lazy Loading Components
const AllOrdersPage = lazy(() => import("@food/pages/restaurant/AllOrdersPage"))
const RestaurantNotifications = lazy(() => import("@food/pages/restaurant/Notifications"))
const OrderDetails = lazy(() => import("@food/pages/restaurant/OrderDetails"))
const OrdersMain = lazy(() => import("@food/pages/restaurant/OrdersMain"))
const RestaurantDashboard = lazy(() => import("@food/pages/restaurant/RestaurantDashboard"))
const RestaurantOnboarding = lazy(() => import("@food/pages/restaurant/Onboarding"))
const TermsAndConditionsPage = lazy(() => import("@food/pages/restaurant/TermsAndConditionsPage"))
const PrivacyPolicyPage = lazy(() => import("@food/pages/restaurant/PrivacyPolicyPage"))
const SupportPolicyPage = lazy(() => import("@food/pages/restaurant/SupportPolicyPage"))
const MenuCategoriesPage = lazy(() => import("@food/pages/restaurant/MenuCategoriesPage"))
const RestaurantStatus = lazy(() => import("@food/pages/restaurant/RestaurantStatus"))
const ExploreMore = lazy(() => import("@food/pages/restaurant/ExploreMore"))
const DeliverySettings = lazy(() => import("@food/pages/restaurant/DeliverySettings"))
const RushHour = lazy(() => import("@food/pages/restaurant/RushHour"))
const OutletTimings = lazy(() => import("@food/pages/restaurant/OutletTimings"))
const DaySlots = lazy(() => import("@food/pages/restaurant/DaySlots"))
const OutletInfo = lazy(() => import("@food/pages/restaurant/OutletInfo"))
const RatingsReviews = lazy(() => import("@food/pages/restaurant/RatingsReviews"))
const EditOwner = lazy(() => import("@food/pages/restaurant/EditOwner"))
const EditRestaurantAddress = lazy(() => import("@food/pages/restaurant/EditRestaurantAddress"))
const Inventory = lazy(() => import("@food/pages/restaurant/Inventory"))
const Feedback = lazy(() => import("@food/pages/restaurant/Feedback"))
const ShareFeedback = lazy(() => import("@food/pages/restaurant/ShareFeedback"))
const DishRatings = lazy(() => import("@food/pages/restaurant/DishRatings"))
const RestaurantSupport = lazy(() => import("@food/pages/restaurant/RestaurantSupport"))
const FssaiDetails = lazy(() => import("@food/pages/restaurant/FssaiDetails"))
const FssaiUpdate = lazy(() => import("@food/pages/restaurant/FssaiUpdate"))
const Hyperpure = lazy(() => import("@food/pages/restaurant/Hyperpure"))
const ItemDetailsPage = lazy(() => import("@food/pages/restaurant/ItemDetailsPage"))
const HubFinance = lazy(() => import("@food/pages/restaurant/HubFinance"))
const WalletPage = lazy(() => import("@food/pages/restaurant/WalletPage"))
const FinanceDetailsPage = lazy(() => import("@food/pages/restaurant/FinanceDetailsPage"))
const WithdrawalHistoryPage = lazy(() => import("@food/pages/restaurant/WithdrawalHistoryPage"))
const DownloadReport = lazy(() => import("@food/pages/restaurant/DownloadReport"))
const RestaurantProfilePage = lazy(() => import("@food/pages/restaurant/RestaurantProfilePage"))
const RestaurantReferEarn = lazy(() => import("@food/pages/restaurant/RestaurantReferEarn"))
const BusinessPlanPage = lazy(() => import("@food/pages/restaurant/BusinessPlanPage"))
const LiveLocationControl = lazy(() => import("@food/pages/restaurant/LiveLocationControl"))
const VendorMoveLocation = lazy(() => import("@food/pages/restaurant/VendorMoveLocation"))

const ManageOutlets = lazy(() => import("@food/pages/restaurant/ManageOutlets"))
const UpdateBankDetails = lazy(() => import("@food/pages/restaurant/UpdateBankDetails"))
const ZoneSetup = lazy(() => import("@food/pages/restaurant/ZoneSetup"))
const DiningReservations = lazy(() => import("@food/pages/restaurant/DiningReservations"))
const CouponListPage = lazy(() => import("@food/pages/restaurant/CouponListPage"))
const Welcome = lazy(() => import("@food/pages/restaurant/auth/Welcome"))
const Login = lazy(() => import("@food/pages/restaurant/auth/Login"))
const OTP = lazy(() => import("@food/pages/restaurant/auth/OTP"))
const Signup = lazy(() => import("@food/pages/restaurant/auth/Signup"))
const ForgotPassword = lazy(() => import("@food/pages/restaurant/auth/ForgotPassword"))
const VerificationPending = lazy(() => import("@food/pages/restaurant/auth/VerificationPending"))

export default function RestaurantRouter() {
  useEffect(() => {
    // Initialize restaurant app settings and favicon
    setAppType('restaurant')
    loadBusinessSettings()
  }, [])

  return (
    <div className="restaurant-theme">
    <LiveLocationProvider>
      <Suspense fallback={<Loader />}>
        <Routes>
          {/* Auth Routes */}
          <Route path="welcome" element={<Welcome />} />
          <Route path="login" element={<Login />} />
          <Route path="otp" element={<OTP />} />
          <Route path="signup" element={<Signup />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="pending-verification" element={<VerificationPending />} />

          {/* Protected Routes */}
          <Route element={<Navigate to="dashboard" replace />} path="" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><RestaurantDashboard /></RestaurantPageShell></ProtectedRoute>} path="dashboard" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><OrdersMain /></RestaurantPageShell></ProtectedRoute>} path="orders/all" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><AllOrdersPage /></RestaurantPageShell></ProtectedRoute>} path="orders/history" />
          <Route path="onboarding" element={<RestaurantOnboarding />} />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><RestaurantNotifications /></RestaurantPageShell></ProtectedRoute>} path="notifications" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><OrderDetails /></RestaurantPageShell></ProtectedRoute>} path="orders/:orderId" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><DeliverySettings /></RestaurantPageShell></ProtectedRoute>} path="delivery-settings" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><RushHour /></RestaurantPageShell></ProtectedRoute>} path="rush-hour" />
          <Route path="terms" element={<TermsAndConditionsPage />} />
          <Route path="privacy" element={<PrivacyPolicyPage />} />
          <Route path="support-policy" element={<SupportPolicyPage />} />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><MenuCategoriesPage /></RestaurantPageShell></ProtectedRoute>} path="menu-categories" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><CouponListPage /></RestaurantPageShell></ProtectedRoute>} path="promo-codes" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><RestaurantStatus /></RestaurantPageShell></ProtectedRoute>} path="status" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><ExploreMore /></RestaurantPageShell></ProtectedRoute>} path="explore" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><OutletTimings /></RestaurantPageShell></ProtectedRoute>} path="outlet-timings" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><DaySlots /></RestaurantPageShell></ProtectedRoute>} path="outlet-timings/:day" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><OutletInfo /></RestaurantPageShell></ProtectedRoute>} path="outlet-info" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><RatingsReviews /></RestaurantPageShell></ProtectedRoute>} path="ratings-reviews" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><EditOwner /></ProtectedRoute>} path="edit-owner" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><EditRestaurantAddress /></ProtectedRoute>} path="edit-address" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><Inventory /></RestaurantPageShell></ProtectedRoute>} path="inventory" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><Feedback /></RestaurantPageShell></ProtectedRoute>} path="feedback" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><ShareFeedback /></RestaurantPageShell></ProtectedRoute>} path="share-feedback" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><DishRatings /></ProtectedRoute>} path="dish-ratings" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><RestaurantSupport /></RestaurantPageShell></ProtectedRoute>} path="help-centre/support" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><FssaiDetails /></ProtectedRoute>} path="fssai" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><FssaiUpdate /></ProtectedRoute>} path="fssai/update" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><Hyperpure /></ProtectedRoute>} path="hyperpure" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><ItemDetailsPage /></ProtectedRoute>} path="hub-menu/item/:id" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><HubFinance /></ProtectedRoute>} path="hub-finance" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><SubscriptionGate userType="RESTAURANT" redirectTo="/food/restaurant"><WalletPage /></SubscriptionGate></ProtectedRoute>} path="wallet" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><WithdrawalHistoryPage /></RestaurantPageShell></ProtectedRoute>} path="withdrawal-history" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><FinanceDetailsPage /></RestaurantPageShell></ProtectedRoute>} path="finance-details" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><DownloadReport /></ProtectedRoute>} path="download-report" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><ManageOutlets /></ProtectedRoute>} path="manage-outlets" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><UpdateBankDetails /></RestaurantPageShell></ProtectedRoute>} path="update-bank-details" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><DiningReservations /></ProtectedRoute>} path="reservations" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantPageShell><ZoneSetup /></RestaurantPageShell></ProtectedRoute>} path="zone-setup" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantProfilePage /></ProtectedRoute>} path="profile" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><SubscriptionGate userType="RESTAURANT" redirectTo="/food/restaurant"><BusinessPlanPage /></SubscriptionGate></ProtectedRoute>} path="business-plan" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><RestaurantReferEarn /></ProtectedRoute>} path="refer-earn" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><LiveLocationControl /></ProtectedRoute>} path="live-location" />
          <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"><VendorMoveLocation /></ProtectedRoute>} path="move-location" />
          <Route path="*" element={<Navigate to="/food/restaurant" replace />} />
        </Routes>
      </Suspense>
    </LiveLocationProvider>
    </div>
  )
}
