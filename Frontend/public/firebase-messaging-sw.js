/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

const sanitize = (value) => String(value || "").trim().replace(/^['"]|['"]$/g, "");
const PUSH_DEBUG_PREFIX = "[push-sw]";
const pushDebugLog = () => { };
const getNotificationKey = (payload) =>
  payload?.data?.notificationId ||
  payload?.data?.messageId ||
  payload?.messageId ||
  [
    payload?.notification?.title || payload?.data?.title || "",
    payload?.notification?.body || payload?.data?.body || "",
    payload?.data?.orderId || "",
    payload?.data?.targetUrl || payload?.data?.link || "",
  ].join("::");

function getAudienceFromPayload(payload = {}) {
  const data = payload?.data || {};
  const explicit = String(data.audience || "").toLowerCase().trim();
  if (explicit) return explicit;

  const pushType = String(data.type || "").toLowerCase();
  if (pushType === "new_order") return "restaurant";
  if (pushType === "new_order_available" || pushType === "new_delivery") return "delivery";

  const title = String(payload?.notification?.title || data.title || "").toLowerCase();
  if (title.includes("new order received") || title.includes("quick delivery order")) {
    return "restaurant";
  }
  if (title.includes("delivery task") || title.includes("delivery order") || title.includes("return pickup")) {
    return "delivery";
  }

  const link = String(data.targetUrl || data.link || data.click_action || "").toLowerCase();
  if (link.includes("/restaurant") && !link.includes("/restaurants")) return "restaurant";
  if (link.includes("/delivery")) return "delivery";
  if (link.includes("/admin")) return "admin";
  if (link.includes("/seller")) return "seller";
  return "";
}

function getModuleFromPathname(pathname = "") {
  const path = String(pathname || "");
  if (path.includes("/restaurant") && !path.includes("/restaurants")) return "restaurant";
  if (path.includes("/delivery")) return "delivery";
  if (path.includes("/admin")) return "admin";
  if (path.includes("/seller")) return "seller";
  return "user";
}

function clientMatchesAudience(clientUrl, audience) {
  if (!audience) return true;
  try {
    const path = new URL(clientUrl).pathname;
    return getModuleFromPathname(path) === audience;
  } catch {
    return false;
  }
}

async function notifyOpenClients(payload) {
  const audience = getAudienceFromPayload(payload);
  pushDebugLog(PUSH_DEBUG_PREFIX, "Broadcasting push to matching clients only", {
    audience,
    type: payload?.data?.type,
  });
  const windowClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
  windowClients.forEach((client) => {
    if (!clientMatchesAudience(client.url, audience)) {
      return;
    }
    client.postMessage({
      type: "push-notification-received",
      payload,
    });
  });
}

function getTargetPathFromPayload(payload = {}) {
  const rawTarget =
    payload?.data?.targetUrl ||
    payload?.data?.link ||
    payload?.data?.click_action ||
    payload?.fcmOptions?.link ||
    "/";

  try {
    const url = new URL(rawTarget, self.location.origin);
    return url.pathname || "/";
  } catch {
    return "/";
  }
}

function clientMatchesPayloadAudience(client, audience, payload = {}) {
  if (audience) return clientMatchesAudience(client.url, audience);
  // Fallback: match by target path module when audience could not be inferred
  try {
    const targetPath = getTargetPathFromPayload(payload);
    const targetModule = getModuleFromPathname(targetPath);
    const clientModule = getModuleFromPathname(new URL(client.url).pathname);
    return targetModule === clientModule;
  } catch {
    return false;
  }
}

async function hasOpenClientForAudience(payload = {}) {
  const audience = getAudienceFromPayload(payload);
  const windowClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
  const matching = windowClients.find((client) =>
    clientMatchesPayloadAudience(client, audience, payload),
  );
  pushDebugLog(PUSH_DEBUG_PREFIX, "Open audience client check", {
    audience,
    hasOpenClient: Boolean(matching),
  });
  return Boolean(matching);
}

async function hasVisibleClientForAudience(payload = {}) {
  const audience = getAudienceFromPayload(payload);
  const windowClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
  const visibleClient = windowClients.find((client) => {
    const isVisible = client.visibilityState === "visible" || client.focused;
    if (!isVisible) return false;
    return clientMatchesPayloadAudience(client, audience, payload);
  });
  pushDebugLog(PUSH_DEBUG_PREFIX, "Visible audience client check", {
    audience,
    hasVisibleClient: Boolean(visibleClient),
  });
  return Boolean(visibleClient);
}

async function loadFirebaseWebConfig() {
  const candidates = [
    "/firebase-web-config.json",
    "/api/v1/food/public/env",
  ];
  for (const url of candidates) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const json = await response.json();
      const data = url.endsWith(".json") ? (json || {}) : ((json && json.data) || {});
      const config = {
        apiKey: sanitize(data.VITE_FIREBASE_API_KEY || data.FIREBASE_API_KEY),
        authDomain: sanitize(data.VITE_FIREBASE_AUTH_DOMAIN || data.FIREBASE_AUTH_DOMAIN),
        projectId: sanitize(data.VITE_FIREBASE_PROJECT_ID || data.FIREBASE_PROJECT_ID),
        appId: sanitize(data.VITE_FIREBASE_APP_ID || data.FIREBASE_APP_ID),
        messagingSenderId: sanitize(data.VITE_FIREBASE_MESSAGING_SENDER_ID || data.FIREBASE_MESSAGING_SENDER_ID),
        storageBucket: sanitize(data.VITE_FIREBASE_STORAGE_BUCKET || data.FIREBASE_STORAGE_BUCKET),
        measurementId: sanitize(data.VITE_FIREBASE_MEASUREMENT_ID || data.FIREBASE_MEASUREMENT_ID),
      };

      if (config.apiKey && config.projectId && config.appId && config.messagingSenderId) {
        pushDebugLog(PUSH_DEBUG_PREFIX, "Loaded Firebase web config");
        return config;
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

(async () => {
  const config = await loadFirebaseWebConfig();
  if (!config || !config.apiKey || !config.projectId || !config.appId || !config.messagingSenderId) {
    return;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(config);
  }
  pushDebugLog(PUSH_DEBUG_PREFIX, "Firebase messaging service worker initialized");
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(async (payload) => {
    pushDebugLog(PUSH_DEBUG_PREFIX, "Received Firebase background message", { payload });

    const audience = getAudienceFromPayload(payload);
    // CRITICAL: If ANY matching-role tab exists (even backgrounded / not focused),
    // do NOT show a system notification. OS notifications are global and would
    // appear while the User tab is focused — looking like the User app received
    // "New order received". Socket + page relay handle the restaurant/delivery tab.
    const openAudienceClient = await hasOpenClientForAudience(payload);
    const visibleClient = openAudienceClient
      ? await hasVisibleClientForAudience(payload)
      : false;

    if (!openAudienceClient) {
      const title = payload?.notification?.title || payload?.data?.title || "New Notification";
      const body = payload?.notification?.body || payload?.data?.body || "";
      const image =
        payload?.notification?.image ||
        payload?.data?.image ||
        payload?.data?.imageUrl ||
        undefined;
      const notificationKey = getNotificationKey(payload);

      pushDebugLog(PUSH_DEBUG_PREFIX, "Showing service worker notification", {
        title,
        body,
        image,
        notificationKey,
        audience,
        reason: "no matching-role client open",
      });

      self.registration.showNotification(title, {
        body,
        icon: "/favicon.ico",
        image,
        tag: notificationKey,
        renotify: false,
        silent: false,
        requireInteraction: false,
        vibrate: [200, 100, 200, 100, 300],
        data: {
          ...(payload?.data || {}),
          audience: audience || payload?.data?.audience || "",
        },
      });
    } else {
      pushDebugLog(PUSH_DEBUG_PREFIX, "Skipping OS notification — matching-role client already open", {
        audience,
        visibleClient,
      });
    }

    // Relay ONLY to matching-role tabs (never User when audience=restaurant).
    await notifyOpenClients(payload);
  });
})();

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    pushDebugLog(PUSH_DEBUG_PREFIX, "Received raw push event", { payload });
    // No client relay here. onBackgroundMessage handles delivery, and relaying in both
    // places can produce duplicate notifications in web clients.
    event.waitUntil(Promise.resolve());
  } catch {
    // Ignore malformed payloads.
  }
});

/**
 * Page → SW: show restaurant/delivery OS notification only when safe.
 * Suppresses when User/Admin (or any non-audience module) tab is visible so
 * User /cart never displays "Restaurant pickup request nearby".
 */
self.addEventListener("message", (event) => {
  const msg = event?.data;
  if (!msg || msg.type !== "show-actor-notification") return;

  event.waitUntil(
    (async () => {
      const audience = String(msg.audience || "").toLowerCase().trim();
      if (!audience) return;

      const windowClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const isVisible = (client) =>
        client.visibilityState === "visible" || client.focused;

      const foreignVisible = windowClients.some((client) => {
        if (!isVisible(client)) return false;
        try {
          const mod = getModuleFromPathname(new URL(client.url).pathname);
          return mod !== audience;
        } catch {
          return false;
        }
      });

      if (foreignVisible) {
        pushDebugLog(PUSH_DEBUG_PREFIX, "Skipping actor OS notification — another module tab is visible", {
          audience,
        });
        return;
      }

      const audienceVisible = windowClients.some(
        (client) => isVisible(client) && clientMatchesAudience(client.url, audience),
      );
      if (audienceVisible) {
        pushDebugLog(PUSH_DEBUG_PREFIX, "Skipping actor OS notification — audience tab already visible", {
          audience,
        });
        return;
      }

      const title = msg.title || "New notification";
      const body = msg.body || "";
      await self.registration.showNotification(title, {
        body,
        tag: msg.tag || undefined,
        renotify: true,
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200, 100, 300],
        icon: "/favicon.ico",
        data: {
          ...(msg.data || {}),
          audience,
        },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  pushDebugLog(PUSH_DEBUG_PREFIX, "Notification click received", {
    data: event?.notification?.data || {},
  });
  event.notification.close();
  const rawLink =
    event?.notification?.data?.link ||
    event?.notification?.data?.click_action ||
    event?.notification?.data?.targetUrl ||
    "/";
  const targetUrl = String(rawLink || "/").startsWith("/") ? String(rawLink || "/") : "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      const audience = String(event?.notification?.data?.audience || "").toLowerCase();
      const matching = audience
        ? windowClients.find((c) => clientMatchesAudience(c.url, audience))
        : windowClients.find((c) => c.url.includes(self.location.origin));
      if (matching) {
        matching.focus();
        return matching.navigate(targetUrl);
      }
      return clients.openWindow(targetUrl);
    }),
  );
});
