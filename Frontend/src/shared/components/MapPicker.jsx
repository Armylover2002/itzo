import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Circle,
  Autocomplete,
  Polygon,
} from "@react-google-maps/api";
import { Search, MapPin, Navigation, Loader2 } from "lucide-react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";

const libraries = ["places"];
const mapContainerStyle = {
  width: "100%",
  height: "400px",
};

const defaultCenter = {
  lat: 20.5937, // India center
  lng: 78.9629,
};

const MapPicker = ({
  isOpen,
  onClose,
  onConfirm,
  initialLocation = null,
  initialRadius = 5,
  maxRadius = 20,
  zoneCoordinates = [],
  zoneLabel = "",
}) => {
  const [center, setCenter] = useState(initialLocation || defaultCenter);
  const [marker, setMarker] = useState(initialLocation);
  const [radius, setRadius] = useState(initialRadius);
  const [address, setAddress] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const autocompleteRef = useRef(null);
  const mapRef = useRef(null);

  const zonePath = React.useMemo(
    () =>
      Array.isArray(zoneCoordinates)
        ? zoneCoordinates
            .map((coord) => ({
              lat: Number(coord?.latitude ?? coord?.lat),
              lng: Number(coord?.longitude ?? coord?.lng),
            }))
            .filter(
              (coord) =>
                Number.isFinite(coord.lat) && Number.isFinite(coord.lng),
            )
        : [],
    [zoneCoordinates],
  );

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  // Initialize map state only once when modal opens
  useEffect(() => {
    if (!isOpen) return;

    // Use initialLocation only for first-time initialization when modal opens
    if (initialLocation) {
      setCenter(initialLocation);
      setMarker(initialLocation);
    } else if (zonePath.length > 0) {
      const avgLat =
        zonePath.reduce((sum, point) => sum + point.lat, 0) / zonePath.length;
      const avgLng =
        zonePath.reduce((sum, point) => sum + point.lng, 0) / zonePath.length;
      setCenter({ lat: avgLat, lng: avgLng });
      setMarker(null);
    } else {
      setCenter(defaultCenter);
      setMarker(null);
    }
    
    if (initialRadius !== undefined) {
      setRadius(initialRadius);
    }
  }, [isOpen]); // Only run when modal opens

  useEffect(() => {
    if (!isLoaded || !isOpen || !mapRef.current || zonePath.length < 3 || !window.google) {
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    zonePath.forEach((point) => bounds.extend(point));
    mapRef.current.fitBounds(bounds);
  }, [isLoaded, isOpen, zonePath]);

  const onMapClick = useCallback((e) => {
    const newPos = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng(),
    };
    setMarker(newPos);
  }, []);

  const onMarkerDragEnd = useCallback((e) => {
    const newPos = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng(),
    };
    setMarker(newPos);
  }, []);

  const handlePlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry) {
        const newPos = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };
        setMarker(newPos);
        setAddress(place.formatted_address || "");
        // Pan and zoom the map imperatively
        if (mapRef.current) {
          mapRef.current.panTo(newPos);
          mapRef.current.setZoom(16);
        } else {
          setCenter(newPos);
        }
      }
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported on this device.");
      return;
    }

    setIsFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newPos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setMarker(newPos);
        setAddress("");
        setIsFetchingLocation(false);
        if (mapRef.current) {
          mapRef.current.panTo(newPos);
          mapRef.current.setZoom(16);
        } else {
          setCenter(newPos);
        }
      },
      () => {
        setIsFetchingLocation(false);
        alert("Unable to retrieve your current location. Please allow location access and try again.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  const isPointInPolygon = (point, polygon) => {
    const x = point.lng;
    const y = point.lat;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng;
      const yi = polygon[i].lat;
      const xj = polygon[j].lng;
      const yj = polygon[j].lat;

      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const handleConfirm = async () => {
    if (!marker) {
      alert("Please select a location on the map.");
      return;
    }

    if (zonePath && zonePath.length >= 3) {
      if (!isPointInPolygon(marker, zonePath)) {
        alert("The selected location is outside your assigned service zone. Please select a valid location inside the highlighted zone.");
        return;
      }
    }

    setIsGeocoding(true);
    try {
      // Reverse geocode only on confirmation to save costs
      const geocoder = new window.google.maps.Geocoder();
      const result = await new Promise((resolve, reject) => {
        geocoder.geocode({ location: marker }, (results, status) => {
          if (status === "OK") resolve(results[0]);
          else reject(status);
        });
      });

      onConfirm({
        ...marker,
        radius,
        address: result.formatted_address,
      });
      onClose();
    } catch (error) {
      console.error("Geocoding failed:", error);
      // Fallback: confirm without address
      onConfirm({
        ...marker,
        radius,
        address: address || "Custom Location",
      });
      onClose();
    } finally {
      setIsGeocoding(false);
    }
  };

  if (loadError) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Select Location">
        <div className="p-8 text-center text-red-500">
          Failed to load Google Maps. Please check your API key and connection.
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Shop Location"
      size="lg"
      footer={
        <div className="flex justify-between w-full items-center">
          <div className="text-sm text-gray-500">
            {marker
              ? address
                ? <span className="font-medium text-slate-700 truncate max-w-xs block">{address}</span>
                : `${marker.lat.toFixed(4)}, ${marker.lng.toFixed(4)}`
              : "No location selected"}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!marker || isGeocoding}>
              {isGeocoding ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Confirm Location
            </Button>
          </div>
        </div>
      }>
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            {isLoaded && (
              <Autocomplete
                onLoad={(ref) => (autocompleteRef.current = ref)}
                onPlaceChanged={handlePlaceChanged}
                options={{
                  componentRestrictions: { country: "IN" },
                  fields: ["geometry", "formatted_address"],
                }}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search for your shop area..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </Autocomplete>
            )}
          </div>
          <Button
            variant="outline"
            type="button"
            onClick={getCurrentLocation}
            disabled={isFetchingLocation}
            className="shrink-0 whitespace-nowrap px-4"
            title="Use current location">
            {isFetchingLocation ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="mr-2 h-4 w-4" />
            )}
            {isFetchingLocation ? "Fetching..." : "Use Current Location"}
          </Button>
        </div>

        <div className="rounded-xl overflow-hidden border border-gray-200 shadow-inner relative">
          {!isLoaded ? (
            <div className="h-[400px] flex items-center justify-center bg-gray-50">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={center}
              zoom={15}
              onClick={onMapClick}
              onLoad={(map) => {
                mapRef.current = map;
              }}
              options={{
                disableDefaultUI: true,
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
              }}>
              {zonePath.length >= 3 && (
                <Polygon
                  path={zonePath}
                  options={{
                    fillColor: "#10b981",
                    fillOpacity: 0.14,
                    strokeColor: "#059669",
                    strokeOpacity: 0.9,
                    strokeWeight: 2,
                    clickable: false,
                    editable: false,
                    zIndex: 1,
                  }}
                />
              )}
              {marker && (
                <>
                  <Marker
                    position={marker}
                    draggable={true}
                    onDragEnd={onMarkerDragEnd}
                    animation={window.google.maps.Animation.DROP}
                  />
                  <Circle
                    center={marker}
                    radius={radius * 1000} // KM to Meters
                    options={{
                      fillColor: "#FE5502",
                      fillOpacity: 0.1,
                      strokeColor: "#FE5502",
                      strokeOpacity: 0.5,
                      strokeWeight: 2,
                      clickable: false,
                      editable: false,
                      zIndex: 1,
                    }}
                  />
                </>
              )}
            </GoogleMap>
          )}
        </div>

        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          {zoneLabel ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
              Showing selected zone: {zoneLabel}
            </div>
          ) : null}
          <p className="text-xs text-gray-500 flex items-start gap-1">
            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
            Customers will see your location based on this pin.
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default MapPicker;
