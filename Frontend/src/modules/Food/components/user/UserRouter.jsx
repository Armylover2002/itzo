import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import UserLayout from "./UserLayout"
import { Suspense, lazy } from "react"
import Loader from "@food/components/Loader"
import ProtectedRoute from "@food/components/ProtectedRoute"

// Lazy Loading Pages

// Home & Discovery
const Home = lazy(() => import("../../pages/user/Home"))
const Under250 = lazy(() => import("@food/pages/user/Under250"))
const Categories = lazy(() => import("@food/pages/user/Categories"))
const CategoryPage = lazy(() => import("@food/pages/user/CategoryPage"))
const Restaurants = lazy(() => import("@food/pages/user/restaurants/Restaurants"))
const RestaurantDetails = lazy(() => import("@food/pages/user/restaurants/RestaurantDetails"))
const SearchResults = lazy(() => import("@food/pages/user/search/ProfessionalSearch"))
const ProductDetail = lazy(() => import("@food/pages/user/ProductDetail"))

// Cart
// Orders
const Orders = lazy(() => import("@food/pages/user/orders/Orders"))
const OrderTracking = lazy(() => import("@food/pages/user/orders/OrderTracking"))
const OrderInvoice = lazy(() => import("@food/pages/user/orders/OrderInvoice"))
const UserOrderDetails = lazy(() => import("@food/pages/user/orders/UserOrderDetails"))

// Offers
const Offers = lazy(() => import("@food/pages/user/Offers"))

// Gourmet
const Gourmet = lazy(() => import("@food/pages/user/Gourmet"))


// Collections
const Collections = lazy(() => import("@food/pages/user/Collections"))
const CollectionDetail = lazy(() => import("@food/pages/user/CollectionDetail"))



// Profile
const Profile = lazy(() => import("@food/pages/user/profile/Profile"))
const EditProfile = lazy(() => import("@food/pages/user/profile/EditProfile"))
const Payments = lazy(() => import("@food/pages/user/profile/Payments"))
const AddPayment = lazy(() => import("@food/pages/user/profile/AddPayment"))
const EditPayment = lazy(() => import("@food/pages/user/profile/EditPayment"))
const Favorites = lazy(() => import("@food/pages/user/profile/Favorites"))
const FoodWishlist = lazy(() => import("@food/pages/user/profile/FoodWishlist"))
const Support = lazy(() => import("@food/pages/user/profile/Support"))
const Coupons = lazy(() => import("@food/pages/user/profile/Coupons"))
const About = lazy(() => import("@food/pages/user/profile/About"))
const Terms = lazy(() => import("@food/pages/user/profile/Terms"))
const Privacy = lazy(() => import("@food/pages/user/profile/Privacy"))
const Refund = lazy(() => import("@food/pages/user/profile/Refund"))
const Shipping = lazy(() => import("@food/pages/user/profile/Shipping"))
const Cancellation = lazy(() => import("@food/pages/user/profile/Cancellation"))
const ReportSafetyEmergency = lazy(() => import("@food/pages/user/profile/ReportSafetyEmergency"))
const Accessibility = lazy(() => import("@food/pages/user/profile/Accessibility"))
const Logout = lazy(() => import("@food/pages/user/profile/Logout"))
const ReferEarn = lazy(() => import("@food/pages/user/profile/ReferEarn"))

// Auth
const SignIn = lazy(() => import("@food/pages/user/auth/SignIn"))
const OTP = lazy(() => import("@food/pages/user/auth/OTP"))
const AuthCallback = lazy(() => import("@food/pages/user/auth/AuthCallback"))

// Help
const Help = lazy(() => import("@food/pages/user/help/Help"))
const OrderHelp = lazy(() => import("@food/pages/user/help/OrderHelp"))

// Notifications
const Notifications = lazy(() => import("@food/pages/user/Notifications"))

// Wallet
const Wallet = lazy(() => import("@food/pages/user/Wallet"))

// Complaints
const SubmitComplaint = lazy(() => import("@food/pages/user/complaints/SubmitComplaint"))

