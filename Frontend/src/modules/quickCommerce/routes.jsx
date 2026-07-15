import { Routes, Route, Navigate } from "react-router-dom"
import { Suspense, lazy } from "react"
import Loader from "@food/components/Loader"
import UserLayout from "./user/UserLayout"

// Lazy-load the new Blinkit-style pages
const Home = lazy(() => import("./user/pages/Home"))
const Cart = lazy(() => import("./user/pages/CartPage"))
const Orders = lazy(() => import("./user/pages/OrdersPage"))
const OrderDetail = lazy(() => import("./user/pages/OrderDetailPage"))
const Products = lazy(() => import("./user/pages/ProductsPage"))
const Categories = lazy(() => import("./user/pages/CategoriesPage"))
const CategoryProducts = lazy(() => import("./user/pages/CategoryProductsPage"))
const ProductDetail = lazy(() => import("./user/pages/ProductDetailPage"))
const Checkout = lazy(() => import("./user/pages/CheckoutPage"))
const Wallet = lazy(() => import("../Food/pages/user/Wallet"))
const Addresses = lazy(() => import("./user/pages/AddressesPage"))
const Support = lazy(() => import("./user/pages/SupportPage"))
const Search = lazy(() => import("./user/pages/SearchPage"))
const Wishlist = lazy(() => import("./user/pages/WishlistPage"))
const Transactions = lazy(() => import("./user/pages/OrderTransactionsPage"))
const Privacy = lazy(() => import("./user/pages/PrivacyPage"))
const About = lazy(() => import("./user/pages/AboutPage"))
const Terms = lazy(() => import("./user/pages/TermsPage"))

// Returns
const ReturnList = lazy(() => import("./user/pages/Returns/ReturnListPage"))
const ReturnDetail = lazy(() => import("./user/pages/Returns/ReturnDetailPage"))
const CreateReturn = lazy(() => import("./user/pages/Returns/CreateReturnPage"))

import { CartProvider } from "./user/context/CartContext"
import { LocationProvider } from "./user/context/LocationContext"
import { ProductDetailProvider } from "./user/context/ProductDetailContext"
import { WishlistProvider } from "./user/context/WishlistContext"
import { CartAnimationProvider } from "./user/context/CartAnimationContext"

// Inner routes component — kept separate so Suspense doesn't remount providers
function QuickCommerceInnerRoutes() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route element={<UserLayout />}>
          <Route index element={<Home />} />
          <Route path="home" element={<Home />} />
          <Route path="cart" element={<Cart />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:orderId" element={<OrderDetail />} />
          <Route path="products" element={<Products />} />
          <Route path="categories" element={<Categories />} />
          <Route path="categories/:categoryId" element={<CategoryProducts />} />
          <Route path="product/:productId" element={<ProductDetail />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="profile" element={<Navigate to="/profile?from=quick" replace />} />
          <Route path="profile/edit" element={<Navigate to="/profile/edit?from=quick" replace />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="addresses" element={<Addresses />} />
          <Route path="support" element={<Support />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="returns" element={<ReturnList />} />
          <Route path="returns/create/:orderId" element={<CreateReturn />} />
          <Route path="returns/:returnRequestId" element={<ReturnDetail />} />
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
