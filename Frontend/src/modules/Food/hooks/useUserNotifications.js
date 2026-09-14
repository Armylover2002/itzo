import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { toast } from 'sonner';
import { API_BASE_URL } from '@food/api/config';
import { dispatchNotificationInboxRefresh } from '@food/hooks/useNotificationInbox';
import { getUserIdFromStorage } from '@food/utils/userSessionCache';
import { getLifecycleDisplay } from '@food/utils/orderLifecycleDisplay';

const debugLog = (...args) => {
  if (import.meta.env.DEV) {
    console.log('📬 [UserSocket]', ...args);
  }
};

/**
 * Hook for user to receive real-time order notifications.
 * Dispatches 'orderStatusNotification' custom event for OrderTrackingCard.
 */
export const useUserNotifications = () => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userId, setUserId] = useState(null);

  // Resolve user ID from localStorage — avoids extra /auth/me on every layout mount
  useEffect(() => {
    const storedId = getUserIdFromStorage();
    if (storedId) {
      setUserId(storedId);
      return;
    }

    const handleAuthChange = () => {
      const id = getUserIdFromStorage();
      if (id) setUserId(id);
    };

    window.addEventListener('userAuthChanged', handleAuthChange);
    return () => window.removeEventListener('userAuthChanged', handleAuthChange);
  }, []);

  useEffect(() => {
    if (!API_BASE_URL || !String(API_BASE_URL).trim()) {
      setIsConnected(false);
      return;
    }
    if (!userId) {
      return;
    }

    // Normalize backend URL
    let backendUrl = API_BASE_URL;
    try {
      backendUrl = new URL(backendUrl).origin;
    } catch {
      backendUrl = String(backendUrl || "")
        .replace(/\/api\/v\d+\/?$/i, "")
        .replace(/\/api\/?$/i, "")
        .replace(/\/+$/, "");
    }

    const socketUrl = `${backendUrl}`;
    
    // Auth token
    const token = localStorage.getItem('user_accessToken') || localStorage.getItem('accessToken');
    if (!token) return;

    debugLog('🔌 Connecting to User Socket.IO:', socketUrl);

    socketRef.current = io(socketUrl, {
      path: '/socket.io/',
      transports: ['polling', 'websocket'],
      reconnection: true,
      auth: { token }
    });

    socketRef.current.on('connect', () => {
      debugLog('✅ User Socket connected, userId:', userId);
      setIsConnected(true);

      if (typeof window !== 'undefined') window.orderSocketConnected = true;
      // Backend auto-joins 'user:userId' room based on role/token in config/socket.js
    });

    socketRef.current.on('order_status_update', (data) => {
      debugLog('🔔 Order status update received:', data);

      const life = getLifecycleDisplay(
        {
          orderStatus: data.orderStatus,
          status: data.orderStatus,
          deliveryState: data.deliveryState,
          dispatch: data.dispatch,
          orderId: data.orderId,
        },
        { audience: 'user' },
      );

      const title =
        data.title ||
        life?.title ||
        `Order #${data.orderId || 'Update'}`;
      const message =
        data.message ||
        life?.subtitle ||
        `Your order status is now ${String(data.orderStatus || '').replace(/_/g, ' ')}`;

      // Optional: Show toast for important updates (Cancel, Ready, etc.)
      const isImportant = String(data.orderStatus).includes('cancel') || ['ready_for_pickup', 'ready', 'confirmed'].includes(data.orderStatus);
      if (isImportant) {
        toast.success(title, {
          id: `order-status-${data.orderId}`,
          description: message,
          duration: 5000
        });
      }

      // Dispatch custom event for OrderTrackingCard and other listeners
      const event = new CustomEvent('orderStatusNotification', {
        detail: {
          orderMongoId: data.orderMongoId,
          orderId: data.orderId,
          status: data.orderStatus,
          orderStatus: data.orderStatus, // Ensure compatibility with different UI checks
          title,
          message,
          deliveryState: data.deliveryState,
          deliveryVerification: data.deliveryVerification,
          timestamp: new Date().toISOString()
        }
      });
      window.dispatchEvent(event);
    });

    /** Customer receives handover OTP when partner confirms "reached drop" (never shown to partner). */
    socketRef.current.on('delivery_drop_otp', (payload) => {
      debugLog('🔐 Delivery handover OTP:', payload?.orderId);
      const otp = payload?.otp != null ? String(payload.otp) : '';
      const orderId = payload?.orderId != null ? String(payload.orderId) : '';
      const message = payload?.message != null ? String(payload.message) : '';
      window.dispatchEvent(
        new CustomEvent('deliveryDropOtp', {
          detail: {
            orderMongoId: payload?.orderMongoId,
            orderId,
            otp,
            message
          }
        })
      );
      const title = orderId ? `Order ${orderId}` : 'Delivery OTP';
      const parts = [message, otp ? `OTP: ${otp}` : ''].filter(Boolean);
      toast.success(title, {
        id: `order-otp-${orderId}`,
        description: parts.join(' — ') || 'Handover OTP from your delivery partner.',
        duration: 20000
      });
    });

    socketRef.current.on('admin_notification', (payload) => {
      toast.message(payload?.title || 'Notification', {
        id: `admin-notif-${Date.now()}`,
        description: payload?.message || 'New broadcast notification received.',
        duration: 5000
      });
      dispatchNotificationInboxRefresh();
    });

    socketRef.current.on('connect_error', (error) => {
      if (import.meta.env.DEV) {
        // debugLog('❌ Socket connection error:', error.message);
      }
      setIsConnected(false);
      if (typeof window !== 'undefined') window.orderSocketConnected = false;
    });

    socketRef.current.on('disconnect', (reason) => {
      debugLog('🔌 Socket disconnected:', reason);
      setIsConnected(false);
      if (typeof window !== 'undefined') window.orderSocketConnected = false;
    });

    return () => {
      if (socketRef.current) {

        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [userId]);

  return { isConnected };
};
