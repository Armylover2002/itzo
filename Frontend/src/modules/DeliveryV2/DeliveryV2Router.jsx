import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthPageGuard } from '@core/guards/RouteGuard';
import Loader from "@food/components/Loader";
import {
  subscribeBusinessSettings,
  getAppFavicon,
  setAppType,
  updateFavicon,
} from "@common/utils/businessSettings";

// Auth Pages (Lazy loaded)
const Welcome = lazy(() => import("./pages/auth/Welcome"))
const SignIn = lazy(() => import("./pages/auth/SignIn"))
const OTP = lazy(() => import("./pages/auth/OTP"))
const SignupStep1 = lazy(() => import("./pages/auth/SignupStep1"))
const SignupStep2 = lazy(() => import("./pages/auth/SignupStep2"))
const PendingVerification = lazy(() => import("./pages/auth/PendingVerification"))
const RejectedOnboarding = lazy(() => import("./pages/auth/RejectedOnboarding"))

// V2 Pages
import DeliveryHomeV2 from './pages/DeliveryHomeV2';
import { PayoutV2 } from './pages/pocket/PayoutV2';
import { PocketStatementV2 } from './pages/pocket/PocketStatementV2';
import { DeductionStatementV2 } from './pages/pocket/DeductionStatementV2';
import { LimitSettlementV2 } from './pages/pocket/LimitSettlementV2';
import { PocketBalanceV2 } from './pages/pocket/PocketBalanceV2';
import { CashLimitInfoV2 } from './pages/pocket/CashLimitInfoV2';
import { ProfileBankV2 } from './pages/profile/ProfileBankV2';
import { ProfileDocsV2 } from './pages/profile/ProfileDocsV2';
import { SupportTicketsV2 } from './pages/help/SupportTicketsV2';
import { CreateSupportTicketV2 } from './pages/help/CreateSupportTicketV2';
import { ViewSupportTicketV2 } from './pages/help/ViewSupportTicketV2';
import ShowIdCardV2 from './pages/help/ShowIdCardV2';
import { PocketDetailsV2 } from './pages/pocket/PocketDetailsV2';
import { ProfileDetailsV2 } from './pages/profile/ProfileDetailsV2';
import TermsAndConditionsV2 from './pages/TermsAndConditionsV2';
import PrivacyPolicyV2 from './pages/PrivacyPolicyV2';
import SupportInfoV2 from './pages/SupportInfoV2';
import NotificationsV2 from './pages/NotificationsV2';
import SubscriptionV2 from './pages/SubscriptionV2';
import DeliveryShell from './components/DeliveryShell';

const DeliveryV2Router = () => {
  const location = useLocation();

  useEffect(() => {
    setAppType("delivery");

    const applyDeliveryFavicon = () => {
      const deliveryFavicon = getAppFavicon("delivery");
      if (deliveryFavicon) {
        updateFavicon(deliveryFavicon);
      }
    };

    applyDeliveryFavicon();
    return subscribeBusinessSettings(() => applyDeliveryFavicon());
  }, []);

  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        {/* Auth routes — redirect to home if already logged in */}
        <Route path="welcome" element={<AuthPageGuard module="delivery" home="/food/delivery"><Welcome /></AuthPageGuard>} />
        <Route path="login" element={<AuthPageGuard module="delivery" home="/food/delivery"><SignIn /></AuthPageGuard>} />
        {/* Canonical auth path used by RouteGuard */}
        <Route path="auth/login" element={<AuthPageGuard module="delivery" home="/food/delivery"><SignIn /></AuthPageGuard>} />
        <Route path="otp" element={<AuthPageGuard module="delivery" home="/food/delivery"><OTP /></AuthPageGuard>} />
        <Route path="signup" element={<Navigate to={`/food/delivery/login${location.search}`} replace />} />
        <Route path="signup/details" element={<SignupStep1 />} />
        <Route path="signup/documents" element={<SignupStep2 />} />
        <Route path="verification" element={<PendingVerification />} />
        <Route path="onboarding/rejected" element={<RejectedOnboarding />} />
        <Route path="terms" element={<TermsAndConditionsV2 />} />
        <Route path="privacy" element={<PrivacyPolicyV2 />} />
        <Route path="support" element={<SupportInfoV2 />} />

        {/* Protected routes share one shell so tab switches do not remount sockets. */}
        <Route element={<ProtectedRoute><DeliveryShell /></ProtectedRoute>}>
          <Route path="/" element={<DeliveryHomeV2 tab="feed" />} />
          <Route path="/feed" element={<DeliveryHomeV2 tab="feed" />} />
          <Route path="/pocket" element={<DeliveryHomeV2 tab="pocket" />} />
          <Route path="/history" element={<DeliveryHomeV2 tab="history" />} />
          <Route path="/profile" element={<DeliveryHomeV2 tab="profile" />} />
          <Route path="/notifications" element={<NotificationsV2 />} />
          <Route path="/profile/details" element={<ProfileDetailsV2 />} />
          <Route path="/profile/bank" element={<ProfileBankV2 />} />
          <Route path="/profile/documents" element={<ProfileDocsV2 />} />
          <Route path="/subscription" element={<SubscriptionV2 />} />

          {/* Support Systems */}
          <Route path="/help/tickets" element={<SupportTicketsV2 />} />
          <Route path="/help/tickets/create" element={<CreateSupportTicketV2 />} />
          <Route path="/help/tickets/:ticketId" element={<ViewSupportTicketV2 />} />
          <Route path="/help/id-card" element={<ShowIdCardV2 />} />
          <Route path="/profile/terms" element={<TermsAndConditionsV2 />} />
          <Route path="/profile/privacy" element={<PrivacyPolicyV2 />} />
          <Route path="/profile/support" element={<SupportInfoV2 />} />

          {/* Financial Deep-Pages */}
          <Route path="/pocket/payout" element={<PayoutV2 />} />
          <Route path="/pocket/statement" element={<PocketStatementV2 />} />
          <Route path="/pocket/deductions" element={<DeductionStatementV2 />} />
          <Route path="/pocket/limit-settlement" element={<LimitSettlementV2 />} />
          <Route path="/pocket/balance" element={<PocketBalanceV2 />} />
          <Route path="/pocket/cash-limit" element={<CashLimitInfoV2 />} />
          <Route path="/pocket/details" element={<PocketDetailsV2 />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/food/delivery" replace />} />
      </Routes>
    </Suspense>
  );
};

export default DeliveryV2Router;
