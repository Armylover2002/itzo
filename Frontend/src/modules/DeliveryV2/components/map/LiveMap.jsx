import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { 
  GoogleMap, 
  Marker, 
  DirectionsService, 
  Polygon,
  Polyline,
  useJsApiLoader,
  OverlayView
} from '@react-google-maps/api';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { deliveryAPI } from '@food/api';
import {
  buildVisibleRouteFromRiderPosition,
  getRouteHeading,
  simplifyLivePolyline,
  trimPolylineFromDistanceAlongRoute,
} from '@food/utils/liveTrackingPolyline';
import { normalizeLocationPoint, normalizePickupPoints, resolveRestaurantLogoForDelivery, isReturnPickupTrip, getReturnDropLocation } from '@/modules/DeliveryV2/utils/orderRouting';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  position: 'absolute',
  inset: 0
};

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  scaleControl: false,
  streetViewControl: false,
  rotateControl: false,
  fullscreenControl: false,
  styles: [
    { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
    { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] }
  ]
};
const LIBRARIES = ['places', 'geometry'];

export const LiveMap = ({
  onMapClick,
  onMapLoad,
  onPathReceived,
  onPolylineReceived,
  zoom = 12,
  simulationPath = [],
  simulationIndex = 0,
  simulationProgress = 0,
  simulationLocked = false,
}) => {
  const { riderLocation, activeOrder, tripStatus, mapContext, setMapContext } = useDeliveryStore();
  const onPathReceivedRef = useRef(onPathReceived);
  const onPolylineReceivedRef = useRef(onPolylineReceived);

  useEffect(() => {
    onPathReceivedRef.current = onPathReceived;
  }, [onPathReceived]);

  useEffect(() => {
    onPolylineReceivedRef.current = onPolylineReceived;
  }, [onPolylineReceived]);
  
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES
  });

  const [directions, setDirections] = useState(null);
  const [map, setMapInternal] = useState(null);
  const [zones, setZones] = useState([]);
  const [lastDirectionsAt, setLastDirectionsAt] = useState(0);
  const routeProgressDistanceRef = useRef(0);
  const routeProgressSignatureRef = useRef('');

  const handleMapLoad = (mapInstance) => {
    mapInstance.setOptions({
      disableDefaultUI: true,
      zoomControl: false,
      mapTypeControl: false,
      scaleControl: false,
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: false
    });
    setMapInternal(mapInstance);
    if (onMapLoad) onMapLoad(mapInstance);
  };

  useEffect(() => {
    setLastDirectionsAt(0);
    setDirections(null);
    routeProgressDistanceRef.current = 0;
    routeProgressSignatureRef.current = '';
  }, [tripStatus, activeOrder?._id]);

  const targetLocation = useMemo(() => {
    if (!activeOrder) return null;
    let rawLoc = null;
    if (tripStatus === 'PICKING_UP' || tripStatus === 'REACHED_PICKUP') {
      rawLoc = activeOrder.restaurantLocation;
    } else if (tripStatus === 'PICKED_UP' || tripStatus === 'REACHED_DROP') {
      rawLoc = isReturnPickupTrip(activeOrder)
        ? (activeOrder.sellerDropLocation || getReturnDropLocation(activeOrder) || activeOrder.dropPoint)
        : activeOrder.customerLocation;
    }
    if (!rawLoc) return null;
    const lat = parseFloat(rawLoc.lat || rawLoc.latitude);
    const lng = parseFloat(rawLoc.lng || rawLoc.longitude);
    return (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng } : null;
  }, [activeOrder, tripStatus]);

  const pickupStops = useMemo(() => normalizePickupPoints(activeOrder), [activeOrder]);
  const customerStop = useMemo(() => normalizeLocationPoint(activeOrder?.customerLocation), [activeOrder]);
  const routeWaypoints = useMemo(() => {
    if (!activeOrder) return [];
    if (tripStatus === 'PICKED_UP' || tripStatus === 'REACHED_DROP') return [];
    if (String(activeOrder?.orderType || '').toLowerCase() !== 'mixed') return [];
    return pickupStops.map((point) => ({ location: point.location, stopover: true }));
  }, [activeOrder, tripStatus, pickupStops]);

  const routeDestination = useMemo(() => {
    if (!activeOrder) return null;
    if (tripStatus === 'PICKED_UP' || tripStatus === 'REACHED_DROP') {
      if (isReturnPickupTrip(activeOrder)) return targetLocation;
      return customerStop || targetLocation;
    }
    if (routeWaypoints.length > 0 && customerStop && !isReturnPickupTrip(activeOrder)) {
      return customerStop;
    }
    return targetLocation;
  }, [activeOrder, tripStatus, customerStop, routeWaypoints.length, targetLocation]);

  const parsedRiderLocation = useMemo(() => {
    if (!riderLocation) return null;
    const lat = parseFloat(riderLocation.lat || riderLocation.latitude);
    const lng = parseFloat(riderLocation.lng || riderLocation.longitude);
    return (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng, heading: parseFloat(riderLocation.heading || 0) } : null;
  }, [riderLocation]);

  useEffect(() => { if (map) map.setZoom(zoom); }, [zoom, map]);

  const shouldUpdateRoute = useMemo(() => {
    const now = Date.now();
    if (!directions) return true;
    let throttleMs = 20000;
    if (parsedRiderLocation && targetLocation && window.google) {
      try {
        const p1 = new window.google.maps.LatLng(parsedRiderLocation.lat, parsedRiderLocation.lng);
        const p2 = new window.google.maps.LatLng(targetLocation.lat, targetLocation.lng);
        const dist = window.google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
        if (dist > 2000) throttleMs = 60000;
        else if (dist > 500) throttleMs = 20000;
        else throttleMs = 5000;
      } catch (e) {}
    }
    return (now - lastDirectionsAt) >= throttleMs;
  }, [lastDirectionsAt, directions, parsedRiderLocation, targetLocation]);

  useEffect(() => {
    if (directions) {
      const path = directions.routes[0]?.overview_path;
      if (path && onPathReceivedRef.current) {
        const decodedPath = path.map(p => ({
          lat: typeof p.lat === 'function' ? p.lat() : (p.lat || p.latitude),
          lng: typeof p.lng === 'function' ? p.lng() : (p.lng || p.longitude)
        }));
        const simplePath = simplifyLivePolyline(decodedPath, {
          toleranceMeters: 3,
          highestQuality: true,
        });
        onPathReceivedRef.current(simplePath);
      }

      const encodedPolyline = directions.routes[0]?.overview_polyline;
      if (encodedPolyline && onPolylineReceivedRef.current) {
        onPolylineReceivedRef.current(encodedPolyline);
      }
    }
  }, [directions]);

  const directionsCallback = useCallback((result, status) => {
    if (status === 'OK' && result) {
      setDirections(result);
      setLastDirectionsAt(Date.now());
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const response = await deliveryAPI.getMapContext();
        if (response?.data?.success && response.data.data?.visibleZones) {
          setMapContext({ visibleZones: response.data.data.visibleZones });
        }
      } catch (err) {}
    })();
  }, [setMapContext]);

  useEffect(() => {
    if (mapContext?.visibleZones) {
      const formattedZones = mapContext.visibleZones.map(zone => ({
        ...zone,
        paths: (zone.coordinates || []).map(coord => ({ lat: coord.latitude, lng: coord.longitude }))
      })).filter(z => z.paths.length >= 3);
      setZones(formattedZones);
    }
  }, [mapContext?.visibleZones]);

  const restaurantMarkerUrl = useMemo(() => {
    if (!activeOrder) return resolveRestaurantLogoForDelivery({});
    return resolveRestaurantLogoForDelivery(activeOrder);
  }, [activeOrder]);

  const customerMarkerUrl = useMemo(() => {
    if (!activeOrder) return 'https://cdn-icons-png.flaticon.com/512/1275/1275302.png';
    return activeOrder.customerImage || activeOrder.user?.logo || activeOrder.user?.profileImage || 'https://cdn-icons-png.flaticon.com/512/1275/1275302.png';
  }, [activeOrder]);

  const lastCenteredPosRef = useRef(null);
  useEffect(() => {
    if (map && parsedRiderLocation) {
      if (!lastCenteredPosRef.current) {
        map.panTo(parsedRiderLocation);
        lastCenteredPosRef.current = parsedRiderLocation;
        return;
      }
      const dist = window.google.maps.geometry.spherical.computeDistanceBetween(
        new window.google.maps.LatLng(parsedRiderLocation.lat, parsedRiderLocation.lng),
        new window.google.maps.LatLng(lastCenteredPosRef.current.lat, lastCenteredPosRef.current.lng)
      );
      if (dist > 30) {
        map.panTo(parsedRiderLocation);
        lastCenteredPosRef.current = parsedRiderLocation;
      }
    }
  }, [map, parsedRiderLocation]);

  const remainingPath = useMemo(() => {
    if (!parsedRiderLocation) return [];

    const fullPath = simulationLocked && Array.isArray(simulationPath) && simulationPath.length > 1
      ? simulationPath
      : (directions?.routes?.[0]?.overview_path || []).map((point) => ({
          lat: typeof point.lat === 'function' ? point.lat() : point.lat,
          lng: typeof point.lng === 'function' ? point.lng() : point.lng,
        }));

    if (fullPath.length < 2) return fullPath;

    const simplifyVisibleRoute = (path, toleranceMeters = 5) => simplifyLivePolyline(path, {
      toleranceMeters,
      highestQuality: false,
    });

    if (simulationLocked) {
      let traversedDistance = 0;
      const safeIndex = Math.max(0, Math.min(Number(simulationIndex) || 0, fullPath.length - 2));
      const safeProgress = Math.max(0, Math.min(Number(simulationProgress) || 0, 1));

      for (let i = 0; i < safeIndex; i++) {
        traversedDistance += window.google.maps.geometry.spherical.computeDistanceBetween(
          new window.google.maps.LatLng(fullPath[i].lat, fullPath[i].lng),
          new window.google.maps.LatLng(fullPath[i + 1].lat, fullPath[i + 1].lng),
        );
      }

      if (safeIndex < fullPath.length - 1) {
        const currentSegmentDistance = window.google.maps.geometry.spherical.computeDistanceBetween(
          new window.google.maps.LatLng(fullPath[safeIndex].lat, fullPath[safeIndex].lng),
          new window.google.maps.LatLng(fullPath[safeIndex + 1].lat, fullPath[safeIndex + 1].lng),
        );
        traversedDistance += currentSegmentDistance * safeProgress;
      }

      return simplifyVisibleRoute(
        trimPolylineFromDistanceAlongRoute(fullPath, traversedDistance).trimmedPolyline,
        3,
      );
    }

    const routeSignature = [
      activeOrder?._id || activeOrder?.orderId || '',
      tripStatus || '',
      fullPath.length,
      fullPath[0]?.lat,
      fullPath[0]?.lng,
      fullPath[fullPath.length - 1]?.lat,
      fullPath[fullPath.length - 1]?.lng,
    ].join(':');

    if (routeProgressSignatureRef.current !== routeSignature) {
      routeProgressSignatureRef.current = routeSignature;
      routeProgressDistanceRef.current = 0;
    }

    const visibleRoute = buildVisibleRouteFromRiderPosition(fullPath, parsedRiderLocation, {
      offRouteThresholdMeters: 35,
    });

    const forwardOnlyDistance = Math.max(
      routeProgressDistanceRef.current || 0,
      Number(visibleRoute?.distanceAlongRoute || 0),
    );
    routeProgressDistanceRef.current = forwardOnlyDistance;

    const clampedRoute = trimPolylineFromDistanceAlongRoute(fullPath, forwardOnlyDistance);

    const unclutteredRoute = visibleRoute?.isOffRoute
      ? [parsedRiderLocation, ...clampedRoute.trimmedPolyline]
      : clampedRoute.trimmedPolyline;

    return simplifyVisibleRoute(unclutteredRoute, visibleRoute?.isOffRoute ? 3 : 5);
  }, [activeOrder?._id, activeOrder?.orderId, directions, parsedRiderLocation, simulationIndex, simulationLocked, simulationPath, simulationProgress, tripStatus]);

  const riderMarkerLocation = useMemo(() => {
    if (!parsedRiderLocation) return null;
    return {
      ...parsedRiderLocation,
      heading: getRouteHeading(remainingPath, parsedRiderLocation, parsedRiderLocation.heading),
    };
  }, [parsedRiderLocation, remainingPath]);

  if (loadError) return <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-red-500 font-bold">Map Load Error</div>;
  if (!isLoaded) return <div className="absolute inset-0 flex items-center justify-center bg-gray-50"><div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;

  const directionsServiceOptions = (parsedRiderLocation && routeDestination) ? {
    origin: parsedRiderLocation,
    destination: routeDestination,
    waypoints: routeWaypoints,
    optimizeWaypoints: false,
    travelMode: 'DRIVING',
  } : null;

  return (
    <div className="absolute inset-0 z-0 text-gray-900 overflow-hidden flex flex-col">
      <GoogleMap
        onLoad={handleMapLoad}
        mapContainerStyle={mapContainerStyle}
        zoom={14}
        onClick={(e) => onMapClick?.(e.latLng.lat(), e.latLng.lng())}
        options={mapOptions}
      >
        {directionsServiceOptions && shouldUpdateRoute && !simulationLocked && (
          <DirectionsService options={directionsServiceOptions} callback={directionsCallback} />
        )}

        {remainingPath.length > 0 && (
          <Polyline path={remainingPath} options={{ strokeColor: '#22c55e', strokeOpacity: 0.9, strokeWeight: 6, zIndex: 10 }} />
        )}

        {directions && (
          <Polyline path={directions.routes[0].overview_path} options={{ strokeColor: '#94a3b8', strokeOpacity: 0, strokeWeight: 4, zIndex: 1, icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.3, scale: 3, strokeWeight: 4, strokeColor: '#64748b' }, offset: '0', repeat: '15px' }] }} />
        )}

        {riderMarkerLocation && (
          <OverlayView position={riderMarkerLocation} mapPaneName={OverlayView.MARKER_LAYER}>
            <div style={{ transform: `translate(-50%, -50%) rotate(${riderMarkerLocation.heading || 0}deg)`, transition: 'transform 0.35s linear' }} className="relative w-[72px] h-[72px]">
              <img src="/MapRider.png" alt="Rider" className="w-full h-full object-contain" />
            </div>
          </OverlayView>
        )}

        {pickupStops.map((point, index) => (
          <Marker
            key={point.id}
            position={point.location}
            label={{
              text: point.pickupType === 'quick' ? `S${index + 1}` : `R${index + 1}`,
              color: '#111827',
              fontWeight: '700',
              fontSize: '11px',
            }}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: point.pickupType === 'quick' ? '#3b82f6' : '#ef4444',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 12,
            }}
          />
        ))}

        {customerStop && (
          <Marker position={customerStop} icon={{ url: customerMarkerUrl, scaledSize: new window.google.maps.Size(44, 44), anchor: new window.google.maps.Point(22, 22) }} />
        )}

        {zones.map((zone) => (
          <Polygon key={zone.id || zone._id} paths={zone.paths} options={{ fillColor: "#22c55e", fillOpacity: 0.1, strokeColor: "#22c55e", strokeOpacity: 0.4, strokeWeight: 2, zIndex: 1 }} />
        ))}
      </GoogleMap>
    </div>
  );
};

export default LiveMap;
