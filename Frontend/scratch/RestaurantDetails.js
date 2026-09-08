import { useState, useEffect, useRef, Component, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { restaurantAPI, orderAPI } from "@food/api";
import { API_BASE_URL } from "@food/api/config";
import { toast } from "sonner";
import { useLocation } from "@food/hooks/useLocation";
import { useZone } from "@food/hooks/useZone";
import {
  ArrowLeft,
  Search,
  MoreVertical,
  MapPin,
  Clock,
  Tag,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Info,
  Star,
  SlidersHorizontal,
  Utensils,
  Flame,
  Bookmark,
  Heart,
  Share2,
  Plus,
  Minus,
  X,
  RotateCcw,
  Zap,
  Check,
  Lock,
  Percent,
  Eye,
  Users,
  AlertCircle,
  Copy,
  MessageCircle,
  Send,
  Mail
} from "lucide-react";
import { Button } from "@food/components/ui/button";
import { Badge } from "@food/components/ui/badge";
import { Checkbox } from "@food/components/ui/checkbox";
import AnimatedPage from "@food/components/user/AnimatedPage";
import { useCart } from "@food/context/CartContext";
import { useProfile } from "@food/context/ProfileContext";
import AddToCartAnimation from "@food/components/user/AddToCartAnimation";
import { getCompanyNameAsync } from "@common/utils/businessSettings";
import { isModuleAuthenticated } from "@food/utils/auth";
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability";
import useAppBackNavigation from "@food/hooks/useAppBackNavigation";
import {
  buildCartLineId,
  getDefaultFoodVariant,
  getFoodDisplayPrice,
  getFoodPriceLabel,
  getFoodVariants,
  hasFoodVariants
} from "@food/utils/foodVariants";
import fssaiLogo from "@food/assets/fssai.png";
import { RestaurantDetailSkeleton } from "@food/components/ui/loading-skeletons";
const debugLog = (...args) => {
};
const debugWarn = (...args) => {
};
const debugError = (...args) => {
};
const FOOD_IMAGE_FALLBACK = "https://picsum.photos/seed/food-fallback/800/600";
const RUPEE_SYMBOL = "\u20B9";
const RESTAURANT_DETAILS_FILTERS_STORAGE_KEY = "food-restaurant-details-filters";
function RestaurantDetailsContent() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const goBack = useAppBackNavigation();
  const [searchParams] = useSearchParams();
  const showOnlyUnder250 = searchParams.get("under250") === "true";
  const targetDishId = useMemo(() => String(searchParams.get("dish") || "").trim(), [searchParams]);
  const { addToCart, updateQuantity, removeFromCart, getCartItem, cart } = useCart();
  const { vegMode, addDishFavorite, removeDishFavorite, isDishFavorite, getDishFavorites, getFavorites, addFavorite, removeFavorite, isFavorite } = useProfile();
  const { location: userLocation } = useLocation();
  const { zoneId, zone, loading: loadingZone, isOutOfService } = useZone(userLocation);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [quantities, setQuantities] = useState({});
  const [showManageCollections, setShowManageCollections] = useState(false);
  const [showItemDetail, setShowItemDetail] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [showScheduleSheet, setShowScheduleSheet] = useState(false);
  const [showOffersSheet, setShowOffersSheet] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [expandedCoupons, setExpandedCoupons] = useState(/* @__PURE__ */ new Set());
  const [showMenuSheet, setShowMenuSheet] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [availabilityTick, setAvailabilityTick] = useState(Date.now());
  const [showMenuOptionsSheet, setShowMenuOptionsSheet] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharePayload, setSharePayload] = useState(null);
  const [expandedAddButtons, setExpandedAddButtons] = useState(/* @__PURE__ */ new Set());
  const [expandedSections, setExpandedSections] = useState(/* @__PURE__ */ new Set([0]));
  const [highlightedDishId, setHighlightedDishId] = useState(null);
  const [loadingMenuItems, setLoadingMenuItems] = useState(true);
  const [selectedMenuCategory, setSelectedMenuCategory] = useState("all");
  const dishCardRefs = useRef({});
  const getLineItemIdForDish = (item, variant = null) => buildCartLineId(item?.id || item?._id || "", variant?.id || variant?._id || "");
  const getVariantForDish = (item, preferredVariantId = "") => {
    const variants = getFoodVariants(item);
    if (variants.length === 0) return null;
    return variants.find((variant) => String(variant.id) === String(preferredVariantId || "")) || variants[0];
  };
  const getDishQuantity = (item, preferredVariantId = "") => {
    const variant = getVariantForDish(item, preferredVariantId);
    const lineItemId = getLineItemIdForDish(item, variant);
    return quantities[lineItemId] || 0;
  };
  const [filters, setFilters] = useState(() => {
    if (typeof window === "undefined" || !slug) {
      return {
        sortBy: null,
        vegNonVeg: null,
        highlyReordered: false,
        spicy: false
      };
    }
    try {
      const raw = window.localStorage.getItem(RESTAURANT_DETAILS_FILTERS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const savedFilters = parsed?.[slug];
        if (savedFilters && typeof savedFilters === "object") {
          return {
            sortBy: savedFilters.sortBy === "low-to-high" || savedFilters.sortBy === "high-to-low" ? savedFilters.sortBy : null,
            vegNonVeg: savedFilters.vegNonVeg === "veg" || savedFilters.vegNonVeg === "non-veg" ? savedFilters.vegNonVeg : null,
            highlyReordered: savedFilters.highlyReordered === true,
            spicy: savedFilters.spicy === true
          };
        }
      }
    } catch (error) {
      debugWarn("Failed to initialize restaurant filters from localStorage:", error);
    }
    return {
      sortBy: null,
      vegNonVeg: null,
      highlyReordered: false,
      spicy: false
    };
  });
  const [restaurant, setRestaurant] = useState(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(true);
  const [restaurantError, setRestaurantError] = useState(null);
  const fetchedRestaurantRef = useRef(false);
  const fetchedSlugRef = useRef(null);
  useEffect(() => {
    const intervalId = setInterval(() => {
      setAvailabilityTick(Date.now());
    }, 6e4);
    return () => clearInterval(intervalId);
  }, []);
  useEffect(() => {
    setSelectedMenuCategory("all");
  }, [slug]);
  useEffect(() => {
    const fetchRestaurant = async () => {
      if (!slug) return;
      if (fetchedRestaurantRef.current && fetchedSlugRef.current === slug && restaurant) {
        return;
      }
      try {
        setLoadingRestaurant(!fetchedRestaurantRef.current && !restaurant);
        setRestaurantError(null);
        debugLog("Fetching restaurant with slug:", slug);
        let response = null;
        let apiRestaurant = null;
        if (!apiRestaurant) {
          try {
            try {
              response = await restaurantAPI.getRestaurantById(slug);
              if (response?.data?.success && response?.data?.data) {
                apiRestaurant = response.data.data;
                debugLog("? Found restaurant in restaurant API by slug/ID:", apiRestaurant);
              }
            } catch (directLookupError) {
              debugLog("? Direct lookup failed, trying search by name...");
              const searchVariants = zoneId ? [{ limit: 100, zoneId, _ts: Date.now() }, { limit: 100, _ts: Date.now() }] : [{ limit: 100, _ts: Date.now() }];
              for (const searchParams2 of searchVariants) {
                try {
                  const searchResponse = await restaurantAPI.getRestaurants(searchParams2, { noCache: true });
                  const restaurants = searchResponse?.data?.data?.restaurants || searchResponse?.data?.data || [];
                  const restaurantName = slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
                  const matchingRestaurant = restaurants.find(
                    (r) => r.slug === slug || r.name?.toLowerCase().replace(/\s+/g, "-") === slug.toLowerCase() || r.name?.toLowerCase() === restaurantName.toLowerCase()
                  );
                  if (matchingRestaurant) {
                    const fullResponse = await restaurantAPI.getRestaurantById(matchingRestaurant._id || matchingRestaurant.restaurantId);
                    if (fullResponse.data && fullResponse.data.success && fullResponse.data.data) {
                      apiRestaurant = fullResponse.data.data;
                      debugLog("? Found restaurant in restaurant API by name search:", apiRestaurant);
                      break;
                    }
                  }
                } catch (searchError) {
                  debugWarn("? Search fallback failed for params:", searchParams2, searchError?.message);
                }
              }
            }
          } catch (restaurantError2) {
            debugError("? Restaurant not found in restaurant API either:", restaurantError2);
          }
        }
        if (apiRestaurant) {
          debugLog("? Fetched restaurant from API:", apiRestaurant);
          debugLog("? Restaurant data keys:", Object.keys(apiRestaurant));
          debugLog("? Restaurant name field:", apiRestaurant?.name);
          debugLog("? Restaurant restaurantId:", apiRestaurant?.restaurantId);
          debugLog("? Restaurant _id:", apiRestaurant?._id);
          debugLog("? Restaurant.restaurant:", apiRestaurant?.restaurant);
          const actualRestaurant = apiRestaurant?.restaurant || apiRestaurant;
          const formatRestaurantAddress = (locationObj2) => {
            if (!locationObj2) return "Location";
            if (typeof locationObj2 === "string") {
              return locationObj2;
            }
            if (locationObj2.formattedAddress && locationObj2.formattedAddress.trim() !== "" && locationObj2.formattedAddress !== "Select location") {
              const isCoordinates = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(locationObj2.formattedAddress.trim());
              if (!isCoordinates) {
                const formattedAddr = locationObj2.formattedAddress.trim();
                const hasPinCode = /\b\d{6}\b/.test(formattedAddr);
                if (hasPinCode) {
                  const cleanedAddr = formattedAddr.replace(/^[A-Z0-9]+\+[A-Z0-9]+,\s*/i, "");
                  return cleanedAddr;
                }
                if (formattedAddr.split(",").length >= 3) {
                  const cleanedAddr = formattedAddr.replace(/^[A-Z0-9]+\+[A-Z0-9]+,\s*/i, "");
                  return cleanedAddr;
                }
              }
            }
            const addressParts = [];
            if (locationObj2.addressLine1 && locationObj2.addressLine1.trim() !== "") {
              addressParts.push(locationObj2.addressLine1.trim());
            }
            if (locationObj2.addressLine2 && locationObj2.addressLine2.trim() !== "") {
              addressParts.push(locationObj2.addressLine2.trim());
            }
            if (locationObj2.area && locationObj2.area.trim() !== "") {
              addressParts.push(locationObj2.area.trim());
            }
            if (locationObj2.city && locationObj2.city.trim() !== "") {
              addressParts.push(locationObj2.city.trim());
            }
            if (locationObj2.state && locationObj2.state.trim() !== "") {
              addressParts.push(locationObj2.state.trim());
            }
            const pinCode = locationObj2.pincode || locationObj2.zipCode || locationObj2.postalCode;
            if (pinCode && pinCode.toString().trim() !== "") {
              addressParts.push(pinCode.toString().trim());
            }
            if (addressParts.length >= 3) {
              return addressParts.join(", ");
            }
            if (addressParts.length >= 2) {
              return addressParts.join(", ");
            }
            if (locationObj2.formattedAddress && locationObj2.formattedAddress.trim() !== "" && locationObj2.formattedAddress !== "Select location") {
              const isCoordinates = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(locationObj2.formattedAddress.trim());
              if (!isCoordinates) {
                const cleanedAddr = locationObj2.formattedAddress.trim().replace(/^[A-Z0-9]+\+[A-Z0-9]+,\s*/i, "");
                return cleanedAddr;
              }
            }
            if (locationObj2.address && locationObj2.address.trim() !== "") {
              return locationObj2.address.trim();
            }
            return locationObj2.area || locationObj2.city || "Location";
          };
          const locationObj = actualRestaurant?.location || apiRestaurant?.location;
          debugLog("? Location Object for formatting:", locationObj);
          debugLog("? formattedAddress field:", locationObj?.formattedAddress);
          const formattedAddress = formatRestaurantAddress(locationObj);
          debugLog("? Final Formatted Address:", formattedAddress);
          const calculateDistance = (lat1, lng1, lat2, lng2) => {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLng = (lng2 - lng1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
          };
          const restaurantLat2 = locationObj?.latitude || (locationObj?.coordinates && Array.isArray(locationObj.coordinates) ? locationObj.coordinates[1] : null);
          const restaurantLng2 = locationObj?.longitude || (locationObj?.coordinates && Array.isArray(locationObj.coordinates) ? locationObj.coordinates[0] : null);
          debugLog("? Restaurant coordinates:", { restaurantLat: restaurantLat2, restaurantLng: restaurantLng2, locationObj });
          const userLat = userLocation?.latitude;
          const userLng = userLocation?.longitude;
          debugLog("? User location:", { userLat, userLng, userLocation });
          let calculatedDistance = null;
          if (userLat && userLng && restaurantLat2 && restaurantLng2 && !isNaN(userLat) && !isNaN(userLng) && !isNaN(restaurantLat2) && !isNaN(restaurantLng2)) {
            const distanceInKm = calculateDistance(userLat, userLng, restaurantLat2, restaurantLng2);
            if (distanceInKm >= 1) {
              calculatedDistance = `${distanceInKm.toFixed(1)} km`;
            } else {
              const distanceInMeters = Math.round(distanceInKm * 1e3);
              calculatedDistance = `${distanceInMeters} m`;
            }
            debugLog("? Calculated distance from user to restaurant:", calculatedDistance, "km:", distanceInKm);
          } else {
            debugWarn("? Cannot calculate distance - missing coordinates:", {
              hasUserLocation: !!(userLat && userLng),
              hasRestaurantLocation: !!(restaurantLat2 && restaurantLng2),
              userLat,
              userLng,
              restaurantLat: restaurantLat2,
              restaurantLng: restaurantLng2
            });
          }
          const categoryFromArray = (list) => {
            if (!Array.isArray(list) || list.length === 0) return null;
            const firstEntry = list[0];
            if (typeof firstEntry === "string") return firstEntry;
            if (firstEntry && typeof firstEntry === "object") {
              return firstEntry.name || firstEntry.label || firstEntry.title || null;
            }
            return null;
          };
          const resolvedTopCategory = actualRestaurant?.topCategory || apiRestaurant?.topCategory || categoryFromArray(actualRestaurant?.topCategories) || categoryFromArray(apiRestaurant?.topCategories) || categoryFromArray(actualRestaurant?.cuisines) || categoryFromArray(apiRestaurant?.cuisines) || categoryFromArray(actualRestaurant?.categories) || categoryFromArray(apiRestaurant?.categories) || actualRestaurant?.cuisine || apiRestaurant?.cuisine || actualRestaurant?.category || apiRestaurant?.category || "Multi-cuisine";
          const onboardingStep2 = actualRestaurant?.onboarding?.step2 || apiRestaurant?.onboarding?.step2 || {};
          const onboardingStep4 = actualRestaurant?.onboarding?.step4 || apiRestaurant?.onboarding?.step4 || {};
          const normalizedProfileImage = actualRestaurant?.profileImage || apiRestaurant?.profileImage || onboardingStep2?.profileImageUrl || null;
          const normalizedCoverImages = Array.isArray(actualRestaurant?.coverImages) && actualRestaurant.coverImages.length > 0 ? actualRestaurant.coverImages : Array.isArray(apiRestaurant?.coverImages) && apiRestaurant.coverImages.length > 0 ? apiRestaurant.coverImages : [];
          const normalizedMenuImages = Array.isArray(actualRestaurant?.menuImages) && actualRestaurant.menuImages.length > 0 ? actualRestaurant.menuImages : Array.isArray(apiRestaurant?.menuImages) && apiRestaurant.menuImages.length > 0 ? apiRestaurant.menuImages : Array.isArray(onboardingStep2?.menuImageUrls) ? onboardingStep2.menuImageUrls : [];
          const normalizedRestaurantOffers = actualRestaurant?.restaurantOffers || apiRestaurant?.restaurantOffers || {};
          const transformedRestaurant = {
            id: actualRestaurant?.restaurantId || actualRestaurant?._id || actualRestaurant?.id || apiRestaurant?.restaurantId || apiRestaurant?._id || null,
            mongoId: actualRestaurant?._id || apiRestaurant?._id || null,
            name: actualRestaurant?.name || actualRestaurant?.restaurantName || apiRestaurant?.name || apiRestaurant?.restaurantName || "Unknown Restaurant",
            cuisine: resolvedTopCategory,
            topCategory: resolvedTopCategory,
            rating: actualRestaurant?.rating || apiRestaurant?.rating || actualRestaurant?.averageRating || apiRestaurant?.averageRating || 4.5,
            reviews: actualRestaurant?.totalRatings || apiRestaurant?.totalRatings || actualRestaurant?.reviewCount || apiRestaurant?.reviewCount || actualRestaurant?.reviews?.length || apiRestaurant?.reviews?.length || 0,
            deliveryTime: actualRestaurant?.estimatedDeliveryTime || apiRestaurant?.estimatedDeliveryTime || actualRestaurant?.deliveryTime || apiRestaurant?.deliveryTime || actualRestaurant?.avgDeliveryTime || apiRestaurant?.avgDeliveryTime || "25-30 mins",
            distance: calculatedDistance || actualRestaurant?.distance || apiRestaurant?.distance || actualRestaurant?.distanceFromUser || apiRestaurant?.distanceFromUser || "1.2 km",
            location: formattedAddress,
            locationObject: locationObj,
            // Store full location object for reference
            image: normalizedCoverImages?.[0]?.url || normalizedCoverImages?.[0] || normalizedProfileImage?.url || normalizedProfileImage || (normalizedMenuImages.length > 0 ? normalizedMenuImages[0]?.url || normalizedMenuImages[0] : null) || actualRestaurant?.image || apiRestaurant?.image || null,
            priceRange: actualRestaurant?.priceRange || apiRestaurant?.priceRange || onboardingStep4?.priceRange || "$$",
            offers: Array.isArray(actualRestaurant?.offers) ? actualRestaurant.offers : Array.isArray(apiRestaurant?.offers) ? apiRestaurant.offers : [],
            // Will be populated from menu/offers API later
            offerText: actualRestaurant?.offer || apiRestaurant?.offer || onboardingStep4?.offer || "FLAT 50% OFF",
            offerCount: actualRestaurant?.offerCount || apiRestaurant?.offerCount || 0,
            restaurantOffers: {
              goldOffer: {
                title: normalizedRestaurantOffers?.goldOffer?.title || "Gold exclusive offer",
                description: apiRestaurant?.restaurantOffers?.goldOffer?.description || "Free delivery above \u20B999",
                unlockText: normalizedRestaurantOffers?.goldOffer?.unlockText || "join Gold to unlock",
                buttonText: apiRestaurant?.restaurantOffers?.goldOffer?.buttonText || "Add Gold - \u20B91"
              },
              coupons: Array.isArray(normalizedRestaurantOffers?.coupons) ? normalizedRestaurantOffers.coupons : []
            },
            outlets: Array.isArray(actualRestaurant?.outlets) ? actualRestaurant.outlets : Array.isArray(apiRestaurant?.outlets) ? apiRestaurant.outlets : [],
            categories: Array.isArray(actualRestaurant?.categories) ? actualRestaurant.categories : Array.isArray(apiRestaurant?.categories) ? apiRestaurant.categories : [],
            menu: Array.isArray(actualRestaurant?.menu) ? actualRestaurant.menu : Array.isArray(apiRestaurant?.menu) ? apiRestaurant.menu : [],
            slug: actualRestaurant?.slug || apiRestaurant?.slug || actualRestaurant?.name?.toLowerCase().replace(/\s+/g, "-") || apiRestaurant?.name?.toLowerCase().replace(/\s+/g, "-") || slug || "unknown",
            restaurantId: actualRestaurant?.restaurantId || actualRestaurant?._id || actualRestaurant?.id || apiRestaurant?.restaurantId || apiRestaurant?._id || apiRestaurant?.id || null,
            // Add other fields with defaults
            featuredDish: actualRestaurant?.featuredDish || apiRestaurant?.featuredDish || onboardingStep4?.featuredDish || "Special Dish",
            featuredPrice: actualRestaurant?.featuredPrice || apiRestaurant?.featuredPrice || onboardingStep4?.featuredPrice || 249,
            // Additional safety fields
            openDays: Array.isArray(actualRestaurant?.openDays) ? actualRestaurant.openDays : Array.isArray(apiRestaurant?.openDays) ? apiRestaurant.openDays : Array.isArray(onboardingStep2?.openDays) ? onboardingStep2.openDays : [],
            deliveryTimings: actualRestaurant?.deliveryTimings || apiRestaurant?.deliveryTimings || {
              openingTime: actualRestaurant?.openingTime || apiRestaurant?.openingTime || onboardingStep2?.deliveryTimings?.openingTime || "09:00",
              closingTime: actualRestaurant?.closingTime || apiRestaurant?.closingTime || onboardingStep2?.deliveryTimings?.closingTime || "22:00"
            },
            outletTimings: actualRestaurant?.outletTimings || apiRestaurant?.outletTimings || null,
            cuisines: Array.isArray(actualRestaurant?.cuisines) ? actualRestaurant.cuisines : Array.isArray(apiRestaurant?.cuisines) ? apiRestaurant.cuisines : Array.isArray(onboardingStep2?.cuisines) ? onboardingStep2.cuisines : [],
            profileImage: normalizedProfileImage,
            coverImages: normalizedCoverImages,
            menuImages: normalizedMenuImages,
            // Menu sections for display (will be populated from menu API)
            menuSections: [],
            // Onboarding data including FSSAI license
            onboarding: actualRestaurant?.onboarding || apiRestaurant?.onboarding || null,
            // Availability fields for grayscale styling
            isActive: actualRestaurant?.isActive !== false,
            // Default to true if not specified
            isAcceptingOrders: actualRestaurant?.isAcceptingOrders !== false
            // Default to true if not specified
          };
          debugLog("? Transformed restaurant:", transformedRestaurant);
          debugLog("? Restaurant ID for menu fetch:", transformedRestaurant.id);
          if (!transformedRestaurant.id) {
            debugError("? No restaurant ID found! Cannot fetch menu.");
          }
          setRestaurant(transformedRestaurant);
          fetchedRestaurantRef.current = true;
          fetchedSlugRef.current = slug;
          try {
            const outletRestaurantId = transformedRestaurant.mongoId || actualRestaurant?._id || apiRestaurant?._id;
            if (outletRestaurantId) {
              const outletResponse = await restaurantAPI.getOutletTimingsByRestaurantId(outletRestaurantId, { noCache: true });
              const outletTimingsData = outletResponse?.data?.data?.outletTimings || outletResponse?.data?.outletTimings;
              if (outletTimingsData) {
                setRestaurant((prev) => ({ ...prev, outletTimings: outletTimingsData }));
              }
            }
          } catch (outletError) {
            debugWarn("Outlet timings fetch failed, falling back to delivery timings:", outletError?.message);
          }
          let restaurantIdForMenu = transformedRestaurant.id;
          if (!restaurantIdForMenu) {
            debugWarn("? No restaurant ID available, searching for restaurant by name...");
            try {
              const searchVariants = zoneId ? [{ limit: 100, zoneId, _ts: Date.now() }, { limit: 100, _ts: Date.now() }] : [{ limit: 100, _ts: Date.now() }];
              for (const searchParams2 of searchVariants) {
                const searchResponse = await restaurantAPI.getRestaurants(searchParams2, { noCache: true });
                const restaurants = searchResponse?.data?.data?.restaurants || searchResponse?.data?.data || [];
                const matchingRestaurant = restaurants.find(
                  (r) => r.name?.toLowerCase().trim() === transformedRestaurant.name?.toLowerCase().trim()
                );
                if (matchingRestaurant) {
                  restaurantIdForMenu = matchingRestaurant._id || matchingRestaurant.restaurantId || matchingRestaurant.id;
                  debugLog("? Found matching restaurant by name, ID:", restaurantIdForMenu);
                  setRestaurant((prev) => ({
                    ...prev,
                    id: restaurantIdForMenu,
                    restaurantId: restaurantIdForMenu
                  }));
                  break;
                }
              }
              if (!restaurantIdForMenu) {
                debugWarn("? No matching restaurant found by name");
              }
            } catch (searchError) {
              debugError("? Error searching for restaurant:", searchError);
            }
          }
          const normalizedLookupIds = [
            restaurantIdForMenu,
            slug,
            transformedRestaurant.id,
            transformedRestaurant.restaurantId,
            transformedRestaurant.mongoId,
            apiRestaurant?.restaurantId,
            apiRestaurant?._id,
            actualRestaurant?.restaurantId,
            actualRestaurant?._id,
            actualRestaurant?.slug
          ].filter(Boolean).map((value) => String(value).trim()).filter((value, index, arr) => arr.indexOf(value) === index);
          setLoadingMenuItems(true);
          if (normalizedLookupIds.length > 0) {
            let hasPreviousOrderForRestaurant = false;
            if (isModuleAuthenticated("user")) {
              try {
                const normalize = (value) => value ? String(value).trim().toLowerCase() : "";
                const targetRestaurantName = normalize(transformedRestaurant.name);
                const targetRestaurantIds = new Set(
                  [
                    ...normalizedLookupIds,
                    transformedRestaurant.id,
                    transformedRestaurant.restaurantId,
                    apiRestaurant?.restaurantId,
                    apiRestaurant?._id,
                    actualRestaurant?.restaurantId,
                    actualRestaurant?._id
                  ].map(normalize).filter(Boolean)
                );
                const FETCH_LIMIT = 100;
                const firstResponse = await orderAPI.getOrders({ limit: FETCH_LIMIT, page: 1 });
                let allOrders = [];
                let totalPages = 1;
                if (firstResponse?.data?.success && firstResponse?.data?.data?.orders) {
                  allOrders = firstResponse.data.data.orders || [];
                  totalPages = firstResponse.data.data?.pagination?.pages || 1;
                } else if (firstResponse?.data?.orders) {
                  allOrders = firstResponse.data.orders || [];
                  totalPages = firstResponse.data?.pagination?.pages || 1;
                } else if (Array.isArray(firstResponse?.data?.data)) {
                  allOrders = firstResponse.data.data || [];
                }
                if (totalPages > 1) {
                  const pagePromises = [];
                  for (let p = 2; p <= totalPages; p += 1) {
                    pagePromises.push(orderAPI.getOrders({ limit: FETCH_LIMIT, page: p }));
                  }
                  const pageResponses = await Promise.all(pagePromises);
                  const remainingOrders = pageResponses.flatMap((resp) => {
                    if (resp?.data?.success && resp?.data?.data?.orders) return resp.data.data.orders || [];
                    if (resp?.data?.orders) return resp.data.orders || [];
                    if (Array.isArray(resp?.data?.data)) return resp.data.data || [];
                    return [];
                  });
                  allOrders = [...allOrders, ...remainingOrders];
                }
                hasPreviousOrderForRestaurant = allOrders.some((order) => {
                  const orderRestaurantField = order?.restaurantId;
                  const candidateIds = [
                    order?.restaurantId,
                    orderRestaurantField?._id,
                    orderRestaurantField?.id,
                    orderRestaurantField?.restaurantId,
                    order?.restaurant,
                    order?.restaurant_id
                  ].map(normalize).filter(Boolean);
                  if (candidateIds.some((id) => targetRestaurantIds.has(id))) {
                    return true;
                  }
                  const candidateNames = [
                    order?.restaurantName,
                    orderRestaurantField?.name,
                    order?.restaurant?.name
                  ].map(normalize).filter(Boolean);
                  return !!targetRestaurantName && candidateNames.includes(targetRestaurantName);
                });
              } catch (orderCheckError) {
                debugWarn("Could not verify previous orders for recommendation section:", orderCheckError);
              }
            }
            try {
              debugLog("? Fetching menu for restaurant ID:", restaurantIdForMenu);
              let menuResponse = null;
              let resolvedMenuLookupId = null;
              for (const lookupId of normalizedLookupIds) {
                try {
                  debugLog("? Fetching menu for restaurant lookup ID:", lookupId);
                  const response2 = await restaurantAPI.getMenuByRestaurantId(lookupId, { noCache: true });
                  if (response2?.data?.success) {
                    menuResponse = response2;
                    resolvedMenuLookupId = lookupId;
                    break;
                  }
                } catch (lookupError) {
                  if (lookupError?.response?.status !== 404) {
                    throw lookupError;
                  }
                }
              }
              if (!menuResponse) {
                throw Object.assign(new Error("Menu not found"), { response: { status: 404 } });
              }
              debugLog("? Menu resolved using lookup ID:", resolvedMenuLookupId);
              if (menuResponse.data && menuResponse.data.success && menuResponse.data.data && menuResponse.data.data.menu) {
                const rawSections = menuResponse.data.data.menu.sections || [];
                const toArray = (value) => {
                  if (Array.isArray(value)) return value;
                  if (!value || typeof value !== "object") return [];
                  return Object.values(value).filter((entry) => entry && typeof entry === "object");
                };
                const normalizeItem = (item = {}) => {
                  const isRecommended = item.isRecommended === true || item.isRecommended === 1 || String(item.isRecommended) === "true";
                  const isSpicy = item.isSpicy === true || item.isSpicy === 1 || String(item.isSpicy) === "true";
                  let foodType = item.foodType || "Non-Veg";
                  if (typeof foodType === "string") {
                    if (foodType.toLowerCase() === "veg") foodType = "Veg";
                    else if (foodType.toLowerCase() === "non-veg" || foodType.toLowerCase() === "nonveg") foodType = "Non-Veg";
                  }
                  return {
                    ...item,
                    id: String(item.id || item._id || `${Date.now()}-${Math.random()}`),
                    name: item.name || "Unnamed Item",
                    foodType,
                    price: getFoodDisplayPrice(item),
                    otherPrice: item.otherPrice || 0,
                    variants: getFoodVariants(item),
                    variations: getFoodVariants(item),
                    isAvailable: item.isAvailable !== false,
                    isRecommended,
                    isSpicy,
                    description: typeof item.description === "string" ? item.description : ""
                  };
                };
                const menuSections = toArray(rawSections).map((section, sectionIndex) => ({
                  ...section,
                  id: String(section.id || section._id || `section-${sectionIndex}`),
                  name: section.name || section.title || "Unnamed Section",
                  items: toArray(section.items).map(normalizeItem),
                  subsections: toArray(section.subsections).map((subsection, subsectionIndex) => ({
                    ...subsection,
                    id: String(subsection.id || subsection._id || `subsection-${sectionIndex}-${subsectionIndex}`),
                    name: subsection.name || "Unnamed Subsection",
                    items: toArray(subsection.items).map(normalizeItem)
                  }))
                }));
                const recommendedItems = [];
                menuSections.forEach((section) => {
                  if (section.items && Array.isArray(section.items)) {
                    section.items.forEach((item) => {
                      if (isRecommendedItem(item) && item.isAvailable !== false) {
                        recommendedItems.push(item);
                      }
                    });
                  }
                  if (section.subsections && Array.isArray(section.subsections)) {
                    section.subsections.forEach((subsection) => {
                      if (subsection.items && Array.isArray(subsection.items)) {
                        subsection.items.forEach((item) => {
                          if (isRecommendedItem(item) && item.isAvailable !== false) {
                            recommendedItems.push(item);
                          }
                        });
                      }
                    });
                  }
                });
                debugLog("Recommended items collected:", recommendedItems.map((item) => ({
                  name: item.name,
                  isRecommended: item.isRecommended,
                  isRecommendedType: typeof item.isRecommended,
                  preparationTime: item.preparationTime
                })));
                debugLog("Menu sections with preparationTime:", menuSections.map((section) => ({
                  sectionName: section.name,
                  items: section.items?.map((item) => ({
                    name: item.name,
                    preparationTime: item.preparationTime
                  })) || []
                })));
                let searchedDishSection = null;
                if (targetDishId) {
                  const allItemsInMenu = [];
                  menuSections.forEach((s) => {
                    if (s.items) allItemsInMenu.push(...s.items);
                    if (s.subsections) {
                      s.subsections.forEach((ss) => {
                        if (ss.items) allItemsInMenu.push(...ss.items);
                      });
                    }
                  });
                  const matchedItem = allItemsInMenu.find((item) => String(item.id || item._id || "").trim() === targetDishId);
                  if (matchedItem) {
                    searchedDishSection = {
                      name: "Result for your search",
                      items: [matchedItem],
                      subsections: [],
                      isSearchResult: true
                    };
                  }
                }
                let finalMenuSections = [...menuSections];
                if (hasPreviousOrderForRestaurant) {
                  finalMenuSections = [{ name: "Recommended for you", items: recommendedItems, subsections: [] }, ...finalMenuSections];
                }
                if (searchedDishSection) {
                  finalMenuSections = [searchedDishSection, ...finalMenuSections];
                }
                setRestaurant((prev) => ({
                  ...prev,
                  menuSections: finalMenuSections
                }));
                const defaultExpandedSections = new Set(
                  Array.from({ length: Math.min(3, finalMenuSections.length) }, (_, idx) => idx)
                );
                setExpandedSections(defaultExpandedSections);
                debugLog("Fetched menu sections with recommended items:", finalMenuSections);
              }
            } catch (menuError) {
              if (menuError.response && menuError.response.status === 404) {
                debugLog("? Menu not found for this restaurant.");
              } else {
                debugError("? Error fetching menu:", menuError);
              }
            } finally {
              setLoadingMenuItems(false);
            }
            try {
              debugLog("? Fetching inventory for restaurant ID:", restaurantIdForMenu);
              let inventoryResponse = null;
              let resolvedInventoryLookupId = null;
              for (const lookupId of normalizedLookupIds) {
                try {
                  debugLog("? Fetching inventory for restaurant lookup ID:", lookupId);
                  const response2 = await restaurantAPI.getInventoryByRestaurantId(lookupId);
                  if (response2?.data?.success) {
                    inventoryResponse = response2;
                    resolvedInventoryLookupId = lookupId;
                    break;
                  }
                } catch (lookupError) {
                  if (lookupError?.response?.status !== 404) {
                    throw lookupError;
                  }
                }
              }
              if (!inventoryResponse) {
                throw Object.assign(new Error("Inventory not found"), { response: { status: 404 } });
              }
              debugLog("? Inventory resolved using lookup ID:", resolvedInventoryLookupId);
              if (inventoryResponse.data && inventoryResponse.data.success && inventoryResponse.data.data && inventoryResponse.data.data.inventory) {
                const inventoryCategories = inventoryResponse.data.data.inventory.categories || [];
                const normalizedInventory = inventoryCategories.map((category, index) => ({
                  id: category.id || `category-${index}`,
                  name: category.name || "Unnamed Category",
                  description: category.description || "",
                  itemCount: category.itemCount || (category.items?.length || 0),
                  inStock: category.inStock !== void 0 ? category.inStock : true,
                  items: Array.isArray(category.items) ? category.items.map((item) => ({
                    id: String(item.id || Date.now() + Math.random()),
                    name: item.name || "Unnamed Item",
                    inStock: item.inStock !== void 0 ? item.inStock : true,
                    isVeg: item.isVeg !== void 0 ? item.isVeg : true,
                    stockQuantity: item.stockQuantity || "Unlimited",
                    unit: item.unit || "piece",
                    expiryDate: item.expiryDate || null,
                    lastRestocked: item.lastRestocked || null
                  })) : [],
                  order: category.order !== void 0 ? category.order : index
                }));
                setRestaurant((prev) => ({
                  ...prev,
                  inventory: normalizedInventory
                }));
                debugLog("? Fetched and normalized inventory categories:", normalizedInventory);
              }
            } catch (inventoryError) {
              if (inventoryError.response && inventoryError.response.status === 404) {
                debugLog("? Inventory not found for this restaurant.");
              } else {
                debugError("? Error fetching inventory:", inventoryError);
              }
            }
          } else {
            setLoadingMenuItems(false);
          }
        } else {
          debugError("? No restaurant data found in API response");
          debugError("? Response:", response);
          debugError("? apiRestaurant:", apiRestaurant);
          if (!fetchedRestaurantRef.current) {
            setRestaurantError("Restaurant not found");
            setRestaurant(null);
          }
        }
      } catch (error) {
        const isNetworkError = error.code === "ERR_NETWORK" || error.message === "Network Error";
        const is404Error = error.response?.status === 404;
        if (isNetworkError) {
          debugError("Network error fetching restaurant (backend may not be running):", error);
          if (!fetchedRestaurantRef.current) {
            setRestaurantError("Backend server is not connected. Please make sure the backend is running.");
            setRestaurant(null);
          }
        } else if (is404Error) {
          debugLog(`Restaurant "${slug}" not found in database`);
          if (!fetchedRestaurantRef.current) {
            setRestaurantError("Restaurant not found");
            setRestaurant(null);
          }
        } else {
          debugError("Error fetching restaurant:", error);
          if (!fetchedRestaurantRef.current) {
            setRestaurantError(error.message || "Failed to load restaurant");
            setRestaurant(null);
          }
        }
      } finally {
        setLoadingRestaurant(false);
        setLoadingMenuItems(false);
      }
    };
    if (fetchedRestaurantRef.current && fetchedSlugRef.current !== slug) {
      fetchedRestaurantRef.current = false;
      fetchedSlugRef.current = null;
    }
    fetchRestaurant();
  }, [slug, zoneId, restaurant]);
  const prevCoordsRef = useRef({ userLat: null, userLng: null, restaurantLat: null, restaurantLng: null });
  const prevDistanceRef = useRef(null);
  const restaurantLat = restaurant?.locationObject?.latitude || (restaurant?.locationObject?.coordinates && Array.isArray(restaurant.locationObject.coordinates) ? restaurant.locationObject.coordinates[1] : null);
  const restaurantLng = restaurant?.locationObject?.longitude || (restaurant?.locationObject?.coordinates && Array.isArray(restaurant.locationObject.coordinates) ? restaurant.locationObject.coordinates[0] : null);
  useEffect(() => {
    if (!restaurant || !userLocation?.latitude || !userLocation?.longitude) return;
    if (!restaurantLat || !restaurantLng) return;
    const userLat = userLocation.latitude;
    const userLng = userLocation.longitude;
    const coordsChanged = Math.abs(prevCoordsRef.current.userLat - userLat) > 1e-4 || Math.abs(prevCoordsRef.current.userLng - userLng) > 1e-4 || Math.abs(prevCoordsRef.current.restaurantLat - restaurantLat) > 1e-4 || Math.abs(prevCoordsRef.current.restaurantLng - restaurantLng) > 1e-4;
    if (!coordsChanged && prevDistanceRef.current !== null) {
      return;
    }
    prevCoordsRef.current = { userLat, userLng, restaurantLat, restaurantLng };
    if (userLat && userLng && restaurantLat && restaurantLng && !isNaN(userLat) && !isNaN(userLng) && !isNaN(restaurantLat) && !isNaN(restaurantLng)) {
      const calculateDistance = (lat1, lng1, lat2, lng2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };
      const distanceInKm = calculateDistance(userLat, userLng, restaurantLat, restaurantLng);
      let calculatedDistance = null;
      if (distanceInKm >= 1) {
        calculatedDistance = `${distanceInKm.toFixed(1)} km`;
      } else {
        const distanceInMeters = Math.round(distanceInKm * 1e3);
        calculatedDistance = `${distanceInMeters} m`;
      }
      if (calculatedDistance !== prevDistanceRef.current) {
        debugLog("? Recalculated distance from user to restaurant:", calculatedDistance, "km:", distanceInKm);
        prevDistanceRef.current = calculatedDistance;
        setRestaurant((prev) => {
          if (prev?.distance === calculatedDistance) {
            return prev;
          }
          return {
            ...prev,
            distance: calculatedDistance
          };
        });
      }
    }
  }, [userLocation?.latitude, userLocation?.longitude, restaurantLat, restaurantLng]);
  useEffect(() => {
    if (!restaurant || !restaurant.name) return;
    const cartQuantities = {};
    cart.forEach((item) => {
      if (item.restaurant === restaurant.name) {
        cartQuantities[item.id] = item.quantity || 0;
      }
    });
    setQuantities(cartQuantities);
  }, [restaurant?.name, cart]);
  useEffect(() => {
    if (!selectedItem) {
      setSelectedVariantId("");
      return;
    }
    const defaultVariant = getDefaultFoodVariant(selectedItem);
    setSelectedVariantId(defaultVariant?.id || "");
  }, [selectedItem]);
  const updateItemQuantity = (item, newQuantity, event = null, preferredVariant = null) => {
    if (!isModuleAuthenticated("user")) {
      toast.error("Please login to add items to cart");
      navigate("/user/auth/login", { state: { from: location.pathname } });
      return;
    }
    if (isOutOfService) {
      toast.error("You are outside the service zone. Please select a location within the service area.");
      return;
    }
    const availability = getRestaurantAvailabilityStatus(restaurant);
    if (!availability.isOpen) {
      toast.error("Restaurant is currently offline. Please try again later.");
      return;
    }
    const resolvedVariant = preferredVariant || getDefaultFoodVariant(item);
    const lineItemId = getLineItemIdForDish(item, resolvedVariant);
    setQuantities((prev) => ({
      ...prev,
      [lineItemId]: newQuantity
    }));
    if (!restaurant || !restaurant.name) {
      debugError("? Cannot add item to cart: Restaurant data is missing!");
      toast.error("Restaurant information is missing. Please refresh the page.");
      return;
    }
    const validRestaurantId = restaurant?.restaurantId || restaurant?._id || restaurant?.id;
    if (!validRestaurantId) {
      debugError("? Cannot add item to cart: Restaurant ID is missing!", {
        restaurant,
        restaurantId: restaurant?.restaurantId,
        _id: restaurant?._id,
        id: restaurant?.id
      });
      toast.error("Restaurant ID is missing. Please refresh the page.");
      return;
    }
    debugLog("? Adding item to cart:", {
      itemName: item.name,
      restaurantName: restaurant.name,
      restaurantId: validRestaurantId,
      restaurant_id: restaurant._id,
      restaurant_restaurantId: restaurant.restaurantId
    });
    const cartItem = {
      id: lineItemId,
      lineItemId,
      itemId: item.id,
      name: item.name,
      price: resolvedVariant?.price ?? item.price,
      otherPrice: resolvedVariant?.otherPrice ?? item.otherPrice ?? item.originalPrice ?? 0,
      variantId: resolvedVariant?.id || "",
      variantName: resolvedVariant?.name || "",
      variantPrice: resolvedVariant?.price ?? item.price,
      image: item.image,
      restaurant: restaurant.name,
      // Use restaurant.name directly (already validated)
      restaurantId: validRestaurantId,
      // Use validated restaurantId
      description: item.description,
      originalPrice: item.originalPrice,
      isVeg: item.isVeg !== void 0 ? item.isVeg : String(item.foodType).toLowerCase() === "veg",
      // Add isVeg property
      preparationTime: item.preparationTime
      // Add preparationTime property
    };
    let sourcePosition = null;
    if (event) {
      let buttonElement = event.currentTarget;
      if (!buttonElement && event.target) {
        buttonElement = event.target.closest("button") || event.target;
      }
      if (buttonElement) {
        const rect = buttonElement.getBoundingClientRect();
        const scrollX = window.pageXOffset || window.scrollX || 0;
        const scrollY = window.pageYOffset || window.scrollY || 0;
        sourcePosition = {
          // Viewport-relative position at capture time
          viewportX: rect.left + rect.width / 2,
          viewportY: rect.top + rect.height / 2,
          // Scroll position at capture time
          scrollX,
          scrollY,
          // Store button identifier to potentially find it again
          itemId: lineItemId
        };
      }
    }
    if (newQuantity <= 0) {
      const productInfo = {
        id: lineItemId,
        name: item.name,
        imageUrl: item.image
      };
      removeFromCart(lineItemId, sourcePosition, productInfo);
    } else {
      const existingCartItem = getCartItem(lineItemId);
      if (existingCartItem) {
        const productInfo = {
          id: lineItemId,
          name: item.name,
          imageUrl: item.image
        };
        if (newQuantity > existingCartItem.quantity && sourcePosition) {
          const result = addToCart(cartItem, sourcePosition);
          if (result?.ok === false) {
            toast.error(result.error || "Cannot add item from different restaurant. Please clear cart first.");
            return;
          }
          updateQuantity(lineItemId, newQuantity);
        } else if (newQuantity < existingCartItem.quantity && sourcePosition) {
          updateQuantity(lineItemId, newQuantity, sourcePosition, productInfo);
        } else {
          updateQuantity(lineItemId, newQuantity);
        }
      } else {
        const result = addToCart(cartItem, sourcePosition);
        if (result?.ok === false) {
          toast.error(result.error || "Cannot add item from different restaurant. Please clear cart first.");
          return;
        }
        if (newQuantity > 1) {
          updateQuantity(lineItemId, newQuantity);
        }
      }
    }
  };
  const isRecommendedSection = (section) => {
    const sectionName = section?.name || section?.title || "";
    if (typeof sectionName !== "string") return false;
    const name = sectionName.trim().toLowerCase();
    return name === "recommended for you" || name === "result for your search";
  };
  const isRecommendedItem = (item) => {
    return item.isRecommended === true && typeof item.isRecommended === "boolean";
  };
  const getSectionDisplayName = (section) => {
    if (isRecommendedSection(section)) {
      return "Recommended for you";
    }
    if (section?.name && typeof section.name === "string" && section.name.trim()) {
      return section.name.trim();
    }
    if (section?.title && typeof section.title === "string" && section.title.trim()) {
      return section.title.trim();
    }
    return "Unnamed Section";
  };
  const normalizeMenuCategoryId = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const toRenderableArray = (value) => {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "object") return [];
    return Object.values(value).filter((entry) => entry && typeof entry === "object");
  };
  const getSectionCategoryImage = (section) => {
    const directImage = typeof section?.image === "string" ? section.image.trim() : "";
    if (directImage) return directImage;
    const firstSectionItemImage = toRenderableArray(section?.items).find(
      (item) => typeof item?.image === "string" && item.image.trim()
    )?.image;
    if (firstSectionItemImage) return firstSectionItemImage;
    const firstSubsectionImage = toRenderableArray(section?.subsections).flatMap((subsection) => toRenderableArray(subsection?.items)).find((item) => typeof item?.image === "string" && item.image.trim())?.image;
    return firstSubsectionImage || "";
  };
  const menuCategories = useMemo(() => {
    if (!restaurant?.menuSections || !Array.isArray(restaurant.menuSections)) return [];
    return restaurant.menuSections.map((section, index) => {
      if (isRecommendedSection(section)) return null;
      const sectionTitle = getSectionDisplayName(section);
      const itemCount = Array.isArray(section?.items) ? section.items.length : 0;
      const subsectionCount = Array.isArray(section?.subsections) ? section.subsections.reduce((sum, sub) => sum + (Array.isArray(sub?.items) ? sub.items.length : 0), 0) : 0;
      const totalCount = itemCount + subsectionCount;
      if (totalCount <= 0) return null;
      return {
        id: normalizeMenuCategoryId(section?.categoryId || sectionTitle || index) || `section-${index}`,
        name: sectionTitle,
        image: getSectionCategoryImage(section),
        count: totalCount,
        sectionIndex: index
      };
    }).filter(Boolean);
  }, [restaurant?.menuSections]);
  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.sortBy) count++;
    if (filters.vegNonVeg) count++;
    if (filters.highlyReordered) count++;
    if (filters.spicy) count++;
    return count;
  };
  const activeFilterCount = getActiveFilterCount();
  useEffect(() => {
    if (typeof window === "undefined" || !slug) return;
    try {
      const raw = window.localStorage.getItem(RESTAURANT_DETAILS_FILTERS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const nextState = parsed && typeof parsed === "object" ? parsed : {};
      nextState[slug] = filters;
      window.localStorage.setItem(RESTAURANT_DETAILS_FILTERS_STORAGE_KEY, JSON.stringify(nextState));
    } catch (error) {
      debugWarn("Failed to persist restaurant filters:", error);
    }
  }, [filters, slug]);
  useEffect(() => {
    if (selectedMenuCategory === "all") return;
    const categoryStillVisible = menuCategories.some((category) => category.id === selectedMenuCategory);
    if (!categoryStillVisible) {
      setSelectedMenuCategory("all");
    }
  }, [menuCategories, selectedMenuCategory]);
  const handleBookmarkClick = (item) => {
    const restaurantId = restaurant?.restaurantId || restaurant?._id || restaurant?.id;
    if (!restaurantId) {
      toast.error("Restaurant information is missing");
      return;
    }
    const dishId = item.id || item._id;
    if (!dishId) {
      toast.error("Dish information is missing");
      return;
    }
    const isFavorite2 = isDishFavorite(dishId, restaurantId);
    if (isFavorite2) {
      removeDishFavorite(dishId, restaurantId);
      toast.success("Dish removed from favorites");
    } else {
      const dishData = {
        id: dishId,
        name: item.name,
        description: item.description,
        price: item.price,
        originalPrice: item.originalPrice,
        image: item.image,
        restaurantId,
        restaurantName: restaurant?.name || "",
        restaurantSlug: restaurant?.slug || slug || "",
        foodType: item.foodType,
        isSpicy: item.isSpicy,
        customisable: item.customisable
      };
      addDishFavorite(dishData);
      toast.success("Dish added to favorites");
    }
  };
  const handleAddToCollection = () => {
    const restaurantSlug = restaurant?.slug || slug || "";
    if (!restaurantSlug) {
      toast.error("Restaurant information is missing");
      return;
    }
    if (!restaurant) {
      toast.error("Restaurant data not available");
      return;
    }
    const isAlreadyFavorite = isFavorite(restaurantSlug);
    if (isAlreadyFavorite) {
      removeFavorite(restaurantSlug);
      toast.success("Restaurant removed from collection");
    } else {
      addFavorite({
        slug: restaurantSlug,
        name: restaurant.name || "",
        cuisine: restaurant.cuisine || "",
        rating: restaurant.rating || 0,
        deliveryTime: restaurant.deliveryTime || restaurant.estimatedDeliveryTime || "",
        distance: restaurant.distance || "",
        priceRange: restaurant.priceRange || "",
        image: restaurant.profileImageUrl?.url || restaurant.image || ""
      });
      toast.success("Restaurant added to collection");
    }
    setShowMenuOptionsSheet(false);
  };
  const handleShareRestaurant = async () => {
    const companyName = await getCompanyNameAsync();
    const restaurantSlug = restaurant?.slug || slug || "";
    const restaurantName = restaurant?.name || "this restaurant";
    const shareUrl = `${window.location.origin}/user/restaurants/${restaurantSlug}`;
    const shareText = `Check out ${restaurantName} on ${companyName}! ${shareUrl}`;
    const payload = {
      title: restaurantName,
      text: shareText,
      url: shareUrl
    };
    if (isMobileDevice()) {
      openShareModal(payload);
      setShowMenuOptionsSheet(false);
      return;
    }
    const shared = await tryNativeShare(payload);
    if (shared) {
      toast.success("Restaurant shared successfully");
      setShowMenuOptionsSheet(false);
      return;
    }
    openShareModal(payload);
    setShowMenuOptionsSheet(false);
  };
  const handleShareClick = async (item) => {
    const dishId = item.id || item._id;
    const restaurantSlug = restaurant?.slug || slug || "";
    const shareUrl = `${window.location.origin}/user/restaurants/${restaurantSlug}?dish=${dishId}`;
    const shareText = `Check out ${item.name} from ${restaurant?.name || "this restaurant"}! ${shareUrl}`;
    const payload = {
      title: `${item.name} - ${restaurant?.name || ""}`,
      text: shareText,
      url: shareUrl
    };
    if (isMobileDevice()) {
      openShareModal(payload);
      return;
    }
    const shared = await tryNativeShare(payload);
    if (shared) {
      toast.success("Dish shared successfully");
      return;
    }
    openShareModal(payload);
  };
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copied to clipboard!");
    } catch (error) {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        toast.success("Link copied to clipboard!");
      } catch (err) {
        toast.error("Failed to copy link");
      }
      document.body.removeChild(textArea);
    }
  };
  const isMobileDevice = () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    const mobileUA = /Android|iPhone|iPad|iPod|Windows Phone|Opera Mini|IEMobile/i.test(navigator.userAgent);
    const smallViewport = window.matchMedia?.("(max-width: 768px)")?.matches;
    return Boolean(mobileUA || smallViewport);
  };
  const openShareModal = (payload) => {
    setSharePayload(payload);
    setShowShareModal(true);
  };
  const tryNativeShare = async (payload) => {
    if (typeof navigator === "undefined" || !navigator.share) return false;
    try {
      await navigator.share(payload);
      return true;
    } catch (error) {
      if (error?.name === "AbortError") return true;
      return false;
    }
  };
  const openShareTarget = (target) => {
    if (!sharePayload?.url) return;
    const text = sharePayload.text || "";
    const url = sharePayload.url;
    const encodedText = encodeURIComponent(text);
    const encodedUrl = encodeURIComponent(url);
    let shareLink = "";
    if (target === "whatsapp") {
      shareLink = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
    } else if (target === "telegram") {
      shareLink = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
    } else if (target === "email") {
      shareLink = `mailto:?subject=${encodeURIComponent(sharePayload.title || "Check this out")}&body=${encodeURIComponent(`${text}

${url}`)}`;
    }
    if (shareLink) {
      window.open(shareLink, "_blank", "noopener,noreferrer");
      setShowShareModal(false);
    }
  };
  const copyShareLink = async () => {
    if (!sharePayload?.url) return;
    await copyToClipboard(sharePayload.url);
    setShowShareModal(false);
  };
  const handleSystemShareFromModal = async () => {
    if (!sharePayload) return;
    const shared = await tryNativeShare(sharePayload);
    if (shared) {
      setShowShareModal(false);
      toast.success("Shared successfully");
    }
  };
  const handleItemClick = (item) => {
    setSelectedItem(item);
    setShowItemDetail(true);
  };
  const getFinalPrice = (item) => {
    if (item.originalPrice && item.discountAmount && item.discountAmount > 0) {
      let discountedPrice = item.originalPrice;
      if (item.discountType === "Percent") {
        discountedPrice = item.originalPrice - item.originalPrice * item.discountAmount / 100;
      } else if (item.discountType === "Fixed") {
        discountedPrice = item.originalPrice - item.discountAmount;
      }
      return Math.max(0, discountedPrice);
    }
    return Math.max(0, item.price || 0);
  };
  const filterMenuItems = (items) => {
    if (!items) return items;
    return items.filter((item) => {
      if (showOnlyUnder250) {
        const finalPrice = getFinalPrice(item);
        if (finalPrice > 250) return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const itemName = item.name?.toLowerCase() || "";
        if (!itemName.includes(query)) return false;
      }
      if (vegMode) {
        if (item.foodType !== "Veg") return false;
      }
      if (filters.vegNonVeg === "veg") {
        if (item.foodType !== "Veg") return false;
      }
      if (filters.vegNonVeg === "non-veg") {
        if (item.foodType !== "Non-Veg") return false;
      }
      if (filters.highlyReordered && !isRecommendedItem(item)) return false;
      if (filters.spicy && item.isSpicy !== true) return false;
      return true;
    });
  };
  const sortMenuItems = (items) => {
    if (!items) return items;
    if (!filters.sortBy) return items;
    const sorted = [...items];
    if (filters.sortBy === "low-to-high") {
      return sorted.sort((a, b) => getFinalPrice(a) - getFinalPrice(b));
    } else if (filters.sortBy === "high-to-low") {
      return sorted.sort((a, b) => getFinalPrice(b) - getFinalPrice(a));
    }
    return sorted;
  };
  const getSectionSortValue = (section) => {
    const allItems = [
      ...toRenderableArray(section?.items),
      ...toRenderableArray(section?.subsections).flatMap((subsection) => toRenderableArray(subsection?.items))
    ];
    if (allItems.length === 0) return null;
    const prices = allItems.map((item) => getFinalPrice(item)).filter((price) => Number.isFinite(price));
    if (prices.length === 0) return null;
    if (filters.sortBy === "low-to-high") {
      return Math.min(...prices);
    }
    if (filters.sortBy === "high-to-low") {
      return Math.max(...prices);
    }
    return null;
  };
  const sectionHasItemsUnder250 = (section) => {
    if (!showOnlyUnder250) return true;
    if (section.items && section.items.length > 0) {
      const hasUnder250Items = section.items.some((item) => {
        if (item.isAvailable === false) return false;
        const finalPrice = getFinalPrice(item);
        return finalPrice <= 250;
      });
      if (hasUnder250Items) return true;
    }
    if (section.subsections && section.subsections.length > 0) {
      for (const subsection of section.subsections) {
        if (subsection.items && subsection.items.length > 0) {
          const hasUnder250Items = subsection.items.some((item) => {
            if (item.isAvailable === false) return false;
            const finalPrice = getFinalPrice(item);
            return finalPrice <= 250;
          });
          if (hasUnder250Items) return true;
        }
      }
    }
    return false;
  };
  const getFilteredSections = () => {
    if (!restaurant?.menuSections) return [];
    const visibleSections = restaurant.menuSections.map((section, index) => {
      const filteredItems = sortMenuItems(
        filterMenuItems(
          toRenderableArray(section?.items).filter((item) => item?.isAvailable !== false)
        )
      );
      const filteredSubsections = toRenderableArray(section?.subsections).map((subsection) => ({
        ...subsection,
        items: sortMenuItems(
          filterMenuItems(
            toRenderableArray(subsection?.items).filter((item) => item?.isAvailable !== false)
          )
        )
      })).filter((subsection) => subsection.items.length > 0);
      return {
        section: {
          ...section,
          items: filteredItems,
          subsections: filteredSubsections
        },
        originalIndex: index
      };
    }).filter(({ section }) => {
      if (selectedMenuCategory !== "all") {
        if (isRecommendedSection(section)) return false;
        const sectionCategoryId = normalizeMenuCategoryId(section?.categoryId || getSectionDisplayName(section));
        if (sectionCategoryId !== selectedMenuCategory) {
          return false;
        }
      }
      const hasVisibleItems = toRenderableArray(section?.items).length > 0;
      const hasVisibleSubsections = toRenderableArray(section?.subsections).length > 0;
      return hasVisibleItems || hasVisibleSubsections;
    });
    if (!filters.sortBy) {
      return visibleSections;
    }
    return [...visibleSections].sort((left, right) => {
      const leftValue = getSectionSortValue(left.section);
      const rightValue = getSectionSortValue(right.section);
      if (leftValue == null && rightValue == null) return 0;
      if (leftValue == null) return 1;
      if (rightValue == null) return -1;
      return filters.sortBy === "low-to-high" ? leftValue - rightValue : rightValue - leftValue;
    });
  };
  const hasActiveMenuFilters = Boolean(
    showOnlyUnder250 || searchQuery.trim() || !!vegMode || filters.sortBy || filters.vegNonVeg || filters.highlyReordered || filters.spicy
  );
  const filteredSections = useMemo(
    () => getFilteredSections(),
    [restaurant?.menuSections, showOnlyUnder250, searchQuery, vegMode, filters, selectedMenuCategory]
  );
  useEffect(() => {
    if (!hasActiveMenuFilters) return;
    const nextExpanded = /* @__PURE__ */ new Set();
    filteredSections.forEach(({ section, originalIndex }) => {
      nextExpanded.add(originalIndex);
      toRenderableArray(section?.subsections).forEach((_, subIndex) => {
        nextExpanded.add(`${originalIndex}-${subIndex}`);
      });
    });
    setExpandedSections(nextExpanded);
  }, [filteredSections, hasActiveMenuFilters]);
  useEffect(() => {
    if (!restaurant?.menuSections || !targetDishId) return;
    let matchedItem = null;
    const sectionKeysToExpand = /* @__PURE__ */ new Set();
    restaurant.menuSections.forEach((section, originalIndex) => {
      const sectionItems = toRenderableArray(section?.items);
      const matchedSectionItem = sectionItems.find(
        (item) => String(item?.id || item?._id || "").trim() === targetDishId
      );
      if (matchedSectionItem && !matchedItem) {
        matchedItem = matchedSectionItem;
        sectionKeysToExpand.add(originalIndex);
      }
      const sectionSubsections = toRenderableArray(section?.subsections);
      sectionSubsections.forEach((subsection, subIndex) => {
        const subsectionItems = toRenderableArray(subsection?.items);
        const matchedSubsectionItem = subsectionItems.find(
          (item) => String(item?.id || item?._id || "").trim() === targetDishId
        );
        if (matchedSubsectionItem && !matchedItem) {
          matchedItem = matchedSubsectionItem;
          sectionKeysToExpand.add(originalIndex);
          sectionKeysToExpand.add(`${originalIndex}-${subIndex}`);
        }
      });
    });
    if (!matchedItem) return;
    setExpandedSections((prev) => {
      const next = new Set(prev);
      sectionKeysToExpand.forEach((key) => next.add(key));
      return next;
    });
    setHighlightedDishId(targetDishId);
    const scrollTimer = window.setTimeout(() => {
      const targetNode = dishCardRefs.current[targetDishId];
      if (targetNode) {
        targetNode.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 250);
    const highlightTimer = window.setTimeout(() => {
      setHighlightedDishId((current) => current === targetDishId ? null : current);
    }, 2600);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(highlightTimer);
    };
  }, [restaurant, targetDishId]);
  const highlightOffers = [
    "Upto 50% OFF",
    restaurant?.offerText || "",
    ...Array.isArray(restaurant?.offers) ? restaurant.offers.map((offer) => offer?.title || "") : []
  ];
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => {
        const offersLength = Array.isArray(restaurant?.offers) && restaurant.offers.length > 0 ? restaurant.offers.length : 1;
        return (prev + 1) % offersLength;
      });
    }, 3e3);
    return () => clearInterval(interval);
  }, [restaurant?.offers?.length || 0]);
  useEffect(() => {
    const interval = setInterval(() => {
      setHighlightIndex((prev) => (prev + 1) % highlightOffers.length);
    }, 2e3);
    return () => clearInterval(interval);
  }, [highlightOffers.length]);
  if (loadingRestaurant) {
    return /* @__PURE__ */ React.createElement(RestaurantDetailSkeleton, null);
  }
  if (restaurantError && !restaurant) {
    const isNetworkError = restaurantError.includes("Backend server is not connected");
    const isNotFoundError = restaurantError === "Restaurant not found";
    return /* @__PURE__ */ React.createElement(AnimatedPage, null, /* @__PURE__ */ React.createElement("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center px-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-center gap-4 text-center" }, /* @__PURE__ */ React.createElement(AlertCircle, { className: `h-12 w-12 ${isNetworkError ? "text-orange-500" : "text-red-500"}` }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-semibold text-gray-900 dark:text-white mb-1" }, isNetworkError ? "Connection Error" : isNotFoundError ? "Restaurant not found" : "Error"), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-gray-600 mb-4 max-w-md" }, restaurantError), isNetworkError && /* @__PURE__ */ React.createElement("p", { className: "text-xs text-gray-500 mb-4" }, "Make sure the backend server is running at ", API_BASE_URL.replace("/api", "")), /* @__PURE__ */ React.createElement(Button, { onClick: goBack, variant: "outline" }, "Go Back")))));
  }
  if (!restaurant) {
    return /* @__PURE__ */ React.createElement(AnimatedPage, null, /* @__PURE__ */ React.createElement("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-center gap-4" }, /* @__PURE__ */ React.createElement(AlertCircle, { className: "h-12 w-12 text-red-500" }), /* @__PURE__ */ React.createElement("span", { className: "text-sm text-gray-600" }, "Restaurant not found"), /* @__PURE__ */ React.createElement(Button, { onClick: goBack, variant: "outline" }, "Go Back"))));
  }
  const availabilityStatus = getRestaurantAvailabilityStatus(restaurant, new Date(availabilityTick));
  const isRestaurantOffline = !availabilityStatus.isOpen;
  const shouldShowGrayscale = isOutOfService || isRestaurantOffline;
  return /* @__PURE__ */ React.createElement(
    AnimatedPage,
    {
      id: "scrollingelement",
      className: `min-h-screen bg-white dark:bg-[#0a0a0a] flex flex-col transition-all duration-300 ${shouldShowGrayscale ? "grayscale opacity-75" : ""}`
    },
    /* @__PURE__ */ React.createElement("div", { className: "px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-2.5 md:py-3 relative z-20 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-7xl mx-auto flex items-center justify-between" }, /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "outline",
        size: "icon",
        className: "rounded-full h-10 w-10 md:h-11 md:w-11 border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-[#1a1a1a]",
        onClick: goBack
      },
      /* @__PURE__ */ React.createElement(ArrowLeft, { className: "h-5 w-5 text-gray-900 dark:text-white" })
    ), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 md:gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5 md:gap-2" }, /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "outline",
        size: "sm",
        className: "flex items-center gap-1.5 whitespace-nowrap border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] rounded-full h-9 md:h-10 px-3 md:px-4 text-xs md:text-sm font-medium relative",
        onClick: () => setShowFilterSheet(true)
      },
      /* @__PURE__ */ React.createElement(SlidersHorizontal, { className: "h-4 w-4" }),
      /* @__PURE__ */ React.createElement("span", null, "Filters"),
      activeFilterCount > 0 && /* @__PURE__ */ React.createElement("span", { className: "absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-semibold" }, activeFilterCount),
      /* @__PURE__ */ React.createElement(ChevronDown, { className: "h-3 w-3" })
    ), /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "outline",
        size: "sm",
        className: `flex items-center gap-1 md:gap-1.5 whitespace-nowrap border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] rounded-full h-9 md:h-10 px-3 md:px-4 text-xs md:text-sm font-medium ${filters.vegNonVeg === "veg" ? "border-green-600 bg-green-50 text-green-700 font-bold dark:bg-green-900/30 dark:text-green-400" : ""}`,
        onClick: () => setFilters((prev) => ({
          ...prev,
          vegNonVeg: prev.vegNonVeg === "veg" ? null : "veg"
        }))
      },
      /* @__PURE__ */ React.createElement("div", { className: "h-2.5 w-2.5 rounded-full bg-green-500 flex-shrink-0" }),
      /* @__PURE__ */ React.createElement("span", null, "Veg"),
      filters.vegNonVeg === "veg" && /* @__PURE__ */ React.createElement(X, { className: "h-3 w-3 text-gray-600 dark:text-gray-300" })
    ), /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "outline",
        size: "sm",
        className: `flex items-center gap-1.5 whitespace-nowrap border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] rounded-full h-9 md:h-10 px-3 md:px-4 text-xs md:text-sm font-medium ${filters.vegNonVeg === "non-veg" ? "border-amber-700 bg-amber-50 text-amber-800 font-bold dark:bg-amber-900/30 dark:text-amber-400" : ""}`,
        onClick: () => setFilters((prev) => ({
          ...prev,
          vegNonVeg: prev.vegNonVeg === "non-veg" ? null : "non-veg"
        }))
      },
      /* @__PURE__ */ React.createElement("div", { className: "h-2.5 w-2.5 rounded-full bg-amber-700 flex-shrink-0" }),
      /* @__PURE__ */ React.createElement("span", null, "Non-veg"),
      filters.vegNonVeg === "non-veg" && /* @__PURE__ */ React.createElement(X, { className: "h-3 w-3 text-gray-600 dark:text-gray-300" })
    )), !showSearch ? /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "outline",
        className: "rounded-full h-9 md:h-10 px-4 md:px-5 border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-[#1a1a1a] flex items-center gap-2 text-gray-900 dark:text-white",
        onClick: () => setShowSearch(true)
      },
      /* @__PURE__ */ React.createElement(Search, { className: "h-4 w-4" }),
      /* @__PURE__ */ React.createElement("span", { className: "text-xs md:text-sm font-semibold" }, "Search")
    ) : /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 flex-1 max-w-md" }, /* @__PURE__ */ React.createElement("div", { className: "relative flex-1" }, /* @__PURE__ */ React.createElement(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" }), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        placeholder: "Search for dishes...",
        value: searchQuery,
        onChange: (e) => setSearchQuery(e.target.value),
        className: "w-full pl-10 pr-10 py-2 rounded-full border border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-[#1a1a1a] text-xs md:text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FE5502] focus:border-transparent",
        autoFocus: true
      }
    ), searchQuery && /* @__PURE__ */ React.createElement("button", { onClick: () => {
      setSearchQuery("");
      setShowSearch(false);
    }, className: "absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" }, /* @__PURE__ */ React.createElement(X, { className: "h-4 w-4" })))), /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "outline",
        size: "icon",
        className: "rounded-full h-9 w-9 md:h-10 md:w-10 border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-[#1a1a1a]",
        onClick: () => setShowMenuOptionsSheet(true)
      },
      /* @__PURE__ */ React.createElement(MoreVertical, { className: "h-5 w-5 text-gray-900 dark:text-white" })
    )))),
    /* @__PURE__ */ React.createElement("div", { className: "bg-[#F8F9FA] dark:bg-[#0a0a0a] relative z-10 px-4 pt-4 md:pt-6 min-h-[50vh]" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-7xl mx-auto space-y-4" }, /* @__PURE__ */ React.createElement("div", { className: "bg-[#FFF9F6] dark:bg-[#1a1a1a] rounded-[28px] shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-orange-100/70 dark:border-gray-800 p-5 md:p-6 space-y-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-start" }, /* @__PURE__ */ React.createElement("div", { className: "flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mb-1" }, /* @__PURE__ */ React.createElement("h1", { className: "text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight" }, restaurant?.name || "Deni Cafe & bar"), /* @__PURE__ */ React.createElement("div", { className: "w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs" }, /* @__PURE__ */ React.createElement(Check, { className: "h-3.5 w-3.5 text-white", strokeWidth: 3 }))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-500 dark:text-gray-400 mt-1" }, /* @__PURE__ */ React.createElement(Utensils, { className: "h-4 w-4 text-gray-400" }), /* @__PURE__ */ React.createElement("span", null, restaurant?.topCategory || restaurant?.cuisine || "Multi-cuisine"))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-end gap-1" }, /* @__PURE__ */ React.createElement("div", { className: "bg-[#007A37] text-white px-3 py-1 rounded-xl flex items-center gap-1 font-extrabold text-sm shadow-xs" }, /* @__PURE__ */ React.createElement(Star, { className: "h-3.5 w-3.5 fill-white text-white" }), /* @__PURE__ */ React.createElement("span", null, restaurant?.rating ? Number(restaurant.rating).toFixed(1) : "4.0")), /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-semibold text-gray-400" }, (restaurant?.reviews || 1).toLocaleString(), "+ ratings"))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-4" }, /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "flex items-center gap-2 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer flex-1 min-w-0",
        onClick: () => setShowLocationSheet(true)
      },
      /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 truncate" }, /* @__PURE__ */ React.createElement(MapPin, { className: "h-4 w-4 text-gray-400 flex-shrink-0" }), /* @__PURE__ */ React.createElement("span", { className: "truncate" }, restaurant?.distance || "3.8 km", " | ", restaurant?.location || restaurant?.address || "Bhawarkua, Shivampuri Colony, Indore, Madhya Pradesh 452001, India"), /* @__PURE__ */ React.createElement(ChevronDown, { className: "h-4 w-4 text-gray-400 flex-shrink-0" }))
    ), /* @__PURE__ */ React.createElement("div", { className: "flex-shrink-0" }, /* @__PURE__ */ React.createElement(Badge, { className: `${isRestaurantOffline ? "bg-rose-100 text-rose-600 border-rose-200" : "bg-[#28A745] text-white border-transparent"} px-4 py-1.5 rounded-full text-xs font-bold shadow-xs whitespace-nowrap` }, isRestaurantOffline ? "\u2022 Offline" : "\u2022 Open now"))), /* @__PURE__ */ React.createElement("div", { className: "inline-flex items-center gap-1.5 bg-orange-50/90 dark:bg-gray-800 border border-orange-100/80 dark:border-gray-700 px-3.5 py-1 rounded-full text-xs font-bold text-gray-700 dark:text-gray-300" }, /* @__PURE__ */ React.createElement(Clock, { className: "h-3.5 w-3.5 text-gray-500" }), /* @__PURE__ */ React.createElement("span", null, restaurant?.deliveryTime || "25-30 mins"))), /* @__PURE__ */ React.createElement(
      "div",
      {
        onClick: () => setShowOffersSheet(true),
        className: "max-w-7xl mx-auto mt-4 bg-gradient-to-r from-orange-100/90 via-amber-50/80 to-orange-50/60 dark:from-orange-950/30 dark:to-zinc-900 rounded-[22px] shadow-xs border border-orange-200/70 dark:border-gray-800 p-4 relative overflow-hidden flex items-center justify-between cursor-pointer group"
      },
      /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3.5" }, /* @__PURE__ */ React.createElement("div", { className: "h-10 w-10 rounded-full bg-[#FE5502] flex items-center justify-center flex-shrink-0 text-white shadow-xs" }, /* @__PURE__ */ React.createElement(Percent, { className: "h-5 w-5 text-white", strokeWidth: 2.5 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { className: "text-sm md:text-base font-black text-[#FE5502] uppercase tracking-wide" }, highlightOffers[highlightIndex] || "UPTO 50% OFF"), /* @__PURE__ */ React.createElement("p", { className: "text-xs font-semibold text-gray-600 dark:text-gray-400" }, "Tap to view all offers"))),
      /* @__PURE__ */ React.createElement("div", { className: "w-8 h-8 rounded-full bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center text-gray-700 dark:text-gray-200 flex-shrink-0 group-hover:scale-110 transition-transform" }, /* @__PURE__ */ React.createElement(ChevronRight, { className: "h-4 w-4 text-gray-700 dark:text-gray-300" }))
    ), isRestaurantOffline && /* @__PURE__ */ React.createElement("div", { className: "max-w-7xl mx-auto mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700" }, "This restaurant is currently offline. Orders are unavailable."), /* @__PURE__ */ React.createElement("div", { className: "border-y border-gray-200 dark:border-gray-800 py-3 -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto scrollbar-hide" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-7xl mx-auto flex flex-col gap-2 w-max md:w-full px-4 md:px-0 items-start justify-start" }, menuCategories.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 w-max md:w-full md:justify-start overflow-x-auto scrollbar-hide" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => setSelectedMenuCategory("all"),
        className: `flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${selectedMenuCategory === "all" ? "border-[#FE5502] bg-red-50 text-[#FE5502]" : "border-gray-300 bg-white text-gray-700"}`
      },
      "All"
    ), menuCategories.map((category) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: category.id,
        type: "button",
        onClick: () => setSelectedMenuCategory(category.id),
        className: `flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${selectedMenuCategory === category.id ? "border-[#FE5502] bg-red-50 text-[#FE5502]" : "border-gray-300 bg-white text-gray-700"}`
      },
      category.image ? /* @__PURE__ */ React.createElement(
        "img",
        {
          src: category.image,
          alt: category.name,
          className: "h-6 w-6 rounded-full object-cover border border-white/70 shadow-sm",
          onError: (event) => {
            event.currentTarget.style.display = "none";
          }
        }
      ) : /* @__PURE__ */ React.createElement("span", { className: "flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold uppercase text-gray-500" }, category.name?.charAt(0) || "C"),
      category.name
    )))))), restaurant?.menuSections && Array.isArray(restaurant.menuSections) && restaurant.menuSections.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 pt-6 pb-[140px] sm:pt-8 md:pt-10 lg:pt-12 space-y-6 md:space-y-8 lg:space-y-10" }, filteredSections.length === 0 && hasActiveMenuFilters && /* @__PURE__ */ React.createElement("div", { className: "rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] px-5 py-8 text-center" }, /* @__PURE__ */ React.createElement("p", { className: "text-sm md:text-base font-medium text-gray-700 dark:text-gray-300" }, "No dishes match the selected filters."), /* @__PURE__ */ React.createElement("p", { className: "text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-2" }, "Clear filters or try a different combination.")), filteredSections.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-sm text-gray-500" }, "No dishes match the current filters."), filteredSections.map(({ section, originalIndex }, sectionIndex) => {
      const isRecommended = isRecommendedSection(section);
      const sectionId = `menu-section-${originalIndex}`;
      const sectionItems = toRenderableArray(section?.items);
      const sectionSubsections = toRenderableArray(section?.subsections);
      const isExpanded = expandedSections.has(originalIndex);
      return /* @__PURE__ */ React.createElement("div", { key: sectionIndex, id: sectionId, className: "space-y-1 scroll-mt-20" }, isRecommended && /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-bold text-gray-900 dark:text-white" }, "Recommended for you"), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: (e) => {
            e.stopPropagation();
            setExpandedSections((prev) => {
              const newSet = new Set(prev);
              if (newSet.has(originalIndex)) {
                newSet.delete(originalIndex);
              } else {
                newSet.add(originalIndex);
              }
              return newSet;
            });
          },
          className: "p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
        },
        /* @__PURE__ */ React.createElement(
          ChevronDown,
          {
            className: `h-5 w-5 text-gray-600 dark:text-gray-400 transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`
          }
        )
      )), !isRecommended && /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("div", { className: "space-y-1" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-bold text-gray-900 dark:text-white" }, section?.name && typeof section.name === "string" && section.name.trim() ? section.name.trim() : section?.title && typeof section.title === "string" && section.title.trim() ? section.title.trim() : "Unnamed Section"), section.subtitle && /* @__PURE__ */ React.createElement("button", { className: "text-sm text-primary dark:text-orange-400 underline" }, section.subtitle)), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: (e) => {
            e.stopPropagation();
            setExpandedSections((prev) => {
              const newSet = new Set(prev);
              if (newSet.has(originalIndex)) {
                newSet.delete(originalIndex);
              } else {
                newSet.add(originalIndex);
              }
              return newSet;
            });
          },
          className: "p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
        },
        /* @__PURE__ */ React.createElement(
          ChevronDown,
          {
            className: `h-5 w-5 text-gray-600 dark:text-gray-400 transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`
          }
        )
      )), isExpanded && isRecommended && !loadingMenuItems && sectionItems.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-center py-8" }, /* @__PURE__ */ React.createElement("p", { className: "text-gray-500 dark:text-gray-400 text-sm md:text-base" }, "No dish recommended")), isExpanded && loadingMenuItems && /* @__PURE__ */ React.createElement("div", { className: "space-y-3 px-1 py-2 animate-pulse" }, /* @__PURE__ */ React.createElement("div", { className: "h-24 rounded-2xl bg-gray-100 dark:bg-gray-800" }), /* @__PURE__ */ React.createElement("div", { className: "h-24 rounded-2xl bg-gray-100 dark:bg-gray-800" })), isExpanded && sectionItems.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "space-y-0" }, sectionItems.map((item) => {
        const quantity = getDishQuantity(item);
        const isVeg = item.foodType === "Veg";
        if (item.preparationTime) {
          debugLog(`[FRONTEND] Item "${item.name}" preparationTime:`, item.preparationTime, "Type:", typeof item.preparationTime);
        }
        return /* @__PURE__ */ React.createElement(
          "div",
          {
            key: item.id,
            ref: (node) => {
              if (node) {
                dishCardRefs.current[item.id] = node;
              } else {
                delete dishCardRefs.current[item.id];
              }
            },
            className: `bg-white dark:bg-[#1a1a1a] rounded-3xl border border-gray-100 dark:border-gray-800 p-4 sm:p-5 md:p-6 flex items-stretch gap-4 sm:gap-6 mb-4 sm:mb-5 shadow-xs hover:shadow-md transition-all duration-300 relative cursor-pointer min-h-[140px] sm:min-h-[170px] ${highlightedDishId === item.id ? "bg-red-50 ring-2 ring-[#FE5502] ring-inset dark:bg-orange-950/20" : ""}`,
            onClick: () => handleItemClick(item)
          },
          /* @__PURE__ */ React.createElement("div", { className: "relative w-32 h-32 sm:w-44 sm:h-44 md:w-48 md:h-48 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800 shadow-xs" }, item.image ? /* @__PURE__ */ React.createElement(
            "img",
            {
              src: item.image,
              alt: item.name,
              className: "w-full h-full object-cover rounded-2xl",
              onError: (e) => {
                if (e.currentTarget.src !== FOOD_IMAGE_FALLBACK) {
                  e.currentTarget.src = FOOD_IMAGE_FALLBACK;
                }
              }
            }
          ) : /* @__PURE__ */ React.createElement("div", { className: "w-full h-full bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs text-gray-400 font-semibold" }, "No image")), /* @__PURE__ */ React.createElement("div", { className: "absolute top-2 left-2 z-10 bg-white/90 dark:bg-black/80 p-1 rounded-md shadow-xs backdrop-blur-xs" }, isVeg ? /* @__PURE__ */ React.createElement("div", { className: "w-4 h-4 border-2 border-green-600 flex items-center justify-center rounded-sm" }, /* @__PURE__ */ React.createElement("div", { className: "w-2 h-2 bg-green-600 rounded-full" })) : /* @__PURE__ */ React.createElement("div", { className: "w-4 h-4 border-2 border-orange-600 flex items-center justify-center rounded-sm" }, /* @__PURE__ */ React.createElement("div", { className: "w-2 h-2 bg-orange-600 rounded-full" })))),
          /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0 flex flex-col justify-between py-0.5" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-2" }, /* @__PURE__ */ React.createElement("h3", { className: "font-extrabold text-gray-900 dark:text-white text-base sm:text-lg leading-tight line-clamp-2" }, item.name), /* @__PURE__ */ React.createElement(
            "button",
            {
              type: "button",
              onClick: (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleBookmarkClick(item);
              },
              className: `p-1.5 rounded-full border transition-colors flex-shrink-0 ${isDishFavorite(item.id, restaurant?.restaurantId || restaurant?._id || restaurant?.id) ? "border-red-500 text-red-500 bg-red-50 dark:bg-red-900/20" : "border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600"}`
            },
            /* @__PURE__ */ React.createElement(
              Heart,
              {
                size: 16,
                className: isDishFavorite(item.id, restaurant?.restaurantId || restaurant?._id || restaurant?.id) ? "fill-red-500 text-red-500" : ""
              }
            )
          )), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-2 my-1.5" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 flex-wrap" }, /* @__PURE__ */ React.createElement("p", { className: "font-extrabold text-gray-900 dark:text-white text-base sm:text-lg" }, RUPEE_SYMBOL, Math.round(getFoodDisplayPrice(item))), item.preparationTime && String(item.preparationTime).trim() && /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full whitespace-nowrap" }, /* @__PURE__ */ React.createElement(Clock, { size: 12, className: "text-gray-500" }), /* @__PURE__ */ React.createElement("span", null, String(item.preparationTime).trim()))), /* @__PURE__ */ React.createElement("div", { className: "flex-shrink-0" }, quantity > 0 ? /* @__PURE__ */ React.createElement("div", { className: "bg-white dark:bg-[#1a1a1a] border-2 border-[#FE5502] text-[#FE5502] font-black px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full shadow-sm flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(
            "button",
            {
              onClick: (e) => {
                e.stopPropagation();
                if (!shouldShowGrayscale) {
                  updateItemQuantity(item, Math.max(0, quantity - 1), e);
                }
              },
              disabled: shouldShowGrayscale,
              className: "text-[#FE5502] hover:text-orange-700 p-0.5"
            },
            /* @__PURE__ */ React.createElement(Minus, { size: 14, className: "stroke-[3px]" })
          ), /* @__PURE__ */ React.createElement("span", { className: "mx-1 text-xs sm:text-sm font-black" }, quantity), /* @__PURE__ */ React.createElement(
            "button",
            {
              onClick: (e) => {
                e.stopPropagation();
                if (!shouldShowGrayscale) {
                  updateItemQuantity(item, quantity + 1, e);
                }
              },
              disabled: shouldShowGrayscale,
              className: "text-[#FE5502] hover:text-orange-700 p-0.5"
            },
            /* @__PURE__ */ React.createElement(Plus, { size: 14, className: "stroke-[3px]" })
          )) : /* @__PURE__ */ React.createElement(
            Button,
            {
              onClick: (e) => {
                e.stopPropagation();
                if (!shouldShowGrayscale) {
                  updateItemQuantity(item, 1, e);
                }
              },
              disabled: shouldShowGrayscale,
              className: "bg-[#FE5502] hover:bg-orange-600 text-white font-extrabold text-xs sm:text-sm px-4 py-1.5 sm:px-6 sm:py-2.5 rounded-full shadow-md transition-transform hover:scale-105 active:scale-95"
            },
            "ADD +"
          ))), item.description && /* @__PURE__ */ React.createElement("p", { className: "text-xs sm:text-sm text-gray-500 dark:text-gray-400 line-clamp-2" }, item.description))
        );
      })), isExpanded && sectionSubsections.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, sectionSubsections.map((subsection, subIndex) => {
        const subsectionKey = `${originalIndex}-${subIndex}`;
        const isSubsectionExpanded = expandedSections.has(subsectionKey);
        const subsectionItems = toRenderableArray(subsection?.items);
        return /* @__PURE__ */ React.createElement("div", { key: subIndex, className: "space-y-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("h3", { className: "text-base font-semibold text-gray-900 dark:text-white" }, subsection?.name || subsection?.title || "Subsection"), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: (e) => {
              e.stopPropagation();
              setExpandedSections((prev) => {
                const newSet = new Set(prev);
                if (newSet.has(subsectionKey)) {
                  newSet.delete(subsectionKey);
                } else {
                  newSet.add(subsectionKey);
                }
                return newSet;
              });
            },
            className: "p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          },
          /* @__PURE__ */ React.createElement(
            ChevronDown,
            {
              className: `h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isSubsectionExpanded ? "" : "-rotate-90"}`
            }
          )
        )), isSubsectionExpanded && subsectionItems.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "space-y-0" }, subsectionItems.map((item) => {
          const quantity = getDishQuantity(item);
          const isVeg = item.foodType === "Veg";
          if (item.preparationTime) {
            debugLog(`[FRONTEND] Subsection item "${item.name}" preparationTime:`, item.preparationTime);
          }
          return /* @__PURE__ */ React.createElement(
            "div",
            {
              key: item.id,
              ref: (node) => {
                if (node) {
                  dishCardRefs.current[item.id] = node;
                } else {
                  delete dishCardRefs.current[item.id];
                }
              },
              className: `bg-white dark:bg-[#1a1a1a] rounded-3xl border border-gray-100 dark:border-gray-800 p-4 sm:p-5 md:p-6 flex items-stretch gap-4 sm:gap-6 mb-4 sm:mb-5 shadow-xs hover:shadow-md transition-all duration-300 relative cursor-pointer min-h-[140px] sm:min-h-[170px] ${highlightedDishId === item.id ? "bg-red-50 ring-2 ring-[#FE5502] ring-inset dark:bg-orange-950/20" : ""}`,
              onClick: () => handleItemClick(item)
            },
            /* @__PURE__ */ React.createElement("div", { className: "relative w-32 h-32 sm:w-44 sm:h-44 md:w-48 md:h-48 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800 shadow-xs" }, item.image ? /* @__PURE__ */ React.createElement(
              "img",
              {
                src: item.image,
                alt: item.name,
                className: "w-full h-full object-cover rounded-2xl",
                onError: (e) => {
                  if (e.currentTarget.src !== FOOD_IMAGE_FALLBACK) {
                    e.currentTarget.src = FOOD_IMAGE_FALLBACK;
                  }
                }
              }
            ) : /* @__PURE__ */ React.createElement("div", { className: "w-full h-full bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs text-gray-400 font-semibold" }, "No image")), /* @__PURE__ */ React.createElement("div", { className: "absolute top-2 left-2 z-10 bg-white/90 dark:bg-black/80 p-1 rounded-md shadow-xs backdrop-blur-xs" }, isVeg ? /* @__PURE__ */ React.createElement("div", { className: "w-4 h-4 border-2 border-green-600 flex items-center justify-center rounded-sm" }, /* @__PURE__ */ React.createElement("div", { className: "w-2 h-2 bg-green-600 rounded-full" })) : /* @__PURE__ */ React.createElement("div", { className: "w-4 h-4 border-2 border-orange-600 flex items-center justify-center rounded-sm" }, /* @__PURE__ */ React.createElement("div", { className: "w-2 h-2 bg-orange-600 rounded-full" })))),
            /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0 flex flex-col justify-between py-0.5" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-2" }, /* @__PURE__ */ React.createElement("h3", { className: "font-extrabold text-gray-900 dark:text-white text-base sm:text-lg leading-tight line-clamp-2" }, item.name), /* @__PURE__ */ React.createElement(
              "button",
              {
                type: "button",
                onClick: (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleBookmarkClick(item);
                },
                className: `p-1.5 rounded-full border transition-colors flex-shrink-0 ${isDishFavorite(item.id, restaurant?.restaurantId || restaurant?._id || restaurant?.id) ? "border-red-500 text-red-500 bg-red-50 dark:bg-red-900/20" : "border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600"}`
              },
              /* @__PURE__ */ React.createElement(
                Heart,
                {
                  size: 16,
                  className: isDishFavorite(item.id, restaurant?.restaurantId || restaurant?._id || restaurant?.id) ? "fill-red-500 text-red-500" : ""
                }
              )
            )), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-2 my-1.5" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 flex-wrap" }, /* @__PURE__ */ React.createElement("p", { className: "font-extrabold text-gray-900 dark:text-white text-base sm:text-lg" }, RUPEE_SYMBOL, Math.round(getFoodDisplayPrice(item))), item.preparationTime && String(item.preparationTime).trim() && /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full whitespace-nowrap" }, /* @__PURE__ */ React.createElement(Clock, { size: 12, className: "text-gray-500" }), /* @__PURE__ */ React.createElement("span", null, String(item.preparationTime).trim()))), /* @__PURE__ */ React.createElement("div", { className: "flex-shrink-0" }, quantity > 0 ? /* @__PURE__ */ React.createElement("div", { className: "bg-white dark:bg-[#1a1a1a] border-2 border-[#FE5502] text-[#FE5502] font-black px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full shadow-sm flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(
              "button",
              {
                onClick: (e) => {
                  e.stopPropagation();
                  if (!shouldShowGrayscale) {
                    updateItemQuantity(item, Math.max(0, quantity - 1), e);
                  }
                },
                disabled: shouldShowGrayscale,
                className: "text-[#FE5502] hover:text-orange-700 p-0.5"
              },
              /* @__PURE__ */ React.createElement(Minus, { size: 14, className: "stroke-[3px]" })
            ), /* @__PURE__ */ React.createElement("span", { className: "mx-1 text-xs sm:text-sm font-black" }, quantity), /* @__PURE__ */ React.createElement(
              "button",
              {
                onClick: (e) => {
                  e.stopPropagation();
                  if (!shouldShowGrayscale) {
                    updateItemQuantity(item, quantity + 1, e);
                  }
                },
                disabled: shouldShowGrayscale,
                className: "text-[#FE5502] hover:text-orange-700 p-0.5"
              },
              /* @__PURE__ */ React.createElement(Plus, { size: 14, className: "stroke-[3px]" })
            )) : /* @__PURE__ */ React.createElement(
              Button,
              {
                onClick: (e) => {
                  e.stopPropagation();
                  if (!shouldShowGrayscale) {
                    updateItemQuantity(item, 1, e);
                  }
                },
                disabled: shouldShowGrayscale,
                className: "bg-[#FE5502] hover:bg-orange-600 text-white font-extrabold text-xs sm:text-sm px-4 py-1.5 sm:px-6 sm:py-2.5 rounded-full shadow-md transition-transform hover:scale-105 active:scale-95"
              },
              "ADD +"
            ))), item.description && /* @__PURE__ */ React.createElement("p", { className: "text-xs sm:text-sm text-gray-500 dark:text-gray-400 line-clamp-2" }, item.description))
          );
        })));
      })));
    }))),
    restaurant?.onboarding?.step3?.fssai?.registrationNumber && /* @__PURE__ */ React.createElement("div", { className: "px-4 py-4 mt-2 mb-24 border-t border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/30 dark:bg-white/5 mx-4 rounded-xl" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "h-12 w-20 flex items-center justify-center bg-white rounded-lg p-1.5 shadow-sm border border-gray-100" }, /* @__PURE__ */ React.createElement(
      "img",
      {
        src: fssaiLogo,
        alt: "FSSAI",
        className: "h-full w-auto object-contain"
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "flex-1" }, /* @__PURE__ */ React.createElement("p", { className: "text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold mb-1" }, "License No."), /* @__PURE__ */ React.createElement("p", { className: "text-sm font-semibold text-gray-600 dark:text-gray-300 font-mono tracking-wide" }, restaurant?.onboarding?.step3?.fssai?.registrationNumber)))),
    !showFilterSheet && !showMenuSheet && !showMenuOptionsSheet && /* @__PURE__ */ React.createElement("div", { className: "fixed bottom-6 right-6 z-50" }, /* @__PURE__ */ React.createElement(
      Button,
      {
        className: "bg-[#064e3b] hover:bg-[#043e2f] text-white flex items-center gap-2 shadow-2xl border border-emerald-700/40 px-5 py-3 rounded-full font-black transform transition-all duration-300 hover:scale-105 active:scale-95 group relative",
        size: "lg",
        onClick: () => setShowMenuSheet(true)
      },
      /* @__PURE__ */ React.createElement(Utensils, { className: "h-4 w-4 text-white group-hover:rotate-12 transition-transform" }),
      /* @__PURE__ */ React.createElement("span", { className: "tracking-widest text-xs font-black" }, "MENU"),
      cart.length > 0 && /* @__PURE__ */ React.createElement("span", { className: "absolute -top-2 -right-2 w-6 h-6 bg-[#FE5502] text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-md border-2 border-white" }, cart.length)
    )),
    typeof window !== "undefined" && createPortal(
      /* @__PURE__ */ React.createElement(AnimatePresence, null, showMenuSheet && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
        motion.div,
        {
          className: "fixed inset-0 bg-black/40 z-[9999]",
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.2 },
          onClick: () => setShowMenuSheet(false)
        }
      ), /* @__PURE__ */ React.createElement(
        motion.div,
        {
          className: "fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[85vh] md:max-h-[85vh] w-full md:w-[500px] lg:w-[560px] flex flex-col overflow-hidden",
          initial: { y: "100%" },
          animate: { y: 0 },
          exit: { y: "100%" },
          transition: { duration: 0.2, type: "spring", damping: 30, stiffness: 400 },
          style: { willChange: "transform" },
          onClick: (e) => e.stopPropagation()
        },
        /* @__PURE__ */ React.createElement("div", { className: "px-5 pt-5 pb-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-bold text-gray-900 dark:text-white" }, "Menu Categories"), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setShowMenuSheet(false),
            className: "hidden md:flex h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white items-center justify-center transition-colors",
            "aria-label": "Close menu categories"
          },
          /* @__PURE__ */ React.createElement(X, { className: "h-4 w-4" })
        )),
        /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto px-5 py-4" }, /* @__PURE__ */ React.createElement("div", { className: "space-y-1" }, menuCategories.map((category, index) => /* @__PURE__ */ React.createElement(
          "button",
          {
            key: index,
            className: "w-full flex items-center justify-between py-3 px-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors text-left",
            onClick: () => {
              setShowMenuSheet(false);
              setTimeout(() => {
                const sectionId = `menu-section-${category.sectionIndex}`;
                const sectionElement = document.getElementById(sectionId);
                if (sectionElement) {
                  sectionElement.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                  });
                }
              }, 300);
            }
          },
          /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 min-w-0" }, category.image ? /* @__PURE__ */ React.createElement(
            "img",
            {
              src: category.image,
              alt: category.name,
              className: "h-10 w-10 rounded-xl object-cover border border-gray-200 dark:border-gray-700",
              onError: (event) => {
                event.currentTarget.style.display = "none";
              }
            }
          ) : /* @__PURE__ */ React.createElement("span", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-bold uppercase text-gray-500 dark:text-gray-400" }, category.name?.charAt(0) || "C"), /* @__PURE__ */ React.createElement("span", { className: "text-base font-semibold text-gray-900 dark:text-white truncate" }, category.name)),
          /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 rounded-full" }, category.count))
        )))),
        /* @__PURE__ */ React.createElement("div", { className: "border-t border-gray-200 dark:border-gray-800 px-4 py-3 bg-white dark:bg-[#1a1a1a] md:hidden" }, /* @__PURE__ */ React.createElement(
          Button,
          {
            className: "w-full bg-[#1a1a1a] dark:bg-[#FE5502] hover:bg-[#FE5502] dark:hover:bg-[#C83C00] text-white border-0 flex items-center justify-center gap-2 py-5 rounded-xl font-bold transition-all shadow-lg",
            onClick: () => setShowMenuSheet(false)
          },
          /* @__PURE__ */ React.createElement(X, { className: "h-5 w-5" }),
          "Close"
        ))
      ))),
      document.body
    ),
    typeof window !== "undefined" && createPortal(
      /* @__PURE__ */ React.createElement(AnimatePresence, null, showFilterSheet && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
        motion.div,
        {
          className: "fixed inset-0 bg-black/40 z-[9999]",
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.15 },
          onClick: () => setShowFilterSheet(false)
        }
      ), /* @__PURE__ */ React.createElement(
        motion.div,
        {
          className: "fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl h-[80vh] md:h-auto md:max-h-[90vh] md:max-w-lg w-full md:w-auto flex flex-col",
          initial: { y: "100%" },
          animate: { y: 0 },
          exit: { y: "100%" },
          transition: { duration: 0.2, type: "spring", damping: 30, stiffness: 400 },
          style: { willChange: "transform" }
        },
        /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-200 dark:border-gray-800" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-semibold text-gray-900 dark:text-white" }, "Filters and Sorting"), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setShowFilterSheet(false),
            className: "p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          },
          /* @__PURE__ */ React.createElement(X, { className: "h-5 w-5 text-gray-600 dark:text-gray-400" })
        )),
        /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto px-4 py-3 space-y-4" }, /* @__PURE__ */ React.createElement("div", { className: "space-y-2" }, /* @__PURE__ */ React.createElement("h3", { className: "text-sm font-semibold text-gray-900 dark:text-white" }, "Sort by:"), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col gap-1.5" }, /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setFilters((prev) => ({
              ...prev,
              sortBy: prev.sortBy === "low-to-high" ? null : "low-to-high"
            })),
            className: `text-left px-4 py-2.5 rounded-lg border-2 transition-all ${filters.sortBy === "low-to-high" ? "border-primary dark:border-orange-400 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"}`
          },
          "Price - low to high"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setFilters((prev) => ({
              ...prev,
              sortBy: prev.sortBy === "high-to-low" ? null : "high-to-low"
            })),
            className: `text-left px-4 py-2.5 rounded-lg border-2 transition-all ${filters.sortBy === "high-to-low" ? "border-primary dark:border-orange-400 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"}`
          },
          "Price - high to low"
        ))), /* @__PURE__ */ React.createElement("div", { className: "space-y-2" }, /* @__PURE__ */ React.createElement("h3", { className: "text-sm font-semibold text-gray-900 dark:text-white" }, "Veg/Non-veg preference:"), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setFilters((prev) => ({
              ...prev,
              vegNonVeg: prev.vegNonVeg === "veg" ? null : "veg"
            })),
            className: `flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all flex-1 ${filters.vegNonVeg === "veg" ? "border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"}`
          },
          /* @__PURE__ */ React.createElement("div", { className: "h-4 w-4 rounded-full bg-green-600 dark:bg-green-500" }),
          /* @__PURE__ */ React.createElement("span", { className: "font-medium" }, "Veg")
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setFilters((prev) => ({
              ...prev,
              vegNonVeg: prev.vegNonVeg === "non-veg" ? null : "non-veg"
            })),
            className: `flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all flex-1 ${filters.vegNonVeg === "non-veg" ? "border-amber-700 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"}`
          },
          /* @__PURE__ */ React.createElement("div", { className: "h-4 w-4 rounded-full bg-amber-700 dark:bg-amber-600" }),
          /* @__PURE__ */ React.createElement("span", { className: "font-medium" }, "Non-veg")
        ))), /* @__PURE__ */ React.createElement("div", { className: "space-y-2" }, /* @__PURE__ */ React.createElement("h3", { className: "text-sm font-semibold text-gray-900 dark:text-white" }, "Top picks:"), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setFilters((prev) => ({
              ...prev,
              highlyReordered: !prev.highlyReordered
            })),
            className: `flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all w-full ${filters.highlyReordered ? "border-[#FE5502] dark:border-[#FE5502] bg-red-50 dark:bg-[#FE5502]/20 text-[#FE5502] dark:text-[#FE5502]" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"}`
          },
          /* @__PURE__ */ React.createElement(RotateCcw, { className: "h-4 w-4" }),
          /* @__PURE__ */ React.createElement("span", { className: "font-medium" }, "Highly reordered")
        )), /* @__PURE__ */ React.createElement("div", { className: "space-y-2" }, /* @__PURE__ */ React.createElement("h3", { className: "text-sm font-semibold text-gray-900 dark:text-white" }, "Dietary preference:"), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setFilters((prev) => ({
              ...prev,
              spicy: !prev.spicy
            })),
            className: `flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all w-full ${filters.spicy ? "border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"}`
          },
          /* @__PURE__ */ React.createElement(Flame, { className: "h-4 w-4" }),
          /* @__PURE__ */ React.createElement("span", { className: "font-medium" }, "Spicy")
        ))),
        /* @__PURE__ */ React.createElement("div", { className: "border-t border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between bg-white dark:bg-[#1a1a1a]" }, /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => {
              setFilters({
                sortBy: null,
                vegNonVeg: null,
                highlyReordered: false,
                spicy: false
              });
            },
            className: "text-red-600 dark:text-red-400 font-medium text-sm hover:text-red-700 dark:hover:text-red-500"
          },
          "Clear All"
        ), /* @__PURE__ */ React.createElement(
          Button,
          {
            className: "bg-[#FE5502] hover:bg-[#C83C00] text-white px-6 py-2.5 rounded-lg font-bold",
            onClick: () => setShowFilterSheet(false)
          },
          "Apply ",
          activeFilterCount > 0 && `(${activeFilterCount})`
        ))
      ))),
      document.body
    ),
    typeof window !== "undefined" && createPortal(
      /* @__PURE__ */ React.createElement(AnimatePresence, null, showLocationSheet && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
        motion.div,
        {
          className: "fixed inset-0 bg-black/40 z-[9999]",
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.2 },
          onClick: () => setShowLocationSheet(false)
        }
      ), /* @__PURE__ */ React.createElement(
        motion.div,
        {
          className: "fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl h-[75vh] md:h-auto md:max-h-[90vh] md:max-w-xl w-full md:w-auto flex flex-col",
          initial: { y: "100%" },
          animate: { y: 0 },
          exit: { y: "100%" },
          transition: { duration: 0.2, type: "spring", damping: 30, stiffness: 400 },
          style: { willChange: "transform" }
        },
        /* @__PURE__ */ React.createElement("div", { className: "px-4 pt-4 pb-3 border-b border-gray-200 dark:border-gray-800" }, /* @__PURE__ */ React.createElement("p", { className: "text-xs text-gray-500 dark:text-gray-400 mb-1.5" }, "All delivery outlets for"), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("div", { className: "w-8 h-8 bg-red-600 dark:bg-red-500 rounded-lg flex items-center justify-center" }, /* @__PURE__ */ React.createElement("span", { className: "text-white font-bold text-base" }, (restaurant.name || "R").charAt(0).toUpperCase())), /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-bold text-gray-900 dark:text-white" }, restaurant?.name || "Unknown Restaurant"))),
        /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto px-4 py-3" }, restaurant?.outlets && Array.isArray(restaurant.outlets) && restaurant.outlets.length > 0 ? /* @__PURE__ */ React.createElement("div", { className: "space-y-2" }, restaurant.outlets.map((outlet) => /* @__PURE__ */ React.createElement(
          "div",
          {
            key: outlet?.id || Math.random(),
            className: "p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2a2a2a]"
          },
          outlet?.isNearest && /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5 mb-2 px-2 py-1 bg-red-50 dark:bg-[#FE5502]/20 rounded-md" }, /* @__PURE__ */ React.createElement(Zap, { className: "h-3.5 w-3.5 text-[#FE5502] dark:text-[#FE5502] fill-[#FE5502] dark:fill-[#FE5502]" }), /* @__PURE__ */ React.createElement("span", { className: "text-xs font-semibold text-[#FE5502] dark:text-[#FE5502]" }, "Nearest available outlet")),
          /* @__PURE__ */ React.createElement("h3", { className: "text-sm font-semibold text-gray-900 dark:text-white mb-2" }, outlet?.location || "Location"),
          /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1" }, /* @__PURE__ */ React.createElement(Clock, { className: "h-3.5 w-3.5" }), /* @__PURE__ */ React.createElement("span", null, outlet?.deliveryTime || "25-30 mins")), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1" }, /* @__PURE__ */ React.createElement(MapPin, { className: "h-3.5 w-3.5" }), /* @__PURE__ */ React.createElement("span", null, outlet?.distance || "1.2 km"))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-end gap-0.5" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1" }, /* @__PURE__ */ React.createElement(Star, { className: "h-3.5 w-3.5 text-green-600 dark:text-green-500 fill-green-600 dark:fill-green-500" }), /* @__PURE__ */ React.createElement("span", { className: "text-xs font-medium text-gray-900 dark:text-white" }, outlet?.rating || 4.5)), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-gray-500 dark:text-gray-400" }, "By ", (outlet?.reviews || 0) >= 1e3 ? `${((outlet.reviews || 0) / 1e3).toFixed(1)}K+` : `${outlet?.reviews || 0}+`)))
        ))) : /* @__PURE__ */ React.createElement("div", { className: "text-center py-8 text-gray-500 dark:text-gray-400" }, "No outlets available")),
        restaurant?.outlets && Array.isArray(restaurant.outlets) && restaurant.outlets.length > 5 && /* @__PURE__ */ React.createElement("div", { className: "border-t border-gray-200 dark:border-gray-800 px-4 py-3 bg-white dark:bg-[#1a1a1a]" }, /* @__PURE__ */ React.createElement("button", { className: "flex items-center justify-center gap-2 text-red-600 dark:text-red-400 font-medium text-sm w-full" }, /* @__PURE__ */ React.createElement("span", null, "See all ", restaurant.outlets.length, " outlets"), /* @__PURE__ */ React.createElement(ChevronDown, { className: "h-4 w-4" })))
      ))),
      document.body
    ),
    typeof window !== "undefined" && createPortal(
      /* @__PURE__ */ React.createElement(AnimatePresence, null, showManageCollections && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
        motion.div,
        {
          className: "fixed inset-0 bg-black/40 z-[9999]",
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.2 },
          onClick: () => setShowManageCollections(false)
        }
      ), /* @__PURE__ */ React.createElement(
        motion.div,
        {
          className: "fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl md:max-w-lg w-full md:w-auto",
          initial: { y: "100%" },
          animate: { y: 0 },
          exit: { y: "100%" },
          transition: { duration: 0.2, type: "spring", damping: 30, stiffness: 400 }
        },
        /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between px-4 pt-6 pb-4 border-b border-gray-200 dark:border-gray-800" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-bold text-gray-900 dark:text-white" }, "Manage Collections"), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setShowManageCollections(false),
            className: "h-8 w-8 rounded-full bg-gray-700 dark:bg-gray-600 flex items-center justify-center hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
          },
          /* @__PURE__ */ React.createElement(X, { className: "h-4 w-4 text-white" })
        )),
        /* @__PURE__ */ React.createElement("div", { className: "px-4 py-4 space-y-2" }, /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "w-full flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors",
            onClick: (e) => {
              e.stopPropagation();
            }
          },
          /* @__PURE__ */ React.createElement("div", { className: "h-12 w-12 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center flex-shrink-0" }, /* @__PURE__ */ React.createElement(Bookmark, { className: "h-6 w-6 text-red-500 dark:text-red-400 fill-red-500 dark:fill-red-400" })),
          /* @__PURE__ */ React.createElement("div", { className: "flex-1 text-left" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("span", { className: "text-base font-medium text-gray-900 dark:text-white" }, "Bookmarks"), selectedItem && /* @__PURE__ */ React.createElement(
            Checkbox,
            {
              checked: isDishFavorite(selectedItem.id, restaurant?.restaurantId || restaurant?._id || restaurant?.id),
              onCheckedChange: (checked) => {
                if (!checked && selectedItem) {
                  const restaurantId = restaurant?.restaurantId || restaurant?._id || restaurant?.id;
                  removeDishFavorite(selectedItem.id, restaurantId);
                  setShowManageCollections(false);
                }
              },
              className: "h-5 w-5 rounded border-2 border-red-500 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500",
              onClick: (e) => e.stopPropagation()
            }
          ), !selectedItem && /* @__PURE__ */ React.createElement("div", { className: "h-5 w-5 rounded border-2 border-red-500 bg-red-500 flex items-center justify-center" }, /* @__PURE__ */ React.createElement(Check, { className: "h-3 w-3 text-white" }))), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-gray-500 dark:text-gray-400 mt-1" }, getDishFavorites().length, " dishes \uFFFD ", getFavorites().length, " restaurant"))
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "w-full flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors",
            onClick: () => setShowManageCollections(false)
          },
          /* @__PURE__ */ React.createElement("div", { className: "h-12 w-12 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center flex-shrink-0" }, /* @__PURE__ */ React.createElement(Plus, { className: "h-6 w-6 text-red-500 dark:text-red-400" })),
          /* @__PURE__ */ React.createElement("div", { className: "flex-1 text-left" }, /* @__PURE__ */ React.createElement("span", { className: "text-base font-medium text-gray-900 dark:text-white" }, "Create new Collection"))
        )),
        /* @__PURE__ */ React.createElement("div", { className: "border-t border-gray-200 dark:border-gray-800 px-4 py-4" }, /* @__PURE__ */ React.createElement(
          Button,
          {
            className: "w-full bg-[#FE5502] hover:bg-[#C83C00] text-white py-3 rounded-lg font-bold",
            onClick: () => {
              setShowManageCollections(false);
            }
          },
          "Done"
        ))
      ))),
      document.body
    ),
    typeof window !== "undefined" && createPortal(
      /* @__PURE__ */ React.createElement(AnimatePresence, null, showItemDetail && selectedItem && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
        motion.div,
        {
          className: "fixed inset-0 bg-black/40 z-[9999]",
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.2 },
          onClick: () => setShowItemDetail(false)
        }
      ), /* @__PURE__ */ React.createElement(
        motion.div,
        {
          className: "fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[90vh] md:max-w-2xl lg:max-w-3xl w-full md:w-auto flex flex-col overflow-hidden",
          initial: { y: "100%" },
          animate: { y: 0 },
          exit: { y: "100%" },
          transition: { duration: 0.15, type: "spring", damping: 30, stiffness: 400 },
          onClick: (e) => e.stopPropagation()
        },
        /* @__PURE__ */ React.createElement("div", { className: "md:hidden absolute -top-[44px] left-1/2 -translate-x-1/2 z-[10001]" }, /* @__PURE__ */ React.createElement(
          motion.button,
          {
            onClick: () => setShowItemDetail(false),
            className: "h-10 w-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-900 transition-colors shadow-lg",
            initial: { opacity: 0, y: -10 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: -10 },
            transition: { duration: 0.2 }
          },
          /* @__PURE__ */ React.createElement(X, { className: "h-5 w-5 text-white" })
        )),
        /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setShowItemDetail(false),
            className: "hidden md:flex absolute top-4 right-4 z-[10001] h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white items-center justify-center transition-colors shadow-md",
            "aria-label": "Close"
          },
          /* @__PURE__ */ React.createElement(X, { className: "h-5 w-5" })
        ),
        /* @__PURE__ */ React.createElement("div", { className: "relative w-full h-64 overflow-hidden rounded-t-3xl" }, selectedItem.image ? /* @__PURE__ */ React.createElement(
          "img",
          {
            src: selectedItem.image,
            alt: selectedItem.name,
            className: "w-full h-full object-cover"
          }
        ) : /* @__PURE__ */ React.createElement("div", { className: "w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm text-gray-400" }, "No image available")), /* @__PURE__ */ React.createElement("div", { className: "absolute bottom-4 right-4 flex items-center gap-3" }, /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: (e) => {
              e.stopPropagation();
              handleBookmarkClick(selectedItem);
            },
            className: `h-10 w-10 rounded-full border flex items-center justify-center transition-all duration-300 ${isDishFavorite(selectedItem.id, restaurant?.restaurantId || restaurant?._id || restaurant?.id) ? "border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400" : "border-white dark:border-gray-800 bg-white/90 dark:bg-[#1a1a1a]/90 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-[#2a2a2a]"}`
          },
          /* @__PURE__ */ React.createElement(
            Bookmark,
            {
              className: `h-5 w-5 transition-all duration-300 ${isDishFavorite(selectedItem.id, restaurant?.restaurantId || restaurant?._id || restaurant?.id) ? "fill-red-500 dark:fill-red-400" : ""}`
            }
          )
        ), /* @__PURE__ */ React.createElement("button", { className: "h-10 w-10 rounded-full border border-white dark:border-gray-800 bg-white/90 dark:bg-[#1a1a1a]/90 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-[#2a2a2a] flex items-center justify-center transition-colors" }, /* @__PURE__ */ React.createElement(Share2, { className: "h-5 w-5" })))),
        /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto px-4 py-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 flex-1" }, selectedItem.foodType === "Veg" || selectedItem.isVeg === true ? /* @__PURE__ */ React.createElement("div", { className: "h-5 w-5 rounded border-2 border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0" }, /* @__PURE__ */ React.createElement("div", { className: "h-2.5 w-2.5 rounded-full bg-green-600 dark:bg-green-500" })) : /* @__PURE__ */ React.createElement("div", { className: "h-5 w-5 rounded border-2 border-amber-700 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0" }, /* @__PURE__ */ React.createElement("div", { className: "h-2.5 w-2.5 rounded-full bg-amber-700 dark:bg-amber-600" })), /* @__PURE__ */ React.createElement("h2", { className: "text-xl font-bold text-gray-900 dark:text-white" }, selectedItem.name))), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed" }, selectedItem.description), isRecommendedItem(selectedItem) && /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mb-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex-1 h-0.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "h-full bg-green-500 dark:bg-green-400 rounded-full", style: { width: "50%" } })), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap" }, "highly reordered")), selectedItem.notEligibleForCoupons && /* @__PURE__ */ React.createElement("p", { className: "text-xs text-gray-500 dark:text-gray-400 font-medium mb-4" }, "NOT ELIGIBLE FOR COUPONS"), hasFoodVariants(selectedItem) && /* @__PURE__ */ React.createElement("div", { className: "mb-4" }, /* @__PURE__ */ React.createElement("p", { className: "text-sm font-semibold text-gray-900 dark:text-white mb-2" }, "Choose a variant"), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, getFoodVariants(selectedItem).map((variant) => /* @__PURE__ */ React.createElement(
          "button",
          {
            key: variant.id,
            type: "button",
            onClick: () => setSelectedVariantId(variant.id),
            className: `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${String(selectedVariantId || "") === String(variant.id) ? "border-red-500 bg-red-50 text-red-600 dark:border-red-400 dark:bg-red-900/30 dark:text-red-200" : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-[#2a2a2a] dark:text-gray-300"}`
          },
          variant.name,
          " \xB7 ",
          RUPEE_SYMBOL,
          Math.round(variant.price)
        ))))),
        /* @__PURE__ */ React.createElement("div", { className: "border-t border-gray-200 dark:border-gray-800 px-4 py-4 bg-white dark:bg-[#1a1a1a]" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-4" }, /* @__PURE__ */ React.createElement("div", { className: `flex items-center gap-3 border-2 rounded-lg px-3 h-[44px] bg-white dark:bg-[#2a2a2a] ${shouldShowGrayscale ? "border-gray-300 dark:border-gray-700 opacity-50" : "border-gray-300 dark:border-gray-700"}` }, /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: (e) => {
              if (!shouldShowGrayscale) {
                updateItemQuantity(
                  selectedItem,
                  Math.max(0, getDishQuantity(selectedItem, selectedVariantId) - 1),
                  e,
                  getVariantForDish(selectedItem, selectedVariantId)
                );
              }
            },
            disabled: getDishQuantity(selectedItem, selectedVariantId) === 0 || shouldShowGrayscale,
            className: `${shouldShowGrayscale ? "text-gray-300 dark:text-gray-600 cursor-not-allowed" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed"}`
          },
          /* @__PURE__ */ React.createElement(Minus, { className: "h-5 w-5" })
        ), /* @__PURE__ */ React.createElement("span", { className: `text-lg font-semibold min-w-[2rem] text-center ${shouldShowGrayscale ? "text-gray-400 dark:text-gray-600" : "text-gray-900 dark:text-white"}` }, getDishQuantity(selectedItem, selectedVariantId)), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: (e) => {
              if (!shouldShowGrayscale) {
                updateItemQuantity(
                  selectedItem,
                  getDishQuantity(selectedItem, selectedVariantId) + 1,
                  e,
                  getVariantForDish(selectedItem, selectedVariantId)
                );
              }
            },
            disabled: shouldShowGrayscale,
            className: shouldShowGrayscale ? "text-gray-300 dark:text-gray-600 cursor-not-allowed" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          },
          /* @__PURE__ */ React.createElement(Plus, { className: "h-5 w-5" })
        )), /* @__PURE__ */ React.createElement(
          Button,
          {
            className: `flex-1 h-[44px] rounded-lg font-semibold flex items-center justify-center gap-2 ${shouldShowGrayscale ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-600 cursor-not-allowed opacity-50" : "bg-red-500 hover:bg-red-600 text-white"}`,
            onClick: (e) => {
              if (!shouldShowGrayscale) {
                updateItemQuantity(
                  selectedItem,
                  getDishQuantity(selectedItem, selectedVariantId) + 1,
                  e,
                  getVariantForDish(selectedItem, selectedVariantId)
                );
                setShowItemDetail(false);
              }
            },
            disabled: shouldShowGrayscale
          },
          /* @__PURE__ */ React.createElement("span", null, "Add item"),
          /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1" }, selectedItem.originalPrice && selectedItem.originalPrice > selectedItem.price && /* @__PURE__ */ React.createElement("span", { className: "text-sm line-through text-red-200" }, RUPEE_SYMBOL, Math.round(selectedItem.originalPrice)), /* @__PURE__ */ React.createElement("span", { className: "text-base font-bold" }, hasFoodVariants(selectedItem) ? `${getVariantForDish(selectedItem, selectedVariantId)?.name || "Default"} \xB7 ${RUPEE_SYMBOL}${Math.round(getVariantForDish(selectedItem, selectedVariantId)?.price || selectedItem.price)}` : `${RUPEE_SYMBOL}${Math.round(selectedItem.price)}`))
        )))
      ))),
      document.body
    ),
    typeof window !== "undefined" && createPortal(
      /* @__PURE__ */ React.createElement(AnimatePresence, null, showScheduleSheet && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
        motion.div,
        {
          className: "fixed inset-0 bg-black/40 z-[9999]",
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.2 },
          onClick: () => setShowScheduleSheet(false)
        }
      ), /* @__PURE__ */ React.createElement(
        motion.div,
        {
          className: "fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[60vh] md:max-h-[90vh] md:max-w-lg w-full md:w-auto flex flex-col",
          initial: { y: "100%" },
          animate: { y: 0 },
          exit: { y: "100%" },
          transition: { duration: 0.15, type: "spring", damping: 30, stiffness: 400 },
          onClick: (e) => e.stopPropagation()
        },
        /* @__PURE__ */ React.createElement("div", { className: "absolute -top-5 left-1/2 -translate-x-1/2 z-10" }, /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setShowScheduleSheet(false),
            className: "h-10 w-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-900 transition-colors shadow-lg"
          },
          /* @__PURE__ */ React.createElement(X, { className: "h-5 w-5 text-white" })
        )),
        /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto px-4 pt-10 pb-4" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-bold text-gray-900 dark:text-white mb-4 text-center" }, "Select your delivery time"), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 mb-4 overflow-x-auto pb-2 scrollbar-hide" }, (() => {
          const today = /* @__PURE__ */ new Date();
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const dayAfter = new Date(today);
          dayAfter.setDate(dayAfter.getDate() + 2);
          const dates = [
            { date: today, label: "Today" },
            { date: tomorrow, label: "Tomorrow" },
            { date: dayAfter, label: dayAfter.toLocaleDateString("en-US", { weekday: "short" }) }
          ];
          return dates.map((item, index) => {
            const dateStr = item.date.toISOString().split("T")[0];
            const day = String(item.date.getDate()).padStart(2, "0");
            const month = item.date.toLocaleDateString("en-US", { month: "short" });
            const isSelected = selectedDate === dateStr;
            return /* @__PURE__ */ React.createElement(
              "button",
              {
                key: index,
                onClick: () => setSelectedDate(dateStr),
                className: "flex flex-col items-center gap-0.5 flex-shrink-0 pb-1"
              },
              /* @__PURE__ */ React.createElement("span", { className: `text-sm font-medium ${isSelected ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}` }, day, " ", month, " ", item.label),
              isSelected && /* @__PURE__ */ React.createElement("div", { className: "h-0.5 w-full bg-red-500 mt-0.5" })
            );
          });
        })()), /* @__PURE__ */ React.createElement("div", { className: "space-y-2 mb-4" }, ["6:30 - 7 PM", "7 - 7:30 PM", "7:30 - 8 PM", "8 - 8:30 PM"].map((slot, index) => {
          const isSelected = selectedTimeSlot === slot;
          return /* @__PURE__ */ React.createElement(
            "button",
            {
              key: index,
              onClick: () => setSelectedTimeSlot(slot),
              className: `w-full text-left px-4 py-2.5 rounded-lg transition-all ${isSelected ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600" : "bg-white dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent"}`
            },
            /* @__PURE__ */ React.createElement("span", { className: "text-sm font-medium" }, slot)
          );
        }))),
        /* @__PURE__ */ React.createElement("div", { className: "px-4 pb-4 pt-2 border-t border-gray-100" }, /* @__PURE__ */ React.createElement(
          Button,
          {
            className: "w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-semibold",
            onClick: () => {
              setShowScheduleSheet(false);
            }
          },
          "Confirm"
        ))
      ))),
      document.body
    ),
    typeof window !== "undefined" && createPortal(
      /* @__PURE__ */ React.createElement(AnimatePresence, null, showOffersSheet && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
        motion.div,
        {
          className: "fixed inset-0 bg-black/40 z-[9999]",
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.15 },
          onClick: () => setShowOffersSheet(false)
        }
      ), /* @__PURE__ */ React.createElement(
        motion.div,
        {
          className: "fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[85vh] md:max-h-[90vh] md:max-w-lg w-full md:w-auto flex flex-col",
          initial: { y: "100%" },
          animate: { y: 0 },
          exit: { y: "100%" },
          transition: { duration: 0.2, type: "spring", damping: 30, stiffness: 400 },
          style: { willChange: "transform" }
        },
        /* @__PURE__ */ React.createElement("div", { className: "px-4 pt-6 pb-4 border-b border-gray-200 dark:border-gray-800" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-bold text-gray-900 dark:text-white" }, "Offers at ", restaurant?.name || "Unknown Restaurant")),
        /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto px-4 py-4" }, restaurant?.restaurantOffers?.goldOffer && /* @__PURE__ */ React.createElement("div", { className: "mb-6" }, /* @__PURE__ */ React.createElement("h3", { className: "text-sm font-semibold text-gray-900 dark:text-white mb-3" }, restaurant.restaurantOffers.goldOffer?.title || "Gold exclusive offer"), /* @__PURE__ */ React.createElement("div", { className: "bg-gray-50 dark:bg-gray-800 rounded-lg p-4 flex items-start justify-between gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start gap-3 flex-1" }, /* @__PURE__ */ React.createElement(Lock, { className: "h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" }), /* @__PURE__ */ React.createElement("div", { className: "flex-1" }, /* @__PURE__ */ React.createElement("p", { className: "text-sm font-medium text-gray-900 dark:text-white mb-1" }, restaurant.restaurantOffers.goldOffer?.description || "Free delivery above \u20B999"), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-gray-500 dark:text-gray-400" }, restaurant.restaurantOffers.goldOffer?.unlockText || "join Gold to unlock"))), /* @__PURE__ */ React.createElement(
          Button,
          {
            className: "bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-lg whitespace-nowrap",
            onClick: () => {
            }
          },
          restaurant.restaurantOffers.goldOffer?.buttonText || "Add Gold - \u20B91"
        ))), restaurant?.restaurantOffers?.coupons && Array.isArray(restaurant.restaurantOffers.coupons) && restaurant.restaurantOffers.coupons.length > 0 && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { className: "text-sm font-semibold text-gray-900 dark:text-white mb-3" }, "Restaurant coupons"), /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, restaurant.restaurantOffers.coupons.map((coupon, couponIndex) => {
          const couponKey = coupon?.id || coupon?.code || `coupon-${couponIndex}`;
          const isExpanded = expandedCoupons.has(couponKey);
          return /* @__PURE__ */ React.createElement(
            "div",
            {
              key: couponKey,
              className: "border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            },
            /* @__PURE__ */ React.createElement(
              "button",
              {
                className: "w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
                onClick: () => {
                  setExpandedCoupons((prev) => {
                    const newSet = new Set(prev);
                    if (newSet.has(couponKey)) {
                      newSet.delete(couponKey);
                    } else {
                      newSet.add(couponKey);
                    }
                    return newSet;
                  });
                }
              },
              /* @__PURE__ */ React.createElement(Percent, { className: "h-5 w-5 text-primary dark:text-orange-400 flex-shrink-0" }),
              /* @__PURE__ */ React.createElement("div", { className: "flex-1 text-left" }, /* @__PURE__ */ React.createElement("p", { className: "text-sm font-medium text-gray-900 dark:text-white mb-1" }, coupon?.title || "Restaurant coupon"), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-gray-500 dark:text-gray-400" }, "Use code ", coupon?.code || "N/A")),
              /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement(
                "button",
                {
                  className: "px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium rounded",
                  onClick: (e) => {
                    e.stopPropagation();
                    if (coupon?.code) {
                      navigator.clipboard.writeText(coupon.code);
                    }
                  }
                },
                coupon?.code || "Copy"
              ), /* @__PURE__ */ React.createElement(
                ChevronDown,
                {
                  className: `h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`
                }
              ))
            ),
            isExpanded && /* @__PURE__ */ React.createElement("div", { className: "px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-800" }, /* @__PURE__ */ React.createElement("p", { className: "text-xs text-gray-600 dark:text-gray-400" }, "Terms and conditions apply"))
          );
        })))),
        /* @__PURE__ */ React.createElement("div", { className: "border-t border-gray-200 dark:border-gray-800 px-4 py-4 bg-white dark:bg-[#1a1a1a]" }, /* @__PURE__ */ React.createElement(
          Button,
          {
            className: "w-full bg-[#1a1a1a] dark:bg-[#FE5502] hover:bg-[#FE5502] dark:hover:bg-[#C83C00] text-white border-0 flex items-center justify-center gap-2 py-6 rounded-xl font-bold transition-all shadow-lg",
            onClick: () => setShowOffersSheet(false)
          },
          /* @__PURE__ */ React.createElement(X, { className: "h-5 w-5" }),
          "Close"
        ))
      ))),
      document.body
    ),
    typeof window !== "undefined" && createPortal(
      /* @__PURE__ */ React.createElement(AnimatePresence, null, showMenuOptionsSheet && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
        motion.div,
        {
          className: "fixed inset-0 bg-black/40 z-[9999]",
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.15 },
          onClick: () => setShowMenuOptionsSheet(false)
        }
      ), /* @__PURE__ */ React.createElement(
        motion.div,
        {
          className: "fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[70vh] md:max-h-[85vh] w-full md:w-[480px] lg:w-[540px] flex flex-col overflow-hidden",
          initial: { y: "100%" },
          animate: { y: 0 },
          exit: { y: "100%" },
          transition: { duration: 0.2, type: "spring", damping: 30, stiffness: 400 },
          style: { willChange: "transform" },
          onClick: (e) => e.stopPropagation()
        },
        /* @__PURE__ */ React.createElement("div", { className: "px-5 pt-6 pb-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-bold text-gray-900 dark:text-white" }, restaurant?.name || "Unknown Restaurant"), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setShowMenuOptionsSheet(false),
            className: "hidden md:flex h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white items-center justify-center transition-colors",
            "aria-label": "Close menu options"
          },
          /* @__PURE__ */ React.createElement(X, { className: "h-4 w-4" })
        )),
        /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto px-5 py-4" }, /* @__PURE__ */ React.createElement("div", { className: "space-y-1" }, /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "w-full flex items-center gap-4 px-3 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors text-left",
            onClick: handleAddToCollection
          },
          /* @__PURE__ */ React.createElement(Bookmark, { className: "h-5 w-5 text-gray-700 dark:text-gray-300 flex-shrink-0" }),
          /* @__PURE__ */ React.createElement("span", { className: "text-base font-medium text-gray-900 dark:text-white" }, isFavorite(restaurant?.slug || slug || "") ? "Remove from Collection" : "Add to Collection")
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "w-full flex items-center gap-4 px-3 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors text-left",
            onClick: handleShareRestaurant
          },
          /* @__PURE__ */ React.createElement(Share2, { className: "h-5 w-5 text-gray-700 dark:text-gray-300 flex-shrink-0" }),
          /* @__PURE__ */ React.createElement("span", { className: "text-base font-medium text-gray-900 dark:text-white" }, "Share this restaurant")
        )), /* @__PURE__ */ React.createElement("div", { className: "mt-6 px-2" }, /* @__PURE__ */ React.createElement("p", { className: "text-xs text-gray-500 leading-relaxed" }, "Menu items, prices, photos and descriptions are set directly by the restaurant. In case you see any incorrect information, please report it to us.")), restaurant?.onboarding?.step3?.fssai?.registrationNumber && /* @__PURE__ */ React.createElement("div", { className: "mt-4 px-2 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3 opacity-80 mb-2" }, /* @__PURE__ */ React.createElement("div", { className: "h-8 w-14 flex items-center justify-center bg-white rounded p-1 border border-gray-100" }, /* @__PURE__ */ React.createElement(
          "img",
          {
            src: fssaiLogo,
            alt: "FSSAI",
            className: "h-full w-auto object-contain"
          }
        )), /* @__PURE__ */ React.createElement("div", { className: "flex-1" }, /* @__PURE__ */ React.createElement("p", { className: "text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium" }, "Lic. No."), /* @__PURE__ */ React.createElement("p", { className: "text-xs font-semibold text-gray-700 dark:text-gray-300" }, restaurant?.onboarding?.step3?.fssai?.registrationNumber)))),
        /* @__PURE__ */ React.createElement("div", { className: "px-4 pb-2 pt-2 md:hidden flex justify-center" }, /* @__PURE__ */ React.createElement("div", { className: "h-1 w-12 bg-gray-300 rounded-full" }))
      ))),
      document.body
    ),
    typeof window !== "undefined" && createPortal(
      /* @__PURE__ */ React.createElement(AnimatePresence, null, showShareModal && sharePayload && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
        motion.div,
        {
          className: "fixed inset-0 bg-black/50 z-[10020]",
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          onClick: () => setShowShareModal(false)
        }
      ), /* @__PURE__ */ React.createElement(
        motion.div,
        {
          className: "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10021] w-[92vw] max-w-md bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl",
          initial: { opacity: 0, scale: 0.95 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.95 },
          transition: { duration: 0.16 },
          onClick: (e) => e.stopPropagation()
        },
        /* @__PURE__ */ React.createElement("div", { className: "px-5 pt-5 pb-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("h3", { className: "text-lg font-semibold text-gray-900 dark:text-white truncate" }, "Share"), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800",
            onClick: () => setShowShareModal(false),
            "aria-label": "Close share modal"
          },
          /* @__PURE__ */ React.createElement(X, { className: "h-4 w-4 text-gray-600 dark:text-gray-300" })
        )),
        /* @__PURE__ */ React.createElement("div", { className: "px-5 py-4 space-y-2" }, typeof navigator !== "undefined" && navigator.share && /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left",
            onClick: handleSystemShareFromModal
          },
          /* @__PURE__ */ React.createElement(Share2, { className: "h-5 w-5 text-gray-700 dark:text-gray-300" }),
          /* @__PURE__ */ React.createElement("span", { className: "text-sm font-medium text-gray-900 dark:text-white" }, "Share via system apps")
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left",
            onClick: () => openShareTarget("whatsapp")
          },
          /* @__PURE__ */ React.createElement(MessageCircle, { className: "h-5 w-5 text-gray-700 dark:text-gray-300" }),
          /* @__PURE__ */ React.createElement("span", { className: "text-sm font-medium text-gray-900 dark:text-white" }, "WhatsApp")
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left",
            onClick: () => openShareTarget("telegram")
          },
          /* @__PURE__ */ React.createElement(Send, { className: "h-5 w-5 text-gray-700 dark:text-gray-300" }),
          /* @__PURE__ */ React.createElement("span", { className: "text-sm font-medium text-gray-900 dark:text-white" }, "Telegram")
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left",
            onClick: () => openShareTarget("email")
          },
          /* @__PURE__ */ React.createElement(Mail, { className: "h-5 w-5 text-gray-700 dark:text-gray-300" }),
          /* @__PURE__ */ React.createElement("span", { className: "text-sm font-medium text-gray-900 dark:text-white" }, "User Id")
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left",
            onClick: copyShareLink
          },
          /* @__PURE__ */ React.createElement(Copy, { className: "h-5 w-5 text-gray-700 dark:text-gray-300" }),
          /* @__PURE__ */ React.createElement("span", { className: "text-sm font-medium text-gray-900 dark:text-white" }, "Copy link")
        ))
      ))),
      document.body
    ),
    typeof window !== "undefined" && createPortal(
      /* @__PURE__ */ React.createElement(
        AddToCartAnimation,
        {
          bottomOffset: 80,
          linkTo: "/food/user/cart",
          hideOnPages: true
        }
      ),
      document.body
    )
  );
}
class RestaurantDetailsErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    debugError("RestaurantDetails crashed:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return /* @__PURE__ */ React.createElement(AnimatedPage, null, /* @__PURE__ */ React.createElement("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center px-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-center gap-4 text-center" }, /* @__PURE__ */ React.createElement(AlertCircle, { className: "h-12 w-12 text-red-500" }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-semibold text-gray-900 dark:text-white mb-1" }, "Something went wrong"), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-gray-600 mb-4 max-w-md" }, "We could not load this restaurant page right now."), /* @__PURE__ */ React.createElement(Button, { onClick: () => window.location.reload(), variant: "outline" }, "Reload Page")))));
    }
    return this.props.children;
  }
}
export default function RestaurantDetails() {
  return /* @__PURE__ */ React.createElement(RestaurantDetailsErrorBoundary, null, /* @__PURE__ */ React.createElement(RestaurantDetailsContent, null));
}
