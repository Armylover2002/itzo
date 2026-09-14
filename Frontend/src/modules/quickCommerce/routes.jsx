import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { Suspense, lazy } from "react"
import Loader from "@food/components/Loader"
import ProtectedRoute from "@food/components/ProtectedRoute"
import UserLayout from "./user/UserLayout"
import Home from "./user/pages/Home"

import QuickErrorBoundary from "./user/components/shared/QuickErrorBoundary"
import OrderDetail from "./user/pages/OrderDetailPage"
import { CartProvider } from "./user/context/CartContext"
import { LocationProvider } from "./user/context/LocationContext"
import { ProductDetailProvider } from "./user/context/ProductDetailContext"
import { WishlistProvider } from "./user/context/WishlistContext"
import { CartAnimationProvider } from "./user/context/CartAnimationContext"

const Cart = lazy(() => import("./user/pages/CartPage"))
const Orders = lazy(() => import("./user/pages/OrdersPage"))
const ReturnRequest = lazy(() => import("./user/pages/ReturnRequestPage"))
const Products = lazy(() => import("./user/pages/ProductsPage"))
const Categories = lazy(() => import("./user/pages/CategoriesPage"))
const CategoryProducts = lazy(() => import("./user/pages/CategoryProductsPage"))
const ProductDetail = lazy(() => import("./user/pages/ProductDetailPage"))
const Checkout = lazy(() => import("./user/pages/CheckoutPage"))
const Wallet = lazy(() => import("../Food/pages/user/Wallet"))
const Addresses = lazy(() => import("./user/pages/AddressesPage"))
const Search = lazy(() => import("./user/pages/SearchPage"))
const Wishlist = lazy(() => import("./user/pages/WishlistPage"))
const Transactions = lazy(() => import("./user/pages/OrderTransactionsPage"))
const Privacy = lazy(() => import("./user/pages/PrivacyPage"))
const About = lazy(() => import("./user/pages/AboutPage"))
const Terms = lazy(() => import("./user/pages/TermsPage"))
const ShopByStore = lazy(() => import("./user/pages/ShopByStorePage"))

// Inner routes component — kept separate so Suspense doesn't remount providers
function QuickCommerceInnerRoutes() {
  const location = useLocation();
  return (
    <QuickErrorBoundary resetKey={location.pathname} locationKey={location.key}>
      <Suspense fallback={<Loader />}>
        <Routes>
        <Route element={<UserLayout />}>
          <Route index element={<Home />} />
          <Route path="home" element={<Home />} />
          <Route path="cart" element={<Cart />} />
          <Route path="orders" element={<ProtectedRoute requiredRole="user" loginPath="/user/auth/login"><Orders /></ProtectedRoute>} />
          <Route path="orders/:orderId" element={<ProtectedRoute requiredRole="user" loginPath="/user/auth/login"><OrderDetail /></ProtectedRoute>} />
          <Route path="orders/:orderId/return" element={<ProtectedRoute requiredRole="user" loginPath="/user/auth/login"><ReturnRequest /></ProtectedRoute>} />
          <Route path="products" element={<Products />} />
          <Route path="shop" element={<ShopByStore />} />
          <Route path="categories" element={<Categories />} />
          <Route path="categories/:categoryId" element={<CategoryProducts />} />
          {/* Legacy footer/deep links used /quick/category/:idOrSlug */}
          <Route path="category/:categoryId" element={<CategoryProducts />} />
          <Route path="product/:productId" element={<ProductDetail />} />
          <Route path="checkout" element={<ProtectedRoute requiredRole="user" loginPath="/user/auth/login"><Checkout /></ProtectedRoute>} />
          <Route path="profile" element={<Navigate to="/profile?from=quick" replace />} />
          <Route path="profile/edit" element={<Navigate to="/profile/edit?from=quick" replace />} />
          <Route path="wallet" element={<ProtectedRoute requiredRole="user" loginPath="/user/auth/login"><Wallet /></ProtectedRoute>} />
          <Route path="addresses" element={<ProtectedRoute requiredRole="user" loginPath="/user/auth/login"><Addresses /></ProtectedRoute>} />
          <Route path="wishlist" element={<ProtectedRoute requiredRole="user" loginPath="/user/auth/login"><Wishlist /></ProtectedRoute>} />
          <Route path="transactions" element={<ProtectedRoute requiredRole="user" loginPath="/user/auth/login"><Transactions /></ProtectedRoute>} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="about" element={<About />} />
          <Route path="terms" element={<Terms />} />
          <Route path="search" element={<Search />} />
          <Route path="user" element={<Navigate to="/quick" replace />} />
          <Route path="user/*" element={<Navigate to="/quick" replace />} />
        </Route>

        {/* Redirects */}
        <Route path="*" element={<Navigate to="/quick" replace />} />
      </Routes>
    </Suspense>
    </QuickErrorBoundary>
  );
}

export default function QuickCommerceRoutes() {
  return (
    <CartProvider>
      <LocationProvider>
        <WishlistProvider>
          <CartAnimationProvider>
            <ProductDetailProvider>
              <QuickCommerceInnerRoutes />
            </ProductDetailProvider>
          </CartAnimationProvider>
        </WishlistProvider>
      </LocationProvider>
    </CartProvider>
  );
}
