import { Navigate } from "react-router-dom";
import { useSubscriptionRequired } from "@common/hooks/useSubscriptionRequired";

/**
 * Route guard for subscription-only pages (Subscription Center, Business Plan,
 * Partner Subscription…).
 *
 * When the admin has switched the subscription requirement OFF for this partner
 * type, the page is not just hidden from the menu — it is unreachable by direct
 * URL too, and the partner is sent back to a safe landing route.
 *
 * Fails SAFE: while settings are unknown the page renders as before.
 *
 * @param {{ userType: 'DELIVERY_PARTNER'|'RESTAURANT', redirectTo: string, children: React.ReactNode }} props
 */
export default function SubscriptionGate({ userType, redirectTo, children }) {
  const subscriptionRequired = useSubscriptionRequired(userType);

  if (!subscriptionRequired) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}
