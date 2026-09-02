import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import SubscriptionGate from "@common/components/SubscriptionGate";
import Loader from "@food/components/Loader";
import {
  loadBusinessSettings,
  getCachedSettings,
  getAppFavicon,
  updateBrowserFavicon,
} from "@common/utils/businessSettings";

// Auth Pages (Lazy loaded)
const Welcome = lazy(() => import("./pages/auth/Welcome"))
const SignIn = lazy(() => import("./pages/auth/SignIn"))
const OTP = lazy(() => import("./pages/auth/OTP"))
const SignupStep1 = lazy(() => import("./pages/auth/SignupStep1"))
const SignupStep2 = lazy(() => import("./pages/auth/SignupStep2"))
const PendingVerification = lazy(() => import("./pages/auth/PendingVerification"))

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
import SupportPolicyV2 from './pages/SupportPolicyV2';
import NotificationsV2 from './pages/NotificationsV2';
import SubscriptionV2 from './pages/SubscriptionV2';
import DeliveryReturns from './pages/DeliveryReturns';

/**
 * Fallback landing spot whenever something in the reapply/onboarding flow can't
 * find its in-progress data (e.g. `sessionStorage` cleared mid-flow) and used to
 * unconditionally bounce the user to the login screen — a dead end for a rejected
 * delivery partner, since it discarded their rejection reason and the "Re-apply"
 * entry point. It now recovers whatever is available instead:
 *   1. A pending/rejected application phone -> back to the verification screen
 *      (shows the rejection reason again, with working Re-apply / New application
 *      buttons).
 *   2. Partially-filled onboarding details -> back into the signup form.
 *   3. Nothing at all -> login, same as before.
 */
const DeliverySignupEntry = () => {
  const location = useLocation();

  const pendingPhone =
    sessionStorage.getItem("deliveryPendingPhone") ||
    localStorage.getItem("deliveryPendingPhone");
  if (pendingPhone) {
    return <Navigate to="/food/delivery/verification" state={{ phone: pendingPhone }} replace />;
  }

  let hasSavedDetails = Boolean(sessionStorage.getItem("deliverySignupDetails"));
  if (!hasSavedDetails) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("deliverySignup_") && key.endsWith("_details")) {
          hasSavedDetails = true;
          break;
        }
      }
    } catch (_) {
      // localStorage unavailable — fall through to login below.
    }
  }
  if (hasSavedDetails) {
    return <Navigate to={`/food/delivery/signup/details${location.search}`} replace />;
  }

  return <Navigate to={`/food/delivery/login${location.search}`} replace />;
};

const DeliveryV2Router = () => {
  const location = useLocation();

  useEffect(() => {
    const applyDeliveryFavicon = () => {
      const deliveryFavicon = getAppFavicon("delivery");
      if (deliveryFavicon) {
        updateBrowserFavicon(deliveryFavicon);
      }
    };

    if (getCachedSettings()) {
      applyDeliveryFavicon();
    } else {
      loadBusinessSettings().then(() => applyDeliveryFavicon());
    }
  }, []);

  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        {/* Auth routes */}
        <Route path="welcome" element={<Welcome />} />
        <Route path="login" element={<SignIn />} />
        <Route path="otp" element={<OTP />} />
        <Route path="signup" element={<DeliverySignupEntry />} />
        <Route path="signup/details" element={<SignupStep1 />} />
        <Route path="signup/documents" element={<SignupStep2 />} />
        <Route path="verification" element={<PendingVerification />} />
        <Route path="terms" element={<TermsAndConditionsV2 />} />
        <Route path="privacy" element={<PrivacyPolicyV2 />} />
        <Route path="support-policy" element={<SupportPolicyV2 />} />

        {/* Protected Core Routes */}
        <Route path="/" element={<ProtectedRoute><DeliveryHomeV2 tab="feed" /></ProtectedRoute>} />
        <Route path="/feed" element={<ProtectedRoute><DeliveryHomeV2 tab="feed" /></ProtectedRoute>} />
        <Route path="/pocket" element={<ProtectedRoute><DeliveryHomeV2 tab="pocket" /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><DeliveryHomeV2 tab="history" /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><DeliveryHomeV2 tab="profile" /></ProtectedRoute>} />
        <Route path="/returns" element={<ProtectedRoute><DeliveryReturns /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationsV2 /></ProtectedRoute>} />
        <Route path="/profile/details" element={<ProtectedRoute><ProfileDetailsV2 /></ProtectedRoute>} />
        <Route path="/profile/bank" element={<ProtectedRoute><ProfileBankV2 /></ProtectedRoute>} />
        <Route path="/profile/documents" element={<ProtectedRoute><ProfileDocsV2 /></ProtectedRoute>} />
        <Route path="/subscription" element={<ProtectedRoute><SubscriptionGate userType="DELIVERY_PARTNER" redirectTo="/food/delivery"><SubscriptionV2 /></SubscriptionGate></ProtectedRoute>} />
        
        {/* Support Systems */}
        <Route path="/help/tickets" element={<ProtectedRoute><SupportTicketsV2 /></ProtectedRoute>} />
        <Route path="/help/tickets/create" element={<ProtectedRoute><CreateSupportTicketV2 /></ProtectedRoute>} />
        <Route path="/help/tickets/:ticketId" element={<ProtectedRoute><ViewSupportTicketV2 /></ProtectedRoute>} />
        <Route path="/help/id-card" element={<ProtectedRoute><ShowIdCardV2 /></ProtectedRoute>} />
        <Route path="/profile/terms" element={<ProtectedRoute><TermsAndConditionsV2 /></ProtectedRoute>} />
        <Route path="/profile/privacy" element={<ProtectedRoute><PrivacyPolicyV2 /></ProtectedRoute>} />
        
        {/* Financial Deep-Pages */}
        <Route path="/pocket/payout" element={<ProtectedRoute><PayoutV2 /></ProtectedRoute>} />
        <Route path="/pocket/statement" element={<ProtectedRoute><PocketStatementV2 /></ProtectedRoute>} />
        <Route path="/pocket/deductions" element={<ProtectedRoute><DeductionStatementV2 /></ProtectedRoute>} />
        <Route path="/pocket/limit-settlement" element={<ProtectedRoute><LimitSettlementV2 /></ProtectedRoute>} />
        <Route path="/pocket/balance" element={<ProtectedRoute><PocketBalanceV2 /></ProtectedRoute>} />
        <Route path="/pocket/cash-limit" element={<ProtectedRoute><CashLimitInfoV2 /></ProtectedRoute>} />
        <Route path="/pocket/details" element={<ProtectedRoute><PocketDetailsV2 /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/food/delivery" replace />} />
      </Routes>
    </Suspense>
  );
};

export default DeliveryV2Router;
