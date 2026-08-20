import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '@food/api/config';
import { restaurantAPI } from '@food/api';
import alertSound from '@food/assets/audio/alert.mp3';
import { dispatchNotificationInboxRefresh } from '@food/hooks/useNotificationInbox';
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const resolveAudioSource = (source, cacheKey = 'restaurant-alert') => {
  if (!source) return source;
  if (!import.meta.env.DEV) return source;
  const separator = source.includes('?') ? '&' : '?';
  return `${source}${separator}devcache=${cacheKey}`;
}

const supportsBrowserNotifications = () =>
  typeof window !== 'undefined' && typeof Notification !== 'undefined';

const buildRestaurantOrderNotification = (orderData = {}) => {
  const orderId = orderData.orderId || orderData.orderMongoId || 'New';
  const itemCount = Array.isArray(orderData.items) ? orderData.items.length : 0;
  const total = Number(orderData.total || orderData.pricing?.total || 0);

  return {
    title: `New order #${orderId}`,
    body: itemCount > 0
      ? `${itemCount} item${itemCount === 1 ? '' : 's'} - ₹${total.toFixed(2)}`
      : 'A new order is waiting for review',
    tag: `restaurant-order-${orderId}`,
    data: {
      orderId,
      targetUrl: `/restaurant/orders/${orderData.orderMongoId || orderData.orderId || ''}`,
    },
  };
}

const triggerWebViewNativeNotification = async (orderData = {}) => {
  if (typeof window === 'undefined') return false;

  const bridgePayload = {
    title: 'New restaurant order',
    body: `Order #${orderData?.orderId || orderData?.orderMongoId || orderData?.id || ''}`.trim(),
    orderId: orderData?.orderId || orderData?.order_id || '',
    orderMongoId: orderData?.orderMongoId || orderData?.order_mongo_id || '',
    targetUrl: `/restaurant/orders/${orderData?.orderMongoId || orderData?.orderId || ''}`,
  };

  try {
    if (
      window.flutter_inappwebview &&
      typeof window.flutter_inappwebview.callHandler === 'function'
    ) {
      const handlerNames = [
        'playNotificationSound',
        'triggerNotificationFeedback',
        'onPushNotification',
      ];

      for (const handlerName of handlerNames) {
        try {
          const result = await window.flutter_inappwebview.callHandler(handlerName, bridgePayload);
          if (result === true) {
            return true;
          }
        } catch {
          // Try next handler name.
        }
      }
    }
  } catch {
    // Ignore bridge failures and fall back to browser/web audio.
  }

  return false;
}


/**
 * Hook for restaurant to receive real-time order notifications with sound
 * @returns {object} - { newOrder, playSound, isConnected }
 */
