import React, { Suspense, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "@shared/layout/DashboardLayout";
import { useAuth } from "@core/context/AuthContext";
import {
  clearSellerOnboardingResume,
  hasSellerLiveSession,
  hasSellerOnboardingResume,
  isNativeLikeShell,
} from "../utils/sellerSession";
import SellerLiveUpdates from "../components/SellerLiveUpdates";
import Orders from "../pages/Orders";
import {
  HiOutlineSquares2X2,
  HiOutlineCube,
  HiOutlineCurrencyDollar,
  HiOutlineUser,
  HiOutlineTruck,
  HiOutlineArchiveBox,
  HiOutlineChartBarSquare,
  HiOutlineCreditCard,
  HiOutlineMapPin,
  HiOutlineTag,
  HiOutlineInbox,
  HiOutlineQuestionMarkCircle,
} from "react-icons/hi2";

const Dashboard = React.lazy(() => import("../pages/Dashboard"));
const ProductManagement = React.lazy(
  () => import("../pages/ProductManagement"),
);
const StockManagement = React.lazy(() => import("../pages/StockManagement"));
const AddProduct = React.lazy(() => import("../pages/AddProduct"));
const Returns = React.lazy(() => import("../pages/Returns"));
const Earnings = React.lazy(() => import("../pages/Earnings"));
const Analytics = React.lazy(() => import("../pages/Analytics"));
const Transactions = React.lazy(() => import("../pages/Transactions"));
const DeliveryTracking = React.lazy(() => import("../pages/DeliveryTracking"));
const Profile = React.lazy(() => import("../pages/Profile"));
const Withdrawals = React.lazy(() => import("../pages/Withdrawals"));
const Onboarding = React.lazy(() => import("../pages/Onboarding"));
const PendingApproval = React.lazy(() => import("../pages/PendingApproval"));
const Coupons = React.lazy(() => import("../pages/Coupons"));
const SellerSupportPage = React.lazy(() => import("../pages/SellerSupportPage"));
const Notifications = React.lazy(() => import("../pages/Notifications"));

const navItems = [
  { label: "Dashboard", path: "/seller", icon: HiOutlineSquares2X2, end: true },
  { label: "Products", path: "/seller/products", icon: HiOutlineCube },
  { label: "Stock", path: "/seller/inventory", icon: HiOutlineArchiveBox },
  { label: "Orders", path: "/seller/orders", icon: HiOutlineTruck },
  { label: "Returns", path: "/seller/returns", icon: HiOutlineArchiveBox },
  { label: "Track Orders", path: "/seller/tracking", icon: HiOutlineMapPin },
  {
    label: "Sales Reports",
    path: "/seller/analytics",
    icon: HiOutlineChartBarSquare,
  },
  {
    label: "Money Request",
    path: "/seller/withdrawals",
    icon: HiOutlineCurrencyDollar,
  },
  {
    label: "Payment History",
    path: "/seller/transactions",
    icon: HiOutlineCreditCard,
  },
  {
    label: "Coupons",
    path: "/seller/coupons",
    icon: HiOutlineTag,
  },
  {
    label: "Earnings",
    path: "/seller/earnings",
    icon: HiOutlineCurrencyDollar,
  },
  { label: "Profile", path: "/seller/profile", icon: HiOutlineUser },
  { label: "Notifications", path: "/seller/notifications", icon: HiOutlineInbox },
  { label: "Help Center", path: "/seller/support", icon: HiOutlineQuestionMarkCircle },
];

const Loader = () => (
  <div className="flex min-h-[50vh] items-center justify-center font-black text-slate-600">
    Loading seller workspace...
  </div>
);

const SellerWorkspace = () => (
  <DashboardLayout navItems={navItems} title="Seller Panel">
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="products" element={<ProductManagement />} />
      <Route path="products/add" element={<AddProduct />} />
      <Route path="inventory" element={<StockManagement />} />
      <Route path="orders" element={<Orders />} />
      <Route path="returns" element={<Returns />} />
      <Route path="tracking" element={<DeliveryTracking />} />
      <Route path="analytics" element={<Analytics />} />
      <Route path="transactions" element={<Transactions />} />
      <Route path="earnings" element={<Earnings />} />
      <Route path="withdrawals" element={<Withdrawals />} />
      <Route path="coupons" element={<Coupons />} />
      <Route path="profile" element={<Profile />} />
      <Route path="notifications" element={<Notifications />} />
      <Route path="support" element={<SellerSupportPage />} />
      <Route path="*" element={<Navigate to="/seller" replace />} />
    </Routes>
  </DashboardLayout>
);

const SellerAccessRouter = () => {
  const { user, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!isNativeLikeShell()) return;
    if (hasSellerLiveSession()) return;
    if (!hasSellerOnboardingResume()) return;
    logout({ keepSellerOnboardingDraft: true });
  }, [logout]);

  useEffect(() => {
    if (!user) return;
    const approved =
      user.approved !== false &&
      (!user.approvalStatus || user.approvalStatus === "approved");
    if (approved) {
      clearSellerOnboardingResume();
    }
  }, [user]);

  if (isLoading) {
    return <Loader />;
  }

  if (!user) {
    return <Navigate to="/seller/auth" replace />;
  }

  const approved =
    user.approved !== false &&
    (!user.approvalStatus || user.approvalStatus === "approved");
  const onboardingSubmitted = user.onboardingSubmitted === true;
  const requiresOnboarding =
    !approved && (!onboardingSubmitted || user.approvalStatus === "draft");

  return (
    <Routes>
      <Route
        path="onboarding"
        element={
          approved ? <Navigate to="/seller" replace /> : <Onboarding />
        }
      />
      <Route
        path="pending"
        element={
          approved ? (
            <Navigate to="/seller" replace />
          ) : onboardingSubmitted ? (
            <PendingApproval />
          ) : (
            <Navigate to="/seller/onboarding" replace />
          )
        }
      />
      <Route
        path="*"
        element={
          approved ? (
            <SellerWorkspace />
          ) : requiresOnboarding ? (
            <Navigate to="/seller/onboarding" replace />
          ) : (
            <Navigate to="/seller/pending" replace />
          )
        }
      />
    </Routes>
  );
};

const SellerRoutes = () => (
  <Suspense fallback={<Loader />}>
    <SellerLiveUpdates />
    <SellerAccessRouter />
  </Suspense>
);

export default SellerRoutes;
