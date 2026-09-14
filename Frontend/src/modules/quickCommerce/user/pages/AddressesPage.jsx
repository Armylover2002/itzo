import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, MapPin, Trash2, Edit2, Navigation, Home, Building2, Briefcase, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { customerApi } from "../services/customerApi";
import { useLocation } from "../context/LocationContext";
import { loadGoogleMaps } from "@/core/services/googleMapsLoader";
import { useDebouncedMapGeocode } from "@core/hooks/useDebouncedMapGeocode";
import {
  DEFAULT_MAP_GEOCODE_DEBOUNCE_MS,
  DEFAULT_MAP_GEOCODE_MIN_DISTANCE_M,
  distanceMeters,
} from "@core/utils/mapGeocode";

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_LAT = 22.711140989838025;
const DEFAULT_LNG = 75.9001552518043;
const DEFAULT_POSITION = [DEFAULT_LAT, DEFAULT_LNG];

const EMPTY_FORM = {
    type: "home",
    name: "",
    phone: "",
    address: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
};

// Enable Maps if API Key is available
const MAPS_ENABLED = !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const calculateDistance = (lat1, lon1, lat2, lon2) =>
    distanceMeters({ lat: lat1, lng: lon1 }, { lat: lat2, lng: lon2 });

const capitalize = (str = "") => str.charAt(0).toUpperCase() + str.slice(1);

const buildDisplayAddress = (addr) =>
    addr.fullAddress ||
    addr.address ||
    addr.street ||
    [addr.landmark, addr.city, addr.state, addr.pincode || addr.zipCode].filter(Boolean).join(", ") ||
    "";

const mapProfileToAddresses = (profile) => {
    const raw = Array.isArray(profile?.addresses) ? profile.addresses : [];
    return raw.map((addr, idx) => ({
        id: addr._id ?? idx,
        type: capitalize(addr.label || "home"),
        name: profile?.name ?? addr?.name ?? "",
        address: buildDisplayAddress(addr),
        street: addr.street || "",
        city: addr.city || "",
        state: addr.state || "",
        pincode: addr.pincode || addr.zipCode || "",
        landmark: addr.landmark || addr.additionalDetails || "",
        phone: profile?.phone ?? addr?.phone ?? "",
        location: addr.location,
        isDefault: idx === 0,
    }));
};

const getAddressIcon = (address) => {
    const label = (address.type || address.label || "").toLowerCase();
    if (label.includes("home")) return Home;
    if (label.includes("work") || label.includes("office")) return Briefcase;
    return MapPin;
};

// Reverse geocode via backend proxy, fallback to Nominatim
const reverseGeocode = async (lat, lng) => {
    try {
        const response = await customerApi.reverseGeocode(lat, lng);
        const geo = response?.data?.data;
        if (geo?.formattedAddress) {
            return {
                street: geo.area || "",
                area: geo.area || "",
                city: geo.city || "",
                state: geo.state || "",
                postalCode: geo.pincode || "",
                address: geo.formattedAddress,
                formattedAddress: geo.formattedAddress,
            };
        }
    } catch (err) {
        // Fallback to nominatim
    }

    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
        const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "AppZeto-QuickCommerce" } });
        const data = await res.json();
        const address = data.address || {};
        const street = address.road || address.suburb || address.neighbourhood || address.city_district || "";
        const area = address.suburb || address.neighbourhood || address.city_district || address.residential || "";
        const city = address.city || address.town || address.village || address.county || "";
        const state = address.state || "";
        const pincode = address.postcode || "";
        const formattedAddress = data.display_name || "";
        
        let shortAddress = formattedAddress;
        if (formattedAddress) {
            const parts = formattedAddress.split(",").map(p => p.trim());
            if (parts.length >= 3) {
                shortAddress = `${parts[0]}, ${parts[1]}, ${parts[2]}`;
            } else if (parts.length > 0) {
                shortAddress = parts[0];
            }
        }

        return {
            street,
            area,
            city,
            state,
            postalCode: pincode,
            address: shortAddress,
            formattedAddress,
        };
    } catch {
        return null;
    }
};

const readStoredCheckoutState = () => {
    try {
        const raw = localStorage.getItem("quick_commerce_checkout_state_v1");
        if (!raw) return {};
        return JSON.parse(raw) || {};
    } catch {
        return {};
    }
};

