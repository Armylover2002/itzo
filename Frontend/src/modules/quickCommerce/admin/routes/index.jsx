import React, { Suspense } from "react"
import {
  Navigate,
  Route,
  Routes
} from "react-router-dom"
import Loader from "@food/components/Loader"

const Dashboard = React.lazy(() => import("../pages/Dashboard"))
const HeaderCategories = React.lazy(() => import("../pages/categories/HeaderCategories"))
const Level2Categories = React.lazy(() => import("../pages/categories/Level2Categories"))
const SubCategories = React.lazy(() => import("../pages/categories/SubCategories"))
const CategoryHierarchy = React.lazy(() => import("../pages/categories/CategoryHierarchy"))
const ProductManagement = React.lazy(() => import("../pages/ProductManagement"))
const ActiveSellers = React.lazy(() => import("../pages/ActiveSellers"))
const PendingSellers = React.lazy(() => import("../pages/PendingSellers"))
const SellerLocations = React.lazy(() => import("../pages/SellerLocations"))
const AdminWallet = React.lazy(() => import("../pages/AdminWallet"))
const WithdrawalRequests = React.lazy(() => import("../pages/WithdrawalRequests"))
const SellerTransactions = React.lazy(() => import("../pages/SellerTransactions"))
const CustomerManagement = React.lazy(() => import("../pages/CustomerManagement"))
const CustomerDetail = React.lazy(() => import("../pages/CustomerDetail"))
const OrdersList = React.lazy(() => import("../pages/OrdersList"))
const OrderDetail = React.lazy(() => import("../pages/OrderDetail"))
const SellerDetail = React.lazy(() => import("../pages/SellerDetail"))
const SupportTickets = React.lazy(() => import("../pages/SupportTickets"))
const ReviewModeration = React.lazy(() => import("../pages/ReviewModeration"))
const CouponManagement = React.lazy(() => import("../pages/CouponManagement"))
const BannerManagement = React.lazy(() => import("../pages/BannerManagement"))
const BillingCharges = React.lazy(() => import("../pages/BillingCharges"))
const QuickZoneSetup = React.lazy(() => import("../pages/ZoneSetup"))
const QuickAddZone = React.lazy(() => import("../pages/AddZone"))
const QuickViewZone = React.lazy(() => import("../pages/ViewZone"))
const SellerCommission = React.lazy(() => import("../pages/SellerCommission"))

const AdminReturnsList = React.lazy(() => import("../pages/AdminReturnsList"))
const AdminReturnDetail = React.lazy(() => import("../pages/AdminReturnDetail"))




function QuickCommerceAdminRoutesInner() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/categories" element={<Navigate to="/ecs/quick-commerce/categories/header" replace />} />
      <Route path="/categories/header" element={<HeaderCategories />} />
      <Route path="/categories/level2" element={<Level2Categories />} />
      <Route path="/categories/sub" element={<SubCategories />} />
      <Route path="/categories/hierarchy" element={<CategoryHierarchy />} />
      <Route path="/products" element={<ProductManagement />} />
      <Route path="/zone-setup" element={<QuickZoneSetup />} />
      <Route path="/zone-setup/add" element={<QuickAddZone />} />
      <Route path="/zone-setup/edit/:id" element={<QuickAddZone />} />
      <Route path="/zone-setup/view/:id" element={<QuickViewZone />} />
      <Route path="/sellers/active" element={<ActiveSellers />} />
      <Route path="/sellers/active/:id" element={<SellerDetail />} />
      <Route path="/sellers/commission" element={<SellerCommission />} />
      <Route path="/support-tickets" element={<SupportTickets />} />
      <Route path="/moderation" element={<ReviewModeration />} />
      <Route path="/banners" element={<BannerManagement />} />
      <Route path="/coupons" element={<CouponManagement />} />
      <Route path="/sellers/pending" element={<PendingSellers />} />
      <Route path="/seller-locations" element={<SellerLocations />} />
      <Route path="/wallet" element={<AdminWallet />} />
      <Route path="/withdrawals" element={<WithdrawalRequests />} />
      <Route path="/seller-transactions" element={<SellerTransactions />} />
      <Route path="/customers" element={<CustomerManagement />} />
      <Route path="/customers/:id" element={<CustomerDetail />} />
      <Route path="/orders/:status" element={<OrdersList />} />
      <Route path="/orders/view/:orderId" element={<OrderDetail />} />
      <Route path="/billing" element={<BillingCharges />} />
      
      {/* Returns Management */}
      <Route path="/returns" element={<AdminReturnsList />} />
      <Route path="/returns/:id" element={<AdminReturnDetail />} />

      <Route path="*" element={<Navigate to="/ecs/quick-commerce" replace />} />
    </Routes>
  )
}

export default function QuickCommerceAdminRoutes() {
  return (
    <Suspense fallback={<Loader />}>
      <QuickCommerceAdminRoutesInner />
    </Suspense>
  )
}
