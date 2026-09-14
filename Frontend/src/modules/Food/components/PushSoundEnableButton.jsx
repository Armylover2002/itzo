import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { BellRing, Volume2 } from "lucide-react";
import { Button } from "@food/components/ui/button";
import { enablePushNotificationSound, isPushSoundEnabled } from "@food/utils/firebaseMessaging";

function isMobileDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent || "";
  const isMobileUserAgent = /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(userAgent);
  const isSmallViewport = window.matchMedia?.("(max-width: 768px)")?.matches;
  const isWebView =
    Boolean(window.ReactNativeWebView) ||
    Boolean(window.flutter_inappwebview) ||
    /\bwv\b|WebView/i.test(userAgent);

  return Boolean(isMobileUserAgent || isSmallViewport || isWebView);
}

export default function PushSoundEnableButton() {
  const location = useLocation();
  const [enabled, setEnabled] = useState(() => isPushSoundEnabled());
  const [permission, setPermission] = useState(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(() => isMobileDevice());
  const isAdminRoute = location.pathname.startsWith("/ecs");
  const shouldShowPrompt = useMemo(() => {
    if (isMobile) return false;
    if (isAdminRoute) return false;
    if (permission === "denied") return false;
    return permission !== "granted" || !enabled;
  }, [enabled, isAdminRoute, isMobile, permission]);

  useEffect(() => {
    const syncState = () => {
      setEnabled(isPushSoundEnabled());
      setIsMobile(isMobileDevice());
      setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    };

    window.addEventListener("push-sound-enabled", syncState);
    window.addEventListener("resize", syncState);

    return () => {
      window.removeEventListener("push-sound-enabled", syncState);
      window.removeEventListener("resize", syncState);
    };
  }, []);

  const handleEnable = async () => {
    setIsSubmitting(true);
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      const requestedPermission = await Notification.requestPermission();
      setPermission(requestedPermission);
      if (requestedPermission !== "granted") {
        setIsSubmitting(false);
        return;
      }
    }

    const success = await enablePushNotificationSound();
    setEnabled(success || isPushSoundEnabled());
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    setIsSubmitting(false);
  };

  if (!shouldShowPrompt) return null;

  const title = permission === "granted" ? "Enable push sound" : "Enable notifications";
  const description =
    permission === "granted"
      ? "Click once to allow notification sound in this browser."
      : "Allow browser notifications first, then sound will be enabled automatically.";
  const buttonLabel =
    permission === "granted"
      ? "Enable Sound"
      : "Allow Notifications";

  return (
    <div className="fixed bottom-4 right-4 z-[100] hidden max-w-[calc(100vw-2rem)] md:block">
      <div className="rounded-2xl border border-amber-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <BellRing className="h-4 w-4 text-amber-600" />
          {title}
        </div>
        <p className="mb-3 text-xs text-slate-600">
          {description}
        </p>
        <Button
          type="button"
          onClick={handleEnable}
          disabled={isSubmitting}
          className="h-9 w-full bg-slate-900 text-white hover:bg-slate-800"
        >
          <Volume2 className="mr-2 h-4 w-4" />
          {isSubmitting ? "Enabling..." : buttonLabel}
        </Button>
      </div>
    </div>
  );
}