export const useRestaurantNotifications = () => {
  const socketRef = useRef(null);
  const [newOrder, setNewOrder] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const audioRef = useRef(null);
  const activeOrderRef = useRef(null);
  const alertLoopTimerRef = useRef(null);
  const alertLoopStartedAtRef = useRef(0);
  const userInteractedRef = useRef(false); // Track user interaction for autoplay policy
  const audioUnlockAttemptedRef = useRef(false);
  const [restaurantId, setRestaurantId] = useState(null);
  const lastConnectErrorLogRef = useRef(0);
  const lastAlertAtByOrderRef = useRef(new Map());
  const lastBrowserNotificationAtByOrderRef = useRef(new Map());
  const CONNECT_ERROR_LOG_THROTTLE_MS = 10000;
  const ALERT_LOOP_INTERVAL_MS = 4500;
  const ALERT_LOOP_MAX_MS = 120000;
  const ALERT_DEDUPE_MS = 15000;
  const BROWSER_NOTIFICATION_DEDUPE_MS = 20000;
  const NOTIFICATION_PERMISSION_ASKED_KEY = 'restaurant_notification_permission_asked';

  const getOrderAlertKey = (orderData = {}) => (
    String(
      orderData?.orderMongoId ||
      orderData?.order_mongo_id ||
      orderData?.orderId ||
      orderData?.order_id ||
      orderData?._id ||
      orderData?.id ||
      ''
    ).trim()
  );

  const shouldProcessOrderAlert = (orderData = {}) => {
    const key = getOrderAlertKey(orderData);
    if (!key) return true;
    const now = Date.now();
    const last = lastAlertAtByOrderRef.current.get(key) || 0;
    if (now - last < ALERT_DEDUPE_MS) return false;
    lastAlertAtByOrderRef.current.set(key, now);
    return true;
  };

  const shouldShowBrowserNotification = (orderData = {}) => {
    const key = getOrderAlertKey(orderData);
    if (!key) return true;
    const now = Date.now();
    const last = lastBrowserNotificationAtByOrderRef.current.get(key) || 0;
    if (now - last < BROWSER_NOTIFICATION_DEDUPE_MS) return false;
    lastBrowserNotificationAtByOrderRef.current.set(key, now);
    return true;
  };

  const showBackgroundOrderNotification = async (orderData) => {
    if (!shouldShowBrowserNotification(orderData)) {
      return;
    }

    if (!supportsBrowserNotifications() || Notification.permission !== 'granted') {
      return;
    }

    const notificationOptions = buildRestaurantOrderNotification(orderData);

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.showNotification(notificationOptions.title, {
            body: notificationOptions.body,
            tag: notificationOptions.tag,
            renotify: true,
            requireInteraction: true,
            silent: false,
            vibrate: [200, 100, 200, 100, 300],
            icon: '/favicon.ico',
            data: notificationOptions.data,
          });
          return;
        }
      }

      new Notification(notificationOptions.title, {
        body: notificationOptions.body,
        tag: notificationOptions.tag,
        requireInteraction: true,
        silent: false,
        icon: '/favicon.ico',
        data: notificationOptions.data,
      });
    } catch (error) {
      debugWarn('Error showing background restaurant notification:', error);
    }
  };

  const stopAlertLoop = () => {
    if (alertLoopTimerRef.current) {
      clearInterval(alertLoopTimerRef.current);
      alertLoopTimerRef.current = null;
    }
    alertLoopStartedAtRef.current = 0;
  };

  const startAlertLoop = () => {
    stopAlertLoop();
    alertLoopStartedAtRef.current = Date.now();

    alertLoopTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - alertLoopStartedAtRef.current;
      if (elapsed >= ALERT_LOOP_MAX_MS || !activeOrderRef.current) {
        stopAlertLoop();
        return;
      }

      // Keep re-alerting while order is pending and tab is not visible.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        playNotificationSound(activeOrderRef.current);
      }
    }, ALERT_LOOP_INTERVAL_MS);
  };

  const handleIncomingOrderAlert = (orderData) => {
    if (!shouldProcessOrderAlert(orderData)) {
      return;
    }

    activeOrderRef.current = orderData || { id: Date.now() };
    playNotificationSound(orderData);
    startAlertLoop();

    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      showBackgroundOrderNotification(orderData);
    }
  };

  // Get restaurant ID from API
  useEffect(() => {
    const fetchRestaurantId = async () => {
      try {
        const response = await restaurantAPI.getCurrentRestaurant();
        if (response.data?.success && response.data.data?.restaurant) {
          const restaurant = response.data.data.restaurant;
          const id = restaurant._id?.toString() || restaurant.restaurantId;
          setRestaurantId(id);
        }
      } catch (error) {
        debugError('Error fetching restaurant:', error);
      }
    };
    fetchRestaurantId();
  }, []);

  // Reliability fallback:
  // If Socket.IO fails (expired jwt / missing token / room join failed),
  // we still fetch restaurant orders from REST periodically and trigger the same
  // alert flow. This prevents "restaurant didn't receive the order" cases.
  useEffect(() => {
    if (!restaurantId) return;

    const ALERT_POLL_MS = 8000;
    let isCancelled = false;

    const pollOrders = async () => {
      if (isCancelled) return;

      try {
        const response = await restaurantAPI.getOrders({ page: 1, limit: 30 });
        const rows =
          response?.data?.data?.orders ||
          response?.data?.data?.data?.orders ||
          [];

        // REST layer normalizes backend statuses so:
        // - backend "created" -> UI "confirmed"
        // We alert only for "confirmed/new order waiting for review".
        const confirmed = (rows || [])
          .filter((o) => String(o?.status || "").toLowerCase() === "confirmed")
          .sort((a, b) => {
            const at = a?.updatedAt || a?.createdAt || 0;
            const bt = b?.updatedAt || b?.createdAt || 0;
            return new Date(bt).getTime() - new Date(at).getTime();
          });

        if (confirmed.length > 0) {
          // Trigger alerts for newest confirmed orders (dedupe prevents spam).
          confirmed.slice(0, 5).forEach((o) => handleIncomingOrderAlert(o));
        }
      } catch (error) {
        // Non-blocking: keep polling.
      }
    };

    // Initial poll immediately.
    pollOrders();
    const intervalId = setInterval(pollOrders, ALERT_POLL_MS);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [restaurantId]);

  useEffect(() => {
    if (!supportsBrowserNotifications()) return;

    if (Notification.permission !== 'default') return;
    if (localStorage.getItem(NOTIFICATION_PERMISSION_ASKED_KEY) === 'true') return;

    const requestPermissionOnce = async () => {
      localStorage.setItem(NOTIFICATION_PERMISSION_ASKED_KEY, 'true');
      try {
        await Notification.requestPermission();
      } catch (error) {
        debugWarn('Failed to request restaurant notification permission:', error);
      }
    };

    const askOnInteraction = () => {
      requestPermissionOnce();
      window.removeEventListener('pointerdown', askOnInteraction);
      window.removeEventListener('keydown', askOnInteraction);
    };

    window.addEventListener('pointerdown', askOnInteraction, { once: true, passive: true });
    window.addEventListener('keydown', askOnInteraction, { once: true });

    return () => {
      window.removeEventListener('pointerdown', askOnInteraction);
      window.removeEventListener('keydown', askOnInteraction);
    };
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState !== 'hidden') return;
      if (!activeOrderRef.current) return;

      playNotificationSound(activeOrderRef.current);
      showBackgroundOrderNotification(activeOrderRef.current);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!API_BASE_URL || !String(API_BASE_URL).trim()) {
      setIsConnected(false);
      return;
    }
    if (!restaurantId) {
      debugLog('? Waiting for restaurantId...');
      return;
    }

    // Normalize backend URL - use simpler, more robust approach
    let backendUrl = API_BASE_URL;
    
    // Step 1: Extract protocol and hostname using URL parsing if possible
    try {
      const urlObj = new URL(backendUrl);
      // Remove /api from pathname
      let pathname = urlObj.pathname.replace(/^\/api\/?$/, '');
      // Reconstruct clean URL
      backendUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? `:${urlObj.port}` : ''}${pathname}`;
    } catch (e) {
      // If URL parsing fails, use regex-based normalization
      // Remove /api suffix first
      backendUrl = backendUrl.replace(/\/api(\/v1)?\/?$/i, "");
      backendUrl = backendUrl.replace(/\/+$/, ''); // Remove trailing slashes
      
      // Normalize protocol - ensure exactly two slashes after protocol
      // Fix patterns: https:/, https:///, https://https://
      if (backendUrl.startsWith('https:') || backendUrl.startsWith('http:')) {
        // Extract protocol
        const protocolMatch = backendUrl.match(/^(https?):/i);
        if (protocolMatch) {
          const protocol = protocolMatch[1].toLowerCase();
          // Remove everything up to and including the first valid domain part
          const afterProtocol = backendUrl.substring(protocol.length + 1);
          // Remove leading slashes
          const cleanPath = afterProtocol.replace(/^\/+/, '');
          // Reconstruct with exactly two slashes
          backendUrl = `${protocol}://${cleanPath}`;
        }
      }
    }
    
    // Final cleanup: ensure exactly two slashes after protocol
    backendUrl = backendUrl.replace(/^(https?):\/+/gi, '$1://');
    backendUrl = backendUrl.replace(/\/+$/, ''); // Remove trailing slashes
    
    // CRITICAL: Check for localhost in production BEFORE creating socket
    // Detect production environment more reliably
    const frontendHostname = window.location.hostname;
    const isLocalhost = frontendHostname === 'localhost' || 
                        frontendHostname === '127.0.0.1' ||
                        frontendHostname === '';
    const isProductionBuild = import.meta.env.MODE === 'production' || import.meta.env.PROD;
    // Production deployment: not localhost AND (HTTPS OR has domain name with dots)
    const isProductionDeployment = !isLocalhost && (
      window.location.protocol === 'https:' || 
      (frontendHostname.includes('.') && !frontendHostname.startsWith('192.168.') && !frontendHostname.startsWith('10.'))
    );
    
    // If backend URL is localhost but we're not running locally, BLOCK connection
    const backendIsLocalhost = backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1');
    // Block if: backend is localhost AND (production build OR production deployment)
    // Allow if: frontend is also localhost (development scenario)
    const shouldBlockConnection = backendIsLocalhost && (isProductionBuild || isProductionDeployment) && !isLocalhost;
    
    if (shouldBlockConnection) {
      // Try to infer backend URL from frontend URL (common pattern: api.domain.com or domain.com/api)
      const frontendHost = window.location.hostname;
      const frontendProtocol = window.location.protocol;
      let suggestedBackendUrl = null;
      
      // Common patterns:
      // - If frontend is on foods.appzeto.com, backend might be api.foods.appzeto.com or foods.appzeto.com
      if (frontendHost.includes('foods.appzeto.com')) {
        suggestedBackendUrl = `${frontendProtocol}//api.foods.appzeto.com/api`;
      } else if (frontendHost.includes('appzeto.com')) {
        suggestedBackendUrl = `${frontendProtocol}//api.${frontendHost}/api`;
      }
      
      debugError('? CRITICAL: BLOCKING Socket.IO connection to localhost!');
      debugError('Backend connectivity disabled (UI-only mode).');
      debugError('?? Current backendUrl:', backendUrl);
      debugError('?? Current API_BASE_URL:', API_BASE_URL);
      debugError('?? Frontend hostname:', frontendHost);
      debugError('?? Frontend protocol:', frontendProtocol);
      debugError('?? Is production build:', isProductionBuild);
      debugError('?? Is production deployment:', isProductionDeployment);
      debugError('?? Backend is localhost:', backendIsLocalhost);
      if (suggestedBackendUrl) {
        debugError('?? Suggested backend URL:', suggestedBackendUrl);
      } else {
        debugError('?? Backend URL config is disabled in this build.');
      }
      debugError('?? Backend URL config is disabled in this build.');
      
      // Clean up any existing socket connection
      if (socketRef.current) {
        debugLog('?? Cleaning up existing socket connection...');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      // Don't try to connect to localhost in production - it will fail
      setIsConnected(false);
      return; // CRITICAL: Exit early to prevent socket creation
    }
    
    // Validate backend URL format
    if (!backendUrl || !backendUrl.startsWith('http')) {
      debugError('? CRITICAL: Invalid backend URL format:', backendUrl);
      debugError('?? API_BASE_URL:', API_BASE_URL);
      debugError('?? Expected format: https://your-domain.com or ');
      setIsConnected(false);
      return; // Don't try to connect with invalid URL
    }
    
    // Construct Socket.IO URL
    // IMPORTANT: Socket.IO server is on the origin (not /api/v1).
    // Our API baseURL is typically like: http://localhost:5000/api/v1
    // So for sockets we always connect to: http://localhost:5000
    let socketOrigin = backendUrl;
    try {
      socketOrigin = new URL(backendUrl).origin;
    } catch {
      socketOrigin = String(backendUrl || "")
        .replace(/\/api\/v\d+\/?$/i, "")
        .replace(/\/api(\/v1)?\/?$/i, "")
        .replace(/\/+$/, "");
    }

    // Backend uses default namespace; rooms handle role separation.
    const socketUrl = `${socketOrigin}`;
    
    // Validate socket URL format
    try {
      const urlTest = new URL(socketUrl); // This will throw if URL is invalid
      // Additional validation: ensure it's not localhost in production
      if ((isProductionBuild || isProductionDeployment) && (urlTest.hostname === 'localhost' || urlTest.hostname === '127.0.0.1')) {
        debugError('? CRITICAL: Socket URL contains localhost in production!');
        debugError('?? Socket URL:', socketUrl);
        debugError('?? This should have been caught earlier, but blocking anyway');
        setIsConnected(false);
        return;
      }
    } catch (urlError) {
      debugError('? CRITICAL: Invalid Socket.IO URL:', socketUrl);
      debugError('?? URL validation error:', urlError.message);
      debugError('?? Backend URL:', backendUrl);
      debugError('?? API_BASE_URL:', API_BASE_URL);
      setIsConnected(false);
      return; // Don't try to connect with invalid URL
    }
    
    debugLog('?? Attempting to connect to Socket.IO:', socketUrl);
    debugLog('?? Backend URL:', backendUrl);
    debugLog('?? API_BASE_URL:', API_BASE_URL);
    debugLog('?? Restaurant ID:', restaurantId);
    debugLog('?? Environment:', import.meta.env.MODE);
    debugLog('?? Is Production Build:', isProductionBuild);
    debugLog('?? Is Production Deployment:', isProductionDeployment);

    // Initialize socket connection (default namespace)
    // Use polling only to avoid repeated "WebSocket connection failed" when backend is down
    socketRef.current = io(socketUrl, {
      path: '/socket.io/',
      transports: ['polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
      forceNew: false,
      autoConnect: true,
      auth: {
        token: localStorage.getItem('restaurant_accessToken') || localStorage.getItem('accessToken')
      }
    });

    socketRef.current.on('connect', () => {
      debugLog('? Restaurant Socket connected, restaurantId:', restaurantId);
      debugLog('? Socket ID:', socketRef.current.id);
      debugLog('? Socket URL:', socketUrl);
      setIsConnected(true);
      
      // Join restaurant room immediately after connection with retry
      if (restaurantId) {
        const joinRoom = () => {
          debugLog('?? Joining restaurant room with ID:', restaurantId);
          socketRef.current.emit('join-restaurant', restaurantId);
          
          // Retry join after 2 seconds if no confirmation received
          setTimeout(() => {
            if (socketRef.current?.connected) {
              debugLog('?? Retrying restaurant room join...');
              socketRef.current.emit('join-restaurant', restaurantId);
            }
          }, 2000);
        };
        
        joinRoom();
      } else {
        debugWarn('?? Cannot join restaurant room: restaurantId is missing');
      }
    });

    // Listen for room join confirmation
    socketRef.current.on('restaurant-room-joined', (data) => {
      debugLog('? Restaurant room joined successfully:', data);
      debugLog('? Room:', data?.room);
      debugLog('? Restaurant ID in room:', data?.restaurantId);
    });

    // Listen for connection errors (throttle logs to avoid console spam on reconnect loops)
    socketRef.current.on('connect_error', (error) => {
      const now = Date.now();
      const shouldLog = now - lastConnectErrorLogRef.current >= CONNECT_ERROR_LOG_THROTTLE_MS;
      if (shouldLog) {
        lastConnectErrorLogRef.current = now;
        const isTransportError = error.type === 'TransportError' || error.message?.includes('xhr poll error');
        debugWarn(
          'Restaurant Socket:',
          isTransportError
            ? `Cannot reach backend at ${backendUrl}. Ensure the backend is running (e.g. npm run dev in backend).`
            : error.message
        );
        if (!isTransportError) {
          debugWarn('Details:', { type: error.type, socketUrl, backendUrl });
        }
      }
      if (error.message?.includes('CORS') || error.message?.includes('Not allowed')) {
        debugWarn('?? Add frontend URL to CORS_ORIGIN in backend .env');
      }
      setIsConnected(false);
    });

    // Listen for disconnection
    socketRef.current.on('disconnect', (reason) => {
      debugLog('? Restaurant Socket disconnected:', reason);
      setIsConnected(false);
      
      if (reason === 'io server disconnect') {
        // Server disconnected the socket, reconnect manually
        socketRef.current.connect();
      }
    });

    // Listen for reconnection attempts
    socketRef.current.on('reconnect_attempt', (attemptNumber) => {
      debugLog(`?? Reconnection attempt ${attemptNumber}...`);
    });

    // Listen for successful reconnection
    socketRef.current.on('reconnect', (attemptNumber) => {
      debugLog(`? Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
      
      // Rejoin restaurant room after reconnection
      if (restaurantId) {
        socketRef.current.emit('join-restaurant', restaurantId);
      }
    });

    // Listen for new order notifications
    socketRef.current.on('new_order', (orderData) => {
      debugLog('?? New order received:', orderData);
      setNewOrder(orderData);

      handleIncomingOrderAlert(orderData);
    });

    // Listen for sound notification event
    socketRef.current.on('play_notification_sound', (data) => {
      debugLog('?? Sound notification:', data);
      const normalizedData = {
        orderId: data?.orderId || data?.order_id,
        orderMongoId: data?.orderMongoId || data?.order_mongo_id,
        ...data
      };
      // Force immediate buzz for notification events, even if dedupe would skip.
      activeOrderRef.current = normalizedData || { id: Date.now() };
      playNotificationSound(normalizedData);
      startAlertLoop();
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        showBackgroundOrderNotification(normalizedData);
      }
      handleIncomingOrderAlert(normalizedData);
    });

    // Listen for order status updates
    socketRef.current.on('order_status_update', (data) => {
      debugLog('?? Order status update:', data);
      const isCancelled = String(data?.orderStatus || '').toLowerCase().includes('cancel');
      if (isCancelled) {
        const cancelledIds = [
          String(data?.orderId || '').trim(),
          String(data?.orderMongoId || '').trim(),
        ].filter(Boolean);
        const activeIds = [
          String(activeOrderRef.current?.orderId || '').trim(),
          String(activeOrderRef.current?.orderMongoId || '').trim(),
          String(newOrder?.orderId || '').trim(),
          String(newOrder?.orderMongoId || '').trim(),
        ].filter(Boolean);

        const matchesActiveOrder = cancelledIds.some((id) => activeIds.includes(id));
        if (matchesActiveOrder) {
          stopAlertLoop();
          activeOrderRef.current = null;
          setNewOrder(null);
        }
      }
    });

    socketRef.current.on('order_deleted', (data) => {
      debugLog('?? Order deleted:', data);
      const deletedIds = [
        String(data?.orderId || '').trim(),
        String(data?.orderMongoId || '').trim(),
      ].filter(Boolean);
      const activeIds = [
        String(activeOrderRef.current?.orderId || '').trim(),
        String(activeOrderRef.current?.orderMongoId || '').trim(),
        String(newOrder?.orderId || '').trim(),
        String(newOrder?.orderMongoId || '').trim(),
      ].filter(Boolean);

      const matchesActiveOrder = deletedIds.some((id) => activeIds.includes(id));
      if (!matchesActiveOrder) return;

      stopAlertLoop();
      activeOrderRef.current = null;
      setNewOrder(null);
    });

    socketRef.current.on('admin_notification', (payload) => {
      debugLog('?? Admin broadcast received:', payload);
      dispatchNotificationInboxRefresh();
    });
    
    socketRef.current.on('restaurant_notification', (payload) => {
      debugLog('?? Restaurant notification received:', payload);
      dispatchNotificationInboxRefresh();
    });

    // Load notification sound
    audioRef.current = new Audio(resolveAudioSource(alertSound));
    audioRef.current.preload = 'auto';
    audioRef.current.volume = 1;

    return () => {
      stopAlertLoop();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [restaurantId]);

  // Track user interaction for autoplay policy
  useEffect(() => {
    const handleUserInteraction = async () => {
      userInteractedRef.current = true;

      if (!audioRef.current) {
        audioRef.current = new Audio(resolveAudioSource(alertSound));
        audioRef.current.preload = 'auto';
        audioRef.current.volume = 1;
      }

      if (!audioUnlockAttemptedRef.current && audioRef.current) {
        audioUnlockAttemptedRef.current = true;
        try {
          audioRef.current.muted = true;
          await audioRef.current.play();
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch (error) {
          audioUnlockAttemptedRef.current = false;
          if (!error.message?.includes('user didn\'t interact') && !error.name?.includes('NotAllowedError')) {
            debugWarn('Error unlocking notification sound:', error);
          }
        } finally {
          // Ensure audio never remains muted after unlock attempts.
          if (audioRef.current) {
            audioRef.current.muted = false;
          }
        }
      }

      // Remove listeners after first interaction
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('pointerdown', handleUserInteraction);
    };
    
    // Listen for user interaction
    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('touchstart', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });
    window.addEventListener('pointerdown', handleUserInteraction, { once: true, passive: true });
    
    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('pointerdown', handleUserInteraction);
    };
  }, []);

  const playNotificationSound = async (orderData = {}) => {
    try {
      const usedNativeBridge = await triggerWebViewNativeNotification(orderData);
      if (
        userInteractedRef.current &&
        typeof navigator !== 'undefined' &&
        typeof navigator.vibrate === 'function'
      ) {
        navigator.vibrate([200, 100, 200, 100, 300]);
      }
      if (usedNativeBridge) {
        return;
      }

      if (audioRef.current) {
        audioRef.current.muted = false;
        audioRef.current.volume = 1;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(error => {
          // Don't log autoplay policy errors as they're expected
          if (!error.message?.includes('user didn\'t interact') && !error.name?.includes('NotAllowedError')) {
            debugWarn('Error playing notification sound:', error);
            // Fallback: try one-shot audio instance (more reliable in background tabs on some browsers)
            try {
              const fallbackAudio = new Audio(resolveAudioSource(alertSound, `restaurant-alert-${Date.now()}`));
              fallbackAudio.volume = 1;
              fallbackAudio.play().catch(() => {});
            } catch (fallbackError) {
              debugWarn('Fallback audio playback failed:', fallbackError);
            }
          }
        });
      }
    } catch (error) {
      // Don't log autoplay policy errors
      if (!error.message?.includes('user didn\'t interact') && !error.name?.includes('NotAllowedError')) {
        debugWarn('Error playing sound:', error);
      }
    }
  };

  const clearNewOrder = () => {
    stopAlertLoop();
    activeOrderRef.current = null;
    setNewOrder(null);
  };

  return {
    newOrder,
    clearNewOrder,
    isConnected,
    playNotificationSound
  };
};



