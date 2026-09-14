import { useEffect, useRef } from "react";

/**
 * Keep extra WebView history so Flutter canGoBack() stays true (no native exit popup)
 * and device-back never leaves the current seller screen unexpectedly.
 */
export function useSellerBackGuard(onBack, { enabled = true } = {}) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const lockedHrefRef = useRef(
    typeof window !== "undefined" ? window.location.href : "",
  );

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;

    lockedHrefRef.current = window.location.href;

    const restoreStack = () => {
      const href = lockedHrefRef.current || window.location.href;
      try {
        window.history.pushState({ sellerNativeBackGuard: true }, "", href);
        window.history.pushState({ sellerNativeBackGuard: true }, "", href);
      } catch {
        // ignore
      }
    };

    restoreStack();

    const handlePopState = () => {
      restoreStack();
      onBackRef.current?.();
    };

    window.addEventListener("popstate", handlePopState, true);
    return () => {
      window.removeEventListener("popstate", handlePopState, true);
    };
  }, [enabled]);
}
