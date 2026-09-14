import { useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '@food/api/config';
import { writeDeliveryLocation, writeOrderTracking } from '@food/realtimeTracking';

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const useLocationSharing = (orderId, enabled = false) => {
  const socketRef = useRef(null);
  const watchIdRef = useRef(null);
  const isSharingRef = useRef(false);
  const deliveryIdRef = useRef(
    localStorage.getItem('deliveryPartnerId') ||
      localStorage.getItem('deliveryPartnerMongoId') ||
      localStorage.getItem('deliveryBoyId') ||
      '',
  );

  const backendUrl = API_BASE_URL ? API_BASE_URL.replace('/api', '') : '';

  const startSharing = () => {
    if (!orderId || isSharingRef.current) return;
    // Backend disconnected - new backend in progress. Do not open Socket.
    if (!API_BASE_URL || !backendUrl || !backendUrl.startsWith('http')) return;

    if (!socketRef.current) {
      socketRef.current = io(backendUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      });

      socketRef.current.on('connect', () => {
        socketRef.current.emit('join-delivery', orderId);
      });
    }

    let lastSentTime = 0;
    const LOCATION_UPDATE_INTERVAL = 3000;
    const lastLocationRef = { lat: null, lng: null };

    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading, speed, accuracy } = position.coords;
        const now = Date.now();

        if (now - lastSentTime < LOCATION_UPDATE_INTERVAL) return;

        if (lastLocationRef.lat !== null && lastLocationRef.lng !== null) {
          const distance = calculateDistance(
            lastLocationRef.lat,
            lastLocationRef.lng,
            latitude,
            longitude
          );
          if (distance < 5) return;
        }

        lastLocationRef.lat = latitude;
        lastLocationRef.lng = longitude;
        lastSentTime = now;

        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('update-location', {
            orderId,
            lat: latitude,
            lng: longitude,
            heading: heading || 0,
            timestamp: now
          });
        }

        const deliveryId = String(deliveryIdRef.current || '').trim();
        if (deliveryId) {
          writeDeliveryLocation({
            deliveryId,
            lat: latitude,
            lng: longitude,
            heading: heading || 0,
            speed: speed || 0,
            accuracy: accuracy || 0,
            isOnline: true,
            activeOrderId: orderId,
            timestamp: now
          }).catch(() => {});
        }

        writeOrderTracking(orderId, {
          lat: latitude,
          lng: longitude,
          heading: heading || 0,
          speed: speed || 0,
          status: 'in_transit',
          timestamp: now
        }).catch(() => {});
      },
      () => {},
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      }
    );

    isSharingRef.current = true;
  };

  const stopSharing = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    isSharingRef.current = false;
  };

  useEffect(() => {
    if (enabled && orderId) startSharing();
    else stopSharing();
    return () => stopSharing();
  }, [enabled, orderId]);

  useEffect(() => () => stopSharing(), []);

  return {
    isSharing: Boolean(enabled && orderId),
    startSharing,
    stopSharing
  };
};

export default useLocationSharing;