export default function UserRouter() {
  const location = useLocation()
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route element={<UserLayout />}>
          {/* Home & Discovery */}
          <Route path="" element={<Home />} />
          <Route path="quick" element={<Navigate to="/quick" replace />} />
          <Route path="under-250" element={<Under250 />} />
          <Route path="categories" element={<Categories />} />
          <Route path="category/:category" element={<CategoryPage />} />
          <Route path="restaurants" element={<Restaurants />} />
          <Route path="restaurants/:slug" element={<RestaurantDetails />} />
          <Route path="search" element={<SearchResults />} />
          <Route path="product/:id" element={<ProductDetail />} />

          {/* Cart - canonicalized globally under /cart */}
          <Route path="cart" element={<Navigate to="/cart" replace />} />
          <Route path="cart/checkout" element={<Navigate to="/cart/checkout" replace />} />
          <Route path="cart/select-address" element={<Navigate to="/cart/select-address" replace />} />
          <Route path="address-selector" element={<Navigate to="/cart/address-selector" replace />} />
          <Route path="cart/address-selector" element={<Navigate to="/cart/address-selector" replace />} />

          {/* Orders - Protected (require user auth) */}
          <Route
            path="orders"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/login">
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route
            path="orders/:orderId"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/login">
                <OrderTracking />
              </ProtectedRoute>
            }
          />
          <Route
            path="orders/:orderId/invoice"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/login">
                <OrderInvoice />
              </ProtectedRoute>
            }
          />
          <Route
            path="orders/:orderId/details"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/login">
                <UserOrderDetails />
              </ProtectedRoute>
            }
          />

          {/* Offers */}
          <Route path="offers" element={<Offers />} />

          {/* Gourmet */}
          <Route path="gourmet" element={<Gourmet />} />


          {/* Collections */}
          <Route path="collections" element={<Collections />} />
          <Route path="collections/:id" element={<CollectionDetail />} />



          {/* Profile - Protected (require user auth) */}
          <Route
            path="profile"
            element={<Navigate to="/profile?from=food" replace />}
          />
          <Route
            path="profile/edit"
            element={<Navigate to="/profile/edit?from=food" replace />}
          />
          <Route
            path="profile/payments"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/login">
                <Payments />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile/payments/new"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/login">
                <AddPayment />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile/payments/:id/edit"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/login">
                <EditPayment />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile/favorites"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/login">
                <Favorites />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile/wishlist"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/login">
                <FoodWishlist />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile/support"
            element={<Navigate to="/profile/support?from=food" replace />}
          />
          <Route
            path="profile/coupons"
            element={<Navigate to="/profile/coupons?from=food" replace />}
          />
          <Route
            path="profile/about"
            element={<Navigate to="/profile/about?from=food" replace />}
          />

          <Route
            path="profile/report-safety-emergency"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/login">
                <ReportSafetyEmergency />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile/accessibility"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/login">
                <Accessibility />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile/logout"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/login">
                <Logout />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile/refer-earn"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/login">
                <ReferEarn />
              </ProtectedRoute>
            }
          />

          {/* Public Legal Policies (stay public) */}
          <Route path="profile/terms" element={<Terms />} />
          <Route path="profile/privacy" element={<Privacy />} />
          <Route path="profile/refund" element={<Refund />} />
          <Route path="profile/shipping" element={<Shipping />} />
          <Route path="profile/cancellation" element={<Cancellation />} />

          {/* Auth - User login is centralized at /user/auth/login */}
          <Route path="auth/login" element={<Navigate to={`/user/auth/login${location.search}`} replace />} />
          <Route path="auth/sign-in" element={<Navigate to={`/user/auth/login${location.search}`} replace />} />
          <Route path="auth/otp" element={<OTP />} />
          <Route path="auth/callback" element={<AuthCallback />} />

          {/* Help */}
          <Route path="help" element={<Help />} />
          <Route path="help/orders/:orderId" element={<OrderHelp />} />

          {/* Notifications - Protected (user auth) */}
          <Route
            path="notifications"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/login">
                <Notifications />
              </ProtectedRoute>
            }
          />

          {/* Wallet - Protected (user auth) */}
          <Route
            path="wallet"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/login">
                <Wallet />
              </ProtectedRoute>
            }
          />

          {/* Complaints - Protected (user auth) */}
          <Route
            path="complaints/submit/:orderId"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/login">
                <SubmitComplaint />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  )
}
