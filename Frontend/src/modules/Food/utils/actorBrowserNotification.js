/**
 * Actor-scoped browser notifications (restaurant / delivery).
 *
 * OS notifications are origin-global. If Delivery/Restaurant call
 * registration.showNotification() while the User tab is focused, the User
 * "receives" that notification. Always route through the service worker so it
 * can suppress display when another module tab is visible.
 */

export function getModuleFromPathname(pathname = "") {
  const path = String(pathname || "");
  if (path.includes("/restaurant") && !path.includes("/restaurants")) return "restaurant";
  if (path.includes("/delivery")) return "delivery";
  if (path.includes("/ecs")) return "admin";
  if (path.includes("/seller")) return "seller";
  return "user";
}

/**
 * Ask the Firebase messaging SW to show an OS notification only when safe.
 * @param {{ audience: 'restaurant'|'delivery', title: string, body: string, tag?: string, data?: object }} options
 */
export async function showActorBrowserNotification(options = {}) {
  const audience = String(options.audience || "").toLowerCase().trim();
  const title = String(options.title || "New notification");
  const body = String(options.body || "");
  const tag = options.tag || undefined;
  const data = {
    ...(options.data && typeof options.data === "object" ? options.data : {}),
    audience,
  };

  if (!audience || typeof window === "undefined") return false;

  if (!("Notification" in window) || Notification.permission !== "granted") {
    return false;
  }

  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const worker = navigator.serviceWorker.controller || registration.active;
      if (worker) {
        worker.postMessage({
          type: "show-actor-notification",
          audience,
          title,
          body,
          tag,
          data,
        });
        return true;
      }

      // No controller yet — still avoid direct showNotification (cross-tab leak).
      return false;
    } catch {
      return false;
    }
  }

  return false;
}
