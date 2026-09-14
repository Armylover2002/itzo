import React, { useEffect, useRef, useState } from 'react';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { RIDER_BIKE_SVG, RESTAURANT_PIN_SVG, CUSTOMER_PIN_SVG } from '@/modules/DeliveryV2/components/map/map.icons';

/**
 * RiderMarker - Professional animated bike marker.
 */
export const RiderMarker = ({ google, map, position, heading = 0 }) => {
  const markerRef = useRef(null);

  useEffect(() => {
    if (!google || !map || !position) return;

    if (!markerRef.current) {
      markerRef.current = new google.maps.Marker({
        position,
        map,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(RIDER_BIKE_SVG)}`,
          anchor: new google.maps.Point(30, 30),
          scaledSize: new google.maps.Size(60, 60),
          rotation: heading
        },
        zIndex: 100,
        optimized: false
      });
    } else {
      // Smoothly animate position and rotation
      markerRef.current.setPosition(position);
      const icon = markerRef.current.getIcon();
      if (icon) {
        markerRef.current.setIcon({ ...icon, rotation: heading });
      }
    }

    return () => {
      if (markerRef.current) markerRef.current.setMap(null);
    };
  }, [google, map, position, heading]);

  return null;
};
