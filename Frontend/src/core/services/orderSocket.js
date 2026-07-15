import { io } from "socket.io-client";

let socket = null;

function socketBaseUrl() {
  const env = import.meta.env.VITE_SOCKET_URL;
  if (env) return env.replace(/\/$/, "");
  const api =
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api/v1";
  return api.replace(/\/api(?:\/v\d+)?\/?$/, "");
}

/**
 * Singleton Socket.IO client with JWT auth.
 */
export function getOrderSocket(getToken) {
  const token = typeof getToken === "function" ? getToken() : getToken;
  if (!token) {
    console.warn('[orderSocket] No token available, cannot connect');
    return null;
  }

  if (!socket || !socket.connected) {
    console.log('[orderSocket] Creating new Socket.IO connection to:', socketBaseUrl());
    socket = io(socketBaseUrl(), {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('[orderSocket] Socket connected, ID:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[orderSocket] Socket disconnected, reason:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('[orderSocket] Socket connection error:', error);
    });
  } else {
    console.log('[orderSocket] Reusing existing socket connection, ID:', socket.id);
  }
  
  return socket;
}

export function disconnectOrderSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinOrderRoom(orderId, getToken) {
  const s = getOrderSocket(getToken);
  if (!s || !orderId) return;
  s.emit("join_order", orderId);
  s.emit("join-tracking", orderId);
}

export function leaveOrderRoom(orderId, getToken) {
  const s = getOrderSocket(getToken);
  if (!s || !orderId) return;
  s.emit("leave_order", orderId);
  s.emit("leave-tracking", orderId);
}

export function onOrderStatusUpdate(getToken, handler) {
  const s = getOrderSocket(getToken);
  if (!s || typeof handler !== "function") return () => {};
  s.on("order:status:update", handler);
  s.on("order_status_update", handler);
  return () => {
    s.off("order:status:update", handler);
    s.off("order_status_update", handler);
  };
}

export function onDeliveryBroadcast(getToken, handler) {
  const s = getOrderSocket(getToken);
  if (!s || typeof handler !== "function") return () => {};
  s.on("delivery:broadcast", handler);
  return () => s.off("delivery:broadcast", handler);
}

export function onDeliveryBroadcastWithdrawn(getToken, handler) {
  const s = getOrderSocket(getToken);
  if (!s || typeof handler !== "function") return () => {};
  s.on("delivery:broadcast:withdrawn", handler);
  return () => s.off("delivery:broadcast:withdrawn", handler);
}

export function onSellerOrderNew(getToken, handler) {
  const s = getOrderSocket(getToken);
  if (!s || typeof handler !== "function") return () => {};
  s.on("order:new", handler);
  return () => s.off("order:new", handler);
}

export function onCustomerOtp(getToken, handler) {
  const s = getOrderSocket(getToken);
  if (!s || typeof handler !== "function") return () => {};
  s.on("order:otp", handler);
  s.on("delivery_drop_otp", handler);
  return () => {
    s.off("order:otp", handler);
    s.off("delivery_drop_otp", handler);
  };
}

export function onDeliveryOtpGenerated(getToken, handler) {
  const s = getOrderSocket(getToken);
  if (!s || typeof handler !== "function") {
    console.warn('[orderSocket] onDeliveryOtpGenerated: Socket not available or invalid handler');
    return () => {};
  }
  
  console.log('[orderSocket] Registering delivery:otp:generated listener');
  
  const wrappedHandler = (payload) => {
    console.log('[orderSocket] delivery:otp:generated event received:', payload);
    handler(payload);
  };
  
  s.on("delivery:otp:generated", wrappedHandler);
  return () => {
    console.log('[orderSocket] Unregistering delivery:otp:generated listener');
    s.off("delivery:otp:generated", wrappedHandler);
  };
}

export function onDeliveryOtpValidated(getToken, handler) {
  const s = getOrderSocket(getToken);
  if (!s || typeof handler !== "function") {
    console.warn('[orderSocket] onDeliveryOtpValidated: Socket not available or invalid handler');
    return () => {};
  }
  
  console.log('[orderSocket] Registering delivery:otp:validated listener');
  
  const wrappedHandler = (payload) => {
    console.log('[orderSocket] delivery:otp:validated event received:', payload);
    handler(payload);
  };
  
  s.on("delivery:otp:validated", wrappedHandler);
  return () => {
    console.log('[orderSocket] Unregistering delivery:otp:validated listener');
    s.off("delivery:otp:validated", wrappedHandler);
  };
}
export function onOrderCancelled(getToken, handler) {
  const s = getOrderSocket(getToken);
  if (!s || typeof handler !== "function") return () => {};
  s.on("order_cancelled", handler);
  s.on("order:cancelled", handler);
  return () => {
    s.off("order_cancelled", handler);
    s.off("order:cancelled", handler);
  };
}

export function onSellerReturnUpdate(getToken, handler) {
  const s = getOrderSocket(getToken);
  if (!s || typeof handler !== "function") return () => {};
  s.on("seller_return_update", handler);
  return () => {
    s.off("seller_return_update", handler);
  };
}
