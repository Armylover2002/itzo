import { useCallback, useRef, useEffect, useState } from 'react'
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api'
import { motion } from 'framer-motion'
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

// Stable empty array references — prevents new [] reference on every render
const EMPTY_SELLER_LOCATIONS = []
const EMPTY_WAYPOINTS = []


/**
 * GoogleMapsTracking Component
 * 
 * Displays a Google Map with route tracking using Directions API in driving mode.
 * 
 * Example usage for Delivery Partner accepting order:
 * 
 * <GoogleMapsTracking
 *   deliveryLocation={{ lat: deliveryBoyLat, lng: deliveryBoyLng }}
 *   storeLocation={{ lat: restaurantLat, lng: restaurantLng, name: "Restaurant Name" }}
 *   customerLocation={{ lat: customerLat, lng: customerLng }}
 *   isTracking={true}
 *   showRoute={true}
 *   routeOrigin={{ lat: deliveryBoyLat, lng: deliveryBoyLng }}
 *   routeDestination={{ lat: restaurantLat, lng: restaurantLng }}
 *   destinationName="Restaurant Name"
 *   onRouteInfoUpdate={(info) => {
 *     debugLog('Distance:', info.distance, 'Duration:', info.duration)
 *   }}
 *   lastUpdate={new Date()}
 * />
 * 
 * When delivery partner accepts order:
 * - Set showRoute={true}
 * - Set routeOrigin to delivery partner's current location
 * - Set routeDestination to restaurant location
 * - The component will automatically calculate and display the driving route polyline
 */

// Use direct public path which is more reliable in this setup
const getDeliveryIconUrl = () => {
  try {
    // Try to use delivery icon from public assets
    return '/assets/deliveryboy/deliveryIcon.png'
  } catch {
    // Fallback to bikelogo if delivery icon not found
    return '/src/assets/bikelogo.png'
  }
}

const mapContainerStyle = {
  width: '100%',
  height: '22rem'
}

