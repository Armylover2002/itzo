/**
 * Feature gate for Order Lifecycle SSOT consumers.
 * Default ON after Phase 1 regression + 10 scenarios passed.
 * Set VITE_ORDER_LIFECYCLE_SSOT=false to revert to legacy status maps instantly.
 */
export function isOrderLifecycleSsotEnabled() {
  try {
    const raw = String(import.meta.env?.VITE_ORDER_LIFECYCLE_SSOT ?? "true")
      .trim()
      .toLowerCase();
    if (raw === "0" || raw === "false" || raw === "no" || raw === "off") {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}
