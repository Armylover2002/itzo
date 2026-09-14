import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '@food/api/config';
import { deliveryAPI } from '@food/api';
import alertSound from '@food/assets/audio/alert.mp3';
import originalSound from '@food/assets/audio/original.mp3';
import { dispatchNotificationInboxRefresh } from '@food/hooks/useNotificationInbox';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import {
  requestRecovery,
  updateSyncPolicy,
  invalidateRecoveryCache,
  applySocketActiveOrder,
} from '@/modules/DeliveryV2/services/deliveryOrderSync';
import { showActorBrowserNotification } from '@food/utils/actorBrowserNotification';

/** StrictMode-safe shared socket: remount within same tick does not tear down. */
let sharedDeliverySocket = null;
let sharedDeliverySocketKey = null;
let sharedDeliverySocketOwners = 0;
let sharedDeliverySocketReleaseTimer = null;
/** True only after a real disconnect — gates reconnect recovery (not initial connect). */
let pendingRecoveryAfterDisconnect = false;

function acquireSharedDeliverySocket(key, createFn) {
  if (sharedDeliverySocketReleaseTimer) {
    clearTimeout(sharedDeliverySocketReleaseTimer);
    sharedDeliverySocketReleaseTimer = null;
  }
  if (sharedDeliverySocket && sharedDeliverySocketKey === key) {
    sharedDeliverySocketOwners += 1;
    return { socket: sharedDeliverySocket, reused: true };
  }
  if (sharedDeliverySocket) {
    try {
      sharedDeliverySocket.removeAllListeners();
      sharedDeliverySocket.disconnect();
    } catch {
      // ignore
    }
    sharedDeliverySocket = null;
    sharedDeliverySocketKey = null;
    sharedDeliverySocketOwners = 0;
  }
  sharedDeliverySocket = createFn();
  sharedDeliverySocketKey = key;
  sharedDeliverySocketOwners = 1;
  return { socket: sharedDeliverySocket, reused: false };
}

function releaseSharedDeliverySocket(socket) {
  if (!socket || socket !== sharedDeliverySocket) return;
  sharedDeliverySocketOwners = Math.max(0, sharedDeliverySocketOwners - 1);
  if (sharedDeliverySocketOwners > 0) return;
  sharedDeliverySocketReleaseTimer = setTimeout(() => {
    sharedDeliverySocketReleaseTimer = null;
    if (sharedDeliverySocketOwners > 0) return;
    if (sharedDeliverySocket) {
      try {
        sharedDeliverySocket.removeAllListeners();
        sharedDeliverySocket.disconnect();
      } catch {
        // ignore
      }
      sharedDeliverySocket = null;
      sharedDeliverySocketKey = null;
    }
  }, 0);
}

const shouldLogDeliverySocket = () => {
  if (typeof window === 'undefined') return import.meta.env.DEV;
  try {
    return (
      import.meta.env.DEV ||
      window.localStorage.getItem('delivery_socket_debug') === '1' ||
      window.location.search.includes('delivery_socket_debug=1')
    );
  } catch {
    return import.meta.env.DEV;
  }
};

const debugLog = (...args) => {
  if (shouldLogDeliverySocket()) {
    console.log('[DeliverySocket]', ...args);
  }
};
const debugWarn = (...args) => {
  if (shouldLogDeliverySocket()) {
    console.warn('[DeliverySocket]', ...args);
  }
};
const debugError = (...args) => {
  console.error('[DeliverySocket]', ...args);
};

if (typeof window !== 'undefined') {
  debugLog('alertSound URL:', alertSound);
  debugLog('originalSound URL:', originalSound);
}

const resolveAudioSource = (source) => {
  if (!source) return '';
  // Handle ES6 module imports where the URL might be in a 'default' property
  const url = typeof source === 'object' ? (source.default || source) : source;
  return url;
};