export default function GoogleMapsTracking({
  storeLocation,
  sellerLocations = EMPTY_SELLER_LOCATIONS,
  customerLocation,
  deliveryLocation,
  isTracking,
  showRoute = false,
  routeOrigin,
  routeDestination,
  routeWaypoints = EMPTY_WAYPOINTS,
  destinationName,
  onRouteInfoUpdate,
  lastUpdate
}) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const mapRef = useRef(null)
  const directionsServiceRef = useRef(null)
  const directionsRendererRef = useRef(null)
  const lastRouteCalcRef = useRef({ time: 0, origin: { lat: 0, lng: 0 } })
  const hasInitialBoundsFitted = useRef(false)
  const [userHasInteracted, setUserHasInteracted] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [routeInfo, setRouteInfo] = useState(null)
  const [routeError, setRouteError] = useState(null)
  const [isGPSWeak, setIsGPSWeak] = useState(false)

  // Check for weak GPS signal (no updates for > 45 seconds)
  useEffect(() => {
    if (!lastUpdate) return;
    const checkGPS = () => {
      const now = new Date().getTime();
      const lastTime = new Date(lastUpdate).getTime();
      setIsGPSWeak(now - lastTime > 45000); // 45 seconds threshold
    };
    const interval = setInterval(checkGPS, 10000); // Check every 10 seconds
    checkGPS(); // Initial check
    return () => clearInterval(interval);
  }, [lastUpdate]);

  // Sync routeInfo with parent
  useEffect(() => {
    if (onRouteInfoUpdate) {
      onRouteInfoUpdate(routeInfo);
    }
  }, [routeInfo, onRouteInfoUpdate]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || '',
    // Do not load `places` — it pulls Geocoding-related code paths; Directions is in core Maps JS.
    libraries: [],
  })

  // Combine storeLocation with sellerLocations
  const allSellers = storeLocation ? [storeLocation, ...sellerLocations] : sellerLocations;

  // Center will be updated dynamically based on deliveryLocation
  const center = deliveryLocation || (allSellers.length > 0 ? {
    lat: (allSellers[0].lat + customerLocation.lat) / 2,
    lng: (allSellers[0].lng + customerLocation.lng) / 2
  } : customerLocation)

  const path = [
    ...allSellers,
    ...(deliveryLocation ? [deliveryLocation] : []),
    customerLocation
  ].filter(loc => loc && (loc.lat !== 0 || loc.lng !== 0))

  // Auto-center and fit bounds when location or route changes
  useEffect(() => {
    if (!isLoaded || !mapRef.current || userHasInteracted || !window.google?.maps) return;
    const bounds = new window.google.maps.LatLngBounds();
    let hasPoints = false;

    // Add delivery location (focus point)
    if (deliveryLocation) {
      bounds.extend(deliveryLocation);
      hasPoints = true;
    }

    // Add route points if visible
    if (showRoute && routeOrigin && routeDestination) {
      bounds.extend(routeOrigin);
      bounds.extend(routeDestination);
      routeWaypoints.forEach(wp => bounds.extend(wp));
      hasPoints = true;
    } else {
      // Add other locations if route not showing
      if (storeLocation) {
        bounds.extend(storeLocation);
        hasPoints = true;
      }
      sellerLocations.forEach(s => {
        bounds.extend(s);
        hasPoints = true;
      });
      bounds.extend(customerLocation);
      hasPoints = true;
    }

    if (hasPoints) {
      if (mapRef.current._setProgrammaticChange) {
        mapRef.current._setProgrammaticChange(true);
      }
      // If in full screen or only have delivery location, focus on delivery boy
      if (deliveryLocation && (isFullScreen || !showRoute)) {
        mapRef.current.panTo(deliveryLocation);
        if (!hasInitialBoundsFitted.current || isFullScreen) {
          const targetZoom = isFullScreen ? 17 : 15;
          // Limit zoom if polyline is shown or during live tracking
          const MAX_ZOOM = 16;
          mapRef.current.setZoom(isTracking || showRoute ? Math.min(targetZoom, MAX_ZOOM) : targetZoom);
          hasInitialBoundsFitted.current = true;
        }
      } else {
        // Fit to include everything (route + locations)
        mapRef.current.fitBounds(bounds, {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        });
        // Limit zoom after fitBounds if polyline is shown or during live tracking
        setTimeout(() => {
          limitZoomIfNeeded(mapRef.current);
        }, 100);
        hasInitialBoundsFitted.current = true;
      }
      if (mapRef.current._setProgrammaticChange) {
        setTimeout(() => mapRef.current._setProgrammaticChange(false), 500);
      }
    }
  }, [isLoaded, deliveryLocation, showRoute, routeOrigin, routeDestination, routeWaypoints, storeLocation, sellerLocations, customerLocation, userHasInteracted, isFullScreen]);

  const handleRecenter = () => {
    setUserHasInteracted(false);
    hasInitialBoundsFitted.current = false;
    if (mapRef.current) {
      if (deliveryLocation && (isFullScreen || !showRoute)) {
        mapRef.current.panTo(deliveryLocation);
        const targetZoom = isFullScreen ? 17 : 15;
        // Limit zoom if polyline is shown or during live tracking
        const MAX_ZOOM = 16;
        mapRef.current.setZoom(isTracking || showRoute ? Math.min(targetZoom, MAX_ZOOM) : targetZoom);
        hasInitialBoundsFitted.current = true;
      } else {
        const bounds = new window.google.maps.LatLngBounds();
        if (deliveryLocation) bounds.extend(deliveryLocation);
        if (showRoute && routeOrigin && routeDestination) {
          bounds.extend(routeOrigin);
          bounds.extend(routeDestination);
          routeWaypoints.forEach(wp => bounds.extend(wp));
        } else {
          if (storeLocation) bounds.extend(storeLocation);
          sellerLocations.forEach(s => bounds.extend(s));
          bounds.extend(customerLocation);
        }
        mapRef.current.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
        // Limit zoom after fitBounds if polyline is shown or during live tracking
        setTimeout(() => {
          limitZoomIfNeeded(mapRef.current);
        }, 100);
        hasInitialBoundsFitted.current = true;
      }
    }
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
    // Reset interaction/bounds to force re-fit in new size
    setUserHasInteracted(false);
    hasInitialBoundsFitted.current = false;
  };

  // Helper function to limit zoom level when polyline is shown or during live tracking
  const limitZoomIfNeeded = useCallback((map) => {
    if (!map) return;
    const currentZoom = map.getZoom();
    const MAX_ZOOM = 16; // Maximum zoom when polyline is shown or during live tracking
    
    // Limit zoom if polyline is shown or during live tracking
    if ((showRoute || isTracking) && currentZoom > MAX_ZOOM) {
      map.setZoom(MAX_ZOOM);
    }
  }, [showRoute, isTracking]);

  const onLoad = useCallback((map) => {
    mapRef.current = map
    // Track user interaction with the map (pan, zoom, drag)
    let isProgrammaticChange = false;
    const trackInteraction = () => {
      if (!isProgrammaticChange) {
        setUserHasInteracted(true);
      }
    };
    // Add event listeners to track user interaction
    map.addListener('dragstart', trackInteraction);
    map.addListener('zoom_changed', () => {
      if (!isProgrammaticChange) {
        // Limit zoom when polyline is shown or during live tracking
        limitZoomIfNeeded(map);
        setTimeout(() => {
          if (!isProgrammaticChange) {
            trackInteraction();
          }
        }, 100);
      }
    });
    // Store the flag setter for use in route calculation
    map._setProgrammaticChange = (value) => {
      isProgrammaticChange = value;
    };
  }, [limitZoomIfNeeded])

  // Calculate and display route using Google Directions Service
  const calculateAndDisplayRoute = useCallback((origin, destination, waypoints = []) => {
    if (!isLoaded || !mapRef.current || !window.google?.maps) {
      debugLog('?? Cannot calculate route: map not loaded or not ready')
      return
    }

    // Validate origin and destination
    if (!origin || !destination || !origin.lat || !origin.lng || !destination.lat || !destination.lng) {
      debugLog('?? Cannot calculate route: invalid origin or destination', { origin, destination })
      return
    }

    // Optimization: Keep Directions API usage low.
    // Recalculate only occasionally or when rider deviates significantly.
    const now = Date.now()
    const lastCalc = lastRouteCalcRef.current
    const timeDiff = now - lastCalc.time
    const MIN_RECALC_INTERVAL_MS = 60000
    if (timeDiff < MIN_RECALC_INTERVAL_MS) {
      // Check if origin moved significantly
      const latDiff = Math.abs(origin.lat - lastCalc.origin.lat)
      const lngDiff = Math.abs(origin.lng - lastCalc.origin.lng)
      // Rough approximation: 0.0025 degrees is ~250m
      if (latDiff < 0.0025 && lngDiff < 0.0025) {
        return // Skip calculation
      }
    }
    lastRouteCalcRef.current = { time: now, origin: { ...origin } }

    // Initialize DirectionsService if not already initialized
    if (!directionsServiceRef.current) {
      directionsServiceRef.current = new window.google.maps.DirectionsService()
    }

    // Initialize or reuse DirectionsRenderer
    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        map: mapRef.current,
        suppressMarkers: true, // We'll use custom markers
        preserveViewport: true, // Preserve viewport - we'll center manually
                      polylineOptions: {
                        strokeColor: '#3b82f6', // Bright blue like Zomato/Swiggy
                        strokeWeight: 6,
                        strokeOpacity: 1.0, // Fully visible - plain solid line
                        icons: [], // No icons/dots - plain solid line only
                      },
      })
    } else {
      // Ensure preserveViewport is true so route updates don't change viewport
      directionsRendererRef.current.setOptions({ preserveViewport: true })
    }

    // Prepare waypoints
    const googleWaypoints = waypoints.map(wp => ({
      location: new window.google.maps.LatLng(wp.lat, wp.lng),
      stopover: true
    }));

    // Calculate route with DRIVING mode
    directionsServiceRef.current.route(
      {
        origin: origin,
        destination: destination,
        waypoints: googleWaypoints,
        travelMode: window.google.maps.TravelMode.DRIVING, // DRIVING mode as requested
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: 'bestguess'
        },
        optimizeWaypoints: true,
      },
      (result, status) => {
        if (status === 'OK' && result.routes && result.routes[0]) {
          setRouteError(null)
          // Extract route information
          const route = result.routes[0]
          if (route.legs && route.legs.length > 0) {
            let totalDistance = 0
            let totalDurationSeconds = 0
            route.legs.forEach((leg) => {
              totalDistance += leg.distance?.value || 0
              totalDurationSeconds += leg.duration?.value || 0
            })

            // Add 2-minute buffer (120 seconds) as requested
            totalDurationSeconds += 120

            const formatDuration = (seconds) => {
              if (seconds < 60) return `${Math.ceil(seconds)} sec`
              const mins = Math.ceil(seconds / 60)
              if (mins < 60) return `${mins} mins`
              const hours = Math.floor(mins / 60)
              const remainingMins = mins % 60
              return `${hours}h ${remainingMins}m`
            }

            const formatDistance = (meters) => {
              if (meters < 1000) return `${meters}m`
              return `${(meters / 1000).toFixed(1)} km`
            }

            setRouteInfo({
              distance: formatDistance(totalDistance),
              duration: formatDuration(totalDurationSeconds),
              durationValue: totalDurationSeconds,
              distanceValue: totalDistance,
            })
          }
          directionsRendererRef.current.setDirections(result);
          
          // Force remove any default icons/dots from polyline after directions are set
          // Try multiple times to ensure icons are removed
          [100, 300, 500, 700].forEach(delay => {
            setTimeout(() => {
              if (directionsRendererRef.current) {
                directionsRendererRef.current.setOptions({
                  polylineOptions: {
                    strokeColor: '#3b82f6',
                    strokeWeight: 6,
                    strokeOpacity: 1.0,
                    icons: [] // Explicitly remove all icons/dots - plain solid line only
                  }
                });
              }
            }, delay);
          });
        } else {
          debugError('? Directions request failed:', status, { origin, destination })
          setRouteInfo(null)
          // Fallback to straight line if route fails
          if (status === 'ZERO_RESULTS') {
            setRouteError('No road route found. Showing straight line.')
          } else if (status === 'OVER_QUERY_LIMIT') {
            setRouteError('Map service busy. Showing straight line.')
          } else {
            setRouteError('Navigation error. Showing straight line.')
          }
        }
      }
    )
  }, [isLoaded])

  // Handle route calculation when routeOrigin and routeDestination are provided
  useEffect(() => {
    if (showRoute && routeOrigin && routeDestination && isLoaded && mapRef.current) {
      // Recalculate route when origin, destination or waypoints change
      calculateAndDisplayRoute(routeOrigin, routeDestination, routeWaypoints)
    } else if (!showRoute && directionsRendererRef.current) {
      // Clear route if showRoute is false
      directionsRendererRef.current.setMap(null)
      directionsRendererRef.current = null
      setRouteInfo(null)
    }
  }, [showRoute, routeOrigin, routeDestination, routeWaypoints, isLoaded, calculateAndDisplayRoute])

  // Interpolation State
  const [animatedDeliveryLocation, setAnimatedDeliveryLocation] = useState(deliveryLocation);
  const animationRef = useRef(null);
  const lastDeliveryLocationRef = useRef(deliveryLocation);

  // Center is only for initial load, we use panTo/fitBounds for updates
  const [initialCenter] = useState(center);

  // Animation Logic
  useEffect(() => {
    if (!deliveryLocation) return;

    // If no previous location, snap to current (initial load)
    if (!lastDeliveryLocationRef.current) {
      setAnimatedDeliveryLocation(deliveryLocation);
      lastDeliveryLocationRef.current = deliveryLocation;
      return;
    }

    // If location hasn't changed (deep check), do nothing
    if (deliveryLocation.lat === lastDeliveryLocationRef.current.lat &&
      deliveryLocation.lng === lastDeliveryLocationRef.current.lng) {
      return;
    }

    const startLocation = animatedDeliveryLocation || lastDeliveryLocationRef.current;
    const targetLocation = deliveryLocation;

    const startTime = performance.now();
    const duration = 3800; // Slightly less than 4s interval to ensure completion

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress; // Linear for constant speed prediction

      const lat = startLocation.lat + (targetLocation.lat - startLocation.lat) * ease;
      const lng = startLocation.lng + (targetLocation.lng - startLocation.lng) * ease;

      setAnimatedDeliveryLocation({ lat, lng });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        lastDeliveryLocationRef.current = targetLocation;
      }
    };

    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = requestAnimationFrame(animate);

    // Update ref for next comparison
    lastDeliveryLocationRef.current = deliveryLocation;

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [deliveryLocation]);

  const containerClasses = isFullScreen
    ? "fixed inset-0 z-[100] bg-white w-screen h-screen flex flex-col"
    : "relative mx-4 mt-4 rounded-lg overflow-hidden shadow-sm";

  if (loadError) {
    return (
      <div className={containerClasses + " bg-red-50 border border-red-200 p-4 text-center"}>
        <p className="text-red-800 text-sm">? Failed to load Google Maps</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className={containerClasses + " bg-gray-100 p-8 text-center"}>
        <div className="animate-spin text-2xl">???</div>
        <p className="text-gray-600 text-sm mt-2">Loading map...</p>
      </div>
    )
  }

  if (!apiKey) {
    return (
      <div className={containerClasses + " bg-yellow-50 border border-yellow-200 p-4 text-center"}>
        <p className="text-yellow-800 text-sm">?? Google Maps API key not configured</p>
      </div>
    )
  }

  return (
    <div className={containerClasses}>
      {/* Map UI Overlays */}
      <div className={`absolute ${isFullScreen ? 'left-6 top-6' : 'left-3 top-3'} flex flex-col gap-2 z-10`}>
        {isTracking && (
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-white bg-black/70 px-2 py-1 rounded text-sm font-medium">Live</span>
          </div>
        )}
        {isGPSWeak && isTracking && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-red-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold shadow-lg flex items-center gap-2"
          >
            <span className="animate-pulse">??</span>
            GPS Signal Weak
          </motion.div>
        )}
        {routeInfo && isFullScreen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-3 rounded-lg shadow-xl border border-gray-100 min-w-[150px]"
          >
            <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Estimated Arrival</div>
            <div className="flex items-end gap-2">
              <span className="text-xl font-bold text-gray-900">{routeInfo.duration}</span>
              <span className="text-sm text-gray-500 mb-0.5">({routeInfo.distance})</span>
            </div>
            {destinationName && (
              <div className="text-xs text-blue-600 mt-1 font-medium truncate">
                to {destinationName}
              </div>
            )}
          </motion.div>
        )}
      </div>

      <div className={`absolute ${isFullScreen ? 'right-6 top-6' : 'right-3 top-3'} flex flex-col gap-2 z-10`}>
        <button
          onClick={toggleFullScreen}
          className="p-2 bg-white rounded-full shadow-md hover:bg-gray-50 transition-colors"
          title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
        >
          {isFullScreen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
          )}
        </button>
        <button
          onClick={handleRecenter}
          className="p-2 bg-white rounded-full shadow-md hover:bg-gray-50 transition-colors"
          title="Recenter"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M3 12h3m12 0h3M12 3v3m0 12v3"/></svg>
        </button>
      </div>

      {routeError && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-full text-xs font-medium shadow-lg flex items-center gap-2">
            <span>??</span>
            {routeError}
          </div>
        </div>
      )}

      {/* Warning when customer location is missing */}
      {isTracking && (!customerLocation || customerLocation.lat === 0) && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 w-max max-w-[90%]">
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-xs font-medium shadow-lg flex flex-col items-center gap-1 text-center">
            <div className="flex items-center gap-2">
              <span>??</span>
              <span className="font-bold">Location Unavailable</span>
            </div>
            <span>Customer hasn't pinned their location.</span>
            <span className="text-red-600/80 text-[10px]">Please rely on the written address.</span>
          </div>
        </div>
      )}

      <GoogleMap
        mapContainerStyle={isFullScreen ? { width: '100%', height: '100%' } : mapContainerStyle}
        center={initialCenter}
        zoom={13}
        onLoad={onLoad}
        options={{
          zoomControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          disableDefaultUI: true,
          clickableIcons: false,
          maxZoom: (showRoute || isTracking) ? 16 : 20, // Limit max zoom when polyline is shown or during live tracking
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }]
            }
          ]
        }}
      >
        {/* Customer Marker - Only show if valid location */}
        {customerLocation && (customerLocation.lat !== 0 || customerLocation.lng !== 0) && (
          <Marker
            position={customerLocation}
            icon={{
              url: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><text x="8" y="32" font-size="32">??</text></svg>')}`,
              scaledSize: window.google?.maps?.Size ? new window.google.maps.Size(40, 40) : undefined
            }}
            title="Delivery Address"
          />
        )}

        {/* Seller Markers */}
        {allSellers.map((seller, index) => (
          <Marker
            key={`seller-${index}`}
            position={seller}
            icon={showRoute && routeDestination?.lat === seller.lat ? {
              path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
              scale: 10,
              fillColor: '#ef4444',
              fillOpacity: 1,
              strokeWeight: 3,
              strokeColor: '#ffffff',
            } : {
              url: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><text x="8" y="32" font-size="32">??</text></svg>')}`,
              scaledSize: window.google?.maps?.Size ? new window.google.maps.Size(40, 40) : undefined
            }}
            title={seller.name || "Seller Shop"}
          />
        ))}

        {/* Delivery Partner Marker (Animated) */}
        {animatedDeliveryLocation && (
          <Marker
            position={animatedDeliveryLocation}
            icon={{
              url: getDeliveryIconUrl(),
              scaledSize: window.google?.maps?.Size ? new window.google.maps.Size(60, 60) : undefined,
              anchor: window.google?.maps?.Point ? new window.google.maps.Point(30, 30) : undefined
            }}
            title="Delivery Partner"
          />
        )}

        {/* Polyline removed - no longer showing route line */}
      </GoogleMap>
    </div>
  )
}