// ─── CenterPin component ─────────────────────────────────────────────────────
const CenterPin = memo(() => (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="relative mb-8 flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-[#FFE8DB] dark:bg-red-900/30 flex items-center justify-center p-2 mb-[-6px] shadow-sm animate-bounce-short">
                <div className="w-6 h-6 rounded-full bg-[#FF0000] flex items-center justify-center border-2 border-white">
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                </div>
            </div>
            <div className="w-1.5 h-6 bg-[#FF0000] border-x border-white shadow-xl rounded-b-full shadow-red-900/40" />
            <div className="w-3 h-1.5 bg-black/20 rounded-full blur-[1px] transform scale-x-150 absolute bottom-[-4px]" />
        </div>
    </div>
));
CenterPin.displayName = "CenterPin";

const AddressesPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { refreshLocation, updateLocation, refreshAddresses: refreshContextAddresses } = useLocation();

    const [addresses, setAddresses] = useState([]);
    const [rawAddresses, setRawAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [profileName, setProfileName] = useState("");
    const [profilePhone, setProfilePhone] = useState("");

    // Full screen form states
    const [showAddressForm, setShowAddressForm] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editAddressId, setEditAddressId] = useState(null);
    const [addForm, setAddForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    // Map states
    const [mapPosition, setMapPosition] = useState(DEFAULT_POSITION);
    const [currentAddress, setCurrentAddress] = useState("");
    const [mapLoading, setMapLoading] = useState(false);
    const [mapUnavailable, setMapUnavailable] = useState(false);

    const mapContainerRef = useRef(null);
    const googleMapRef = useRef(null);
    const hasInitializedRef = useRef(false);

    // Search/Autocomplete states
    const [addressAutocompleteValue, setAddressAutocompleteValue] = useState("");
    const [keywordAddressSuggestions, setKeywordAddressSuggestions] = useState([]);
    const [isKeywordSearching, setIsKeywordSearching] = useState(false);

    // Scroll helpers
    const [formScrollTop, setFormScrollTop] = useState(0);
    const [keyboardInset, setKeyboardInset] = useState(0);
    const [baseMapHeight, setBaseMapHeight] = useState(320);
    const formBodyRef = useRef(null);
    const manualFieldRefs = useRef({});
    const skipMapIdleRef = useRef(false);

    // Delete dialog
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const fetchAddresses = useCallback(async () => {
        try {
            const { data } = await customerApi.getProfile();
            const profile = data?.result ?? data?.data ?? data;
            const raw = Array.isArray(profile?.addresses) ? profile.addresses : [];
            setRawAddresses(raw);
            setProfileName(profile?.name ?? "");
            setProfilePhone(profile?.phone ?? "");
            setAddresses(mapProfileToAddresses(profile));
        } catch {
            setAddresses([]);
            setRawAddresses([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAddresses();
    }, [fetchAddresses]);

    // Nominatim autocomplete suggestion search
    useEffect(() => {
        if (!showAddressForm) return;
        const q = String(addressAutocompleteValue || "").trim();
        if (q.length < 3) {
            setKeywordAddressSuggestions([]);
            setIsKeywordSearching(false);
            return;
        }

        const t = setTimeout(async () => {
            try {
                setIsKeywordSearching(true);
                const refLat = mapPosition[0];
                const refLng = mapPosition[1];
                const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=10&q=${encodeURIComponent(q)}`;
                const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "AppZeto-QuickCommerce" } });
                const json = await res.json();
                const mapped = (Array.isArray(json) ? json : []).map((r) => ({
                    id: r.place_id || r.osm_id,
                    display: r.display_name || "",
                    lat: Number(r.lat),
                    lng: Number(r.lon),
                    address: r.address || {},
                }));
                const withDistance = mapped
                    .filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng))
                    .map((x) => ({
                        ...x,
                        distanceMeters: calculateDistance(refLat, refLng, x.lat, x.lng),
                    }))
                    .sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity))
                    .slice(0, 4);
                setKeywordAddressSuggestions(withDistance);
            } catch {
                setKeywordAddressSuggestions([]);
            } finally {
                setIsKeywordSearching(false);
            }
        }, 350);
        return () => clearTimeout(t);
    }, [addressAutocompleteValue, showAddressForm]);

    const handleMapMoveEnd = useCallback(async (lat, lng, { signal } = {}) => {
        const coordKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
        if (manualFieldRefs.current._lastCoords === coordKey) return;
        manualFieldRefs.current._lastCoords = coordKey;

        const parsed = await reverseGeocode(lat, lng);
        if (!parsed || signal?.aborted) return;

        const friendlyAddress = parsed.address || parsed.formattedAddress || "";
        setCurrentAddress(friendlyAddress);
        setAddForm((prev) => ({
            ...prev,
            address: parsed.street || parsed.area || prev.address || friendlyAddress,
            city: parsed.city || prev.city || "",
            state: parsed.state || prev.state || "",
            pincode: parsed.postalCode || prev.pincode || "",
        }));
    }, []);

    const { bindMap, detachMap, setLastGeocoded } = useDebouncedMapGeocode({
        debounceMs: DEFAULT_MAP_GEOCODE_DEBOUNCE_MS,
        minDistanceM: DEFAULT_MAP_GEOCODE_MIN_DISTANCE_M,
        skipRef: skipMapIdleRef,
        onGeocode: handleMapMoveEnd,
        onCenterChange: (lat, lng) => setMapPosition([lat, lng]),
    });

    // Google Maps Initializer
    useEffect(() => {
        if (!MAPS_ENABLED || mapUnavailable || !showAddressForm || !mapContainerRef.current) return;

        let isMounted = true;
        setMapLoading(true);

        const initializeGoogleMap = async () => {
            try {
                const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
                await loadGoogleMaps(apiKey);
                const google = typeof window !== "undefined" ? window.google : null;
                if (!google?.maps?.Map) throw new Error("Google Maps is unavailable");
                if (!isMounted || !mapContainerRef.current) return;

                const initialPos = { lat: mapPosition[0], lng: mapPosition[1] };

                const map = new google.maps.Map(mapContainerRef.current, {
                    center: initialPos,
                    zoom: 16,
                    disableDefaultUI: true,
                    zoomControl: true,
                    gestureHandling: "greedy",
                    styles: [
                        { featureType: "poi", stylers: [{ visibility: "off" }] },
                        { featureType: "transit", stylers: [{ visibility: "off" }] },
                    ],
                });
                googleMapRef.current = map;
                setLastGeocoded(initialPos);
                bindMap(map);

                setMapLoading(false);
            } catch (err) {
                setMapUnavailable(true);
                setMapLoading(false);
            }
        };
        initializeGoogleMap();
        return () => {
            isMounted = false;
            detachMap();
        };
    }, [showAddressForm, mapUnavailable, bindMap, detachMap, setLastGeocoded]);

    const handleUseCurrentLocation = async () => {
        try {
            toast.loading("Getting location...", { id: "geo" });
            const res = await refreshLocation();

            if (res?.ok && res.location) {
                const loc = res.location;
                const newPos = [loc.latitude, loc.longitude];
                setMapPosition(newPos);

                const parsed = await reverseGeocode(loc.latitude, loc.longitude);
                const friendlyAddress = parsed?.address || parsed?.formattedAddress || loc.name || "";
                setCurrentAddress(friendlyAddress);

                if (googleMapRef.current) {
                    googleMapRef.current.panTo({ lat: loc.latitude, lng: loc.longitude });
                    googleMapRef.current.setZoom(17);
                }

                if (showAddressForm) {
                    setAddForm((prev) => ({
                        ...prev,
                        address: parsed?.street || parsed?.area || friendlyAddress,
                        city: parsed?.city || prev.city || "",
                        state: parsed?.state || prev.state || "",
                        pincode: parsed?.postalCode || prev.pincode || "",
                    }));
                    toast.success("Location updated", { id: "geo" });
                } else {
                    const payload = {
                        name: friendlyAddress,
                        time: "12-15 mins",
                        city: parsed?.city || "",
                        state: parsed?.state || "",
                        pincode: parsed?.postalCode || "",
                        latitude: loc.latitude,
                        longitude: loc.longitude,
                    };
                    updateLocation(payload, { persist: true, updateSavedHome: false });

                    try {
                        const stored = readStoredCheckoutState();
                        stored.currentAddress = {
                            type: "Other",
                            name: profileName || "",
                            phone: profilePhone || "",
                            address: friendlyAddress,
                            city: parsed?.city || "",
                            landmark: "",
                            zipCode: parsed?.postalCode || "",
                            pincode: parsed?.postalCode || "",
                            location: { lat: loc.latitude, lng: loc.longitude },
                        };
                        localStorage.setItem("quick_commerce_checkout_state_v1", JSON.stringify(stored));
                    } catch {}

                    toast.success("Location updated", { id: "geo" });
                    setTimeout(() => {
                        if (searchParams.get("from") === "cart") {
                            navigate(-1);
                        } else {
                            navigate("/quick-commerce/checkout");
                        }
                    }, 800);
                }
            } else {
                toast.error(res?.error || "Could not determine location", { id: "geo" });
            }
        } catch {
            toast.error("Failed to get location", { id: "geo" });
        }
    };

    const handleSelectSavedAddress = async (addr) => {
        const rawText = addr?.address || "";
        const addrLoc = addr?.location;
        const hasLoc = addrLoc && typeof addrLoc.lat === "number" && typeof addrLoc.lng === "number";

        let resolvedLoc = hasLoc ? addrLoc : null;
        if (!resolvedLoc && addr.placeId) {
            try {
                const resp = await customerApi.geocodePlaceId(addr.placeId);
                const loc = resp.data?.result?.location;
                if (loc && typeof loc.lat === "number") {
                    resolvedLoc = { lat: loc.lat, lng: loc.lng };
                }
            } catch {}
        }
        if (!resolvedLoc) {
            try {
                const resp = await customerApi.geocodeAddress(rawText);
                const loc = resp.data?.result?.location;
                if (loc && typeof loc.lat === "number") {
                    resolvedLoc = { lat: loc.lat, lng: loc.lng };
                }
            } catch {}
        }

        const finalLat = resolvedLoc?.lat ?? resolvedLoc?.latitude ?? DEFAULT_LAT;
        const finalLng = resolvedLoc?.lng ?? resolvedLoc?.longitude ?? DEFAULT_LNG;

        const locationPayload = {
            name: rawText,
            time: "12-15 mins",
            city: addr.city || "",
            state: addr.state || "",
            pincode: addr.pincode || "",
            latitude: finalLat,
            longitude: finalLng,
        };
        updateLocation(locationPayload, { persist: true, updateSavedHome: false });

        try {
            const stored = readStoredCheckoutState();
            stored.currentAddress = {
                id: addr.id,
                type: addr.type || "Other",
                name: addr.name || profileName || "",
                phone: addr.phone || profilePhone || "",
                address: rawText,
                city: addr.city || "",
                landmark: addr.landmark || "",
                zipCode: addr.pincode || "",
                pincode: addr.pincode || "",
                location: { lat: finalLat, lng: finalLng },
            };
            localStorage.setItem("quick_commerce_checkout_state_v1", JSON.stringify(stored));
        } catch {}

        toast.success("Address selected");

        if (searchParams.get("from") === "cart") {
            navigate(-1);
        } else {
            navigate("/quick-commerce/checkout");
        }
    };

    const scrollFieldIntoView = useCallback((fieldName) => {
        const el = manualFieldRefs.current?.[fieldName];
        if (!el) return;
        setTimeout(() => {
            try {
                const scrollHost = formBodyRef.current;
                if (!scrollHost) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    return;
                }
                const hostRect = scrollHost.getBoundingClientRect();
                const elRect = el.getBoundingClientRect();
                const viewportHeight =
                    typeof window !== "undefined" && window.visualViewport
                        ? window.visualViewport.height
                        : window.innerHeight;
                const safeBottom = viewportHeight - keyboardInset - 90;
                const overBy = elRect.bottom - safeBottom;
                if (overBy > 0) {
                    scrollHost.scrollTo({
                        top: scrollHost.scrollTop + overBy + 24,
                        behavior: "smooth",
                    });
                    return;
                }
                if (elRect.top < hostRect.top + 70) {
                    const upBy = hostRect.top + 70 - elRect.top;
                    scrollHost.scrollTo({
                        top: Math.max(0, scrollHost.scrollTop - upBy - 12),
                        behavior: "smooth",
                    });
                    return;
                }
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            } catch {}
        }, 120);
    }, [keyboardInset]);

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const handleAddAddressClick = () => {
        setAddForm({
            type: "home",
            name: profileName,
            phone: profilePhone,
            address: "",
            landmark: "",
            city: "",
            state: "",
            pincode: "",
        });
        setIsEditing(false);
        setEditAddressId(null);
        setMapPosition(DEFAULT_POSITION);
        setCurrentAddress("");
        setShowAddressForm(true);
    };

    const handleEditAddressClick = (addr) => {
        const lat = addr.location?.coordinates?.[1] ?? addr.location?.lat ?? DEFAULT_LAT;
        const lng = addr.location?.coordinates?.[0] ?? addr.location?.lng ?? DEFAULT_LNG;

        setAddForm({
            type: (addr.type || "home").toLowerCase(),
            name: addr.name || profileName,
            phone: addr.phone || profilePhone,
            address: addr.street || addr.address || "",
            landmark: addr.landmark || "",
            city: addr.city || "",
            state: addr.state || "",
            pincode: addr.pincode || "",
        });
        setIsEditing(true);
        setEditAddressId(addr.id);
        setMapPosition([lat, lng]);
        setCurrentAddress(addr.address || "");
        setShowAddressForm(true);
    };

    const handleCancelAddressForm = () => {
        setShowAddressForm(false);
    };

    const handleAddressFormSubmit = async (e) => {
        e.preventDefault();
        const address = addForm.address?.trim();
        const city = addForm.city?.trim();
        const state = addForm.state?.trim();

        if (!address) {
            toast.error("Please enter the address");
            return;
        }
        if (!city) {
            toast.error("Please enter the city");
            return;
        }
        if (!state) {
            toast.error("Please enter the state");
            return;
        }

        setSaving(true);
        try {
            const rawLabel = addForm.type === "work" ? "Office" : capitalize(addForm.type);
            const pincode = addForm.pincode?.trim() || "";
            const fullAddress =
                currentAddress?.trim() ||
                [address, addForm.landmark?.trim(), city, state, pincode]
                    .filter(Boolean)
                    .join(", ");
            const nextAddressItem = {
                label: rawLabel,
                address: fullAddress,
                street: address,
                additionalDetails: addForm.landmark?.trim() || "",
                city: city,
                state: state,
                zipCode: pincode,
                pincode: pincode,
                phone: addForm.phone?.trim() || "",
                latitude: mapPosition[0],
                longitude: mapPosition[1],
                location: {
                    type: "Point",
                    coordinates: [mapPosition[1], mapPosition[0]],
                },
            };

            let updatedAddressesList = [];
            if (isEditing) {
                const idx = rawAddresses.findIndex(
                    (_, i) =>
                        addresses[i]?.id === editAddressId ||
                        (addresses[i]?.address === currentAddress && addresses[i]?.type === capitalize(addForm.type))
                );
                if (idx >= 0) {
                    updatedAddressesList = rawAddresses.map((r, i) => (i === idx ? { ...r, ...nextAddressItem } : r));
                } else {
                    updatedAddressesList = [...rawAddresses, nextAddressItem];
                }
            } else {
                updatedAddressesList = [...rawAddresses, nextAddressItem];
            }

            await customerApi.updateProfile({
                ...(addForm.name?.trim() && { name: addForm.name.trim() }),
                ...(addForm.phone?.trim() && { phone: addForm.phone.trim() }),
                addresses: updatedAddressesList,
            });

            toast.success(isEditing ? "Address updated successfully" : "Address saved successfully");
            setShowAddressForm(false);
            setAddressAutocompleteValue("");
            setKeywordAddressSuggestions([]);

            setLoading(true);
            await fetchAddresses();
            await refreshContextAddresses?.();

            // Set as chosen checkout address
            const resolvedItem = {
                id: editAddressId || Date.now().toString(),
                type: rawLabel,
                name: addForm.name || profileName,
                phone: addForm.phone || profilePhone,
                address: [address, addForm.landmark].filter(Boolean).join(", "),
                city: city,
                landmark: addForm.landmark,
                pincode: addForm.pincode,
                location: { lat: mapPosition[0], lng: mapPosition[1] },
            };
            handleSelectSavedAddress(resolvedItem);
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to save address");
        } finally {
            setSaving(false);
        }
    };

    // ── Delete ──
    const handleDeleteClick = (addr) => {
        setSelectedAddress(addr);
        setIsDeleteOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedAddress) return;
        const idx = addresses.findIndex(
            (a) => a.id === selectedAddress.id || (a.address === selectedAddress.address && a.type === selectedAddress.type)
        );
        if (idx < 0) {
            setIsDeleteOpen(false);
            return;
        }

        setDeleting(true);
        try {
            await customerApi.updateProfile({
                addresses: rawAddresses.filter((_, i) => i !== idx),
            });
            toast.success("Address deleted successfully");
            setIsDeleteOpen(false);
            setSelectedAddress(null);

            setLoading(true);
            await fetchAddresses();
            await refreshContextAddresses?.();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to delete address");
        } finally {
            setDeleting(false);
        }
    };

    useEffect(() => {
        if (!showAddressForm) return;
        const updateBaseMapHeight = () => {
            const vh = typeof window !== "undefined" ? window.innerHeight : 800;
            const target = Math.round(vh * 0.45);
            setBaseMapHeight(Math.max(260, Math.min(420, target)));
        };
        updateBaseMapHeight();
        window.addEventListener("resize", updateBaseMapHeight);
        return () => window.removeEventListener("resize", updateBaseMapHeight);
    }, [showAddressForm]);

    useEffect(() => {
        if (!showAddressForm) return;
        setFormScrollTop(0);
    }, [showAddressForm]);

    useEffect(() => {
        if (!showAddressForm || typeof window === "undefined" || !window.visualViewport) return;
        const viewport = window.visualViewport;
        const updateKeyboardInset = () => {
            const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
            setKeyboardInset(inset > 0 ? inset : 0);
        };
        updateKeyboardInset();
        viewport.addEventListener("resize", updateKeyboardInset);
        viewport.addEventListener("scroll", updateKeyboardInset);
        return () => {
            viewport.removeEventListener("resize", updateKeyboardInset);
            viewport.removeEventListener("scroll", updateKeyboardInset);
        };
    }, [showAddressForm]);

    if (showAddressForm) {
        const mapHeight = baseMapHeight;
        return (
            <div className="fixed inset-0 z-[9999] bg-white dark:bg-[#0a0a0a] flex flex-col h-screen overflow-hidden font-sans">
                <div className="flex-shrink-0 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={handleCancelAddressForm} className="rounded-full">
                        <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <h1 className="text-lg font-bold">{isEditing ? "Edit delivery location" : "Add delivery location"}</h1>
                </div>

                <div
                    ref={formBodyRef}
                    onScroll={(e) => {
                        setFormScrollTop(e.currentTarget.scrollTop);
                    }}
                    className="flex-1 overflow-y-auto"
                    style={{ paddingBottom: `${96 + keyboardInset}px` }}
                >
                    {/* Map Section - Parallax enabled */}
                    <div
                        className="flex-shrink-0 relative z-0"
                        style={{
                            height: `${mapHeight}px`,
                            transform: `translateY(${formScrollTop * 0.4}px)`,
                            opacity: clamp(1 - formScrollTop / 500, 0.4, 1),
                        }}
                    >
                        <div className="absolute top-4 left-4 right-4 z-20">
                            <div className="relative group shadow-2xl">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-5 w-5 text-gray-400" />
                                </div>
                                <Input
                                    value={addressAutocompleteValue}
                                    onChange={(e) => setAddressAutocompleteValue(e.target.value)}
                                    placeholder="Search area, street, landmark..."
                                    className="pl-10 h-12 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-md border-none rounded-xl shadow-lg focus:ring-2 focus:ring-[#FF0000] transition-all"
                                />
                                {isKeywordSearching && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#FF0000] border-t-transparent" />
                                    </div>
                                )}

                                {keywordAddressSuggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden z-30 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                                            Suggestions
                                        </p>
                                        {keywordAddressSuggestions.map((s) => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                onClick={() => {
                                                    const { lat, lng, display, address: a } = s;
                                                    setMapPosition([lat, lng]);
                                                    if (googleMapRef.current) {
                                                        googleMapRef.current.panTo({ lat, lng });
                                                        googleMapRef.current.setZoom(17);
                                                    }
                                                    setAddressAutocompleteValue(display);
                                                    const city = a.city || a.town || a.village || a.county || "";
                                                    const state = a.state || "";
                                                    const zipCode = a.postcode || "";
                                                    setAddForm((prev) => ({
                                                        ...prev,
                                                        address: display || prev.address,
                                                        city: city || prev.city,
                                                        state: state || prev.state,
                                                        pincode: zipCode || prev.pincode,
                                                    }));
                                                    setKeywordAddressSuggestions([]);
                                                }}
                                                className="w-full px-4 py-3 flex items-start gap-3 hover:bg-[#FFF2EB] dark:hover:bg-red-900/10 transition-colors text-left border-b border-gray-50 dark:border-gray-800 last:border-none"
                                            >
                                                <MapPin className="h-4 w-4 text-gray-400 mt-1 flex-shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                        {s.display}
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                        {s.address?.city || s.address?.state}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div ref={mapContainerRef} className="w-full h-full bg-gray-100 dark:bg-gray-800" />

                        {mapUnavailable && (
                            <div className="absolute inset-x-4 top-20 z-20 rounded-2xl border border-amber-200 bg-white/95 px-4 py-3 text-sm text-amber-900 shadow-lg backdrop-blur">
                                Map preview could not load here. You can still enter and save the address manually below.
                            </div>
                        )}

                        <CenterPin />

                        {mapLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF0000]" />
                            </div>
                        )}

                        <div className="absolute bottom-10 right-4 z-10">
                            <Button
                                onClick={handleUseCurrentLocation}
                                className="bg-white text-black hover:bg-gray-100 shadow-xl border border-gray-200 rounded-full h-12 px-6"
                            >
                                <Navigation className="h-4 w-4 mr-2 text-[#FF0000]" /> Use My Location
                            </Button>
                        </div>
                    </div>

                    <div className="relative bg-white dark:bg-[#0a0a0a] rounded-t-[32px] -mt-8 z-10 p-4 space-y-6 shadow-[0_-12px_24px_-10px_rgba(0,0,0,0.1)]">
                        <div className="bg-[#FFF2EB]/50 dark:bg-green-900/10 border border-[#FFE8DB] dark:border-green-900/20 rounded-xl p-4 flex gap-3">
                            <MapPin className="h-5 w-5 text-[#FF0000] mt-0.5" />
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-red-800 dark:text-green-200 uppercase mb-1">
                                    Pinned Location
                                </p>
                                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                                    {currentAddress || "Select a location on map"}
                                </p>
                            </div>
                        </div>

                        <div>
                            <Label className="text-sm font-bold mb-2 block">Primary Address (Street / Area / Landmark)</Label>
                            <Input
                                placeholder="Search or drag to update street/area"
                                value={addForm.address}
                                onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                                onFocus={() => scrollFieldIntoView("address")}
                                ref={(el) => {
                                    manualFieldRefs.current.address = el;
                                }}
                                className="mb-4 h-12 rounded-xl bg-gray-50 dark:bg-gray-800/50"
                                required
                            />

                            <Label className="text-sm font-bold mb-2 block text-[#FF0000] dark:text-green-400">
                                Secondary Address (House No. / Flat / Floor)
                            </Label>
                            <Input
                                placeholder="E.g. Flat 402, 4th Floor, AppZeto Building"
                                value={addForm.landmark}
                                onChange={(e) => setAddForm({ ...addForm, landmark: e.target.value })}
                                onFocus={() => scrollFieldIntoView("landmark")}
                                ref={(el) => {
                                    manualFieldRefs.current.landmark = el;
                                }}
                                className="h-12 rounded-xl border-[#FFCCCC] dark:border-green-900/40 focus:ring-green-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-xs mb-1 block">City</Label>
                                <Input
                                    value={addForm.city}
                                    onChange={(e) => setAddForm({ ...addForm, city: e.target.value })}
                                    onFocus={() => scrollFieldIntoView("city")}
                                    ref={(el) => {
                                        manualFieldRefs.current.city = el;
                                    }}
                                    className="h-12 rounded-xl"
                                    required
                                />
                            </div>
                            <div>
                                <Label className="text-xs mb-1 block">State</Label>
                                <Input
                                    value={addForm.state}
                                    onChange={(e) => setAddForm({ ...addForm, state: e.target.value })}
                                    onFocus={() => scrollFieldIntoView("state")}
                                    ref={(el) => {
                                        manualFieldRefs.current.state = el;
                                    }}
                                    className="h-12 rounded-xl"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <Label className="text-xs mb-1 block">Pincode / ZIP</Label>
                            <Input
                                placeholder="Pincode"
                                value={addForm.pincode}
                                onChange={(e) => setAddForm({ ...addForm, pincode: e.target.value })}
                                onFocus={() => scrollFieldIntoView("pincode")}
                                ref={(el) => {
                                    manualFieldRefs.current.pincode = el;
                                }}
                                className="h-12 rounded-xl"
                            />
                        </div>

                        <div>
                            <Label className="text-sm font-bold mb-2 block">Save address as</Label>
                            <div className="flex gap-2">
                                {["home", "work", "other"].map((l) => (
                                    <Button
                                        key={l}
                                        type="button"
                                        variant={addForm.type === l ? "default" : "outline"}
                                        onClick={() => setAddForm({ ...addForm, type: l })}
                                        className="flex-1 capitalize"
                                        style={addForm.type === l ? { backgroundColor: "#FF0000", color: "white" } : {}}
                                    >
                                        {l === "work" ? "Office" : l}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div
                    className="fixed left-0 right-0 p-4 bg-white dark:bg-[#1a1a1a] border-t dark:border-gray-800 transition-[bottom] duration-150 z-50"
                    style={{ bottom: `${keyboardInset}px` }}
                >
                    <Button
                        className="w-full h-12 text-white font-bold text-lg"
                        style={{ backgroundColor: "#FF0000" }}
                        onClick={handleAddressFormSubmit}
                        disabled={saving}
                    >
                        {saving ? "Saving..." : "Save Address & Proceed"}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex flex-col font-sans transition-colors duration-500">
            {/* Header */}
            <div className="flex-shrink-0 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 px-4 py-4 flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
                    <ChevronLeft className="h-6 w-6" />
                </Button>
                <h1 className="text-xl font-bold">Select Location</h1>
            </div>

            <div className="flex-1 overflow-y-auto pb-10">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800">
                    <button
                        onClick={handleUseCurrentLocation}
                        className="w-full flex items-center gap-4 p-4 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm hover:shadow-md transition-all group"
                    >
                        <div className="h-10 w-10 rounded-full bg-[#FFE8DB] dark:bg-red-900/30 flex items-center justify-center">
                            <Navigation className="h-5 w-5 text-[#FF0000]" />
                        </div>
                        <div className="text-left flex-1">
                            <p className="font-bold text-[#FF0000]">Use Current Location</p>
                            <p className="text-xs text-gray-500 line-clamp-1">
                                {currentAddress || "Enable GPS for accuracy"}
                            </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                    </button>
                </div>

                <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Saved Addresses</h2>
                        <Button
                            variant="ghost"
                            className="text-[#FF0000] hover:text-[#0b721b] p-0 h-auto font-bold"
                            onClick={handleAddAddressClick}
                        >
                            <Plus className="h-4 w-4 mr-1" /> Add New
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {loading ? (
                            <div className="text-center py-10 opacity-50">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FF0000] border-t-transparent mx-auto mb-2" />
                                <p>Loading addresses...</p>
                            </div>
                        ) : addresses.length === 0 ? (
                            <div className="text-center py-10 opacity-50">
                                <MapPin className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                                <p>No addresses saved yet</p>
                            </div>
                        ) : (
                            addresses.map((addr, idx) => {
                                const Icon = getAddressIcon(addr);
                                return (
                                    <div
                                        key={addr.id || idx}
                                        className="w-full flex items-start justify-between gap-4 p-4 bg-slate-50 dark:bg-[#1a1a1a] rounded-xl hover:bg-[#FFF2EB] dark:hover:bg-red-900/10 transition-colors text-left group cursor-pointer relative"
                                        onClick={() => handleSelectSavedAddress(addr)}
                                    >
                                        <div className="flex items-start gap-4 flex-1 min-w-0">
                                            <div className="h-10 w-10 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm flex-shrink-0">
                                                <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-gray-900 dark:text-white capitalize">
                                                    {addr.type || "Address"}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                                                    {addr.address}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {addr.name} • {addr.phone}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 flex-shrink-0 self-center">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleEditAddressClick(addr);
                                                }}
                                                className="h-8 w-8 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center border border-gray-200 dark:border-gray-700 shadow-sm hover:border-[#FF0000] text-gray-500 hover:text-[#FF0000] transition-all"
                                            >
                                                <Edit2 className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleDeleteClick(addr);
                                                }}
                                                className="h-8 w-8 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center border border-gray-200 dark:border-gray-700 shadow-sm hover:border-red-500 text-gray-500 hover:text-red-500 transition-all"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[425px] rounded-2xl p-5">
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Delete Address?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this address? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedAddress && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 my-2">
                            <p className="font-bold text-slate-800 mb-1">{selectedAddress.type}</p>
                            <p className="text-slate-600 text-sm">{selectedAddress.address}</p>
                        </div>
                    )}
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={deleting}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            className="bg-red-500 hover:bg-red-600 text-white font-bold"
                            onClick={handleConfirmDelete}
                            disabled={deleting}
                        >
                            {deleting ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <style>{`
                @keyframes bounce-short {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-4px); }
                }
                .animate-bounce-short {
                    animation: bounce-short 1s infinite ease-in-out;
                }
            `}</style>
        </div>
    );
};

export default AddressesPage;