const safeReadJson = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const decodeJwtPayload = (token) => {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((ch) => `%${(`00${ch.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const resolveDeliveryPartnerIdFromClient = () => {
  try {
    const storedUser =
      safeReadJson('delivery_user') ||
      safeReadJson('deliveryUser') ||
      safeReadJson('user');

    const nestedCandidate =
      storedUser?.id ||
      storedUser?._id ||
      storedUser?.userId ||
      storedUser?.deliveryId ||
      storedUser?.deliveryPartnerId ||
      storedUser?.user?.id ||
      storedUser?.user?._id ||
      storedUser?.deliveryPartner?.id ||
      storedUser?.deliveryPartner?._id;

    if (nestedCandidate) return String(nestedCandidate);

    const token =
      localStorage.getItem('delivery_accessToken') ||
      '';
    const payload = decodeJwtPayload(token);
    const tokenCandidate =
      payload?.userId ||
      payload?.id ||
      payload?._id ||
      payload?.sub;

    return tokenCandidate ? String(tokenCandidate) : null;
  } catch {
    return null;
  }
};

const supportsBrowserNotifications = () =>
  typeof window !== 'undefined' && typeof Notification !== 'undefined';

const buildDeliveryOrderNotification = (orderData = {}) => {
  const orderId = orderData.orderId || orderData.orderMongoId || orderData.id || 'New';

  const itemCount = Array.isArray(orderData.items) ? orderData.items.length : 0;
  const total = Number(orderData.total || orderData.pricing?.total || orderData.orderTotal || 0);

  return {
    title: orderData.tripType === 'return_pickup' || orderData.documentType === 'seller_return'
      ? `Return pickup #${orderId}`
      : `New Food Order #${orderId}`,
    body: itemCount > 0
      ? `${itemCount} item${itemCount === 1 ? '' : 's'} - ₹${total.toFixed(2)}`
      : 'Restaurant pickup request nearby',
    tag: `delivery-order-${orderId}`,
    data: {
      orderId,
      module: 'food',
      targetUrl: '/food/delivery',
    },
  };
}

const isActionableDeliveryOffer = (orderData = {}) => {
  if (
    String(orderData?.tripType || '').trim() === 'return_pickup' ||
    String(orderData?.documentType || '').trim() === 'seller_return'
  ) {
    const dispatchStatus = String(
      orderData?.dispatch?.status || orderData?.dispatchStatus || '',
    ).trim().toLowerCase();
    if (dispatchStatus === 'accepted' || dispatchStatus === 'completed') {
      return false;
    }
    return Boolean(
      orderData?.returnId ||
      orderData?.orderMongoId ||
      orderData?.orderId,
    );
  }

  const orderStatus = String(
    orderData?.orderStatus || orderData?.status || ''
  ).trim().toLowerCase();
  const dispatchStatus = String(
    orderData?.dispatch?.status || orderData?.dispatchStatus || ''
  ).trim().toLowerCase();

  const actionableStatuses = ['confirmed', 'preparing', 'ready_for_pickup'];
  const returnPickupStatuses = ['return_approved', 'return_pickup_assigned', 'return_in_transit'];
  const actionableDispatchStatuses = ['unassigned', 'assigned'];

  if (orderStatus && !actionableStatuses.includes(orderStatus) && !returnPickupStatuses.includes(orderStatus)) {
    return false;
  }

  if (dispatchStatus && !actionableDispatchStatuses.includes(dispatchStatus)) {
    return false;
  }

  return Boolean(
    orderData?.orderId ||
    orderData?.orderMongoId ||
    orderData?._id ||
    orderData?.id,
  );
};

const triggerWebViewNativeNotification = async (orderData = {}) => {
  if (typeof window === 'undefined') return false;

  const bridgePayload = {
    title: 'New delivery order',
    body: `Order #${orderData?.orderId || orderData?.orderMongoId || orderData?.id || ''}`.trim(),
    orderId: orderData?.orderId || orderData?.order_id || '',
    orderMongoId: orderData?.orderMongoId || orderData?.order_mongo_id || '',
    targetUrl: '/delivery',
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
          await window.flutter_inappwebview.callHandler(handlerName, bridgePayload);
          return true;
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

export const useDeliveryNotifications = () => {
  // CRITICAL: All hooks must be called unconditionally and in the same order every render
  // Order: useRef -> useState -> useEffect -> useCallback
  
  // Step 1: All refs first (unconditional)
  const socketRef = useRef(null);
  const audioRef = useRef(null);
  const audioUnlockAttemptedRef = useRef(false);
  const activeOrderRef = useRef(null);
  const alertLoopTimerRef = useRef(null);
  const alertLoopStartedAtRef = useRef(0);
  const userInteractedRef = useRef(false);
  const lastAlertAtByOrderRef = useRef(new Map());
  const lastBrowserNotificationAtByOrderRef = useRef(new Map());
  /**
   * A partner can be offered several orders at the same time (dispatch wave,
   * restaurant resend, multiple restaurants). Only one offer may be on screen,
   * so the rest wait here instead of replacing the popup under the driver.
   */
  const offerQueueRef = useRef([]);
  const currentOfferKeyRef = useRef('');
  const enqueueOfferRef = useRef(null);
  const dropOfferByKeyRef = useRef(null);

  // Step 2: All state hooks (unconditional)
  const [newOrder, setNewOrder] = useState(null);
  /** Last offer key that became unavailable (claimed/accepted/cancelled). */
  const [unavailableOfferKey, setUnavailableOfferKey] = useState(null);
  const [orderReady, setOrderReady] = useState(null);
  const [orderStatusUpdate, setOrderStatusUpdate] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [deliveryPartnerId, setDeliveryPartnerId] = useState(null);
  const [forcedOfflineEvent, setForcedOfflineEvent] = useState(null);
  const joinedDeliveryRoomRef = useRef(null);
  // Keep latest handlers in refs so the socket effect only depends on auth identity.
  const recoverDeliveryStateRef = useRef(null);
  const joinDeliveryRoomRef = useRef(null);
  const handleIncomingOrderAlertRef = useRef(null);
  const playNotificationSoundRef = useRef(null);
  const showBackgroundOrderNotificationRef = useRef(null);
  const startAlertLoopRef = useRef(null);
  const stopAlertLoopRef = useRef(null);
  const ALERT_LOOP_INTERVAL_MS = 4500;
  const ALERT_LOOP_MAX_MS = 120000;
  const ALERT_DEDUPE_MS = 15000;
  const BROWSER_NOTIFICATION_DEDUPE_MS = 20000;
  const OFFER_QUEUE_MAX = 5;
  /** A queued offer older than this is dead on the server side — never show it. */
  const OFFER_QUEUE_TTL_MS = 90000;
  const NOTIFICATION_PERMISSION_ASKED_KEY = 'delivery_notification_permission_asked';

  // Step 3: All callbacks before effects (unconditional)
  const getOrderAlertKey = (orderData = {}) => (
    [
      String(
        orderData?.orderMongoId ||
        orderData?.order_mongo_id ||
        orderData?.orderId ||
        orderData?.order_id ||
        orderData?._id ||
        orderData?.id ||
        ''
      ).trim(),
      String(orderData?.dispatchLeg?.legId || orderData?.legId || '').trim(),
    ]
      .filter(Boolean)
      .join(':')
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

  const stopAlertLoop = useCallback(() => {
    if (alertLoopTimerRef.current) {
      clearInterval(alertLoopTimerRef.current);
      alertLoopTimerRef.current = null;
    }
    alertLoopStartedAtRef.current = 0;
  }, []);

  const startAlertLoop = useCallback((playSoundFn) => {
    stopAlertLoop();
    alertLoopStartedAtRef.current = Date.now();

    alertLoopTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - alertLoopStartedAtRef.current;
      if (elapsed >= ALERT_LOOP_MAX_MS || !activeOrderRef.current) {
        stopAlertLoop();
        return;
      }

      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        playSoundFn(activeOrderRef.current);
      }
    }, ALERT_LOOP_INTERVAL_MS);
  }, [stopAlertLoop]);
  
  const playNotificationSound = useCallback(async (orderData = {}) => {
    try {
      const usedNativeBridge = await triggerWebViewNativeNotification(orderData);

      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([200, 100, 200, 100, 300]);
      }

      if (usedNativeBridge) {
        return;
      }

      // Get current selected sound preference from localStorage
      const selectedSound = localStorage.getItem('delivery_alert_sound') || 'zomato_tone';
      const soundFile = selectedSound === 'original'
        ? resolveAudioSource(originalSound, 'delivery-original')
        : resolveAudioSource(alertSound, 'delivery-alert');
      
      // Update audio source if preference changed or initialize if not exists
      if (audioRef.current) {
        const currentSrc = audioRef.current.src;
        const newSrc = soundFile;
        // Check if source needs to be updated
        if (!currentSrc.includes(newSrc.split('/').pop())) {
          audioRef.current.pause();
          audioRef.current.src = newSrc;
          audioRef.current.load();
          debugLog('?? Audio source updated to:', selectedSound === 'original' ? 'Original' : 'Zomato Tone');
        }
      } else {
        // Initialize audio if not exists
        audioRef.current = new Audio();
        audioRef.current.src = soundFile;
        audioRef.current.preload = 'auto';
        audioRef.current.volume = 0.9;
        audioRef.current.load();
        debugLog('?? Audio initialized with:', selectedSound === 'original' ? 'Original' : 'Zomato Tone', 'Source:', soundFile);
      }
      
      if (audioRef.current) {
        audioRef.current.muted = false;
        audioRef.current.volume = 0.9;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(error => {
          // On strict autoplay environments, we still keep vibration/native bridge path active.
          if (!error.message?.includes('user didn\'t interact') && !error.name?.includes('NotAllowedError')) {
            debugWarn('Error playing notification sound:', error);
          }
        });
      }
    } catch (error) {
      // Don't log autoplay policy errors
      if (!error.message?.includes('user didn\'t interact') && !error.name?.includes('NotAllowedError')) {
        debugWarn('Error playing sound:', error);
      }
    }
  }, []);

  const showBackgroundOrderNotification = useCallback(async (orderData = {}) => {
    if (!shouldShowBrowserNotification(orderData)) {
      return;
    }

    if (!supportsBrowserNotifications() || Notification.permission !== 'granted') {
      return;
    }

    const notificationOptions = buildDeliveryOrderNotification(orderData);

    try {
      // Never call registration.showNotification from the page — that string
      // ("Restaurant pickup request nearby") was appearing on the User /cart tab
      // because OS notifications are origin-global. SW suppresses when User is visible.
      await showActorBrowserNotification({
        audience: 'delivery',
        title: notificationOptions.title,
        body: notificationOptions.body,
        tag: notificationOptions.tag,
        data: {
          ...notificationOptions.data,
          audience: 'delivery',
        },
      });
    } catch (error) {
      debugWarn('Error showing background delivery notification:', error);
    }
  }, []);

  const handleIncomingOrderAlert = useCallback((orderData = {}) => {
    if (!shouldProcessOrderAlert(orderData)) {
      return;
    }

    activeOrderRef.current = orderData || { id: Date.now() };
    playNotificationSound(orderData);
    startAlertLoop(playNotificationSound);

    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      showBackgroundOrderNotification(orderData);
    }
  }, [playNotificationSound, showBackgroundOrderNotification, startAlertLoop]);

  const pruneOfferQueue = useCallback(() => {
    const now = Date.now();
    offerQueueRef.current = offerQueueRef.current.filter(
      (entry) => now - entry.at < OFFER_QUEUE_TTL_MS,
    );
  }, [OFFER_QUEUE_TTL_MS]);

  /** Show the next queued offer, or leave the popup closed when nothing is waiting. */
  const promoteNextOffer = useCallback(() => {
    pruneOfferQueue();
    const next = offerQueueRef.current.shift();
    if (!next) {
      currentOfferKeyRef.current = '';
      setNewOrder(null);
      return;
    }
    currentOfferKeyRef.current = next.key;
    setNewOrder(next.order);
    handleIncomingOrderAlert(next.order);
  }, [handleIncomingOrderAlert, pruneOfferQueue]);

  /**
   * Returns true when the offer is the one now displayed, so the caller knows
   * whether to ring. A different offer is queued and never steals the popup.
   */
  const enqueueOffer = useCallback((orderData) => {
    const key = getOrderAlertKey(orderData);
    if (!key) return false;
    pruneOfferQueue();

    // Refresh of the offer already on screen — update details in place.
    if (currentOfferKeyRef.current === key) {
      setNewOrder(orderData);
      return false;
    }

    if (!currentOfferKeyRef.current) {
      currentOfferKeyRef.current = key;
      setNewOrder(orderData);
      return true;
    }

    const queuedIndex = offerQueueRef.current.findIndex((entry) => entry.key === key);
    if (queuedIndex >= 0) {
      offerQueueRef.current[queuedIndex] = { key, order: orderData, at: Date.now() };
      return false;
    }

    offerQueueRef.current.push({ key, order: orderData, at: Date.now() });
    if (offerQueueRef.current.length > OFFER_QUEUE_MAX) {
      offerQueueRef.current.shift();
    }
    return false;
  }, [OFFER_QUEUE_MAX, pruneOfferQueue]);

  /** Drop every pending offer — used once the partner is locked into a trip. */
  const resetOfferQueue = useCallback(() => {
    offerQueueRef.current = [];
    currentOfferKeyRef.current = '';
    stopAlertLoop();
    activeOrderRef.current = null;
    setNewOrder(null);
  }, [stopAlertLoop]);

  /** Drop an offer that is no longer winnable (claimed elsewhere, accepted, cancelled). */
  const dropOfferByKey = useCallback((key) => {
    const target = String(key || '').trim();
    if (!target) return;

    offerQueueRef.current = offerQueueRef.current.filter((entry) => entry.key !== target);
    setUnavailableOfferKey({ key: target, at: Date.now() });

    if (currentOfferKeyRef.current === target) {
      stopAlertLoop();
      activeOrderRef.current = null;
      promoteNextOffer();
    }
  }, [promoteNextOffer, stopAlertLoop]);

  const recoverDeliveryState = useCallback(async (reason = 'reconnect') => {
    if (!deliveryPartnerId) return;

    try {
      const result = await requestRecovery(reason);
      if (!result || result.type === 'error' || result.type === 'skipped') return;

      if (result.type === 'active') {
        const currentTrip = result.foodCurrent;
        if (currentTrip) {
          debugLog('Recovered current delivery trip after reconnect:', currentTrip);
          setOrderStatusUpdate({
            ...currentTrip,
            recoverySource: 'delivery_reconnect',
          });
        }
        return;
      }

      // Available offers are owned by the poller — recovery no longer returns type 'available'.
      if (result.type === 'idle') {
        debugLog('Recovery idle — available poller owns offer fetches');
      }
    } catch (error) {
      debugWarn('Delivery recovery sync failed:', error?.message || error);
    }
  }, [deliveryPartnerId]);

  const joinDeliveryRoomIfPossible = useCallback(() => {
    if (!socketRef.current?.connected || !deliveryPartnerId) {
      return false;
    }

    if (joinedDeliveryRoomRef.current === deliveryPartnerId) {
      return true;
    }

    debugLog('Joining delivery room', {
      deliveryPartnerId,
      socketId: socketRef.current?.id,
    });
    socketRef.current.emit('join-delivery', deliveryPartnerId);
    joinedDeliveryRoomRef.current = deliveryPartnerId;
    return true;
  }, [deliveryPartnerId]);

  // Keep refs current without putting handlers in the socket effect dependency list.
  useEffect(() => {
    recoverDeliveryStateRef.current = recoverDeliveryState;
    joinDeliveryRoomRef.current = joinDeliveryRoomIfPossible;
    handleIncomingOrderAlertRef.current = handleIncomingOrderAlert;
    playNotificationSoundRef.current = playNotificationSound;
    showBackgroundOrderNotificationRef.current = showBackgroundOrderNotification;
    startAlertLoopRef.current = startAlertLoop;
    stopAlertLoopRef.current = stopAlertLoop;
    enqueueOfferRef.current = enqueueOffer;
    dropOfferByKeyRef.current = dropOfferByKey;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.__deliverySocketDebug = {
      enabled: shouldLogDeliverySocket(),
      apiBaseUrl: API_BASE_URL,
      get deliveryPartnerId() {
        return deliveryPartnerId;
      },
      get isConnected() {
        return isConnected;
      },
      get socketId() {
        return socketRef.current?.id || null;
      },
      get socketConnected() {
        return Boolean(socketRef.current?.connected);
      },
      forceReconnect() {
        if (socketRef.current) {
          socketRef.current.connect();
        }
      },
      dump() {
        return {
          enabled: shouldLogDeliverySocket(),
          apiBaseUrl: API_BASE_URL,
          deliveryPartnerId,
          isConnected,
          socketId: socketRef.current?.id || null,
          socketConnected: Boolean(socketRef.current?.connected),
          socketAuthTokenPresent: Boolean(
            localStorage.getItem('delivery_accessToken') || ''
          ),
        };
      },
    };

    return () => {
      if (window.__deliverySocketDebug) {
        delete window.__deliverySocketDebug;
      }
    };
  }, [deliveryPartnerId, isConnected]);

  // Step 4: All effects (unconditional hook calls, conditional logic inside)
  useEffect(() => {
    if (!supportsBrowserNotifications()) return;

    if (Notification.permission !== 'default') return;
    if (localStorage.getItem(NOTIFICATION_PERMISSION_ASKED_KEY) === 'true') return;

    const requestPermissionOnce = async () => {
      localStorage.setItem(NOTIFICATION_PERMISSION_ASKED_KEY, 'true');
      try {
        await Notification.requestPermission();
      } catch (error) {
        debugWarn('Failed to request delivery notification permission:', error);
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
  }, [playNotificationSound, showBackgroundOrderNotification]);

  // Track user interaction for autoplay policy
  useEffect(() => {
    const handleUserInteraction = async () => {
      userInteractedRef.current = true;

      const selectedSound = localStorage.getItem('delivery_alert_sound') || 'zomato_tone';
      const soundFile = selectedSound === 'original'
        ? resolveAudioSource(originalSound, 'delivery-original')
        : resolveAudioSource(alertSound, 'delivery-alert');

      if (!audioRef.current) {
        audioRef.current = new Audio(soundFile);
        audioRef.current.preload = 'auto';
        audioRef.current.volume = 0.7;
      }

      if (!audioUnlockAttemptedRef.current && audioRef.current) {
        audioUnlockAttemptedRef.current = true;
        try {
          audioRef.current.muted = true;
          // Ensure src is set even if it was just initialized
          if (!audioRef.current.src || audioRef.current.src === window.location.href) {
             const selectedSound = localStorage.getItem('delivery_alert_sound') || 'zomato_tone';
             const soundFile = selectedSound === 'original'
                ? resolveAudioSource(originalSound)
                : resolveAudioSource(alertSound);
             audioRef.current.src = soundFile;
          }
          audioRef.current.load();
          await audioRef.current.play();
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          debugLog('?? Audio unlocked successfully');
        } catch (error) {
          audioUnlockAttemptedRef.current = false;
          if (!error.message?.includes('user didn\'t interact') && !error.name?.includes('NotAllowedError')) {
            debugWarn('Error unlocking notification audio:', error, 'Audio src:', audioRef.current?.src);
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
  
  // Initialize audio on mount - use selected preference from localStorage
  useEffect(() => {
    // Get selected alert sound preference from localStorage
    const selectedSound = localStorage.getItem('delivery_alert_sound') || 'zomato_tone';
    const soundFile = selectedSound === 'original'
      ? resolveAudioSource(originalSound, 'delivery-original')
      : resolveAudioSource(alertSound, 'delivery-alert');
    
    if (!audioRef.current) {
      audioRef.current = new Audio(soundFile);
      audioRef.current.preload = 'auto';
      audioRef.current.volume = 0.7;
      debugLog('?? Audio initialized with:', selectedSound === 'original' ? 'Original' : 'Zomato Tone');
    } else {
      // Update audio source if preference changed
      const currentSrc = audioRef.current.src;
      const newSrc = soundFile;
      if (!currentSrc.includes(newSrc.split('/').pop())) {
        audioRef.current.pause();
        audioRef.current.src = newSrc;
        audioRef.current.load();
        debugLog('?? Audio updated to:', selectedSound === 'original' ? 'Original' : 'Zomato Tone');
      }
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []); // Note: This runs once on mount. To update dynamically, we'd need to listen to storage events

  // Fetch delivery partner ID
  useEffect(() => {
    const fallbackId = resolveDeliveryPartnerIdFromClient();
    if (fallbackId) {
      setDeliveryPartnerId(fallbackId);
      debugLog('? Delivery Partner ID restored from local client auth:', fallbackId);
    }

    const fetchDeliveryPartnerId = async () => {
      try {
        const response = await deliveryAPI.getMe();
        if (response.data?.success && response.data.data) {
          const deliveryPartner = response.data.data.user || response.data.data.deliveryPartner;
          if (deliveryPartner) {
            const id = deliveryPartner.id?.toString() || 
                      deliveryPartner._id?.toString() || 
                      deliveryPartner.deliveryId;
            if (id) {
              setDeliveryPartnerId(id);
              debugLog('? Delivery Partner ID fetched:', id);
            } else {
              debugWarn('?? Could not extract delivery partner ID from response');
            }
          } else {
            debugWarn('?? No delivery partner data in API response');
          }
        } else {
          debugWarn('?? Could not fetch delivery partner ID from API');
        }
      } catch (error) {
        debugError('Error fetching delivery partner:', error);
      }
    };
    fetchDeliveryPartnerId();
  }, []);

  // Socket connection effect — reconnect only when auth / partner identity changes.
  // activeVehicleId and volatile handlers are intentionally excluded from deps.
  useEffect(() => {
    if (!deliveryPartnerId) {
      return;
    }

    if (!API_BASE_URL || !String(API_BASE_URL).trim()) {
      setIsConnected(false);
      return;
    }

    // IMPORTANT: Socket.IO server is on the origin (not /api/v1).
    let backendUrl = API_BASE_URL;
    try {
      const base =
        String(backendUrl).startsWith('http')
          ? undefined
          : (typeof window !== 'undefined' ? window.location.origin : undefined);
      backendUrl = new URL(backendUrl, base).origin;
    } catch {
      backendUrl = String(backendUrl || "")
        .replace(/\/api\/v\d+\/?$/i, "")
        .replace(/\/api\/?$/i, "")
        .replace(/\/+$/, "");

      if ((!backendUrl || !backendUrl.startsWith('http')) && typeof window !== 'undefined') {
        backendUrl = window.location.origin;
      }
    }

    const socketUrl = `${backendUrl}`;

    debugLog('?? Attempting to connect to Delivery Socket.IO:', socketUrl);
    debugLog('?? Delivery Partner ID:', deliveryPartnerId);

    if (import.meta.env.PROD && backendUrl.includes('localhost')) {
      debugError('? CRITICAL: Trying to connect Socket.IO to localhost in production!');
      setIsConnected(false);
      return;
    }

    if (!backendUrl || !backendUrl.startsWith('http')) {
      debugError('? CRITICAL: Invalid backend URL format:', backendUrl);
      return;
    }

    try {
      new URL(socketUrl);
    } catch (urlError) {
      debugError('? CRITICAL: Invalid Socket.IO URL:', socketUrl, urlError.message);
      return;
    }

    const token = localStorage.getItem('delivery_accessToken') || '';
    if (!token) {
      debugWarn('Delivery socket skipped: missing delivery_accessToken');
      setIsConnected(false);
      return;
    }
    const tokenPreview = token ? `${String(token).slice(0, 12)}...` : null;
    // Snapshot vehicle id at connect time only — must not be an effect dependency.
    const vehicleIdAtConnect = useDeliveryStore.getState().activeVehicleId;

    debugLog('Preparing socket auth payload', {
      tokenPresent: Boolean(token),
      tokenPreview,
      deliveryPartnerId,
      activeVehicleId: vehicleIdAtConnect,
      socketUrl,
    });

    const socketKey = `${socketUrl}|${deliveryPartnerId || 'pending'}|${token ? 'authed' : 'anon'}`;

    const { socket, reused } = acquireSharedDeliverySocket(socketKey, () =>
      io(socketUrl, {
        path: '/socket.io/',
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
        timeout: 20000,
        auth: {
          token: token || "",
        },
        query: {
          ...(token ? { token } : {}),
          ...(vehicleIdAtConnect ? { activeVehicleId: vehicleIdAtConnect } : {}),
        },
      })
    );

    socketRef.current = socket;

    if (reused) {
      debugLog('Reusing shared delivery socket (StrictMode / remount safe)', {
        socketId: socket.id,
        connected: socket.connected,
      });
      // Drop prior effect listeners before re-binding (connection stays up).
      socket.removeAllListeners();
      if (socket.connected) {
        setIsConnected(true);
        updateSyncPolicy({ isSocketConnected: true });
      }
    } else {
      debugLog('Socket.IO client created', {
        socketUrl,
        tokenPresent: Boolean(token),
        deliveryPartnerId,
      });
    }

    socket.on('connect', () => {
      debugLog('Socket connected', {
        socketId: socketRef.current?.id,
        deliveryPartnerId,
        transport: socketRef.current?.io?.engine?.transport?.name || 'unknown',
        pendingRecoveryAfterDisconnect,
      });
      setIsConnected(true);

      updateSyncPolicy({ isSocketConnected: true });

      joinedDeliveryRoomRef.current = null;
      if (!joinDeliveryRoomRef.current?.()) {
        debugLog('Socket connected before deliveryPartnerId was ready; waiting to join room.');
      }
      debugLog('Requesting resync after connect', {
        deliveryPartnerId,
        socketId: socketRef.current?.id,
      });
      socket.emit('resync');

      // Initial connect: coldStart owns active-trip restore. Recover only after a real disconnect.
      if (pendingRecoveryAfterDisconnect) {
        pendingRecoveryAfterDisconnect = false;
        void recoverDeliveryStateRef.current?.('reconnect');
      }
    });

    socket.on('delivery-room-joined', (data) => {
      debugLog('Delivery room joined successfully', data);
    });

    socket.on('resync_complete', (data) => {
      debugLog('Resync completed', data);
    });

    // Socket-first active trip restore (HTTP recovery remains fallback on disconnect).
    socket.on('active_order', (orderData) => {
      if (!orderData) return;
      debugLog('active_order received via resync', {
        orderId: orderData?.orderId || orderData?.orderMongoId,
      });
      try {
        applySocketActiveOrder(orderData, 'socket-resync');
      } catch (err) {
        debugWarn('applySocketActiveOrder failed', err);
      }
    });

    socket.on('connect_error', (error) => {
      debugError('Socket connection error', {
        message: error?.message,
        type: error?.type,
        description: error?.description,
        context: error?.context,
        data: error?.data,
        socketUrl,
        apiBaseUrl: API_BASE_URL,
        deliveryPartnerId,
        tokenPresent: Boolean(token),
        tokenPreview,
        transport: socketRef.current?.io?.engine?.transport?.name || 'unknown',
      });
      setIsConnected(false);
      updateSyncPolicy({ isSocketConnected: false });
    });

    socket.on('disconnect', (reason) => {
      debugWarn('Socket disconnected', {
        reason,
        socketId: socketRef.current?.id,
        deliveryPartnerId,
      });
      setIsConnected(false);
      updateSyncPolicy({ isSocketConnected: false });
      joinedDeliveryRoomRef.current = null;
      pendingRecoveryAfterDisconnect = true;
      invalidateRecoveryCache('disconnect');

      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      debugWarn('Reconnection attempt', {
        attemptNumber,
        socketUrl,
        deliveryPartnerId,
      });
    });

    socket.on('reconnect', (attemptNumber) => {
      debugLog('Socket reconnected', {
        attemptNumber,
        socketId: socketRef.current?.id,
        deliveryPartnerId,
        transport: socketRef.current?.io?.engine?.transport?.name || 'unknown',
      });
      setIsConnected(true);
      updateSyncPolicy({ isSocketConnected: true });

      joinedDeliveryRoomRef.current = null;
      joinDeliveryRoomRef.current?.();
      socket.emit('resync');

      // Same gate as connect — only after an actual disconnect (avoid double recovery).
      if (pendingRecoveryAfterDisconnect) {
        pendingRecoveryAfterDisconnect = false;
        invalidateRecoveryCache('reconnect');
        void recoverDeliveryStateRef.current?.('reconnect');
      }
    });

    socket.on('new_order', (orderData) => {
      if (!isActionableDeliveryOffer(orderData)) {
        debugLog('Ignoring non-actionable new_order event', orderData);
        return;
      }
      debugLog('New order received via socket', {
        orderId: orderData?.orderId || orderData?.orderMongoId || orderData?._id,
        dispatchStatus: orderData?.dispatch?.status,
      });

      if (enqueueOfferRef.current?.(orderData)) {
        handleIncomingOrderAlertRef.current?.(orderData);
      }
    });

    socket.on('new_order_available', (orderData) => {
      if (!isActionableDeliveryOffer(orderData)) {
        debugLog('Ignoring non-actionable new_order_available event', orderData);
        return;
      }
      debugLog('New order available received via socket', {
        orderId: orderData?.orderId || orderData?.orderMongoId || orderData?._id,
        phase: orderData?.phase || 'unknown',
        dispatchStatus: orderData?.dispatch?.status,
      });

      if (enqueueOfferRef.current?.(orderData)) {
        handleIncomingOrderAlertRef.current?.(orderData);
      }
    });

    socket.on('play_notification_sound', (data) => {
      if (data?.audience && data.audience !== 'delivery') {
        debugLog('Ignoring non-delivery play_notification_sound', data?.audience);
        return;
      }

      const normalizedData = {
        orderId: data?.orderId || data?.order_id,
        orderMongoId: data?.orderMongoId || data?.order_mongo_id,
        ...data
      };

      // Untagged legacy slim pings must still look like a delivery offer.
      if (!normalizedData.audience && !isActionableDeliveryOffer(normalizedData)) {
        debugLog('Ignoring untagged non-actionable play_notification_sound', normalizedData);
        return;
      }

      const activeAlertKey = getOrderAlertKey(activeOrderRef.current || {});
      const incomingAlertKey = getOrderAlertKey(normalizedData);
      const shouldAllowStandaloneSound =
        Boolean(normalizedData.audience === 'delivery') ||
        isActionableDeliveryOffer(normalizedData) ||
        (incomingAlertKey && incomingAlertKey === activeAlertKey);

      if (!shouldAllowStandaloneSound) {
        debugLog('Ignoring standalone play_notification_sound event', normalizedData);
        return;
      }

      debugLog('play_notification_sound received', {
        orderId: normalizedData?.orderId || normalizedData?.orderMongoId || normalizedData?.order_id,
      });

      // The ring loop must stay pinned to the offer on screen, otherwise a ping
      // for a queued order retargets it and later clear-by-key checks miss.
      if (incomingAlertKey && incomingAlertKey !== currentOfferKeyRef.current) {
        playNotificationSoundRef.current?.(normalizedData);
        return;
      }

      activeOrderRef.current = normalizedData || { id: Date.now() };
      playNotificationSoundRef.current?.(normalizedData);
      startAlertLoopRef.current?.(playNotificationSoundRef.current);
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        showBackgroundOrderNotificationRef.current?.(normalizedData);
      }
      handleIncomingOrderAlertRef.current?.(normalizedData);
    });

    socket.on('order_ready', (orderData) => {
      debugLog('order_ready received via socket', {
        orderId: orderData?.orderId || orderData?.orderMongoId || orderData?._id,
      });
      setOrderReady(orderData);
      playNotificationSoundRef.current?.(orderData);
    });

    socket.on('order_status_update', (statusData) => {
      debugLog('?? Delivery order status update received via socket:', statusData);
      invalidateRecoveryCache('order-status');
      const statusOrderId = String(
        statusData?.orderId || statusData?.orderMongoId || ''
      ).trim();
      const statusLegId = String(statusData?.legId || '').trim();
      const statusKey = [statusOrderId, statusLegId].filter(Boolean).join(':');

      if (statusData?.dispatchStatus === 'accepted' && statusKey) {
        dropOfferByKeyRef.current?.(statusKey);
      }
      setOrderStatusUpdate(statusData || null);
    });

    socket.on('order_cancelled', (statusData) => {
      debugLog('?? Delivery order cancelled event received via socket:', statusData);
      invalidateRecoveryCache('order-status');
      setOrderStatusUpdate({
        ...(statusData || {}),
        status: 'cancelled'
      });
    });

    socket.on('order_deleted', (statusData) => {
      debugLog('?? Delivery order deleted event received via socket:', statusData);
      invalidateRecoveryCache('order-status');
      setOrderStatusUpdate({
        ...(statusData || {}),
        status: 'deleted'
      });
    });

    socket.on('order_reassigned_elsewhere', (data) => {
      debugLog('?? Order reassigned to another partner:', data);
      invalidateRecoveryCache('order-status');
      const eventKey = getOrderAlertKey(data || {});
      if (eventKey) {
        debugLog('?? Removing reassigned order from local state');
        dropOfferByKeyRef.current?.(eventKey);
      }
    });

    socket.on('forced_offline', (data) => {
      debugLog('?? Forced offline received via socket:', data);
      setForcedOfflineEvent(data || { reason: 'UNKNOWN' });
      playNotificationSoundRef.current?.();
    });

    socket.on('order_claimed', (data) => {
      debugLog('?? Order claimed by another partner:', data);
      invalidateRecoveryCache('order-status');
      dropOfferByKeyRef.current?.(getOrderAlertKey(data || {}));
    });

    socket.on('admin_notification', (payload) => {
      debugLog('Admin broadcast received via socket', payload);
      dispatchNotificationInboxRefresh();
    });

    const handleAuthChange = () => {
      const newToken = localStorage.getItem('delivery_accessToken') || '';
      if (socketRef.current && newToken) {
        debugLog('?? Auth changed, updating socket token');
        socketRef.current.auth.token = newToken;
        if (!socketRef.current.connected) {
          socketRef.current.connect();
        }
      }
    };

    const handleAuthRefreshed = (e) => {
      if (e.detail?.module === 'delivery' && socketRef.current && e.detail.token) {
        debugLog('?? Auth refreshed for delivery, updating socket token');
        socketRef.current.auth.token = e.detail.token;
        if (!socketRef.current.connected) {
          socketRef.current.connect();
        }
      }
    };

    // Focus must NOT trigger recovery — coldStart + reconnect-after-disconnect + refreshActiveTrip cover it.

    window.addEventListener('deliveryAuthChanged', handleAuthChange);
    window.addEventListener('authRefreshed', handleAuthRefreshed);

    // If we reused an already-connected socket, still join once (no recovery).
    if (reused && socket.connected) {
      joinDeliveryRoomRef.current?.();
    }

    return () => {
      debugLog('? Releasing socket ownership (StrictMode-safe)...');
      stopAlertLoopRef.current?.();
      joinedDeliveryRoomRef.current = null;
      window.removeEventListener('deliveryAuthChanged', handleAuthChange);
      window.removeEventListener('authRefreshed', handleAuthRefreshed);
      // Detach listeners immediately so an unmounted owner cannot receive events;
      // connection teardown is deferred for StrictMode remount reuse.
      try {

        socket.removeAllListeners();
      } catch {
        // ignore
      }
      releaseSharedDeliverySocket(socket);
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [deliveryPartnerId]);

  useEffect(() => {
    if (!deliveryPartnerId) {
      debugLog('? Waiting for deliveryPartnerId...');
      return;
    }

    joinDeliveryRoomIfPossible();

    if (socketRef.current?.connected) {
      debugLog('Requesting resync after deliveryPartnerId resolved', {
        deliveryPartnerId,
        socketId: socketRef.current?.id,
      });
      socketRef.current.emit('resync');
      // Recovery is owned by the socket connect/reconnect handlers (forced).
      // Avoid a second forced recovery when partner id lands on an already-connected socket.
    }
  }, [deliveryPartnerId, joinDeliveryRoomIfPossible]);

  // Helper functions
  /** Resolve the offer on screen (accept / pass / expiry) and show whatever waited behind it. */
  const clearNewOrder = () => {
    stopAlertLoop();
    activeOrderRef.current = null;
    currentOfferKeyRef.current = '';
    promoteNextOffer();
  };

  const clearOrderReady = () => {
    setOrderReady(null);
  };

  const clearOrderStatusUpdate = () => {
    setOrderStatusUpdate(null);
  };

  const clearForcedOfflineEvent = useCallback(() => setForcedOfflineEvent(null), []);

  const emitLocation = useCallback((data) => {
    if (socketRef.current && socketRef.current.connected) {
      // debugLog('? Emitting location via socket:', data);
      socketRef.current.emit('update-location', data);
      return true;
    }
    return false;
  }, []);

  return {
    newOrder,
    clearNewOrder,
    unavailableOfferKey,
    resetOfferQueue,
    orderReady,
    clearOrderReady,
    orderStatusUpdate,
    clearOrderStatusUpdate,
    isConnected,
    playNotificationSound,
    emitLocation,
    forcedOfflineEvent,
    clearForcedOfflineEvent
  };
};

