import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation as useRouterLocation, useNavigate } from "react-router-dom";
import Lottie from "lottie-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "@core/context/AuthContext";
import { useProfile } from "@food/context/ProfileContext";
import { useWishlist } from "../context/WishlistContext";
import { customerApi } from "../services/customerApi";
import { useLocation as useAppLocation } from "../context/LocationContext";
import {
  MapPin,
  Clock,
  CreditCard,
  Banknote,
  ChevronRight,
  ChevronLeft,
  Share2,
  Gift,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  Heart,
  Truck,
  Tag,
  Sparkles,
  Plus,
  Minus,
  Search,
  X,
  Clipboard,
  AlertCircle,
  Check,
  Contact2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@shared/components/ui/Toast";
import { useSettings } from "@core/context/SettingsContext";
import SlideToPay from "../components/shared/SlideToPay";
import { initRazorpayPayment } from "@food/utils/razorpay";
import { getCachedGeocode, setCachedGeocode } from "@/core/utils/geocodeCache";
import {
  getOrderSocket,
  joinOrderRoom,
  leaveOrderRoom,
  onOrderStatusUpdate,
} from "@/core/services/orderSocket";
import ProductCard from "../components/shared/ProductCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import emptyBoxAnimation from "../assets/lottie/Empty box.json";
import {
  getQuickCategoriesPath,
  getQuickOrderDetailPath,
  getQuickOrdersPath,
} from "../utils/routes";

const MAX_QUICK_DELIVERY_RADIUS_KM = 15;

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const parseLocationCoords = (obj) => {
  if (!obj) return null;
  if (typeof obj.lat === "number" && typeof obj.lng === "number" && Number.isFinite(obj.lat) && Number.isFinite(obj.lng)) {
    return { lat: obj.lat, lng: obj.lng };
  }
  if (typeof obj.latitude === "number" && typeof obj.longitude === "number" && Number.isFinite(obj.latitude) && Number.isFinite(obj.longitude)) {
    return { lat: obj.latitude, lng: obj.longitude };
  }
  if (Array.isArray(obj.coordinates) && obj.coordinates.length === 2) {
    const lng = Number(obj.coordinates[0]);
    const lat = Number(obj.coordinates[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }
  if (obj.result) {
    const res = parseLocationCoords(obj.result);
    if (res) return res;
  }
  if (obj.data) {
    const res = parseLocationCoords(obj.data);
    if (res) return res;
  }
  if (obj.location) {
    const res = parseLocationCoords(obj.location);
    if (res) return res;
  }
  return null;
};

const CHECKOUT_STORAGE_KEY = "quick_commerce_checkout_state_v1";
const RECIPIENT_STORAGE_KEY = "appzeto_checkout_recipient_v1";

const DEFAULT_CURRENT_ADDRESS = {
  type: "Home",
  name: "",
  address: "",
  landmark: "",
  city: "",
  phone: "",
};

const DEFAULT_RECIPIENT_DATA = {
  completeAddress: "",
  landmark: "",
  pincode: "",
  name: "",
  phone: "",
};

const DEFAULT_QUICK_BILLING_SETTINGS = {
  deliveryFee: 25,
  deliveryFeeRanges: [],
  freeDeliveryThreshold: 0,
  platformFee: 0,
  gstRate: 0,
};

const calculateQuickCheckoutPricing = ({
  subtotal = 0,
  discountAmount = 0,
  selectedTip = 0,
  feeSettings = DEFAULT_QUICK_BILLING_SETTINGS,
  cartItems = [],
  categoryFeeMap = {},
}) => {
  const safeSubtotal = Number(subtotal || 0);
  const safeDiscount = Math.max(0, Number(discountAmount || 0));
  const safeTip = Math.max(0, Number(selectedTip || 0));
  const freeThreshold = Number(feeSettings?.freeDeliveryThreshold || 0);
  const ranges = Array.isArray(feeSettings?.deliveryFeeRanges)
    ? [...feeSettings.deliveryFeeRanges].sort((a, b) => Number(a.min) - Number(b.min))
    : [];

  let deliveryFeeCharged = 0;
  if (Number.isFinite(freeThreshold) && freeThreshold > 0 && safeSubtotal >= freeThreshold) {
    deliveryFeeCharged = 0;
  } else if (ranges.length) {
    let matchedFee = null;
    for (let i = 0; i < ranges.length; i += 1) {
      const range = ranges[i] || {};
      const min = Number(range.min);
      const max = Number(range.max);
      const fee = Number(range.fee);
      if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(fee)) continue;
      const isLast = i === ranges.length - 1;
      const inRange = isLast
        ? safeSubtotal >= min && safeSubtotal <= max
        : safeSubtotal >= min && safeSubtotal < max;
      if (inRange) {
        matchedFee = fee;
        break;
      }
    }
    deliveryFeeCharged = Number.isFinite(matchedFee)
      ? matchedFee
      : Number(feeSettings?.deliveryFee || 0);
  } else {
    deliveryFeeCharged = Number(feeSettings?.deliveryFee || 0);
  }

  const handlingFeeCharged = cartItems.reduce((maxFee, item) => {
    const candidateIds = [item?.headerId, item?.categoryId, item?.subcategoryId];
    const itemFee = candidateIds.reduce((currentMax, rawId) => {
      const normalizedId =
        rawId && typeof rawId === "object" && rawId._id
          ? String(rawId._id)
          : String(rawId || "").trim();
      return Math.max(currentMax, Number(categoryFeeMap[normalizedId] || 0));
    }, 0);
    return Math.max(maxFee, itemFee);
  }, 0);
  const platformFeeCharged = Number(feeSettings?.platformFee || 0);
  const gstRate = Number(feeSettings?.gstRate || 0);
  const gstAmount =
    Number.isFinite(gstRate) && gstRate > 0
      ? Math.round(safeSubtotal * (gstRate / 100))
      : 0;

  return {
    deliveryFeeCharged,
    handlingFeeCharged,
    platformFeeCharged,
    gstAmount,
    grandTotal: Math.max(
      0,
      safeSubtotal +
        deliveryFeeCharged +
        handlingFeeCharged +
        platformFeeCharged +
        gstAmount -
        safeDiscount +
        safeTip,
    ),
    snapshots: {
      feeSettings,
      deliverySettings: {
        pricingMode: "order_value_range",
      },
    },
  };
};

const isLegacyStaticCheckoutValue = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return false;

  return [
    "harshvardhan panchal",
    "6268423925",
    "pipliyahana",
    "rajshri palace",
    "indore - 452018",
    "214, rajshri palace colony",
  ].some((token) => normalized.includes(token));
};

const sanitizeCheckoutAddress = (address = {}) => {
  if (!address || typeof address !== "object") {
    return { ...DEFAULT_CURRENT_ADDRESS };
  }

  const next = { ...DEFAULT_CURRENT_ADDRESS, ...address };

  if (isLegacyStaticCheckoutValue(next.name)) next.name = "";
  if (isLegacyStaticCheckoutValue(next.phone)) next.phone = "";
  if (isLegacyStaticCheckoutValue(next.address)) next.address = "";
  if (isLegacyStaticCheckoutValue(next.city)) next.city = "";

  return next;
};

const parseAddressLineParts = (value = "") =>
  String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

const buildNormalizedQuickOrderAddress = ({
  label = "Other",
  name = "",
  phone = "",
  street = "",
  additionalDetails = "",
  city = "",
  state = "",
  zipCode = "",
  completeAddress = "",
  location,
  placeId,
}) => {
  const normalizedLabel = ["Home", "Office", "Other"].includes(label)
    ? label
    : "Other";
  const resolvedStreet =
    String(street || "").trim() || String(completeAddress || "").trim();
  const resolvedCity = String(city || "").trim() || "NA";
  const resolvedState = String(state || "").trim() || resolvedCity || "NA";
  const resolvedZipCode = String(zipCode || "").trim();
  const resolvedAdditionalDetails = String(additionalDetails || "").trim();

  return {
    type: normalizedLabel,
    label: normalizedLabel,
    name: String(name || "").trim(),
    phone: String(phone || "").trim(),
    street: resolvedStreet,
    address: resolvedStreet,
    additionalDetails: resolvedAdditionalDetails,
    landmark: resolvedAdditionalDetails,
    city: resolvedCity,
    state: resolvedState,
    zipCode: resolvedZipCode,
    ...(placeId ? { placeId } : {}),
    ...(location ? { location } : {}),
  };
};

const readStoredCheckoutState = () => {
  try {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem(CHECKOUT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    return {
      ...parsed,
      currentAddress: sanitizeCheckoutAddress(parsed.currentAddress),
    };
  } catch {
    return {};
  }
};

const CheckoutPage = () => {
  const {
    cart,
    addToCart,
    cartTotal,
    cartCount,
    updateQuantity,
    removeFromCart,
    clearCart,
    loading,
    appliedCoupon,
  } = useCart();
  const { wishlist, addToWishlist, fetchFullWishlist, isFullDataFetched } =
    useWishlist();
  const { showToast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const { userProfile } = useProfile();
  const { settings } = useSettings();
  const routerLocation = useRouterLocation();

  // Fetch full wishlist data if not already fetched
  useEffect(() => {
    if (isAuthenticated && !isFullDataFetched) {
      fetchFullWishlist();
    }
  }, [isAuthenticated, isFullDataFetched, fetchFullWishlist]);

  const appName = settings?.appName || "App";
  const {
    savedAddresses: locationSavedAddresses,
    currentLocation,
    refreshLocation,
    isFetchingLocation,
    updateLocation,
  } = useAppLocation();
  const navigate = useNavigate();
  const categoriesPath = getQuickCategoriesPath();
  const ordersPath = getQuickOrdersPath();
  const storedCheckoutState = readStoredCheckoutState();

  // State management
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(
    storedCheckoutState.selectedTimeSlot || "now",
  );
  const [selectedPayment, setSelectedPayment] = useState(
    routerLocation.state?.selectedPayment ||
      storedCheckoutState.selectedPayment ||
      "cash",
  );
  const [selectedTip, setSelectedTip] = useState(
    Number(storedCheckoutState.selectedTip || 0),
  );
  const [showAllCartItems, setShowAllCartItems] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(
    appliedCoupon || storedCheckoutState.selectedCoupon || null,
  );

  useEffect(() => {
    if (appliedCoupon && appliedCoupon.code !== selectedCoupon?.code) {
      setSelectedCoupon(appliedCoupon);
    }
  }, [appliedCoupon]);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isResolvingAddressCoords, setIsResolvingAddressCoords] = useState(false);
  const [showAddNewAddressForm, setShowAddNewAddressForm] = useState(false);
  const [newAddressForm, setNewAddressForm] = useState({ label: "Home", name: "", phone: "", address: "", landmark: "", city: "", zipCode: "" });
  const [newAddressErrors, setNewAddressErrors] = useState({});
  const [isSavingNewAddress, setIsSavingNewAddress] = useState(false);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [showOutOfZoneDialog, setShowOutOfZoneDialog] = useState(false);
  const [outOfZoneDistance, setOutOfZoneDistance] = useState(null);
  const [isCurrentAddressOutOfZone, setIsCurrentAddressOutOfZone] = useState(false);
  const [pricingPreview, setPricingPreview] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [quickBillingSettings, setQuickBillingSettings] = useState(
    DEFAULT_QUICK_BILLING_SETTINGS,
  );
  const [categoryFeeMap, setCategoryFeeMap] = useState({});
  const postOrderNavigateRef = useRef(null);
  const [currentAddress, setCurrentAddress] = useState(
    storedCheckoutState.currentAddress || DEFAULT_CURRENT_ADDRESS,
  );
  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false);
  const [editAddressForm, setEditAddressForm] = useState({
    ...(storedCheckoutState.currentAddress || DEFAULT_CURRENT_ADDRESS),
  });
  const [showRecipientForm, setShowRecipientForm] = useState(
    Boolean(storedCheckoutState.showRecipientForm),
  );
  const [recipientData, setRecipientData] = useState(DEFAULT_RECIPIENT_DATA);
  const [savedRecipient, setSavedRecipient] = useState(null);
  const [recipientErrors, setRecipientErrors] = useState({});
  const sharedProfileName = String(
    userProfile?.name || user?.name || "",
  ).trim();
  const sharedProfilePhone = String(
    userProfile?.phone || user?.phone || "",
  ).trim();

  // Mock data for recommendations
  const recommendedProducts = [
    {
      id: 101,
      name: "Uncle Chips",
      price: 20,
      image:
        "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=200",
    },
    {
      id: 102,
      name: "Lay's Chips",
      price: 20,
      image:
        "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=200",
    },
    {
      id: 103,
      name: "Bread",
      price: 35,
      image:
        "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200",
    },
  ];

  const [coupons, setCoupons] = useState([]);
  const [manualCode, setManualCode] = useState(
    storedCheckoutState.manualCode || "",
  );
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadBillingSettings = async () => {
      try {
        const [response, categoriesResponse] = await Promise.all([
          customerApi.getBillingSettings(),
          customerApi.getCategories({ tree: true }),
        ]);
        const settings =
          response?.data?.data?.feeSettings ||
          response?.data?.result ||
          null;
        if (!mounted || !settings) return;

        setQuickBillingSettings((prev) => ({
          ...prev,
          ...settings,
          deliveryFeeRanges: Array.isArray(settings.deliveryFeeRanges)
            ? settings.deliveryFeeRanges
            : prev.deliveryFeeRanges,
        }));

        const results =
          categoriesResponse?.data?.results ||
          categoriesResponse?.data?.result ||
          [];
        const nextFeeMap = {};
        const visit = (items = []) => {
          items.forEach((item) => {
            const id = String(item?._id || item?.id || "").trim();
            if (id) nextFeeMap[id] = Number(item?.handlingFees || 0);
            if (Array.isArray(item?.children) && item.children.length > 0) {
              visit(item.children);
            }
          });
        };
        if (Array.isArray(results)) {
          visit(results);
        }
        if (mounted) {
          setCategoryFeeMap(nextFeeMap);
        }
      } catch (error) {
        console.error("Failed to load quick billing settings:", error);
      }
    };

    void loadBillingSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const timeSlots = [
    { id: "now", label: "Now", sublabel: "10-15 min" },
    { id: "30min", label: "30 min", sublabel: "Standard" },
    { id: "1hour", label: "1 hour", sublabel: "Scheduled" },
    { id: "2hours", label: "2 hours", sublabel: "Scheduled" },
  ];

  const paymentMethods = [
    ...(settings?.onlineEnabled === false
      ? []
      : [
          {
            id: "online",
            label: "Pay Online",
            icon: CreditCard,
            sublabel: "UPI / Cards / NetBanking",
          },
        ]),
    ...(settings?.codEnabled === false || userProfile?.isCodAllowed === false
      ? []
      : [
          {
            id: "cash",
            label: "Cash on Delivery",
            icon: Banknote,
            sublabel: "Pay after delivery",
          },
        ]),
  ];

  const tipAmounts = [
    { value: 0, label: "No Tip" },
    { value: 10, label: "₹10" },
    { value: 20, label: "₹20" },
    { value: 30, label: "₹30" },
  ];
  const [customTip, setCustomTip] = useState("");

  const deliveryFee = pricingPreview?.deliveryFeeCharged || 0;
  const handlingFee = pricingPreview?.handlingFeeCharged || 0;
  const platformFee = pricingPreview?.platformFeeCharged || 0;
  const gstAmount = pricingPreview?.gstAmount || 0;
  const discountedItemsTotal = cart.reduce((sum, item) => {
    const unitPrice = Number(item.salePrice || item.price || 0);
    return sum + unitPrice * Number(item.quantity || 0);
  }, 0);

  const discountAmount = selectedCoupon ? (() => {
    const total = discountedItemsTotal;
    const discountType = String(selectedCoupon.discountType || 'flat').toLowerCase();
    const discountValue = Number(selectedCoupon.discountValue || selectedCoupon.discount || 0);
    const maxDiscount = Number(selectedCoupon.maxDiscount || selectedCoupon.maxDiscountValue || 0);

    let amount = 0;
    if (discountType === 'percent' || discountType === 'percentage') {
      amount = Math.round((total * discountValue) / 100);
      if (maxDiscount > 0) amount = Math.min(amount, maxDiscount);
    } else {
      amount = discountValue;
    }
    return Math.min(amount, total);
  })() : 0;
  const originalItemsTotal = cart.reduce((sum, item) => {
    const originalUnitPrice = Number(
      item.originalPrice || item.mrp || item.price || item.salePrice || 0,
    );
    return sum + originalUnitPrice * Number(item.quantity || 0);
  }, 0);
  const totalAmount = pricingPreview?.grandTotal || 0;

  const displayCartItems = showAllCartItems ? cart : cart;
  const getCheckoutProductId = (item) =>
    String(item?.productId || item?.itemId || item?.id || item?._id || "").split("::")[0];
  const getCheckoutCartItemsForSync = () =>
    cart
      .map((item) => ({
        productId: getCheckoutProductId(item),
        quantity: Math.max(1, Number(item.quantity || 1)),
      }))
      .filter((item) => item.productId);

  const syncVisibleCartToBackend = async () => {
    const cartItemsForSync = getCheckoutCartItemsForSync();

    if (!cartItemsForSync.length) {
      throw new Error("Cart is empty");
    }

    await customerApi.clearCart();
    for (const item of cartItemsForSync) {
      await customerApi.addToCart(item);
    }
  };

  const getCheckoutErrorMessage = (error) =>
    String(
      error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "",
    ).trim();

  // Derived display values for primary delivery card
  const displayName =
    savedRecipient?.name ||
    sharedProfileName ||
    currentAddress.name ||
    "Customer";
  const displayPhone =
    savedRecipient?.phone || currentAddress.phone || sharedProfilePhone || "";
  const displayAddress = savedRecipient
    ? `${savedRecipient.completeAddress}${savedRecipient.landmark ? `, ${savedRecipient.landmark}` : ""}${savedRecipient.pincode ? ` - ${savedRecipient.pincode}` : ""}`
    : [currentAddress.address, currentAddress.landmark, currentAddress.city]
        .filter(Boolean)
        .join(", ");

  const validateAddressZone = async (addressObj) => {
    if (!addressObj) return { inZone: true, distanceKm: 0, coords: null };
    let coords = parseLocationCoords(addressObj);
    const textParts = [
      addressObj.address,
      addressObj.street,
      addressObj.landmark,
      addressObj.city,
      addressObj.state,
      addressObj.zipCode || addressObj.pincode,
    ].filter(Boolean);
    const fullText = textParts.join(", ");

    if (!coords && fullText.trim()) {
      try {
        const resp = await customerApi.geocodeAddress(fullText);
        coords = parseLocationCoords(resp);
      } catch {
        // geocoding optional
      }
    }

    if (coords) {
      const storeLat = 22.711140989838025; // Indore Hub
      const storeLng = 75.9001552518043;
      const dist = haversineKm(storeLat, storeLng, coords.lat, coords.lng);
      if (dist > MAX_QUICK_DELIVERY_RADIUS_KM) {
        return { inZone: false, distanceKm: Math.round(dist), coords };
      }
      return { inZone: true, distanceKm: Math.round(dist), coords };
    }

    const lower = fullText.toLowerCase();
    const farCities = [
      "kolkata", "mumbai", "delhi", "bangalore", "bengaluru", "chennai",
      "hyderabad", "pune", "ahmedabad", "jaipur", "lucknow", "patna", "guwahati"
    ];
    if (farCities.some((c) => lower.includes(c))) {
      return { inZone: false, distanceKm: 500, coords: null };
    }

    return { inZone: true, distanceKm: 0, coords: null };
  };

  useEffect(() => {
    if (!currentAddress?.address && !currentAddress?.city) return;
    let isMounted = true;
    void validateAddressZone(currentAddress).then((res) => {
      if (!isMounted) return;
      if (!res.inZone) {
        setIsCurrentAddressOutOfZone(true);
        setOutOfZoneDistance(res.distanceKm || 500);
        setShowOutOfZoneDialog(true);
      } else {
        setIsCurrentAddressOutOfZone(false);
        setOutOfZoneDistance(null);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [currentAddress]);

  useEffect(() => {
    if (!paymentMethods.length) return;
    const exists = paymentMethods.some((method) => method.id === selectedPayment);
    if (!exists) {
      setSelectedPayment(paymentMethods[0].id);
    }
  }, [paymentMethods, selectedPayment]);

  useEffect(() => {
    if (!sharedProfileName && !sharedProfilePhone) return;

    setCurrentAddress((prev) => {
      const nextName = prev.name || sharedProfileName;
      const nextPhone = prev.phone || sharedProfilePhone;
      if (nextName === prev.name && nextPhone === prev.phone) return prev;
      return {
        ...prev,
        name: nextName,
        phone: nextPhone,
      };
    });

    setEditAddressForm((prev) => {
      const nextName = prev.name || sharedProfileName;
      const nextPhone = prev.phone || sharedProfilePhone;
      if (nextName === prev.name && nextPhone === prev.phone) return prev;
      return {
        ...prev,
        name: nextName,
        phone: nextPhone,
      };
    });
    // Note: recipientData is intentionally NOT pre-filled from profile —
    // the receiver is a different person, so the user must enter their details manually.
  }, [sharedProfileName, sharedProfilePhone]);

  useEffect(() => {
    const hasUsableAddress = [currentAddress.address, currentAddress.city, currentAddress.landmark]
      .some((value) => String(value || "").trim());

    if (hasUsableAddress || !locationSavedAddresses.length) {
      return;
    }

    const primaryAddress =
      locationSavedAddresses.find((addr) => addr?.isDefault || addr?.isCurrent) ||
      locationSavedAddresses[0];
    if (!primaryAddress?.address) {
      return;
    }

    setCurrentAddress((prev) => ({
      ...prev,
      type: primaryAddress.label || prev.type || "Home",
      name: primaryAddress.name || sharedProfileName || "",
      address: primaryAddress.address || "",
      city: primaryAddress.city || "",
      phone: primaryAddress.phone || sharedProfilePhone || "",
      landmark: "",
      ...(primaryAddress.placeId ? { placeId: primaryAddress.placeId } : {}),
      ...(primaryAddress.location ? { location: primaryAddress.location } : {}),
      ...(primaryAddress.id ? { id: primaryAddress.id } : {}),
    }));
  }, [
    currentAddress.address,
    currentAddress.city,
    currentAddress.landmark,
    locationSavedAddresses,
    sharedProfileName,
    sharedProfilePhone,
  ]);

  const buildAddressForOrder = () => {
    if (savedRecipient) {
      const recipientAddressParts = parseAddressLineParts(
        savedRecipient.completeAddress,
      );
      return buildNormalizedQuickOrderAddress({
        label: "Other",
        name: savedRecipient.name,
        phone: savedRecipient.phone,
        street: recipientAddressParts[0] || savedRecipient.completeAddress,
        additionalDetails:
          savedRecipient.landmark || recipientAddressParts.slice(1, -1).join(", "),
        city: currentAddress.city || recipientAddressParts.at(-1) || "NA",
        state: currentAddress.state || currentLocation?.state || "NA",
        zipCode: savedRecipient.pincode || currentAddress.pincode || "",
        completeAddress: savedRecipient.completeAddress,
        location:
          currentLocation?.latitude && currentLocation?.longitude
            ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
            : undefined,
      });
    }

    const addrLoc = currentAddress?.location;
    const hasAddrLoc =
      addrLoc &&
      typeof addrLoc.lat === "number" &&
      typeof addrLoc.lng === "number" &&
      Number.isFinite(addrLoc.lat) &&
      Number.isFinite(addrLoc.lng);
    const currentAddressParts = parseAddressLineParts(currentAddress.address);

    return buildNormalizedQuickOrderAddress({
      label: currentAddress.type || "Home",
      name: currentAddress.name || user?.name || "",
      phone: currentAddress.phone || "",
      street: currentAddressParts[0] || currentAddress.address,
      additionalDetails:
        currentAddress.landmark || currentAddressParts.slice(1, -1).join(", "),
      city:
        currentAddress.city ||
        currentAddressParts.at(-1) ||
        currentLocation?.city ||
        "NA",
      state: currentAddress.state || currentLocation?.state || "NA",
      zipCode:
        currentAddress.zipCode ||
        currentAddress.pincode ||
        currentLocation?.pincode ||
        "",
      completeAddress: currentAddress.address,
      placeId: currentAddress.placeId,
      location:
        // Important: delivery fee must be based on the selected delivery address,
        // not the device's last detected location (which can be stale).
        hasAddrLoc ? { lat: addrLoc.lat, lng: addrLoc.lng } : undefined,
    });
  };

  const handleSaveRecipient = () => {
    const errors = {};

    if (!recipientData.completeAddress?.trim()) {
      errors.completeAddress = "Complete address is required";
    } else if (recipientData.completeAddress.trim().length < 5) {
      errors.completeAddress = "Address is too short, please enter a valid address";
    }

    if (!recipientData.name?.trim()) {
      errors.name = "Receiver's name is required";
    } else if (recipientData.name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters";
    }

    if (!recipientData.phone) {
      errors.phone = "Phone number is required";
    } else if (recipientData.phone.length !== 10) {
      errors.phone = `Phone number must be exactly 10 digits (entered ${recipientData.phone.length})`;
    } else if (!/^[6-9]\d{9}$/.test(recipientData.phone)) {
      errors.phone = "Enter a valid Indian mobile number starting with 6, 7, 8 or 9";
    }

    if (recipientData.pincode && recipientData.pincode.length !== 6) {
      errors.pincode = "Pin code must be exactly 6 digits";
    }

    if (Object.keys(errors).length > 0) {
      // Show the first error as a toast
      const firstError = Object.values(errors)[0];
      showToast(firstError, "error");
      setRecipientErrors(errors);
      return;
    }

    setRecipientErrors({});
    setSavedRecipient(recipientData);
    setShowRecipientForm(false);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          RECIPIENT_STORAGE_KEY,
          JSON.stringify(recipientData),
        );
      }
    } catch {
      // ignore storage errors
    }
    showToast("Recipient details saved!", "success");
  };

  const handleMoveToWishlist = (item) => {
    // Normalize the cart item into a proper product object for the wishlist
    const productId = String(item?.productId || item?.itemId || item?.id || item?._id || "").split("::")[0];
    if (!productId) {
      showToast("Could not move item to wishlist", "error");
      return;
    }
    const productForWishlist = {
      ...item,
      id: productId,
      _id: productId,
      productId,
      mainImage: item.mainImage || item.image || "",
      image: item.image || item.mainImage || "",
    };
    addToWishlist(productForWishlist);
    removeFromCart(productId);
    showToast(`${item.name} moved to wishlist`, "success");
  };

  const handleOpenEditAddress = () => {
    setEditAddressForm({
      ...currentAddress,
      name: currentAddress.name || sharedProfileName || "",
      phone: currentAddress.phone || sharedProfilePhone || "",
    });
    setIsEditAddressOpen(true);
  };

  const isValidLatLng = (loc) =>
    loc &&
    typeof loc.lat === "number" &&
    typeof loc.lng === "number" &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng);

  const resolveAddressCoords = async (addressText) => {
    const q = String(addressText || "").trim();
    if (!q) return null;

    // Prefer placeId resolution if the current address has one (more reliable than text geocode).
    // Note: This helper is called with raw address text; placeId resolution happens in caller when available.
    const cacheKey = `addr:${q}`;
    const cached = getCachedGeocode(cacheKey);
    if (cached?.location?.lat && cached?.location?.lng) {
      return cached.location;
    }

    // Prefer backend geocoding (server key) so billing is controlled centrally.
    try {
      const resp = await customerApi.geocodeAddress(q);
      const coords = parseLocationCoords(resp);
      if (coords) {
        setCachedGeocode(cacheKey, { location: coords });
        return coords;
      }
    } catch (e) {
      const serverMsg =
        e?.response?.data?.message ||
        e?.response?.data?.error?.message ||
        e?.message ||
        null;
      // Bubble up a helpful message for UI.
      const err = new Error(serverMsg || "Could not geocode address");
      err.__serverMsg = serverMsg;
      throw err;
    }

    return null;
  };

  const handleSelectSavedAddress = async (addr) => {
    const rawText = addr?.address || "";
    const addrLoc = addr?.location;
    const hasLoc = isValidLatLng(addrLoc);
    const pid = typeof addr?.placeId === "string" ? addr.placeId.trim() : "";

    setIsResolvingAddressCoords(true);
    try {
      let resolvedLoc = null;
      try {
        if (hasLoc) {
          resolvedLoc = addrLoc;
        } else if (pid) {
          const cacheKey = `pid:${pid}`;
          const cached = getCachedGeocode(cacheKey);
          if (cached?.location?.lat && cached?.location?.lng) {
            resolvedLoc = cached.location;
          } else {
            const resp = await customerApi.geocodePlaceId(pid);
            const loc = resp.data?.result?.location;
            if (isValidLatLng(loc)) {
              resolvedLoc = { lat: loc.lat, lng: loc.lng };
              setCachedGeocode(cacheKey, { location: resolvedLoc });
            }
          }
        } else {
          resolvedLoc = await resolveAddressCoords(rawText);
        }
      } catch (e) {
        showToast(
          e?.__serverMsg ||
            e?.message ||
            "Could not fetch coordinates for this address. Delivery charges may not update.",
          "error",
        );
      }

      // Don't proceed with a stale location; keep the modal open so the user can pick/edit again.
      if (!resolvedLoc) {
        showToast(
          "Could not fetch coordinates for this address. Please edit the address or choose a different one.",
          "error",
        );
        return;
      }

      // Zone check: block out-of-zone addresses
      const zoneCheck = await validateAddressZone({
        ...addr,
        address: rawText,
        location: resolvedLoc,
      });

      if (!zoneCheck.inZone) {
        setOutOfZoneDistance(zoneCheck.distanceKm);
        setShowOutOfZoneDialog(true);
        return;
      }

      setCurrentAddress({
        id: addr.id,
        type: addr.label,
        name: addr.name || user?.name || "",
        address: rawText,
        city: addr.city || "",
        phone: addr.phone || currentAddress.phone,
        landmark: "", // already baked into addr.address if present
        ...(pid ? { placeId: pid } : {}),
        ...(resolvedLoc ? { location: resolvedLoc } : {}),
      });

      if (resolvedLoc) {
        updateLocation(
          {
            name: rawText,
            time: currentLocation?.time || "12-15 mins",
            city: currentLocation?.city,
            state: currentLocation?.state,
            pincode: currentLocation?.pincode,
            latitude: resolvedLoc.lat,
            longitude: resolvedLoc.lng,
          },
          { persist: true, updateSavedHome: false },
        );
      }

      setIsAddressModalOpen(false);
    } finally {
      setIsResolvingAddressCoords(false);
    }
  };

  const handleSaveNewAddress = async () => {
    const errors = {};
    if (!newAddressForm.name.trim()) errors.name = "Name is required";
    if (!newAddressForm.phone || newAddressForm.phone.length !== 10) errors.phone = "Valid 10-digit phone number is required";
    if (!newAddressForm.address.trim()) errors.address = "Address is required";
    if (!newAddressForm.city.trim()) errors.city = "City is required";
    if (newAddressForm.zipCode && newAddressForm.zipCode.length > 0 && newAddressForm.zipCode.length !== 6) errors.zipCode = "Pincode must be exactly 6 digits";

    if (Object.keys(errors).length > 0) {
      setNewAddressErrors(errors);
      showToast(Object.values(errors)[0], "error");
      return;
    }

    setNewAddressErrors({});
    setIsSavingNewAddress(true);
    try {
      // Geocode the address for coordinates
      const query = [newAddressForm.address, newAddressForm.landmark, newAddressForm.city, newAddressForm.zipCode].filter(Boolean).join(", ");
      let resolvedLoc = null;
      try {
        const resp = await customerApi.geocodeAddress(query);
        const loc = resp.data?.result?.location;
        if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
          resolvedLoc = { lat: loc.lat, lng: loc.lng };
        }
      } catch { /* geocoding optional */ }

      // Zone check: block out-of-zone addresses
      const zoneCheck = await validateAddressZone({
        address: newAddressForm.address.trim(),
        landmark: newAddressForm.landmark.trim(),
        city: newAddressForm.city.trim(),
        zipCode: newAddressForm.zipCode,
        location: resolvedLoc,
      });

      if (!zoneCheck.inZone) {
        setOutOfZoneDistance(zoneCheck.distanceKm);
        setShowOutOfZoneDialog(true);
        setIsSavingNewAddress(false);
        return;
      }

      // Save via location context
      const newAddr = {
        label: newAddressForm.label,
        name: newAddressForm.name.trim(),
        phone: newAddressForm.phone,
        address: newAddressForm.address.trim(),
        landmark: newAddressForm.landmark.trim(),
        city: newAddressForm.city.trim(),
        zipCode: newAddressForm.zipCode,
        ...(resolvedLoc ? { location: resolvedLoc } : {}),
      };

      // Set as current address
      setCurrentAddress({
        type: newAddr.label,
        name: newAddr.name,
        phone: newAddr.phone,
        address: newAddr.address,
        landmark: newAddr.landmark,
        city: newAddr.city,
        zipCode: newAddr.zipCode,
        ...(resolvedLoc ? { location: resolvedLoc } : {}),
      });

      if (resolvedLoc) {
        updateLocation(
          { name: query, time: currentLocation?.time || "12-15 mins", latitude: resolvedLoc.lat, longitude: resolvedLoc.lng },
          { persist: true, updateSavedHome: false },
        );
      }

      showToast("Address saved!", "success");
      setShowAddNewAddressForm(false);
      setNewAddressForm({ label: "Home", name: "", phone: "", address: "", landmark: "", city: "", zipCode: "" });
      setIsAddressModalOpen(false);
    } catch (e) {
      showToast(e?.message || "Failed to save address", "error");
    } finally {
      setIsSavingNewAddress(false);
    }
  };

  const handleSaveEditedAddress = async () => {
    if (!editAddressForm.address.trim()) {
      showToast("Please enter your address", "error");
      return;
    }
    if (!editAddressForm.city.trim()) {
      showToast("Please enter your city", "error");
      return;
    }
    if (editAddressForm.zipCode && editAddressForm.zipCode.length > 0 && editAddressForm.zipCode.length !== 6) {
      showToast("Pincode must be exactly 6 digits", "error");
      return;
    }

    // Best-effort forward geocode so delivery pricing uses the edited address (not stale device coords).
    let location = null;
    let placeId = null;
    let formattedAddress = null;
    try {
      const query = [
        editAddressForm.address,
        editAddressForm.landmark,
        editAddressForm.city,
      ]
        .filter(Boolean)
        .join(", ");
      const resp = await customerApi.geocodeAddress(query);
      const coords = parseLocationCoords(resp);
      if (coords) {
        location = coords;
        placeId = resp.data?.result?.placeId || resp.data?.data?.placeId || null;
        formattedAddress = resp.data?.result?.formattedAddress || resp.data?.data?.formattedAddress || null;
        updateLocation(
          {
            name: formattedAddress || query,
            time: currentLocation?.time || "12-15 mins",
            city: currentLocation?.city,
            state: currentLocation?.state,
            pincode: currentLocation?.pincode,
            latitude: coords.lat,
            longitude: coords.lng,
          },
          { persist: true, updateSavedHome: false },
        );
      }
    } catch (e) {
      // If geocoding fails, keep the edited address but warn: distance-based pricing may be inaccurate.
      showToast(
        e.response?.data?.message ||
          "Could not fetch coordinates for this address. Delivery charges may be inaccurate.",
        "error",
      );
    }

    // Zone check: block out-of-zone addresses
    const zoneCheck = await validateAddressZone({
      ...editAddressForm,
      location,
    });

    if (!zoneCheck.inZone) {
      setOutOfZoneDistance(zoneCheck.distanceKm);
      setShowOutOfZoneDialog(true);
      return;
    }

    setCurrentAddress({
      ...editAddressForm,
      name: editAddressForm.name || currentAddress.name || user?.name || "",
      ...(location ? { location } : {}),
      ...(placeId ? { placeId } : {}),
      ...(formattedAddress ? { formattedAddress } : {}),
    });
    setIsEditAddressOpen(false);
    showToast("Delivery address updated", "success");
  };

  const handleUseCurrentLiveLocation = async () => {
    const result = await refreshLocation();

    if (result?.ok && result.location) {
      const liveLocation = result.location;

      // Zone check: block out-of-zone live locations
      const zoneCheck = await validateAddressZone(liveLocation);
      if (!zoneCheck.inZone) {
        setOutOfZoneDistance(zoneCheck.distanceKm);
        setShowOutOfZoneDialog(true);
        return;
      }

      setCurrentAddress((prev) => ({
        ...prev,
        address: liveLocation.name,
        landmark: "",
        city: [liveLocation.city, liveLocation.state, liveLocation.pincode]
          .filter(Boolean)
          .join(", "),
        ...(typeof liveLocation.latitude === "number" &&
        typeof liveLocation.longitude === "number"
          ? { location: { lat: liveLocation.latitude, lng: liveLocation.longitude } }
          : {}),
      }));
      showToast("Using your current live location", "success");
      return;
    }

    if (currentLocation?.name) {
      setCurrentAddress((prev) => ({
        ...prev,
        address: currentLocation.name,
        landmark: "",
        city: [currentLocation.city, currentLocation.state, currentLocation.pincode]
          .filter(Boolean)
          .join(", "),
        ...(typeof currentLocation.latitude === "number" &&
        typeof currentLocation.longitude === "number"
          ? { location: { lat: currentLocation.latitude, lng: currentLocation.longitude } }
          : {}),
      }));
      showToast("Using your last detected location", "success");
      return;
    }

    showToast(result?.error || "Unable to detect current location", "error");
  };

  const handleShare = async () => {
    const shareUrl = window.location.origin;
    const shareText = `Hey! Check out ${appName} for quick grocery delivery in minutes! 🛒`;
    const shareData = { title: `${appName} - Quick Delivery`, text: shareText, url: shareUrl };

    // Try native share sheet first (works on mobile/PWA)
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err.name === "AbortError") return; // user cancelled — do nothing
        // Other error — fall through to modal
      }
    }

    // Desktop fallback: show share options modal
    setShowShareModal(true);
  };

  const handleCopyLink = async () => {
    const shareUrl = window.location.origin;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast("Link copied to clipboard!", "success");
    } catch {
      showToast(shareUrl, "info");
    }
    setShowShareModal(false);
  };

  const handleApplyCoupon = async (coupon) => {
    try {
      const payload = {
        code: coupon.code,
        cartTotal,
        items: cart,
        customerId: user?._id,
      };
      const res = await customerApi.validateCoupon(payload);
      if (res.data.success) {
        const data = res.data.result;
        setSelectedCoupon({
          ...coupon,
          ...data,
        });
        setIsCouponModalOpen(false);
        showToast(`Coupon ${coupon.code} applied!`, "success");
      } else {
        showToast(res.data.message || "Unable to apply coupon", "error");
      }
    } catch (error) {
      showToast(
        error.response?.data?.message || "Unable to apply coupon",
        "error",
      );
    }
  };

  const handleAddToCart = (product) => {
    addToCart(product);
    showToast(`${product.name} added to cart!`, "success");
  };

  const getCartItem = (productId) => cart.find((item) => item.id === productId);

  useEffect(() => {
    // Recipient data is intentionally not restored from localStorage —
    // the receiver is a different person and should be entered fresh each time.

    const fetchCoupons = async () => {
      try {
        const res = await customerApi.getActiveCoupons();
        if (res.data.success) {
          const list = res.data.result || res.data.results || [];
          setCoupons(list);
        }
      } catch {
        // silently ignore
      }
    };
    fetchCoupons();
  }, []);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(
        CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          selectedTimeSlot,
          selectedPayment,
          selectedTip,
          selectedCoupon,
          manualCode,
          currentAddress,
          recipientData,
          savedRecipient,
          showRecipientForm,
        }),
      );
    } catch {
      // ignore storage errors
    }
  }, [
    currentAddress,
    manualCode,
    recipientData,
    savedRecipient,
    selectedCoupon,
    selectedPayment,
    selectedTimeSlot,
    selectedTip,
    showRecipientForm,
  ]);

  useEffect(() => {
    if (selectedCoupon) {
      const minOrder = Number(selectedCoupon.minOrderValue || selectedCoupon.minOrder || 0);
      if (minOrder > 0 && discountedItemsTotal < minOrder) {
        setSelectedCoupon(null);
        showToast(`Coupon ${selectedCoupon.code} removed because minimum order value is not met`, "error");
      }
    }
  }, [discountedItemsTotal, selectedCoupon]);

  useEffect(() => {
    if (cart.length === 0) {
      setPricingPreview(null);
      return;
    }

    setIsPreviewLoading(true);
    const subtotal = cart.reduce(
      (sum, item) =>
        sum +
        Number(item.salePrice || item.price || 0) *
          Number(item.quantity || 0),
      0,
    );
    const {
      deliveryFeeCharged,
      handlingFeeCharged,
      platformFeeCharged,
      taxTotal,
      gstAmount,
      grandTotal,
      snapshots,
    } = calculateQuickCheckoutPricing({
      subtotal,
      discountAmount,
      selectedTip,
      feeSettings: quickBillingSettings,
      cartItems: cart,
      categoryFeeMap,
    });

    setPricingPreview({
      subtotal,
      deliveryFeeCharged,
      handlingFeeCharged,
      platformFeeCharged,
      taxTotal,
      gstAmount,
      grandTotal,
      snapshots,
    });
    setIsPreviewLoading(false);
  }, [cart, categoryFeeMap, discountAmount, quickBillingSettings, selectedTip]);

  const handlePlaceOrder = async () => {
    setIsPlacingOrder(true);
    try {
      if (isCurrentAddressOutOfZone) {
        setShowOutOfZoneDialog(true);
        setIsPlacingOrder(false);
        return;
      }

      const preCheckAddress = buildAddressForOrder();
      const zoneCheck = await validateAddressZone(preCheckAddress);
      if (!zoneCheck.inZone) {
        setIsCurrentAddressOutOfZone(true);
        setOutOfZoneDistance(zoneCheck.distanceKm);
        setShowOutOfZoneDialog(true);
        setIsPlacingOrder(false);
        return;
      }
      if (!getCheckoutCartItemsForSync().length) {
        showToast("Cart is empty", "error");
        return;
      }

      const orderData = {
        items: getCheckoutCartItemsForSync(),
        address: buildAddressForOrder(),
        paymentMode: selectedPayment === "online" ? "ONLINE" : "COD",
        discountTotal: discountAmount,
        taxTotal: gstAmount,
        platformFee: platformFee,
        timeSlot: selectedTimeSlot,
        ...(selectedCoupon ? { couponCode: selectedCoupon.code } : {}),
      };

      let response;
      try {
        response = await customerApi.createOrder(orderData);
      } catch (error) {
        const errorMessage = getCheckoutErrorMessage(error).toLowerCase();

        if (
          errorMessage.includes("cart is empty") ||
          errorMessage.includes("no valid items found in cart")
        ) {
          await syncVisibleCartToBackend();
          response = await customerApi.createOrder(orderData);
        } else {
          throw error;
        }
      }

      if (response.data.success) {
        const order = response.data.result;
        const razorpay = response.data.razorpay;
        const placedOrderId =
          order?.orderId || order?.orderNumber || order?.id || order?._id || "";
          
        const finishOrderSuccess = (finalOrder) => {
          clearCart();
          try {
            if (typeof window !== "undefined") {
              window.localStorage.removeItem(CHECKOUT_STORAGE_KEY);
              window.localStorage.removeItem(RECIPIENT_STORAGE_KEY);
            }
          } catch {
            // ignore storage errors
          }

          showToast(`Order placed — waiting for seller to accept.`, "success");
          setOrderId(placedOrderId);
          setShowSuccess(true);

          if (postOrderNavigateRef.current) {
            clearTimeout(postOrderNavigateRef.current);
          }
          postOrderNavigateRef.current = setTimeout(() => {
            postOrderNavigateRef.current = null;
            navigate(getQuickOrderDetailPath(placedOrderId || finalOrder?._id || finalOrder?.id));
          }, 1200);
        };

        if (razorpay && razorpay.orderId && razorpay.key) {
          try {
            await initRazorpayPayment({
              key: razorpay.key,
              amount: razorpay.amount,
              currency: razorpay.currency || "INR",
              order_id: razorpay.orderId,
              name: "Itzo Quick Commerce",
              description: `Order ${order.orderId || order._id}`,
              prefill: {
                name: String(userProfile?.name || "Customer"),
                email: String(userProfile?.email || "customer@example.com"),
                contact: String(userProfile?.phone || "").replace(/\D/g, "")
              },
              notes: {
                orderId: order._id || order.orderId
              },
              handler: async (rpResponse) => {
                try {
                  const verifyRes = await customerApi.verifyPayment({
                    orderId: order._id || order.orderId,
                    razorpayOrderId: rpResponse.razorpay_order_id,
                    razorpayPaymentId: rpResponse.razorpay_payment_id,
                    razorpaySignature: rpResponse.razorpay_signature
                  });

                  if (verifyRes.data.success) {
                    finishOrderSuccess(order);
                  } else {
                    throw new Error("Payment verification failed");
                  }
                } catch (err) {
                  console.error(err);
                  showToast("Payment verification failed. Please contact support.", "error");
                  setIsPlacingOrder(false);
                }
              },
              onError: (err) => {
                console.error(err);
                showToast("Payment failed or cancelled.", "error");
                setIsPlacingOrder(false);
              }
            });
          } catch (err) {
            showToast("Failed to initialize payment gateway", "error");
            setIsPlacingOrder(false);
          }
          return;
        }

        // Cash flow or fallback
        finishOrderSuccess(order);
      }
    } catch (error) {
      console.error("Failed to place order:", error);
      showToast(
        getCheckoutErrorMessage(error) ||
          "Failed to place order. Please try again.",
        "error",
      );
      setIsPlacingOrder(false);
    }
  };

  // After place order: listen for seller timeout / rejection (customer room + order room) and poll as fallback
  useEffect(() => {
    if (!orderId || !showSuccess) return undefined;

    const getToken = () => localStorage.getItem("auth_customer");
    getOrderSocket(getToken);
    joinOrderRoom(orderId, getToken);

    let pollId = null;

    const applyCancelled = (o) => {
      if (o.workflowStatus === "CANCELLED" || o.status === "cancelled") {
        if (postOrderNavigateRef.current) {
          clearTimeout(postOrderNavigateRef.current);
          postOrderNavigateRef.current = null;
        }
        if (pollId != null) clearInterval(pollId);
        setShowSuccess(false);
        showToast(
          "Order cancelled — seller did not accept in time.",
          "error",
        );
        navigate(ordersPath, { replace: true });
        return true;
      }
      return false;
    };

    const tick = () => {
      customerApi
        .getOrderDetails(orderId)
        .then((r) => {
          if (r.data?.result) applyCancelled(r.data.result);
        })
        .catch(() => {});
    };

    const off = onOrderStatusUpdate(getToken, tick);

    tick();
    pollId = setInterval(tick, 4000);

    return () => {
      off();
      if (pollId != null) clearInterval(pollId);
      leaveOrderRoom(orderId, getToken);
    };
  }, [orderId, showSuccess, navigate, ordersPath, showToast]);

  // Map-based precise location has been removed; manual addresses are used instead.

  if (loading && cart.length === 0 && !showSuccess) {
    return (
      <div className="min-h-screen bg-white dark:bg-background flex flex-col items-center justify-center p-6 text-center transition-colors">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-[#FE5502]" />
        <h2 className="mt-5 text-2xl font-black text-slate-800">Loading checkout</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Restoring your cart before checkout...
        </p>
      </div>
    );
  }

  if (cart.length === 0 && !showSuccess) {
    return (
      <div className="min-h-screen bg-white dark:bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans transition-colors duration-500">
        {/* Artistic Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-orange-50/50 via-transparent to-transparent pointer-events-none" />
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute -top-20 -right-20 w-80 h-80 bg-orange-100/30 rounded-full blur-3xl pointer-events-none"
        />
        <motion.div
          animate={{
            scale: [1, 1.5, 1],
            rotate: [0, -45, 0],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-40 -left-20 w-60 h-60 bg-amber-100/40 rounded-full blur-3xl pointer-events-none"
        />

        <motion.div className="relative z-10 flex flex-col items-center text-center max-w-sm mx-auto">
          {/* Empty Cart Illustration */}
          <div className="relative w-56 h-56 md:w-64 md:h-64 mb-8 flex items-center justify-center">
            <motion.div
              animate={{ y: [-8, 8, -8] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="relative z-10 rounded-[2rem] bg-white/90 dark:bg-card/90 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-orange-100 dark:border-white/5 transition-colors">
              <Lottie
                animationData={emptyBoxAnimation}
                loop
                className="h-36 w-36 md:h-44 md:w-44"
              />
            </motion.div>

            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 border-2 border-dashed border-slate-200 rounded-full"
            />
          </div>

          <h2 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">
            Your Cart is Empty
          </h2>
          <p className="text-slate-500 mb-8 leading-relaxed font-medium">
            It feels lighter than air! <br />
            Explore our aisles and fill it with goodies.
          </p>

          <Link
            to={categoriesPath}
            className="group relative inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-[#FE5502] to-[#FF7A00] text-white font-bold rounded-2xl overflow-hidden shadow-xl shadow-orange-600/20 transition-all hover:scale-[1.02] active:scale-95 w-full sm:w-auto">
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="relative flex items-center gap-2 text-lg">
              Start Shopping <ChevronRight size={20} />
            </span>
          </Link>

          <div className="mt-8 flex gap-6 text-slate-400">
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-slate-50 dark:bg-card rounded-2xl">
                <Clock size={20} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Fast Delivery
              </span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-slate-50 rounded-2xl">
                <Tag size={20} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Daily Deals
              </span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-slate-50 rounded-2xl">
                <Sparkles size={20} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Fresh Items
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f1e8] pb-32 font-sans">
      {/* Premium Header - Curved on mobile, integrated on desktop */}
      <div className="bg-gradient-to-br from-[#FE5502] via-[#ea580c] to-[#c2410c] pt-6 pb-12 md:pb-24 relative z-10 shadow-lg md:rounded-b-[4rem] rounded-b-[2rem] overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full blur-[100px] -mr-32 -mt-64 pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-orange-400/10 rounded-full blur-[80px] pointer-events-none" />

        {/* Header Content */}
        <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl transition-all active:scale-95">
              <ChevronLeft size={28} className="text-white" />
            </button>

            <div className="flex flex-col items-center">
              <h1 className="text-xl md:text-3xl font-[1000] text-white tracking-tight uppercase">
                Checkout
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="h-1.5 w-1.5 bg-orange-200 rounded-full animate-pulse" />
                <p className="text-orange-100/90 text-[10px] md:text-xs font-black tracking-[0.2em] uppercase">
                  {cartCount} {cartCount === 1 ? "Item" : "Items"} in cart
                </p>
              </div>
            </div>

            <button
              onClick={handleShare}
              className="h-12 px-4 flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl transition-all active:scale-95">
              <Share2 size={20} className="text-white" />
              <span className="text-xs font-black text-white uppercase tracking-widest hidden sm:block">
                Share
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-12 md:-mt-16 lg:-mt-20 relative z-20">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-start">
          {/* Left Column: Delivery & Items */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6 pb-8">
            {/* Delivery Time Banner */}
            <motion.div className="bg-white dark:bg-card rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-white/5 mt-3 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                  <Clock size={24} className="text-[#FE5502]" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg">
                    Delivery in 12-15 mins
                  </h3>
                  <p className="text-sm text-slate-500">
                    Shipment of {cartCount} items
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Delivery Address Section - New UI */}
            <motion.div className="bg-white dark:bg-card rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-white/5 transition-colors">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs text-slate-500 font-medium">
                  Ordering for someone else?
                </span>
                <button
                  onClick={() => setShowRecipientForm(!showRecipientForm)}
                  className="text-[#FE5502] text-xs font-bold hover:underline">
                  {showRecipientForm
                    ? "Close"
                    : savedRecipient
                      ? "Change details"
                      : "Add details"}
                </button>
              </div>

              {savedRecipient && !showRecipientForm && (
                <div className="mb-4 p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-start justify-between">
                  <div className="flex gap-3">
                    <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-[#FE5502] flex-shrink-0">
                      <Contact2 size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {savedRecipient.name}
                      </p>
                      <p className="text-xs text-[#FE5502] font-bold mb-1">
                        {savedRecipient.phone}
                      </p>
                      <p className="text-xs text-slate-500 leading-tight">
                        {savedRecipient.completeAddress}
                        {savedRecipient.landmark &&
                          `, ${savedRecipient.landmark}`}
                        {savedRecipient.pincode &&
                          ` - ${savedRecipient.pincode}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSavedRecipient(null);
                      try {
                        if (typeof window !== "undefined") {
                          window.localStorage.removeItem(RECIPIENT_STORAGE_KEY);
                        }
                      } catch {
                        // ignore storage errors
                      }
                    }}
                    className="text-red-500 text-xs font-bold hover:underline">
                    Remove
                  </button>
                </div>
              )}

              <AnimatePresence>
                {showRecipientForm && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden mb-4">
                    <div className="bg-[#f8f9fb] dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-white/5 space-y-4">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 mb-3">
                          Enter delivery address details
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <Input
                              placeholder="Enter complete address*"
                              value={recipientData.completeAddress}
                              onChange={(e) => {
                                setRecipientData({ ...recipientData, completeAddress: e.target.value });
                                if (recipientErrors.completeAddress) setRecipientErrors((prev) => ({ ...prev, completeAddress: "" }));
                              }}
                              className={`h-12 rounded-xl text-sm ${recipientErrors.completeAddress ? "border-rose-400 focus:ring-rose-400 focus:border-rose-400" : "border-slate-200 focus:ring-[#FE5502] focus:border-[#FE5502]"}`}
                            />
                            {recipientErrors.completeAddress && (
                              <p className="text-xs text-rose-500 mt-1 ml-1">{recipientErrors.completeAddress}</p>
                            )}
                          </div>
                          <Input
                            placeholder="Find landmark (optional)"
                            value={recipientData.landmark}
                            onChange={(e) => setRecipientData({ ...recipientData, landmark: e.target.value })}
                            className="h-12 rounded-xl border-slate-200 focus:ring-[#FE5502] focus:border-[#FE5502] text-sm"
                          />
                          <div>
                            <Input
                              placeholder="Enter pin code (optional)"
                              value={recipientData.pincode}
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                                setRecipientData({ ...recipientData, pincode: val });
                                if (recipientErrors.pincode) setRecipientErrors((prev) => ({ ...prev, pincode: "" }));
                              }}
                              className={`h-12 rounded-xl text-sm ${recipientErrors.pincode ? "border-rose-400 focus:ring-rose-400 focus:border-rose-400" : "border-slate-200 focus:ring-[#FE5502] focus:border-[#FE5502]"}`}
                            />
                            {recipientErrors.pincode && (
                              <p className="text-xs text-rose-500 mt-1 ml-1">{recipientErrors.pincode}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-slate-800 mb-1">
                          Enter receiver details
                        </h4>
                        <p className="text-[10px] text-slate-400 mb-3 font-medium">
                          We'll contact receiver to get the exact delivery
                          address
                        </p>
                        <div className="space-y-3">
                          <div>
                            <Input
                              placeholder="Receiver's name*"
                              value={recipientData.name}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^a-zA-Z\u00C0-\u024F\s]/g, "");
                                setRecipientData({ ...recipientData, name: val });
                                if (recipientErrors.name) setRecipientErrors((prev) => ({ ...prev, name: "" }));
                              }}
                              className={`h-12 rounded-xl text-sm ${recipientErrors.name ? "border-rose-400 focus:ring-rose-400 focus:border-rose-400" : "border-slate-200 focus:ring-[#FE5502] focus:border-[#FE5502]"}`}
                            />
                            {recipientErrors.name && (
                              <p className="text-xs text-rose-500 mt-1 ml-1">{recipientErrors.name}</p>
                            )}
                          </div>
                          <div>
                            <div className="relative">
                              <Input
                                placeholder="Receiver's phone number*"
                                value={recipientData.phone}
                                type="tel"
                                inputMode="numeric"
                                maxLength={10}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                                  setRecipientData({ ...recipientData, phone: val });
                                  if (recipientErrors.phone) setRecipientErrors((prev) => ({ ...prev, phone: "" }));
                                }}
                                className={`h-12 rounded-xl text-sm pr-10 ${recipientErrors.phone ? "border-rose-400 focus:ring-rose-400 focus:border-rose-400" : "border-slate-200 focus:ring-[#FE5502] focus:border-[#FE5502]"}`}
                              />
                              <button
                                type="button"
                                title="Pick from contacts"
                                onClick={async () => {
                                  if ("contacts" in navigator && "ContactsManager" in window) {
                                    try {
                                      const contacts = await navigator.contacts.select(["tel"], { multiple: false });
                                      if (contacts?.length && contacts[0]?.tel?.length) {
                                        const raw = contacts[0].tel[0].replace(/\D/g, "").slice(-10);
                                        setRecipientData((prev) => ({ ...prev, phone: raw }));
                                        if (recipientErrors.phone) setRecipientErrors((prev) => ({ ...prev, phone: "" }));
                                      }
                                    } catch {
                                      // user cancelled or permission denied
                                    }
                                  } else {
                                    document.querySelector("input[placeholder=\"Receiver's phone number*\"]")?.focus();
                                  }
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#FE5502] transition-colors cursor-pointer p-1 rounded-lg hover:bg-slate-100"
                              >
                                <Contact2 size={18} />
                              </button>
                            </div>
                            {recipientErrors.phone && (
                              <p className="text-xs text-rose-500 mt-1 ml-1">{recipientErrors.phone}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={handleSaveRecipient}
                        className="w-full h-12 bg-[#2d8618] hover:bg-[#236b11] text-white font-bold rounded-xl">
                        Save address
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="mb-3">
                <h3 className="font-black text-slate-800 text-base">
                  Delivery Address
                </h3>
                <p className="text-xs text-slate-500">
                  Select or edit your saved address
                </p>
              </div>

              {/* Address Card */}
              <div className="border rounded-xl p-3 mb-3 relative cursor-pointer transition-all border-[#FE5502] bg-orange-50/50 dark:bg-orange-950/20">
                <div className="flex items-start gap-3">
                  {/* Radio/Check Button */}
                  <div className="mt-1">
                    <div className="h-5 w-5 rounded-full bg-[#FE5502] flex items-center justify-center">
                      <Check size={12} className="text-white stroke-[4]" />
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-slate-800 text-sm">
                        {displayName}
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditAddress();
                          }}
                          className="text-slate-500 text-xs font-bold hover:underline">
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsAddressModalOpen(true);
                          }}
                          className="text-[#FE5502] text-xs font-bold hover:underline">
                          Change
                        </button>
                      </div>
                    </div>
                    {displayPhone ? (
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {displayPhone}
                      </p>
                    ) : null}
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {displayAddress}
                    </p>
                  </div>
                </div>
              </div>

              {/* Use current location button */}
              <button
                type="button"
                onClick={handleUseCurrentLiveLocation}
                disabled={isFetchingLocation}
                className="mt-3 w-full py-2.5 rounded-2xl border border-dashed border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                {isFetchingLocation
                  ? "Detecting live location..."
                  : "Use current live location"}
              </button>
              {/* Manual address info / out-of-zone banner */}
              {isCurrentAddressOutOfZone ? (
                <motion.div
                  onClick={() => setIsAddressModalOpen(true)}
                  className="mt-3 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 flex items-center gap-3 shadow-sm cursor-pointer hover:bg-red-100 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-red-600 flex items-center justify-center shadow-red-500/40 shadow-md flex-shrink-0">
                    <X size={18} className="text-white stroke-[3]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-red-950">
                      Out of delivery zone
                    </p>
                    <p className="text-[11px] font-medium text-red-800">
                      We cannot deliver to this location ({outOfZoneDistance ? `~${outOfZoneDistance} km away` : 'outside 15 km radius'}). Tap to change.
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-red-500 flex-shrink-0" />
                </motion.div>
              ) : (
                <motion.div className="mt-3 rounded-2xl border border-orange-100 bg-orange-50/70 px-4 py-3 flex items-center gap-3 shadow-sm">
                  <div className="h-8 w-8 rounded-full bg-[#FE5502] flex items-center justify-center shadow-orange-500/40 shadow-md">
                    <Check size={16} className="text-white stroke-[3]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-orange-950">
                      Delivery address confirmed
                    </p>
                    <p className="text-[11px] font-medium text-orange-900/80">
                      We&apos;ll deliver to the address you&apos;ve entered above.
                    </p>
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* Cart Items */}
            <motion.div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-4">
              {displayCartItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                  <div className="h-20 w-20 rounded-xl overflow-hidden bg-slate-50 flex-shrink-0">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 mb-1">
                      {item.name}
                    </h4>
                    <p className="text-xs text-slate-500 mb-2">75 g</p>
                    <button
                      onClick={() => handleMoveToWishlist(item)}
                      className="text-xs text-slate-500 underline hover:text-[#FE5502] transition-colors">
                      Move to wishlist
                    </button>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2 bg-[#FE5502] rounded-lg px-2 py-1">
                      <button
                        onClick={() =>
                          item.quantity > 1
                            ? updateQuantity(item.id, -1)
                            : removeFromCart(item.id)
                        }
                        className="text-white p-1 hover:bg-white/20 rounded transition-colors">
                        <Minus size={14} strokeWidth={3} />
                      </button>
                      <span className="text-white font-bold min-w-[20px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="text-white p-1 hover:bg-white/20 rounded transition-colors">
                        <Plus size={14} strokeWidth={3} />
                      </button>
                    </div>
                    <p className="text-base font-black text-slate-800">
                      ₹{item.price * item.quantity}
                    </p>
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Your Wishlist */}
            {wishlist.filter((item) => item.name).length > 0 && (
              <motion.div className="bg-white dark:bg-card rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-white/5 transition-colors">
                <h3 className="font-black text-slate-800 text-lg mb-4">
                  Your wishlist
                </h3>
                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 snap-x">
                  {wishlist
                    .filter((item) => item.name)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex-shrink-0 w-[140px] snap-start">
                        <ProductCard product={item} compact={true} />
                      </div>
                    ))}
                </div>
              </motion.div>
            )}

            {/* You might also like 
            <motion.div className="bg-white dark:bg-card rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-white/5 transition-colors">
              <h3 className="font-black text-slate-800 text-lg mb-4">
                You might also like
              </h3>
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 snap-x">
                {recommendedProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex-shrink-0 w-[140px] snap-start">
                    <ProductCard product={product} compact={true} />
                  </div>
                ))}
              </div>
            </motion.div>
            */}
          </div>

          {/* Right Column: Order Summary & Payment - Sticky on Desktop */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6 lg:sticky lg:top-8 pb-32 lg:pb-8">
            {/* Summary Backdrop for desktop */}
            <div className="hidden lg:block absolute inset-0 -m-4 bg-[#fcf9f2] rounded-[2.5rem] -z-10 shadow-inner group-hover:shadow-2xl transition-all duration-500" />
            <motion.div className="bg-white dark:bg-card rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-white/5 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Tag size={20} className="text-orange-500" />
                  <h3 className="font-black text-slate-800">
                    Available Coupons
                  </h3>
                </div>
                <button
                  onClick={() => setIsCouponModalOpen(true)}
                  className="text-[#FE5502] text-sm font-bold hover:underline">
                  See All
                </button>
              </div>
              <div className="space-y-3">
                {coupons.map((coupon) => (
                  <div
                    key={coupon.code}
                    className="flex items-center gap-3 p-3 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-orange-100 dark:border-white/5">
                    <div className="flex-1">
                      <p className="font-black text-slate-800 text-sm">
                        {coupon.code}
                      </p>
                      <p className="text-xs text-slate-600">
                        {coupon.description}
                      </p>
                    </div>
                    <button
                      onClick={() => handleApplyCoupon(coupon)}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                        selectedCoupon?.code === coupon.code
                          ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                          : "bg-[#FE5502] text-white hover:bg-[#ea580c]"
                      }`}
                      disabled={selectedCoupon?.code === coupon.code}>
                      {selectedCoupon?.code === coupon.code
                        ? "Applied"
                        : "Apply"}
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Tip for Partner
            <motion.div className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-4 border border-pink-100 dark:border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <Heart size={18} className="text-pink-500 fill-pink-500" />
                <h3 className="font-black text-slate-800">
                  Tip your delivery partner
                </h3>
              </div>
              <p className="text-xs text-slate-600 mb-3">
                100% of the tip goes to them
              </p>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {tipAmounts.map((tip) => (
                  <button
                    key={tip.value}
                    onClick={() => {
                      setSelectedTip(tip.value);
                      setCustomTip("");
                    }}
                    className={`py-2 rounded-xl border-2 transition-all font-bold text-sm ${
                      selectedTip === tip.value && !customTip
                        ? "border-pink-500 bg-pink-100 text-pink-700"
                        : "border-pink-200 bg-white text-slate-700 hover:border-pink-300"
                    }`}>
                    {tip.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  placeholder="Enter custom tip amount (₹)"
                  value={customTip}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    setCustomTip(val);
                    setSelectedTip(val ? Number(val) : 0);
                  }}
                  className="w-full h-10 rounded-xl border-2 border-pink-200 bg-white px-3 text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-pink-400 transition-colors"
                />
                {customTip && (
                  <button
                    onClick={() => { setCustomTip(""); setSelectedTip(0); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </motion.div>
            */}

            {/* Payment Method */}
            <motion.div className="bg-white dark:bg-card rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-white/5 transition-colors">
              <h3 className="font-black text-slate-800 mb-4">Payment Method</h3>
              <div className="space-y-2">
                {paymentMethods.map((method) => {
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.id}
                      onClick={() => setSelectedPayment(method.id)}
                      className={`w-full p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                        selectedPayment === method.id
                          ? "border-[#FE5502] bg-orange-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}>
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          selectedPayment === method.id
                            ? "bg-orange-100"
                            : "bg-slate-100"
                        }`}>
                        <Icon
                          size={18}
                          className={
                            selectedPayment === method.id
                              ? "text-[#FE5502]"
                              : "text-slate-600"
                          }
                        />
                      </div>
                      <div className="flex-1 text-left">
                        <p
                          className={`font-bold text-sm ${selectedPayment === method.id ? "text-[#FE5502]" : "text-slate-800"}`}>
                          {method.label}
                        </p>
                        <p className="text-xs text-slate-500">
                          {method.sublabel}
                        </p>
                      </div>
                      <div
                        className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                          selectedPayment === method.id
                            ? "border-[#FE5502]"
                            : "border-slate-300"
                        }`}>
                        {selectedPayment === method.id && (
                          <div className="h-3 w-3 rounded-full bg-[#FE5502]" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* Bill Details */}
            <motion.div className="bg-white dark:bg-card rounded-[2rem] p-6 shadow-xl shadow-gray-200/50 dark:shadow-none border border-slate-100 dark:border-white/5 transition-colors">
              <div className="flex items-center gap-2 mb-6">
                <div className="h-10 w-10 rounded-2xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
                  <Clipboard size={20} className="text-[#FE5502]" />
                </div>
                <h3 className="font-[1000] text-slate-800 text-xl tracking-tight uppercase">
                  Order Summary
                </h3>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                  <span className="text-slate-500 font-bold text-[13px] uppercase tracking-wider">
                    Item Total
                  </span>
                  <div className="flex items-baseline gap-2">
                    {originalItemsTotal > discountedItemsTotal ? (
                      <span className="text-sm font-bold text-slate-400 line-through">
                        ₹{originalItemsTotal}
                      </span>
                    ) : null}
                    <span className="font-black text-slate-800">
                    ₹{discountedItemsTotal}
                  </span>
                  </div>
                </div>
                <div className="flex justify-between items-center px-2">
                  <span className="text-slate-500 font-bold text-[13px] uppercase tracking-wider">
                    Delivery Fee
                  </span>
                  <span className="font-black text-slate-800">₹{deliveryFee}</span>
                </div>                {pricingPreview &&
                  typeof pricingPreview.distanceKmActual === "number" &&
                  typeof pricingPreview.distanceKmRounded === "number" && (
                    <div className="px-2 -mt-3 flex items-center justify-between text-[11px] font-semibold text-slate-400">
                      <span>
                        Distance: {pricingPreview.distanceKmActual.toFixed(2)} km
                        {pricingPreview.distanceKmRounded
                          ? ` (billed ${pricingPreview.distanceKmRounded.toFixed(2)} km)`
                          : ""}
                      </span>
                      <span className="uppercase tracking-wider">
                        {pricingPreview?.snapshots?.deliverySettings?.deliveryPricingMode ||
                          pricingPreview?.snapshots?.deliverySettings?.pricingMode ||
                          ""}
                      </span>
                    </div>
                  )}
                <div className="flex justify-between items-center px-2">
                  <span className="text-slate-500 font-bold text-[13px] uppercase tracking-wider">
                    Handling Fee
                  </span>
                  <span className="font-black text-slate-800">
                    ₹{handlingFee}
                  </span>
                </div>
                <div className="flex justify-between items-center px-2">
                  <span className="text-slate-500 font-bold text-[13px] uppercase tracking-wider">
                    Platform fee
                  </span>
                  <span className="font-black text-slate-800">₹{platformFee}</span>
                </div>
                <div className="flex justify-between items-center px-2">
                  <span className="text-slate-500 font-bold text-[13px] uppercase tracking-wider">
                    GST
                  </span>
                  <span className="font-black text-slate-800">₹{gstAmount}</span>
                </div>

                {selectedCoupon && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex justify-between items-center px-3 py-2 bg-orange-50 rounded-xl border border-orange-100">
                    <span className="text-[#FE5502] font-black text-xs flex items-center gap-2 uppercase tracking-wider">
                      <Tag size={14} />
                      Coupon Reserved
                    </span>
                    <span className="font-black text-[#FE5502]">
                      -₹{discountAmount}
                    </span>
                  </motion.div>
                )}

                {selectedTip > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex justify-between items-center px-3 py-2 bg-pink-50 rounded-xl border border-pink-100">
                    <span className="text-pink-600 font-bold text-xs flex items-center gap-2">
                      <Heart size={14} className="fill-pink-500" />
                      Delivery Partner Tip
                    </span>
                    <span className="font-black text-pink-600">
                      +₹{selectedTip}
                    </span>
                  </motion.div>
                )}

                <div className="mt-4 pt-6 border-t-2 border-dashed border-slate-100">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex flex-col">
                      <span className="font-[1000] text-slate-800 text-lg uppercase tracking-tight">
                        To Pay
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
                        Safe & Secure Payment
                      </span>
                    </div>
                    <span className="font-[1000] text-[#FE5502] text-3xl tracking-tighter italic">
                      {isPreviewLoading ? "Calculating..." : `₹${totalAmount}`}
                    </span>
                  </div>

                  {/* Desktop Integrated Slide to Pay / Place Order */}
                  <div className="hidden lg:block">
                    {selectedPayment === "cash" || isCurrentAddressOutOfZone ? (
                      <button
                        onClick={handlePlaceOrder}
                        disabled={isPlacingOrder || isPreviewLoading || !pricingPreview}
                        className={`w-full py-4 rounded-2xl ${isCurrentAddressOutOfZone ? 'bg-red-600 hover:bg-red-700' : 'bg-[#FE5502] hover:bg-[#c83c00]'} active:bg-[#a03000] disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-lg tracking-wide transition-colors shadow-lg shadow-orange-500/20`}>
                        {isPlacingOrder ? "Placing Order..." : isCurrentAddressOutOfZone ? "Out of Delivery Zone" : `Place Order | ₹${totalAmount}`}
                      </button>
                    ) : (
                      <SlideToPay
                        amount={totalAmount}
                        onSuccess={handlePlaceOrder}
                        isLoading={isPlacingOrder || isPreviewLoading || !pricingPreview}
                        text="Order Now"
                      />
                    )}
                    <p className="text-center text-[10px] text-slate-400 font-bold mt-4 uppercase tracking-[0.1em]">
                      🔒 SSL encrypted secure checkout
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Sticky Footer - Mobile Only */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-card border-t border-slate-200 dark:border-white/10 px-4 py-4 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50 rounded-t-3xl transition-colors">
        <div className="max-w-4xl mx-auto">
          {selectedPayment === "cash" || isCurrentAddressOutOfZone ? (
            <button
              onClick={handlePlaceOrder}
              disabled={isPlacingOrder || isPreviewLoading || !pricingPreview}
              className={`w-full py-4 rounded-2xl ${isCurrentAddressOutOfZone ? 'bg-red-600 hover:bg-red-700' : 'bg-[#FE5502] hover:bg-[#c83c00]'} active:bg-[#a03000] disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-lg tracking-wide transition-colors shadow-lg shadow-orange-500/20`}>
              {isPlacingOrder ? "Placing Order..." : isCurrentAddressOutOfZone ? "Out of Delivery Zone" : `Place Order | ₹${totalAmount}`}
            </button>
          ) : (
            <SlideToPay
              amount={totalAmount}
              onSuccess={handlePlaceOrder}
              isLoading={isPlacingOrder || isPreviewLoading || !pricingPreview}
              text="Slide to Pay"
            />
          )}
        </div>
      </div>

      {/* Address Selection Modal */}
      {/* Select Delivery Address Modal */}
      <AnimatePresence>
        {isAddressModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => { setIsAddressModalOpen(false); setShowAddNewAddressForm(false); setNewAddressErrors({}); }}
            />
            {/* Modal */}
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative z-10 w-full max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl max-h-[85vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 flex-shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Select Delivery Address</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Choose where you want your order delivered</p>
                </div>
                <button
                  onClick={() => { setIsAddressModalOpen(false); setShowAddNewAddressForm(false); setNewAddressErrors({}); }}
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors flex-shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Address List */}
              <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
                {locationSavedAddresses.length === 0 && (
                  <p className="text-center text-sm text-slate-400 py-6">No saved addresses yet.</p>
                )}
                {locationSavedAddresses.map((addr) => (
                  <button
                    key={addr.id}
                    onClick={() => handleSelectSavedAddress(addr)}
                    disabled={isResolvingAddressCoords}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                      currentAddress.id === addr.id
                        ? "border-[#FE5502] bg-orange-50 shadow-sm"
                        : "border-slate-100 bg-white hover:border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-full ${currentAddress.id === addr.id ? "bg-[#FE5502] text-white" : "bg-slate-100 text-slate-500"}`}>
                        <MapPin size={16} />
                      </div>
                      <span className="font-black text-slate-800 uppercase tracking-widest text-[10px]">
                        {addr.label}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-800">
                      {addr.name || user?.name || currentAddress.name || "Customer"}
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed mb-1">{addr.address}</p>
                    {addr.phone && (
                      <p className="text-[11px] text-slate-400 font-medium">Phone: {addr.phone}</p>
                    )}
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="px-4 pb-5 pt-3 border-t border-slate-100 flex-shrink-0">
                {!showAddNewAddressForm ? (
                  <Button
                    variant="outline"
                    className="w-full h-12 border-2 border-[#FE5502] text-[#FE5502] hover:bg-orange-50 rounded-2xl font-bold"
                    onClick={() => setShowAddNewAddressForm(true)}
                  >
                    <Plus size={16} className="mr-2" /> Add New Address
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-bold text-slate-800">New Address</h3>
                      <button
                        onClick={() => { setShowAddNewAddressForm(false); setNewAddressErrors({}); }}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >Cancel</button>
                    </div>

                    {/* Label selector */}
                    <div className="flex gap-2">
                      {["Home", "Office", "Other"].map((lbl) => (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() => setNewAddressForm((p) => ({ ...p, label: lbl }))}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${newAddressForm.label === lbl ? "border-[#FE5502] bg-orange-50 text-[#FE5502]" : "border-slate-200 text-slate-500"}`}
                        >{lbl}</button>
                      ))}
                    </div>

                    {/* Name */}
                    <div>
                      <Input
                        placeholder="Full name*"
                        value={newAddressForm.name}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^a-zA-Z\u00C0-\u024F\s]/g, "");
                          setNewAddressForm((p) => ({ ...p, name: val }));
                          if (newAddressErrors.name) setNewAddressErrors((p) => ({ ...p, name: "" }));
                        }}
                        className={`h-10 rounded-xl text-sm ${newAddressErrors.name ? "border-rose-400" : "border-slate-200 focus:ring-[#FE5502] focus:border-[#FE5502]"}`}
                      />
                      {newAddressErrors.name && <p className="text-xs text-rose-500 mt-0.5 ml-1">{newAddressErrors.name}</p>}
                    </div>

                    {/* Phone */}
                    <div>
                      <Input
                        placeholder="Phone number*"
                        value={newAddressForm.phone}
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                          setNewAddressForm((p) => ({ ...p, phone: val }));
                          if (newAddressErrors.phone) setNewAddressErrors((p) => ({ ...p, phone: "" }));
                        }}
                        className={`h-10 rounded-xl text-sm ${newAddressErrors.phone ? "border-rose-400" : "border-slate-200 focus:ring-[#FE5502] focus:border-[#FE5502]"}`}
                      />
                      {newAddressErrors.phone && <p className="text-xs text-rose-500 mt-0.5 ml-1">{newAddressErrors.phone}</p>}
                    </div>

                    {/* Address */}
                    <div>
                      <Input
                        placeholder="House, street, area*"
                        value={newAddressForm.address}
                        onChange={(e) => {
                          setNewAddressForm((p) => ({ ...p, address: e.target.value }));
                          if (newAddressErrors.address) setNewAddressErrors((p) => ({ ...p, address: "" }));
                        }}
                        className={`h-10 rounded-xl text-sm ${newAddressErrors.address ? "border-rose-400" : "border-slate-200 focus:ring-[#FE5502] focus:border-[#FE5502]"}`}
                      />
                      {newAddressErrors.address && <p className="text-xs text-rose-500 mt-0.5 ml-1">{newAddressErrors.address}</p>}
                    </div>

                    {/* Landmark */}
                    <Input
                      placeholder="Landmark (optional)"
                      value={newAddressForm.landmark}
                      onChange={(e) => setNewAddressForm((p) => ({ ...p, landmark: e.target.value }))}
                      className="h-10 rounded-xl border-slate-200 focus:ring-[#FE5502] focus:border-[#FE5502] text-sm"
                    />

                    {/* City + Pincode */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Input
                          placeholder="City*"
                          value={newAddressForm.city}
                          onChange={(e) => {
                            setNewAddressForm((p) => ({ ...p, city: e.target.value }));
                            if (newAddressErrors.city) setNewAddressErrors((p) => ({ ...p, city: "" }));
                          }}
                          className={`h-10 rounded-xl text-sm ${newAddressErrors.city ? "border-rose-400" : "border-slate-200 focus:ring-[#FE5502] focus:border-[#FE5502]"}`}
                        />
                        {newAddressErrors.city && <p className="text-xs text-rose-500 mt-0.5 ml-1">{newAddressErrors.city}</p>}
                      </div>
                      <div>
                        <Input
                          placeholder="Pincode"
                          value={newAddressForm.zipCode}
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                            setNewAddressForm((p) => ({ ...p, zipCode: val }));
                            if (newAddressErrors.zipCode) setNewAddressErrors((p) => ({ ...p, zipCode: "" }));
                          }}
                          className={`h-10 rounded-xl text-sm ${newAddressErrors.zipCode ? "border-rose-400" : "border-slate-200 focus:ring-[#FE5502] focus:border-[#FE5502]"}`}
                        />
                        {newAddressErrors.zipCode && <p className="text-xs text-rose-500 mt-0.5 ml-1">{newAddressErrors.zipCode}</p>}
                      </div>
                    </div>

                    <Button
                      onClick={handleSaveNewAddress}
                      disabled={isSavingNewAddress}
                      className="w-full h-11 rounded-2xl bg-[#FE5502] hover:bg-[#ea580c] text-white font-bold"
                    >
                      {isSavingNewAddress ? "Saving..." : "Save Address"}
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Current Address Modal */}
      <AnimatePresence>
        {isEditAddressOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsEditAddressOpen(false)}
            />
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative z-10 w-full max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Edit Delivery Address</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Update your current delivery address</p>
                </div>
                <button
                  onClick={() => setIsEditAddressOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form */}
              <div className="px-5 py-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-address" className="text-xs font-semibold text-slate-700">Address</Label>
                  <Input
                    id="edit-address"
                    value={editAddressForm.address}
                    onChange={(e) => setEditAddressForm((prev) => ({ ...prev, address: e.target.value }))}
                    className="h-11 rounded-xl border-slate-200 focus:ring-[#FE5502] focus:border-[#FE5502]"
                    placeholder="House, street, area"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-landmark" className="text-xs font-semibold text-slate-700">Nearest Landmark (optional)</Label>
                  <Input
                    id="edit-landmark"
                    value={editAddressForm.landmark || ""}
                    onChange={(e) => setEditAddressForm((prev) => ({ ...prev, landmark: e.target.value }))}
                    className="h-11 rounded-xl border-slate-200 focus:ring-[#FE5502] focus:border-[#FE5502]"
                    placeholder="e.g. Near City Mall, Opp. Temple"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-city" className="text-xs font-semibold text-slate-700">City</Label>
                    <Input
                      id="edit-city"
                      value={editAddressForm.city || ""}
                      onChange={(e) => setEditAddressForm((prev) => ({ ...prev, city: e.target.value }))}
                      className="h-11 rounded-xl border-slate-200 focus:ring-[#FE5502] focus:border-[#FE5502]"
                      placeholder="City"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-pincode" className="text-xs font-semibold text-slate-700">Pincode</Label>
                    <Input
                      id="edit-pincode"
                      value={editAddressForm.zipCode || ""}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setEditAddressForm((prev) => ({ ...prev, zipCode: val }));
                      }}
                      className={`h-11 rounded-xl focus:ring-[#FE5502] focus:border-[#FE5502] ${
                        editAddressForm.zipCode && editAddressForm.zipCode.length > 0 && editAddressForm.zipCode.length !== 6
                          ? "border-rose-400"
                          : "border-slate-200"
                      }`}
                      placeholder="6-digit code"
                    />
                    {editAddressForm.zipCode && editAddressForm.zipCode.length > 0 && editAddressForm.zipCode.length !== 6 && (
                      <p className="text-xs text-rose-500 mt-1">Must be 6 digits</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 pb-6 pt-2 flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsEditAddressOpen(false)}
                  className="flex-1 h-11 rounded-2xl border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEditedAddress}
                  className="flex-1 h-11 rounded-2xl bg-[#FE5502] hover:bg-[#ea580c] text-white font-bold"
                >
                  Save changes
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Coupon Selection Modal */}
      <AnimatePresence>
        {isCouponModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsCouponModalOpen(false)}
            />
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative z-10 w-full max-w-md bg-white rounded-[28px] shadow-2xl flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 flex-shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Apply Coupon</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Browse available offers and save more.</p>
                </div>
                <button
                  onClick={() => setIsCouponModalOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors flex-shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Coupon List */}
              <div className="px-4 py-4 space-y-4 overflow-y-auto flex-1">
                {coupons.length === 0 && (
                  <p className="text-center text-sm text-slate-400 py-6">No coupons available right now.</p>
                )}
                {coupons.map((coupon) => (
                  <div
                    key={coupon.code}
                    className={`p-4 rounded-2xl border-2 transition-all relative overflow-hidden ${
                      selectedCoupon?.code === coupon.code
                        ? "border-[#FE5502] bg-orange-50 shadow-sm"
                        : "border-slate-100 bg-white hover:border-slate-200"
                    }`}>
                    {selectedCoupon?.code === coupon.code && (
                      <div className="absolute top-0 right-0 p-1.5 bg-[#FE5502] text-white rounded-bl-xl">
                        <Check size={12} strokeWidth={4} />
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className={`p-3 rounded-2xl flex-shrink-0 ${selectedCoupon?.code === coupon.code ? "bg-[#FE5502]/10 text-[#FE5502]" : "bg-red-50 text-red-500"}`}>
                        <Tag size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="font-black text-slate-800 tracking-wider mb-1">{coupon.code}</p>
                        <p className="text-xs text-slate-500 leading-relaxed">{coupon.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleApplyCoupon(coupon)}
                      disabled={selectedCoupon?.code === coupon.code}
                      className={`w-full mt-3 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        selectedCoupon?.code === coupon.code
                          ? "bg-white text-[#FE5502] border-2 border-[#FE5502] cursor-default"
                          : "bg-[#FE5502] text-white hover:bg-[#ea580c]"
                      }`}>
                      {selectedCoupon?.code === coupon.code ? "Applied ✓" : "Apply Now"}
                    </button>
                  </div>
                ))}
              </div>

              {/* Manual code input */}
              <div className="px-4 pb-5 pt-3 border-t border-slate-100 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input
                    placeholder="Enter coupon code manually"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    className="pl-10 h-12 rounded-xl focus-visible:ring-[#FE5502]"
                  />
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#FE5502] font-bold text-xs"
                    onClick={async () => {
                      if (!manualCode.trim()) {
                        showToast("Please enter a coupon code", "error");
                        return;
                      }
                      try {
                        const res = await customerApi.validateCoupon({
                          code: manualCode.trim(),
                          cartTotal,
                          items: cart,
                          customerId: user?._id,
                        });
                        if (res.data.success) {
                          const data = res.data.result;
                          setSelectedCoupon({
                            code: manualCode.trim(),
                            description: "Applied manually",
                            ...data,
                          });
                          showToast(`Coupon ${manualCode.trim()} applied!`, "success");
                        } else {
                          showToast(res.data.message || "Invalid coupon", "error");
                        }
                      } catch (error) {
                        showToast(error.response?.data?.message || "Invalid coupon", "error");
                      }
                    }}>
                    CHECK
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-6 text-center">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 12 }}
              className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center text-[#FE5502] mb-6">
              <Check size={48} strokeWidth={4} />
            </motion.div>
            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-3xl font-black text-slate-800 mb-2">
              Order placed
            </motion.h2>
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-slate-500 font-medium mb-8">
              #{orderId?.slice(-6)} — waiting for the seller to accept (60s). If
              they don&apos;t, the order will cancel automatically.
              <br />
              Redirecting to order details…
            </motion.p>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 2.5, ease: "linear" }}
              className="w-48 h-1.5 bg-orange-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#FE5502]" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style
        dangerouslySetInnerHTML={{
          __html: `
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `,
        }}
      />

      {/* Share Modal — shown on desktop where native share sheet isn't available */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[700] flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowShareModal(false)}
            />
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative z-10 w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl"
            >
              <h3 className="text-lg font-bold text-slate-900 mb-1">Share {appName}</h3>
              <p className="text-sm text-slate-500 mb-5">Choose how you'd like to share</p>

              <div className="space-y-3">
                {/* WhatsApp */}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Hey! Check out ${appName} for quick grocery delivery in minutes! ${window.location.origin}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowShareModal(false)}
                  className="flex items-center gap-3 w-full rounded-2xl border-2 border-slate-100 p-3 hover:border-green-200 hover:bg-green-50 transition-all"
                >
                  <div className="h-10 w-10 rounded-full bg-[#25D366] flex items-center justify-center text-white font-black text-lg flex-shrink-0">W</div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">WhatsApp</p>
                    <p className="text-xs text-slate-500">Share via WhatsApp</p>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-slate-400" />
                </a>

                {/* Copy Link */}
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-3 w-full rounded-2xl border-2 border-slate-100 p-3 hover:border-slate-200 hover:bg-slate-50 transition-all text-left"
                >
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Clipboard size={18} className="text-slate-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800">Copy Link</p>
                    <p className="text-xs text-slate-500 truncate">{window.location.origin}</p>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-slate-400 flex-shrink-0" />
                </button>
              </div>

              <button
                onClick={() => setShowShareModal(false)}
                className="mt-4 w-full rounded-2xl border-2 border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Out of Zone Dialog */}
      <Dialog open={showOutOfZoneDialog} onOpenChange={setShowOutOfZoneDialog}>
        <DialogContent className="max-w-sm mx-auto z-[9999] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-red-600 flex items-center gap-2">
              <AlertCircle className="text-red-600 h-5 w-5" />
              Out of Delivery Zone
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-slate-600 dark:text-gray-400 mt-2 leading-relaxed">
              We can only deliver within a <strong>{MAX_QUICK_DELIVERY_RADIUS_KM} km</strong> radius from our store hub.
              <br /><br />
              The selected address is <strong>{outOfZoneDistance ? `~${outOfZoneDistance} km` : 'far away'}</strong> from our serviceable area. Please select or add an address nearby.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              onClick={() => {
                setShowOutOfZoneDialog(false);
                setIsAddressModalOpen(true);
              }}
              className="w-full bg-[#FE5502] hover:bg-[#C83C00] text-white font-bold py-3 rounded-2xl shadow-md"
            >
              Choose Another Address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CheckoutPage;
