import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useParams, Link, useSearchParams, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { buildOrderInvoicePdf } from "../../../utils/printOrderInvoice"
import { sharePdfBlob, isNativeAppShell, saveBlobAsFile } from "@/shared/utils/fileDownload"
import { toast } from "sonner"
import {
  ArrowLeft,
  Share2,
  RefreshCw,
  Download,
  Phone,
  User,
  ChevronRight,
  MapPin,
  Home as HomeIcon,
  MessageSquare,
  X,
  Check,
  Shield,
  ShoppingBag,
  CircleSlash,
  Loader2,
  Star
} from "lucide-react"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Card, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog"
import { Textarea } from "@food/components/ui/textarea"
import { useOptionalOrders } from "@food/context/OrdersContext"
import { useProfile } from "@food/context/ProfileContext"
import { useAuth } from "@core/context/AuthContext"
import { useLocation as useUserLocation } from "@food/hooks/useLocation"
import DeliveryTrackingMap from "@food/components/user/DeliveryTrackingMap"
import { isFoodQuickOrder, formatQuickEtaWindow } from "@food/utils/quickDelivery"
import { orderAPI, restaurantAPI } from "@food/api"
import { useCompanyName } from "@food/hooks/useCompanyName"
import { useUserNotifications } from "@food/hooks/useUserNotifications"
import {
  getLifecycleDisplay,
  lifecycleStageToTrackingUi,
} from "@food/utils/orderLifecycleDisplay"
import { customerApi } from "../../../../quickCommerce/user/services/customerApi"
import DeliveryOtpDisplay from "../../../../quickCommerce/user/components/DeliveryOtpDisplay"
import ReturnTrackingPanel, { ReturnItemsCta } from "../../../../quickCommerce/user/components/return/ReturnTrackingPanel"
import ReturnWindowBanner from "../../../../quickCommerce/user/components/return/ReturnWindowBanner"
import { resolveLiveReturnEligibility } from "@/shared/utils/returnWindow"
import { resolveQuickImageUrl } from "../../../../quickCommerce/user/utils/image"
import { RETURN_STATUS } from "@/shared/utils/returnStatus"
import circleIcon from "@food/assets/circleicon.png"
import { RESTAURANT_PIN_SVG, CUSTOMER_PIN_SVG, RIDER_BIKE_SVG } from "@food/constants/mapIcons"

// ─── Fallback SVGs ────────────────────────────────────────────────────────────
const DEFAULT_CUSTOMER_PIN = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#10B981"><path d="M12 2C8.13 2 5 5.13 5 9c0 4.17 4.42 9.92 6.24 12.11.4.48 1.08.48 1.52 0C14.58 18.92 19 13.17 19 9c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5 14.5 7.62 14.5 9 13.38 11.5 12 11.5z"/><circle cx="12" cy="9" r="3" fill="#FFFFFF"/></svg>`;
const SAFE_CUSTOMER_PIN = typeof CUSTOMER_PIN_SVG !== 'undefined' ? CUSTOMER_PIN_SVG : DEFAULT_CUSTOMER_PIN;
const DEFAULT_RESTAURANT_PIN = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#FF0000"><path d="M12 2C8.13 2 5 5.13 5 9c0 4.17 4.42 9.92 6.24 12.11.4.48 1.08.48 1.52 0C14.58 18.92 19 13.17 19 9c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5 14.5 7.62 14.5 9 13.38 11.5 12 11.5z"/><circle cx="12" cy="9" r="3" fill="#FFFFFF"/></svg>`;
const SAFE_RESTAURANT_PIN = typeof RESTAURANT_PIN_SVG !== 'undefined' ? RESTAURANT_PIN_SVG : DEFAULT_RESTAURANT_PIN;

// ─── Debug helpers (no-ops in production, tree-shake friendly) ────────────────
const debugLog = (...args) => console.log('[OrderTracking]', ...args)
const debugWarn = (...args) => console.warn('[OrderTracking]', ...args)
const debugError = (...args) => console.error('[OrderTracking]', ...args)
const INVOICE_BRAND_NAME = "Appzeto"
/** Stable fallback when OrdersProvider is absent (e.g. Quick Commerce routes). */
const NOOP_GET_ORDER_BY_ID = () => null;

// ─── Stable animated checkmark ───────────────────────────────────────────────
// Extracted outside component to prevent recreation on parent re-renders
const CHECKMARK_CIRCLE_ANIM = { pathLength: 1, opacity: 1 }
const CHECKMARK_CIRCLE_INIT = { pathLength: 0, opacity: 0 }
const CHECKMARK_PATH_INIT = { pathLength: 0, opacity: 0 }
const CHECKMARK_PATH_ANIM = { pathLength: 1, opacity: 1 }

const AnimatedCheckmark = React.memo(function AnimatedCheckmark({ delay = 0 }) {
  return (
    <motion.svg width="80" height="80" viewBox="0 0 80 80" initial="hidden" animate="visible" className="mx-auto">
      <motion.circle cx="40" cy="40" r="36" fill="none" stroke="#22c55e" strokeWidth="4"
        initial={CHECKMARK_CIRCLE_INIT} animate={CHECKMARK_CIRCLE_ANIM}
        transition={{ duration: 0.5, delay, ease: "easeOut" }} />
      <motion.path d="M24 40 L35 51 L56 30" fill="none" stroke="#22c55e" strokeWidth="4"
        strokeLinecap="round" strokeLinejoin="round"
        initial={CHECKMARK_PATH_INIT} animate={CHECKMARK_PATH_ANIM}
        transition={{ duration: 0.4, delay: delay + 0.4, ease: "easeOut" }} />
    </motion.svg>
  )
})

// ─── DeliveryMap ─────────────────────────────────────────────────────────────
const DeliveryMap = React.memo(function DeliveryMap({
  orderId, order, isVisible, fallbackCustomerCoords = null,
  userLiveCoords = null, userLocationAccuracy = null, onEtaUpdate = null
}) {
  const toPointFromGeoJSON = useCallback((coords) => {
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, []);

  const restaurantCoords = useMemo(() => {
    const locationCandidates = [
      order?.restaurantLocation,
      order?.restaurantId?.location,
      order?.restaurant?.location,
      order?.seller?.location,
      order?.pickupPoints?.[0]?.location,
      order?.pickupSources?.[0]?.location,
    ];

    for (const loc of locationCandidates) {
      const fromCoords = toPointFromGeoJSON(loc?.coordinates);
      if (fromCoords) return fromCoords;
      const lat = Number(loc?.latitude ?? loc?.lat);
      const lng = Number(loc?.longitude ?? loc?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }

    return null;
  }, [
    order?.restaurantLocation,
    order?.restaurantId?.location,
    order?.restaurant?.location,
    order?.seller?.location,
    order?.pickupPoints,
    order?.pickupSources,
    toPointFromGeoJSON,
  ]);

  const customerCoords = useMemo(() => {
    const coords = order?.address?.coordinates || order?.address?.location?.coordinates;
    const fromCoords = toPointFromGeoJSON(coords);
    if (fromCoords) return fromCoords;
    if (fallbackCustomerCoords && Number.isFinite(fallbackCustomerCoords.lat) && Number.isFinite(fallbackCustomerCoords.lng))
      return fallbackCustomerCoords;
    return null;
  }, [order?.address?.coordinates, order?.address?.location?.coordinates, fallbackCustomerCoords, toPointFromGeoJSON]);

  const deliveryBoyData = useMemo(() => order?.deliveryPartner ? {
    name: order.deliveryPartner.name || 'Delivery Partner',
    avatar: order.deliveryPartner.avatar || null
  } : null, [order?.deliveryPartner]);

  const orderTrackingIdsList = useMemo(() => (
    [order?.orderId, order?.mongoId, order?._id, orderId, order?.id].filter(Boolean)
  ), [order?.orderId, order?.mongoId, order?._id, orderId, order?.id]);

  if (!isVisible || !orderId || !order || (!restaurantCoords && !customerCoords)) {
    return <div className="relative min-h-[450px] bg-gradient-to-b from-gray-100 to-gray-200 dark:from-[#141414] dark:to-[#0a0a0a]" style={{ height: '450px' }} />;
  }

  return (
    <div className="relative w-full min-h-[450px] overflow-visible" style={{ height: '450px' }}>
      <DeliveryTrackingMap
        orderId={orderId}
        orderTrackingIds={orderTrackingIdsList}
        restaurantCoords={restaurantCoords}
        customerCoords={customerCoords}
        userLiveCoords={userLiveCoords}
        userLocationAccuracy={userLocationAccuracy}
        deliveryBoyData={deliveryBoyData}
        order={order}
        onEtaUpdate={onEtaUpdate}
      />
    </div>
  );
});

function getInvoiceActionMeta() {
  // Share only inside the native APK/WebView shell — regular browsers always download.
  const canShare = isNativeAppShell();
  return {
    canShare,
    title: canShare ? "Share invoice" : "Download invoice",
    subtitle: canShare
      ? "Share PDF invoice via WhatsApp or other apps"
      : "Download PDF invoice for this order",
    Icon: canShare ? Share2 : Download,
  };
}

// ─── SectionItem ─────────────────────────────────────────────────────────────
const SECTION_TAP = { scale: 0.99 };
const SectionItem = React.memo(function SectionItem({
  icon: Icon, iconNode, title, subtitle, onClick, showArrow = true, rightContent, truncateSubtitle = true
}) {
  return (
    <motion.button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left border-b border-dashed border-gray-200 dark:border-white/10 last:border-0"
      whileTap={SECTION_TAP}
    >
      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {iconNode ? (
          <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center [&_svg]:w-full [&_svg]:h-full [&_svg]:block">
            {iconNode}
          </div>
        ) : (
          <Icon className="w-5 h-5 text-gray-600 dark:text-slate-400 flex-shrink-0" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-slate-100 truncate">{title}</p>
        {subtitle && <p className={`text-sm text-gray-500 dark:text-slate-400 ${truncateSubtitle ? 'truncate' : ''}`}>{subtitle}</p>}
      </div>
      {rightContent || (showArrow && <ChevronRight className="w-5 h-5 text-gray-400 dark:text-slate-500 flex-shrink-0" />)}
    </motion.button>
  );
});

function asDisplayText(value, fallback = "") {
  if (value == null || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const normalized = String(value).trim();
    return normalized || fallback;
  }
  if (typeof value === "object") {
    const nested =
      value.shopName ||
      value.name ||
      value.title ||
      value.label ||
      value.formattedAddress ||
      value.address ||
      value.street;
    if (nested != null && nested !== value) return asDisplayText(nested, fallback);
  }
  return fallback;
}

function asAddressText(value, fallback = "Address not available") {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || fallback;
  }
  if (typeof value !== "object") return fallback;

  const formatted = String(value.formattedAddress || value.address || "").trim();
  const parts = [
    value.street,
    value.addressLine1,
    value.addressLine2,
    value.landmark,
    value.area,
    value.city,
    value.state,
    value.zipCode || value.pincode || value.postalCode,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  const combined = [formatted, ...parts].filter(Boolean);
  const unique = [];
  combined.forEach((part) => {
    const key = part.toLowerCase();
    if (!unique.some((existing) => existing.toLowerCase() === key || existing.toLowerCase().includes(key) || key.includes(existing.toLowerCase()))) {
      unique.push(part);
    }
  });
  return unique.join(", ") || fallback;
}

// ─── Pure utility functions (module-level, never recreated) ──────────────────
function getRestaurantCoordsFromOrder(apiOrder, fallback = null) {
  const locationCandidates = [
    apiOrder?.restaurantId?.location,
    apiOrder?.restaurant?.location,
    apiOrder?.seller?.location,
    apiOrder?.pickupPoints?.[0]?.location,
    apiOrder?.pickupSources?.[0]?.location,
    apiOrder?.restaurantLocation,
  ];
  for (const loc of locationCandidates) {
    if (Array.isArray(loc?.coordinates) && loc.coordinates.length >= 2) return loc.coordinates;
    if (Number.isFinite(Number(loc?.longitude)) && Number.isFinite(Number(loc?.latitude))) {
      return [Number(loc.longitude), Number(loc.latitude)];
    }
    if (Number.isFinite(Number(loc?.lng)) && Number.isFinite(Number(loc?.lat))) {
      return [Number(loc.lng), Number(loc.lat)];
    }
  }
  return fallback || null;
}

function getRestaurantAddressFromOrder(apiOrder, previousOrder = null, explicitRestaurantAddress = null) {
  if (explicitRestaurantAddress?.trim()) return explicitRestaurantAddress.trim();
  const isQuick =
    String(apiOrder?.orderType || "").toLowerCase() === "quick" ||
    /^QC/i.test(String(apiOrder?.orderId || apiOrder?._id || ""));
  if (isQuick) {
    const sellerAddress = asAddressText(
      apiOrder?.restaurantAddress ||
        apiOrder?.seller?.location?.formattedAddress ||
        apiOrder?.seller?.location?.address ||
        apiOrder?.seller?.address ||
        "",
    );
    if (sellerAddress) return sellerAddress;
  }
  const location = apiOrder?.restaurantId?.location || apiOrder?.restaurant?.location || apiOrder?.seller?.location || {};
  if (location?.formattedAddress?.trim()) return String(location.formattedAddress).trim();
  if (typeof location?.address === "string" && location.address.trim()) return location.address.trim();
  if (location?.addressLine1?.trim()) return String(location.addressLine1).trim();
  const parts = [location?.street, location?.area, location?.city, location?.state, location?.zipCode]
    .map((v) => String(v ?? '').trim()).filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  return asAddressText(
    previousOrder?.restaurantAddress || apiOrder?.restaurantAddress || apiOrder?.restaurant?.address || apiOrder?.seller?.address,
    isQuick ? 'Store location' : 'Restaurant location',
  );
}

function getCustomerCoordsFromApiOrder(apiOrder, previousOrder = null) {
  const addr = apiOrder?.address || apiOrder?.deliveryAddress || {};
  if (Array.isArray(addr?.location?.coordinates) && addr.location.coordinates.length >= 2) return addr.location.coordinates;
  if (Array.isArray(addr?.coordinates) && addr.coordinates.length >= 2) return addr.coordinates;
  const lat = Number(addr?.location?.lat ?? addr?.location?.latitude);
  const lng = Number(addr?.location?.lng ?? addr?.location?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lng, lat];
  const prev = previousOrder?.address?.coordinates || previousOrder?.address?.location?.coordinates;
  if (Array.isArray(prev) && prev.length >= 2) return prev;
  return null;
}

function buildAddressFromPickupPoint(point) {
  const raw = [point?.address, point?.formattedAddress, point?.location?.address, point?.location?.formattedAddress]
    .map((v) => String(v || '').trim()).find(Boolean);
  if (raw) return raw;
  const coords = point?.location?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    const lng = Number(coords[0]), lat = Number(coords[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
  return "";
}

/**
 * Restaurants publish their contact number as `primaryContactNumber`; `phone` and
 * `ownerPhone` only exist on some payloads, so every caller must try all of them.
 */
function resolveRestaurantContactPhone(...sources) {
  for (const source of sources) {
    if (!source) continue;
    const candidates = typeof source === "object"
      ? [
          source.restaurantPhone,
          source.primaryContactNumber,
          source.phone,
          source.contactNumber,
          source.ownerPhone,
          source.contact?.phone,
        ]
      : [source];
    for (const candidate of candidates) {
      const value = String(candidate ?? "").trim();
      if (value) return value;
    }
  }
  return "";
}

function buildPickupSources(apiOrder, previousOrder = null, restaurantAddress = "") {
  const pickupPoints = Array.isArray(apiOrder?.pickupPoints) ? apiOrder.pickupPoints : [];
  const previousSources = Array.isArray(previousOrder?.pickupSources) ? previousOrder.pickupSources : [];
  const normalized = pickupPoints
    .map((point, index) => {
      const pickupType = point?.pickupType === "quick" ? "quick" : "food";
      const fallbackAddress = pickupType === "food" ? (restaurantAddress || previousOrder?.restaurantAddress || "") : "";
      return {
        id: point?.legId || `${pickupType}:${point?.sourceId || index}`,
        pickupType,
        label: pickupType === "quick" ? "Store" : "Restaurant",
        name: String(point?.sourceName || (pickupType === "quick" ? "Seller Store" : apiOrder?.restaurantName || previousOrder?.restaurant || "Restaurant")).trim(),
        address: buildAddressFromPickupPoint(point) || fallbackAddress || "Address not available",
        phone: pickupType === "food"
          ? resolveRestaurantContactPhone(
              apiOrder?.restaurantPhone,
              apiOrder?.restaurantId,
              apiOrder?.restaurant,
              previousOrder?.restaurantPhone,
            )
          : String(point?.phone || point?.contactPhone || '').trim(),
        image: (() => {
          const raw = point?.image
            || (pickupType === "food"
              ? (apiOrder?.restaurantId?.image || apiOrder?.restaurant?.image || apiOrder?.restaurantImage || previousOrder?.restaurantImage || null)
              : (apiOrder?.seller?.shopImage
                || apiOrder?.seller?.image
                || apiOrder?.seller?.shopInfo?.shopImage
                || apiOrder?.restaurantId?.shopImage
                || apiOrder?.restaurantId?.image
                || apiOrder?.restaurantImage
                || previousOrder?.restaurantImage
                || null));
          return resolveQuickImageUrl(raw) || raw || null;
        })(),
      };
    })
    .filter((source) => source.name || source.address);

  if (normalized.length > 0) return normalized;
  if (previousSources.length > 0) return previousSources;
  const isQuick =
    String(apiOrder?.orderType || "").toLowerCase() === "quick" ||
    /^QC/i.test(String(apiOrder?.orderId || apiOrder?._id || ""));
  if (isQuick) {
    const sellerName = String(
      apiOrder?.seller?.shopName ||
        apiOrder?.seller?.name ||
        apiOrder?.restaurantName ||
        previousOrder?.restaurant ||
        "Store",
    ).trim();
    const sellerImage =
      resolveQuickImageUrl(
        apiOrder?.seller?.shopImage ||
          apiOrder?.seller?.image ||
          apiOrder?.restaurantImage ||
          previousOrder?.restaurantImage ||
          null,
      ) ||
      apiOrder?.seller?.shopImage ||
      apiOrder?.restaurantImage ||
      null;
    return [{
      id: "quick:primary",
      pickupType: "quick",
      label: "Store",
      name: sellerName,
      address: asAddressText(
        apiOrder?.seller?.location?.formattedAddress ||
          apiOrder?.seller?.location?.address ||
          apiOrder?.seller?.address ||
          apiOrder?.restaurantAddress ||
          restaurantAddress,
        "Address not available",
      ),
      phone: String(apiOrder?.seller?.phone || apiOrder?.restaurantPhone || "").trim(),
      image: sellerImage,
    }];
  }
  return [{
    id: "food:primary", pickupType: "food", label: "Restaurant",
    name: String(apiOrder?.restaurantName || previousOrder?.restaurant || "Restaurant").trim(),
    address: asAddressText(
      restaurantAddress || previousOrder?.restaurantAddress,
      "Restaurant location",
    ),
    phone: resolveRestaurantContactPhone(
      apiOrder?.restaurantPhone,
      apiOrder?.restaurantId,
      apiOrder?.restaurant,
      previousOrder?.restaurantPhone,
    ),
    image: apiOrder?.restaurantId?.image || apiOrder?.restaurant?.image || apiOrder?.restaurantImage || previousOrder?.restaurantImage || null,
  }];
}

function getPartnerDisplayAvatar(avatar, name = "Delivery Partner") {
  const trimmed = String(avatar || '').trim();
  if (trimmed) return trimmed;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=eff6ff&color=1d4ed8&size=128`;
}

function formatPartnerRating(rating) {
  const n = Number(rating);
  return Number.isFinite(n) && n > 0 ? n.toFixed(1) : "";
}

const formatInvoiceCurrency = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;
const formatInvoiceDateTime = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
};

function normalizeDeliveryPartner(partnerRef, fallbackName = "Delivery Partner") {
  if (!partnerRef) return null;
  if (typeof partnerRef === "string")
    return {
      id: partnerRef,
      name: String(fallbackName || "").trim(),
      phone: "",
      avatar: "",
      rating: null,
      totalRatings: 0,
    };
  const name = String(
    partnerRef?.name || partnerRef?.fullName || partnerRef?.displayName || fallbackName || "",
  ).trim();
  return {
    id: partnerRef?._id || partnerRef?.id || "",
    name,
    phone: String(partnerRef?.phone || partnerRef?.phoneNumber || "").trim(),
    avatar: String(partnerRef?.avatar || partnerRef?.profilePicture || partnerRef?.profileImage || "").trim(),
    rating: Number.isFinite(Number(partnerRef?.rating)) ? Number(partnerRef.rating) : null,
    totalRatings: Number(partnerRef?.totalRatings || 0),
  };
}

function resolveDeliveryPartnerStatusText(apiOrder, { pickupType = "food" } = {}) {
  const raw = String(apiOrder?.orderStatus || apiOrder?.status || "").trim().toLowerCase();
  const isDelivered =
    raw === "delivered" ||
    raw === "completed" ||
    Boolean(apiOrder?.deliveredAt || apiOrder?.deliveryState?.deliveredAt);
  const isCancelled = raw.includes("cancel");

  if (isDelivered) return "Delivered your order";
  if (isCancelled) return "This delivery was cancelled";

  if (raw === "at_drop" || raw === "arrived") return "Arrived at your location";
  if (raw === "on_way" || raw === "out_for_delivery" || raw === "picked_up") {
    return "Out for delivery";
  }
  if (raw === "at_pickup" || raw === "ready" || raw === "picked_up_pending") {
    return pickupType === "quick" ? "At the store for pickup" : "At the restaurant for pickup";
  }
  if (raw === "assigned" || raw === "accepted") {
    return pickupType === "quick"
      ? "Heading to the store for pickup"
      : "Heading to the restaurant for pickup";
  }

  if (pickupType === "quick") return "Handling the store pickup for your order";
  if (pickupType === "food") return "Handling the restaurant pickup for your order";
  return "Assigned to your order";
}

function buildTrackingDeliveryPartners(apiOrder, previousOrder = null) {
  const previousPartners = Array.isArray(previousOrder?.deliveryPartners) ? previousOrder.deliveryPartners : [];
  const legs = Array.isArray(apiOrder?.dispatchPlan?.legs) ? apiOrder.dispatchPlan.legs : [];
  const seen = new Set();

  const normalizedLegPartners = legs.map((leg, index) => {
    const deliveryPartner = normalizeDeliveryPartner(
      leg?.deliveryPartnerId,
      leg?.pickupType === "quick" ? "Store Rider" : "Restaurant Rider",
    );
    if (!deliveryPartner?.id && !deliveryPartner?.name) return null;
    const key = String(leg?.legId || deliveryPartner?.id || `${leg?.pickupType || "delivery"}:${leg?.sourceId || index}`);
    if (seen.has(key)) return null;
    seen.add(key);
    const pickupType = leg?.pickupType === "quick" ? "quick" : "food";
    return {
      id: deliveryPartner?.id || key, legId: leg?.legId || key, pickupType,
      sourceId: leg?.sourceId || null, sourceName: String(leg?.sourceName || '').trim(),
      label: pickupType === "quick" ? "Store pickup" : "Restaurant pickup",
      statusText: resolveDeliveryPartnerStatusText(apiOrder, { pickupType }),
      name: deliveryPartner.name, phone: deliveryPartner.phone, avatar: deliveryPartner.avatar,
      rating: deliveryPartner.rating, totalRatings: deliveryPartner.totalRatings,
    };
  }).filter(Boolean);

  if (normalizedLegPartners.length > 0) return normalizedLegPartners;

  const singlePartner = normalizeDeliveryPartner(
    apiOrder?.deliveryPartner ||
      apiOrder?.deliveryPartnerId ||
      apiOrder?.dispatch?.deliveryPartnerId,
    apiOrder?.deliveryPartnerName || "",
  );
  if (singlePartner && (singlePartner.id || singlePartner.name || singlePartner.phone || apiOrder?.deliveryPartnerName)) {
    if (!singlePartner.name && apiOrder?.deliveryPartnerName) {
      singlePartner.name = String(apiOrder.deliveryPartnerName).trim();
    }
    if (!singlePartner.phone && apiOrder?.deliveryPartnerPhone) {
      singlePartner.phone = String(apiOrder.deliveryPartnerPhone).trim();
    }
    const pickupType =
      String(apiOrder?.orderType || "").toLowerCase() === "quick" ||
      /^QC/i.test(String(apiOrder?.orderId || apiOrder?._id || ""))
        ? "quick"
        : "food";
    return [{
      id: singlePartner.id || "primary-delivery-partner", legId: null, pickupType,
      sourceId: null, sourceName: "", label: "Delivery partner",
      statusText: resolveDeliveryPartnerStatusText(apiOrder, { pickupType }),
      name: singlePartner.name || "Delivery Partner",
      phone: singlePartner.phone,
      avatar: singlePartner.avatar,
      rating: singlePartner.rating, totalRatings: singlePartner.totalRatings,
    }];
  }
  return previousPartners;
}

function transformOrderForTracking(apiOrder, previousOrder = null, explicitRestaurantCoords = null, explicitRestaurantAddress = null) {
  const restaurantCoords = explicitRestaurantCoords || getRestaurantCoordsFromOrder(apiOrder, previousOrder?.restaurantLocation?.coordinates);
  const restaurantAddress = getRestaurantAddressFromOrder(apiOrder, previousOrder, explicitRestaurantAddress);
  const addr = apiOrder?.address || apiOrder?.deliveryAddress || {};
  const customerCoordsResolved = getCustomerCoordsFromApiOrder(apiOrder, previousOrder);
  const pickupSources = buildPickupSources(apiOrder, previousOrder, restaurantAddress);
  const deliveryPartners = buildTrackingDeliveryPartners(apiOrder, previousOrder);
  const primaryDeliveryPartner = deliveryPartners[0] || null;

  return {
    id: apiOrder?.orderId || apiOrder?._id,
    mongoId: apiOrder?._id || null,
    orderId: apiOrder?.orderId || apiOrder?._id,
    restaurant:
      asDisplayText(
        apiOrder?.restaurantName ||
          apiOrder?.seller?.shopName ||
          apiOrder?.seller?.name ||
          previousOrder?.restaurant,
        apiOrder?.orderType === 'quick' || /^QC/i.test(apiOrder?.orderId || apiOrder?._id)
          ? 'Store'
          : 'Restaurant',
      ),
    restaurantName:
      asDisplayText(
        apiOrder?.restaurantName ||
          apiOrder?.seller?.shopName ||
          apiOrder?.seller?.name ||
          previousOrder?.restaurantName ||
          previousOrder?.restaurant,
        null,
      ) || null,
    storeName:
      apiOrder?.storeName ||
      apiOrder?.seller?.shopName ||
      apiOrder?.seller?.name ||
      (String(apiOrder?.orderType || '').toLowerCase() === 'quick' || /^QC/i.test(String(apiOrder?.orderId || apiOrder?._id || ''))
        ? (apiOrder?.restaurantName || previousOrder?.storeName || null)
        : null),
    sellerName: apiOrder?.sellerName || apiOrder?.seller?.shopName || apiOrder?.seller?.name || previousOrder?.sellerName || null,
    seller: apiOrder?.seller || previousOrder?.seller || null,
    orderType: apiOrder?.orderType || previousOrder?.orderType || 'food',
    restaurantPhone: resolveRestaurantContactPhone(
      apiOrder?.restaurantPhone,
      apiOrder?.seller?.phone,
      apiOrder?.seller,
      apiOrder?.restaurantId,
      apiOrder?.restaurant,
      previousOrder?.restaurantPhone,
    ),
    restaurantAddress, restaurantId: apiOrder?.restaurantId || previousOrder?.restaurantId || null,
    userId: apiOrder?.userId || previousOrder?.userId || null,
    userName:
      apiOrder?.userName ||
      apiOrder?.customerName ||
      apiOrder?.userId?.name ||
      apiOrder?.userId?.fullName ||
      apiOrder?.customer?.name ||
      apiOrder?.sellerOrder?.customer?.name ||
      previousOrder?.userName ||
      '',
    customerName:
      apiOrder?.customerName ||
      apiOrder?.userName ||
      apiOrder?.userId?.name ||
      apiOrder?.customer?.name ||
      apiOrder?.sellerOrder?.customer?.name ||
      previousOrder?.customerName ||
      '',
    userPhone:
      apiOrder?.userPhone ||
      apiOrder?.customerPhone ||
      apiOrder?.userId?.phone ||
      apiOrder?.customer?.phone ||
      apiOrder?.sellerOrder?.customer?.phone ||
      previousOrder?.userPhone ||
      '',
    customerPhone:
      apiOrder?.customerPhone ||
      apiOrder?.userPhone ||
      apiOrder?.userId?.phone ||
      apiOrder?.customer?.phone ||
      previousOrder?.customerPhone ||
      '',
    address: {
      label: addr?.label || addr?.type || previousOrder?.address?.label || '',
      type: addr?.type || addr?.label || previousOrder?.address?.type || '',
      name:
        addr?.name ||
        addr?.fullName ||
        apiOrder?.customerName ||
        apiOrder?.userName ||
        apiOrder?.userId?.name ||
        previousOrder?.address?.name ||
        '',
      phone:
        addr?.phone ||
        apiOrder?.customerPhone ||
        apiOrder?.userPhone ||
        apiOrder?.userId?.phone ||
        previousOrder?.address?.phone ||
        '',
      street: addr?.street || addr?.address || previousOrder?.address?.street || '',
      address: addr?.address || addr?.street || previousOrder?.address?.address || '',
      city: addr?.city || previousOrder?.address?.city || '',
      state: addr?.state || previousOrder?.address?.state || '',
      zipCode: addr?.zipCode || addr?.postalCode || previousOrder?.address?.zipCode || '',
      additionalDetails: addr?.additionalDetails || previousOrder?.address?.additionalDetails || '',
      landmark: addr?.landmark || previousOrder?.address?.landmark || '',
      formattedAddress: addr?.formattedAddress ||
        (addr?.street && addr?.city
          ? `${addr.street}${addr.additionalDetails ? `, ${addr.additionalDetails}` : ''}, ${addr.city}${addr.state ? `, ${addr.state}` : ''}${addr.zipCode ? ` ${addr.zipCode}` : ''}`
          : [addr?.street || addr?.address, addr?.additionalDetails, addr?.city, addr?.state, addr?.zipCode || addr?.postalCode]
              .map((part) => String(part || '').trim())
              .filter(Boolean)
              .join(', ') ||
            previousOrder?.address?.formattedAddress ||
            ''),
      coordinates: customerCoordsResolved || addr?.location?.coordinates || previousOrder?.address?.coordinates || null,
      location: addr?.location || previousOrder?.address?.location || null,
    },
    deliveryAddress: apiOrder?.deliveryAddress || previousOrder?.deliveryAddress || null,
    restaurantLocation: { coordinates: restaurantCoords },
    pickupSources,
    restaurantImage:
      apiOrder?.restaurantImage ||
      apiOrder?.seller?.shopImage ||
      apiOrder?.seller?.image ||
      apiOrder?.restaurantId?.shopImage ||
      apiOrder?.restaurantId?.image ||
      previousOrder?.restaurantImage ||
      null,
    items: apiOrder?.items?.map(item => ({
      name: asDisplayText(item.name, "Item"),
      variantName: asDisplayText(item.variantName || item.notes || '', ''),
      quantity: item.quantity,
      price: item.price,
      image: item.image || item.mainImage || null,
      pharmacyDetails: item.pharmacyDetails || null,
      variants: Array.isArray(item.variants) ? item.variants : [],
    })) || previousOrder?.items || [],
    total: apiOrder?.pricing?.total || previousOrder?.total || 0,
    status: apiOrder?.orderStatus || apiOrder?.status || previousOrder?.status || 'pending',
    deliveryPartner: primaryDeliveryPartner || previousOrder?.deliveryPartner || null,
    deliveryPartners,
    deliveryPartnerName:
      asDisplayText(
        primaryDeliveryPartner?.name ||
          apiOrder?.deliveryPartnerName ||
          previousOrder?.deliveryPartnerName ||
          '',
        '',
      ),
    deliveryPartnerPhone:
      primaryDeliveryPartner?.phone ||
      apiOrder?.deliveryPartnerPhone ||
      previousOrder?.deliveryPartnerPhone ||
      '',
    deliveryPartnerId: primaryDeliveryPartner?.id || apiOrder?.deliveryPartnerId?._id || (typeof apiOrder?.deliveryPartnerId === 'object' ? apiOrder?.deliveryPartnerId?.id : apiOrder?.deliveryPartnerId) || apiOrder?.dispatch?.deliveryPartnerId?._id || apiOrder?.dispatch?.deliveryPartnerId || apiOrder?.assignmentInfo?.deliveryPartnerId || null,
    dispatch: apiOrder?.dispatch || previousOrder?.dispatch || null,
    assignmentInfo: apiOrder?.assignmentInfo || previousOrder?.assignmentInfo || null,
    tracking: apiOrder?.tracking || previousOrder?.tracking || {},
    deliveryState: apiOrder?.deliveryState || previousOrder?.deliveryState || null,
    createdAt: apiOrder?.createdAt || previousOrder?.createdAt || null,
    totalAmount: apiOrder?.pricing?.total || apiOrder?.totalAmount || previousOrder?.totalAmount || 0,
    deliveryFee: apiOrder?.pricing?.deliveryFee || apiOrder?.deliveryFee || previousOrder?.deliveryFee || 0,
    quickDeliveryFee: apiOrder?.pricing?.quickDeliveryFee ?? previousOrder?.quickDeliveryFee ?? 0,
    deliveryMode: apiOrder?.deliveryMode || previousOrder?.deliveryMode || "basic",
    etaPromise: apiOrder?.etaPromise || previousOrder?.etaPromise || null,
    sla: apiOrder?.sla || previousOrder?.sla || null,
    gst: apiOrder?.pricing?.tax || apiOrder?.pricing?.gst || apiOrder?.gst || apiOrder?.tax || previousOrder?.gst || 0,
    packagingFee: apiOrder?.pricing?.packagingFee || apiOrder?.packagingFee || previousOrder?.packagingFee || 0,
    platformFee: apiOrder?.pricing?.platformFee || apiOrder?.platformFee || previousOrder?.platformFee || 0,
    discount: apiOrder?.pricing?.discount || apiOrder?.discount || previousOrder?.discount || 0,
    subtotal: apiOrder?.pricing?.subtotal || apiOrder?.subtotal || previousOrder?.subtotal || 0,
    pricing: apiOrder?.pricing || previousOrder?.pricing || {
      subtotal: apiOrder?.pricing?.subtotal || apiOrder?.subtotal || previousOrder?.subtotal || 0,
      packagingFee: apiOrder?.pricing?.packagingFee || apiOrder?.packagingFee || previousOrder?.packagingFee || 0,
      platformFee: apiOrder?.pricing?.platformFee || apiOrder?.platformFee || previousOrder?.platformFee || 0,
      deliveryFee: apiOrder?.pricing?.deliveryFee || apiOrder?.deliveryFee || previousOrder?.deliveryFee || 0,
      tax: apiOrder?.pricing?.tax || apiOrder?.pricing?.gst || apiOrder?.gst || previousOrder?.gst || 0,
      gst: apiOrder?.pricing?.gst || apiOrder?.pricing?.tax || apiOrder?.gst || previousOrder?.gst || 0,
      discount: apiOrder?.pricing?.discount || apiOrder?.discount || previousOrder?.discount || 0,
      total: apiOrder?.pricing?.total || apiOrder?.totalAmount || previousOrder?.totalAmount || 0,
    },
    paymentMethod: asDisplayText(
      apiOrder?.paymentMethod || apiOrder?.payment?.method || previousOrder?.paymentMethod || null,
      '',
    ) || null,
    paymentStatus: apiOrder?.paymentStatus || apiOrder?.payment?.status || previousOrder?.paymentStatus || null,
    payment: apiOrder?.payment || previousOrder?.payment || null,
    ratings: (() => {
      const apiRatings = apiOrder?.ratings;
      if (apiRatings?.seller) {
        return {
          ...apiRatings,
          restaurant: apiRatings.seller,
        };
      }
      return apiRatings || previousOrder?.ratings || null;
    })(),
    deliveryVerification: (() => {
      const prevDV = previousOrder?.deliveryVerification || null;
      const apiDV = apiOrder?.deliveryVerification || null;
      const handoverOtp = apiOrder?.handoverOtp || null;
      if (!prevDV && !apiDV && !handoverOtp) return null;
      const prevDropOtp = prevDV?.dropOtp || null;
      const apiDropOtp = apiDV?.dropOtp || null;
      const merged = { ...(prevDV || {}), ...(apiDV || {}) };
      const finalCode = handoverOtp || prevDropOtp?.code || apiDropOtp?.code;
      if (finalCode || prevDropOtp?.required || apiDropOtp?.required) {
        merged.dropOtp = { ...(prevDropOtp || {}), ...(apiDropOtp || {}), code: finalCode };
      }
      return merged;
    })(),
    deliveredAt:
      apiOrder?.deliveryState?.deliveredAt ||
      apiOrder?.deliveredAt ||
      previousOrder?.deliveredAt ||
      null,
    returnEligibility:
      apiOrder?.returnEligibility ||
      (apiOrder?.returnWindowHours != null
        ? {
            canReturn: apiOrder.canReturn,
            returnsEnabled: apiOrder.returnsEnabled,
            returnWindowHours: apiOrder.returnWindowHours,
            returnExpiryAt: apiOrder.returnExpiryAt,
            deliveredAt: apiOrder.deliveredAt,
            remainingSeconds: apiOrder.remainingSeconds,
            remainingHours: apiOrder.remainingHours,
            returnWindowExpired: apiOrder.returnWindowExpired,
            itemEligibility: apiOrder.itemEligibility || {},
          }
        : previousOrder?.returnEligibility || null),
    returnStatus: apiOrder?.returnStatus || previousOrder?.returnStatus || '',
    returnStatusLabel: apiOrder?.returnStatusLabel || previousOrder?.returnStatusLabel || '',
    hasReturn: Boolean(apiOrder?.hasReturn ?? previousOrder?.hasReturn ?? apiOrder?.returnStatus),
    returnSummary: apiOrder?.returnSummary || previousOrder?.returnSummary || null,
    returns: Array.isArray(apiOrder?.returns) ? apiOrder.returns : (previousOrder?.returns || []),
    originalPaidTotal: Number(
      apiOrder?.originalPaidTotal ?? previousOrder?.originalPaidTotal ?? apiOrder?.pricing?.total ?? 0,
    ),
    refundedAmount: Number(apiOrder?.refundedAmount ?? previousOrder?.refundedAmount ?? 0),
    netAfterReturn: Number(
      apiOrder?.netAfterReturn ??
        previousOrder?.netAfterReturn ??
        apiOrder?.pricing?.total ??
        0,
    ),
  };
}

// ─── Status mapping (module-level, pure) ─────────────────────────────────────
function mapBackendOrderStatusToUi(raw) {
  const s = String(raw || "").toLowerCase();
  if (!s || s === "pending" || s === "created") return "placed";
  if (s === "placed") return "placed";
  if (s === "scheduled") return "scheduled";
  if (s === "confirmed" || s === "accepted") return "confirmed";
  if (s === "preparing" || s === "processed") return "preparing";
  if (s === "ready" || s === "ready_for_pickup" || s === "reached_pickup" || s === "order_confirmed") return "ready";
  if (s === "picked_up" || s === "out_for_delivery" || s === "en_route_to_delivery") return "on_way";
  if (s === "reached_drop" || s === "at_drop" || s === "at_delivery") return "at_drop";
  if (s === "delivered" || s === "completed") return "delivered";
  if (s.includes("cancelled") || s === "cancelled") return "cancelled";
  return "placed";
}

function mapOrderToTrackingUiStatus(orderLike) {
  if (!orderLike) return "placed";

  // Phase 1 SSOT: stage from orderLifecycle; UI key for layout only.
  const life = getLifecycleDisplay(orderLike, { audience: "user" });
  if (life) {
    return lifecycleStageToTrackingUi(life.stage);
  }

  const statusRaw = orderLike.status || orderLike.orderStatus;
  const phase = orderLike.deliveryState?.currentPhase;
  if (isFoodOrderCancelledStatus(statusRaw)) return "cancelled";
  if (statusRaw === "delivered" || statusRaw === "completed") return "delivered";
  const isRiderAccepted = orderLike.dispatch?.status === "accepted" || orderLike.assignmentInfo?.status === "accepted" || orderLike.deliveryPartner?.status === "accepted";
  if (phase === "reached_drop" || phase === "at_drop" || statusRaw === "at_drop") return "at_drop";
  if (phase === "en_route_to_delivery" || statusRaw === "picked_up" || statusRaw === "out_for_delivery") return "on_way";
  if (phase === "at_pickup" && orderLike.deliveryPartnerId && isRiderAccepted) return "at_pickup";
  if (phase === "en_route_to_pickup" && orderLike.deliveryPartnerId && isRiderAccepted) return "assigned";
  return mapBackendOrderStatusToUi(statusRaw);
}

function isFoodOrderCancelledStatus(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  return s === "cancelled" || s.includes("cancelled");
}

function normalizeLookupId(value) {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw || raw === "undefined" || raw === "null") return "";
  return raw;
}

function extractOrderDetailsPayload(response) {
  if (response?.data?.success && response?.data?.result && typeof response.data.result === "object") return response.data.result;
  if (response?.data?.success && response?.data?.data?.order) return response.data.data.order;
  if (response?.data?.order && typeof response.data.order === "object") return response.data.order;
  if (response?.data?.data && typeof response.data.data === "object" && !Array.isArray(response.data.data))
    return response.data.data.order || response.data.data;
  // For quick commerce, if response.data is the order itself
  if (response?.data && typeof response.data === "object" && !Array.isArray(response.data) && !response.data.success) {
    return response.data;
  }
  return null;
}

function normalizeQuickWorkflowStatus(rawStatus) {
  const status = String(rawStatus || "").trim().toUpperCase();
  if (!status) return null;
  if (status === "CREATED" || status === "PENDING" || status === "SELLER_PENDING") return "created";
  if (status === "CONFIRMED" || status === "ACCEPTED") return "confirmed";
  if (status === "PACKING" || status === "PREPARING" || status === "PROCESSING") return "preparing";
  if (status === "READY" || status === "READY_FOR_PICKUP") return "ready_for_pickup";
  if (status === "OUT_FOR_DELIVERY" || status === "PICKED_UP") return "out_for_delivery";
  if (status === "DELIVERED" || status === "COMPLETED") return "delivered";
  if (status.includes("CANCEL")) return "cancelled";
  return status.toLowerCase();
}

function isRefundablePrepaidOrder(order) {
  if (!order) return false;
  const method = String(order?.payment?.method || order?.paymentMethod || "").trim().toLowerCase();
  const status = String(order?.payment?.status || order?.paymentStatus || "").trim().toLowerCase();

  if (["cash", "cod"].includes(method)) return false;

  const hasRazorpayPaymentId = Boolean(order?.payment?.razorpay?.paymentId);
  const hasRazorpayOrderId = Boolean(order?.payment?.razorpay?.orderId);
  const isPaid = ["paid", "refunded"].includes(status);
  const isOnlineMethod = ["razorpay", "razorpay_qr", "online", "upi", "card"].includes(method);

  if (isPaid && (isOnlineMethod || hasRazorpayPaymentId || hasRazorpayOrderId)) return true;
  if (hasRazorpayPaymentId && !["failed", "cancelled"].includes(status)) return true;

  return false;
}

function isQuickOrderOnlinePayment(order, confirmedCheckout = false) {
  if (!order) return false;
  const method = String(order?.payment?.method || order?.paymentMethod || "").trim().toLowerCase();
  if (["cash", "cod"].includes(method)) return false;
  if (confirmedCheckout) return true;
  if (isRefundablePrepaidOrder(order)) return true;
  if (Boolean(order?.payment?.razorpay?.paymentId || order?.payment?.razorpay?.orderId)) return true;
  if (["razorpay", "razorpay_qr", "online", "upi", "card"].includes(method)) return true;
  return false;
}

function normalizeQuickOrderForTracking(rawOrder) {
  if (!rawOrder || typeof rawOrder !== "object") return rawOrder;
  const seller = rawOrder.seller || rawOrder.store || rawOrder.storeId || rawOrder.sellerId || {};
  const sellerCoords = Array.isArray(seller?.location?.coordinates)
    ? seller.location.coordinates
    : Number.isFinite(Number(seller?.location?.lng)) && Number.isFinite(Number(seller?.location?.lat))
      ? [Number(seller.location.lng), Number(seller.location.lat)] : null;
  const sellerName = String(
    rawOrder.storeName ||
      rawOrder.sellerName ||
      seller?.shopName ||
      seller?.name ||
      seller?.storeName ||
      "Store",
  ).trim();
  const sellerAddress = asAddressText(
    seller?.location?.formattedAddress ||
      seller?.location?.address ||
      seller?.address ||
      rawOrder.restaurantAddress ||
      "",
  );
  const sellerPhone = String(
    seller?.phone || seller?.phoneNumber || seller?.shopInfo?.alternatePhone || "",
  ).trim();
  const sellerImageRaw = String(
    seller?.shopImage ||
      seller?.image ||
      seller?.shopInfo?.shopImage ||
      rawOrder.storeImage ||
      rawOrder.restaurantImage ||
      "",
  ).trim();
  const sellerImage = resolveQuickImageUrl(sellerImageRaw) || sellerImageRaw || null;
  const address = rawOrder.address || rawOrder.deliveryAddress || {};
  const addressCoords = Array.isArray(address?.location?.coordinates) ? address.location.coordinates
    : Number.isFinite(Number(address?.location?.lng)) && Number.isFinite(Number(address?.location?.lat))
      ? [Number(address.location.lng), Number(address.location.lat)]
      : Number.isFinite(Number(address?.location?.lat)) && Number.isFinite(Number(address?.location?.lng))
        ? [Number(address.location.lng), Number(address.location.lat)]
        : null;
  const deliveryPartner = rawOrder.deliveryPartnerId || rawOrder.deliveryPartner || rawOrder.deliveryBoy || rawOrder.rider || null;
  const restaurantLikeSeller = {
    ...(typeof seller === "object" && seller ? seller : {}),
    _id: seller?._id || seller?.id || rawOrder.sellerId || rawOrder.storeId || null,
    name: sellerName,
    shopName: sellerName,
    phone: sellerPhone,
    image: sellerImage,
    shopImage: sellerImage,
    location: seller?.location || null,
  };
  const restaurantIdValue =
    rawOrder.restaurantId && typeof rawOrder.restaurantId === "object"
      ? rawOrder.restaurantId
      : restaurantLikeSeller._id
        ? restaurantLikeSeller
        : rawOrder.restaurantId || null;
  return {
    ...rawOrder, orderType: "quick",
    restaurantName: rawOrder.restaurantName || sellerName,
    restaurantPhone: rawOrder.restaurantPhone || sellerPhone,
    restaurantImage: sellerImage || rawOrder.restaurantImage || null,
    restaurantId: restaurantIdValue,
    restaurantAddress: rawOrder.restaurantAddress || sellerAddress,
    status: rawOrder.status || rawOrder.orderStatus || normalizeQuickWorkflowStatus(rawOrder.workflowStatus) || "created",
    orderStatus: rawOrder.orderStatus || normalizeQuickWorkflowStatus(rawOrder.workflowStatus) || rawOrder.status || "created",
    note: asDisplayText(rawOrder.note, ""),
    address: {
      ...address,
      street: address?.street || address?.address || "",
      formattedAddress: address?.formattedAddress || address?.address || [address?.street, address?.city, address?.state, address?.zipCode].filter(Boolean).join(", "),
      location: addressCoords && !address?.location?.coordinates ? { ...(address.location || {}), coordinates: addressCoords } : address.location,
    },
    pickupPoints: Array.isArray(rawOrder.pickupPoints) && rawOrder.pickupPoints.length > 0
      ? rawOrder.pickupPoints.map((point) => ({
          ...point,
          image: point?.image || sellerImage || null,
          phone: point?.phone || sellerPhone || "",
          address: asAddressText(point?.address || sellerAddress || point?.formattedAddress || "", ""),
        }))
      : [{
        pickupType: "quick",
        sourceId: seller?._id || seller?.id || rawOrder.sellerId || rawOrder.storeId || "quick-store",
        sourceName: sellerName,
        phone: sellerPhone,
        address: sellerAddress,
        image: sellerImage,
        location: sellerCoords ? { coordinates: sellerCoords, formattedAddress: sellerAddress, address: sellerAddress } : undefined,
      }],
    deliveryPartnerId: rawOrder.deliveryPartnerId || deliveryPartner || null,
    paymentMethod: asDisplayText(rawOrder.paymentMethod || rawOrder.payment?.method || "", ""),
    paymentStatus: rawOrder.paymentStatus || rawOrder.payment?.status || "",
    payment: rawOrder.payment || {},
  };
}

// ─── Stable STATUS CONFIG (module-level, never recreated) ────────────────────
const STATUS_CONFIG_TEMPLATE = {
  scheduled: { title: "Order Scheduled", color: "bg-blue-600", iconType: 'food' },
  placed: { title: "Order Placed", color: "bg-red-600", iconType: 'food' },
  confirmed: { title: "Order Confirmed", color: "bg-red-600", iconType: 'food' },
  preparing: { title: null /* dynamic */, color: "bg-red-600", iconType: 'food' },
  assigned: { title: "Rider is arriving", color: "bg-red-600", iconType: 'rider' },
  at_pickup: { title: null /* dynamic */, color: "bg-red-600", iconType: 'rider' },
  ready: { title: "Handover in progress", color: "bg-red-600", iconType: 'rider' },
  on_way: { title: "Out for delivery", color: "bg-red-600", iconType: 'rider' },
  at_drop: { title: "Arrived at location", subtitle: "Please come to the door", color: "bg-red-600", iconType: 'rider' },
  delivered: { title: "Order delivered", color: "bg-red-600", iconType: 'delivered' },
  cancelled: { title: "Order cancelled", subtitle: "This order has been cancelled", color: "bg-red-600", iconType: 'cancelled' },
};

// ─── Stable motion props (module-level) ──────────────────────────────────────
const MOTION_FADE = { initial: { opacity: 0 }, animate: { opacity: 1 } };
const MOTION_SLIDE_UP = (delay) => ({ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay } });
const RIDER_SVG_STYLE = { width: "100%", height: "100%" };

// ─── localStorage helpers (lazy init, debounced write) ───────────────────────
function loadShownRatings() {
  try {
    const stored = localStorage.getItem('shownRatingForOrders');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch { return new Set(); }
}

let _saveRatingsTimer = null;
function saveShownRatings(set) {
  if (_saveRatingsTimer) clearTimeout(_saveRatingsTimer);
  _saveRatingsTimer = setTimeout(() => {
    try { localStorage.setItem('shownRatingForOrders', JSON.stringify(Array.from(set))); } catch { }
  }, 500);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OrderTracking() {
  const companyName = useCompanyName();
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const confirmed = searchParams.get("confirmed") === "true";
  const prefetchedOrder = location.state?.prefetchedOrder || location.state?.order || null;
  const isQuickOrder =
    String(location.state?.orderType || "").toLowerCase() === "quick" ||
    String(location.pathname || "").startsWith("/quick/orders/") ||
    /^QC/i.test(String(orderId || ""));
  const backPath = isQuickOrder ? "/quick" : "/food/user";

  const ordersContext = useOptionalOrders();
  // Must be referentially stable: an inline `() => null` would change every render,
  // re-trigger the poll effect, and leave this page stuck on "Loading order details...".
  const getOrderById = ordersContext?.getOrderById || NOOP_GET_ORDER_BY_ID;
  const getOrderByIdRef = useRef(getOrderById);
  getOrderByIdRef.current = getOrderById;
  const { userProfile, getDefaultAddress } = useProfile();
  const profile = userProfile;
  const { isAuthenticated, user: authUser } = useAuth();
  const { location: userLiveLocation } = useUserLocation();
  const { isConnected: isSocketConnected } = useUserNotifications();

  // ── Core order state ────────────────────────────────────────────────────────
  const [order, setOrder] = useState(() => {
    try {
      if (!prefetchedOrder) return null;
      return transformOrderForTracking(
        isQuickOrder ? normalizeQuickOrderForTracking(prefetchedOrder) : prefetchedOrder,
      );
    } catch (err) {
      debugError("Failed to hydrate prefetched order", err);
      return null;
    }
  });
  const isQuickCommerceOrder = useMemo(() => {
    const orderType = String(
      order?.orderType || prefetchedOrder?.orderType || location.state?.orderType || "",
    ).toLowerCase();
    return isQuickOrder || orderType === "quick" || orderType === "mixed";
  }, [isQuickOrder, order?.orderType, prefetchedOrder?.orderType, location.state?.orderType]);
  const [loading, setLoading] = useState(() => !prefetchedOrder);
  const [initialLoadDone, setInitialLoadDone] = useState(() => Boolean(prefetchedOrder));
  const [error, setError] = useState(null);
  const orderRef = useRef(order);
  orderRef.current = order;

  // ── UI state ────────────────────────────────────────────────────────────────
  const [showConfirmation, setShowConfirmation] = useState(confirmed);
  const [orderStatus, setOrderStatus] = useState(() => {
    try {
      return prefetchedOrder
        ? mapOrderToTrackingUiStatus(isQuickOrder ? normalizeQuickOrderForTracking(prefetchedOrder) : prefetchedOrder)
        : 'placed';
    } catch {
      return 'placed';
    }
  });
  const [estimatedTime, setEstimatedTime] = useState(29);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showSafetyDialog, setShowSafetyDialog] = useState(false);
  const [cancellationNotice, setCancellationNotice] = useState(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const invoiceAction = useMemo(() => getInvoiceActionMeta(), []);
  const [cancellationReason, setCancellationReason] = useState("");
  const [refundDestination, setRefundDestination] = useState("gateway");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [activeReturnCount, setActiveReturnCount] = useState(0);
  const handleReturnRefresh = useCallback((items, meta) => {
    const active = (items || []).filter((r) =>
      [
        RETURN_STATUS.REQUESTED,
        RETURN_STATUS.APPROVED,
        RETURN_STATUS.PICKUP_ASSIGNED,
        RETURN_STATUS.IN_TRANSIT,
        RETURN_STATUS.RETURNED,
      ].includes(r.returnStatus),
    );
    setActiveReturnCount(active.length);
    const nextEligibility = meta?.returnEligibility || meta;
    if (nextEligibility?.returnWindowHours != null || nextEligibility?.returnExpiryAt) {
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              returnEligibility: {
                ...(prev.returnEligibility || {}),
                ...nextEligibility,
              },
            }
          : prev,
      );
    }
  }, []);
  const [isUpdatingInstructions, setIsUpdatingInstructions] = useState(false);
  const [resolvedLookupId, setResolvedLookupId] = useState("");
  const [timerNow, setTimerNow] = useState(Date.now);

  // ── Rating state (grouped) ──────────────────────────────────────────────────
  const [ratingModal, setRatingModal] = useState({ open: false, order: null });
  const [selectedRestaurantRating, setSelectedRestaurantRating] = useState(null);
  const [selectedDeliveryRating, setSelectedDeliveryRating] = useState(null);
  const [restaurantFeedbackText, setRestaurantFeedbackText] = useState("");
  const [deliveryFeedbackText, setDeliveryFeedbackText] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  // Use ref for tracking shown ratings to avoid localStorage read on every render
  const shownRatingForOrdersRef = useRef(null);
  if (shownRatingForOrdersRef.current === null) shownRatingForOrdersRef.current = loadShownRatings();

  // ── Socket OTP ──────────────────────────────────────────────────────────────
  const [socketDropOtpCode, setSocketDropOtpCode] = useState(null);

  // ── Refs (stable across renders) ────────────────────────────────────────────
  const lastRealtimeRefreshRef = useRef(0);
  const confirmationShownAtRef = useRef(confirmed ? Date.now() : 0);
  const trackingOrderIdsRef = useRef(new Set());
  const terminalPollStopRef = useRef(false);
  const lookupIdsRef = useRef([]);
  const pollRef = useRef(null);
  const initialPollGenerationRef = useRef(0);

  // ── Derived values ───────────────────────────────────────────────────────────
  const defaultAddress = getDefaultAddress();

  // Keep lookupIds ref up to date without triggering re-renders
  useEffect(() => {
    const ids = [resolvedLookupId, orderId, order?.orderId, order?.mongoId, order?._id, order?.id]
      .map(normalizeLookupId).filter(Boolean);
    lookupIdsRef.current = Array.from(new Set(ids));
  }, [orderId, resolvedLookupId, order?.orderId, order?.mongoId, order?._id, order?.id]);

  // Keep tracking IDs set up to date
  useEffect(() => {
    const s = trackingOrderIdsRef.current;
    s.add(String(orderId));
    if (order?.orderId) s.add(String(order.orderId));
    if (order?.mongoId) s.add(String(order.mongoId));
    if (order?.id) s.add(String(order.id));
  }, [orderId, order?.orderId, order?.mongoId, order?.id]);

  // Stable API ops - kept in ref so polling closure always uses latest without re-creating interval
  const stableOpsRef = useRef({
    resolveOrderFromList: async () => null,
    fetchOrderDetailsWithFallback: async () => {
      throw new Error("Order fetch not ready");
    },
  });

  useEffect(() => {
    stableOpsRef.current = {
      resolveOrderFromList: async (rawLookupId) => {
        const needle = normalizeLookupId(rawLookupId);
        if (!needle || isQuickOrder) return null;
        const maxPages = 3, limit = 50;
        for (let page = 1; page <= maxPages; page++) {
          const listResponse = await orderAPI.getOrders({ page, limit });
          let orders = [];
          if (listResponse?.data?.success && listResponse?.data?.data?.orders) orders = listResponse.data.data.orders || [];
          else if (listResponse?.data?.orders) orders = listResponse.data.orders || [];
          else if (Array.isArray(listResponse?.data?.data?.data)) orders = listResponse.data.data.data || [];
          else if (Array.isArray(listResponse?.data?.data)) orders = listResponse.data.data || [];
          const matched = (orders || []).find((o) =>
            [o?._id, o?.id, o?.orderId, o?.mongoId].map(normalizeLookupId).includes(needle)
          );
          if (matched) return matched;
          const totalPages = Number(listResponse?.data?.data?.pagination?.pages) || Number(listResponse?.data?.data?.totalPages) || 1;
          if (page >= totalPages) break;
        }
        return null;
      },
      fetchOrderDetailsWithFallback: async (options = {}) => {
        const ids = lookupIdsRef.current;
        if (ids.length === 0) throw new Error("Order id required");
        let lastError = null;
        for (const id of ids) {
          try {
            return isQuickOrder
              ? await customerApi.getOrderDetails(id, options)
              : await orderAPI.getOrderDetails(id, options);
          } catch (err) {
            lastError = err;
            if (err?.response?.status === 400 || err?.response?.status === 404) continue;
            throw err;
          }
        }
        throw lastError || new Error("Failed to fetch order details");
      },
    };
  }, [isQuickOrder]);

  const resolveOrderFromList = useCallback((id) => stableOpsRef.current.resolveOrderFromList(id), []);
  const fetchOrderDetailsWithFallback = useCallback((opts) => stableOpsRef.current.fetchOrderDetailsWithFallback(opts), []);

  // ── Memoized derived values ──────────────────────────────────────────────────
  const fallbackCustomerCoords = useMemo(() => {
    const orderCoords = order?.address?.coordinates || order?.address?.location?.coordinates;
    if (Array.isArray(orderCoords) && orderCoords.length >= 2) {
      const [lng, lat] = [Number(orderCoords[0]), Number(orderCoords[1])];
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    const defaultCoords = defaultAddress?.location?.coordinates;
    if (Array.isArray(defaultCoords) && defaultCoords.length >= 2) {
      const [lng, lat] = [Number(defaultCoords[0]), Number(defaultCoords[1])];
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    const liveLat = Number(userLiveLocation?.latitude), liveLng = Number(userLiveLocation?.longitude);
    if (Number.isFinite(liveLat) && Number.isFinite(liveLng)) return { lat: liveLat, lng: liveLng };
    return null;
  }, [order?.address?.coordinates, order?.address?.location?.coordinates, defaultAddress?.location?.coordinates, userLiveLocation?.latitude, userLiveLocation?.longitude]);

  const userLiveCoords = useMemo(() => {
    const lat = Number(userLiveLocation?.latitude), lng = Number(userLiveLocation?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }, [userLiveLocation?.latitude, userLiveLocation?.longitude]);

  const isAdminAccepted = useMemo(() => (
    ["confirmed", "preparing", "ready", "ready_for_pickup", "picked_up"].includes(order?.status)
  ), [order?.status]);

  const showRefundDestinationChoice = useMemo(() => {
    if (!order) return false;
    const method = String(order?.payment?.method || order?.paymentMethod || "").trim().toLowerCase();
    if (method === "wallet") return false;
    if (isQuickOrder) return isQuickOrderOnlinePayment(order, confirmed);
    return isRefundablePrepaidOrder(order) && ["razorpay", "razorpay_qr", "online"].includes(method);
  }, [isQuickOrder, order, confirmed]);

  const canUseWalletRefund = useMemo(() => Boolean(
    isAuthenticated ||
    authUser?._id ||
    authUser?.id ||
    authUser?.userId ||
    order?.userId,
  ), [isAuthenticated, authUser, order?.userId]);

  const acceptedAtMs = useMemo(() => {
    const ts = order?.tracking?.confirmed?.timestamp || order?.tracking?.preparing?.timestamp || order?.updatedAt || order?.createdAt;
    const parsed = ts ? new Date(ts).getTime() : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  }, [order?.tracking?.confirmed?.timestamp, order?.tracking?.preparing?.timestamp, order?.updatedAt, order?.createdAt]);

  const editWindowRemainingMs = useMemo(() => {
    if (!isAdminAccepted || !acceptedAtMs) return 0;
    return Math.max(0, 60000 - (timerNow - acceptedAtMs));
  }, [isAdminAccepted, acceptedAtMs, timerNow]);

  const isEditWindowOpen = editWindowRemainingMs > 0;

  const editWindowText = useMemo(() => {
    const total = Math.ceil(editWindowRemainingMs / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }, [editWindowRemainingMs]);

  const pickupSources = useMemo(() => (
    Array.isArray(order?.pickupSources) ? order.pickupSources.filter((s) => s?.name || s?.address) : []
  ), [order?.pickupSources]);

  const customerDeliveryOtp = useMemo(() => {
    const rawDropOtp = order?.deliveryVerification?.dropOtp;
    const primitiveDropOtp = typeof rawDropOtp === "string" || typeof rawDropOtp === "number" ? rawDropOtp : null;
    const code = order?.deliveryVerification?.dropOtp?.code ?? order?.handoverOtp ?? order?.deliveryOtp ?? primitiveDropOtp ?? socketDropOtpCode;
    return code ? String(code) : null;
  }, [order?.deliveryVerification?.dropOtp?.code, order?.deliveryVerification?.dropOtp, order?.handoverOtp, order?.deliveryOtp, socketDropOtpCode]);

  const isFoodQuick = isFoodQuickOrder(order);
  const quickPromiseLabel = formatQuickEtaWindow(order?.etaPromise);

  // Build status config dynamically only when relevant values change
  const currentStatus = useMemo(() => {
    const template = STATUS_CONFIG_TEMPLATE[orderStatus] || STATUS_CONFIG_TEMPLATE.placed;
    const withDefaults = {
      ...template,
      title: template.title || "Order update",
      subtitle: template.subtitle || "Updating your order status",
    };
    const life = getLifecycleDisplay(order, { audience: "user" });
    if (life) {
      return {
        ...withDefaults,
        title: life.title || withDefaults.title,
        subtitle: life.subtitle || withDefaults.subtitle,
      };
    }

    const arriveBy =
      isFoodQuick && quickPromiseLabel
        ? `Quick promise ${quickPromiseLabel}`
        : typeof estimatedTime === "number"
          ? `Arriving in ${estimatedTime} mins`
          : null;
    switch (orderStatus) {
      case 'scheduled': return { ...withDefaults, subtitle: isQuickOrder ? "Your order is scheduled. Please wait for the store to respond." : "Your order is scheduled. Please wait for the restaurant to respond." };
      case 'placed': return { ...withDefaults, subtitle: isQuickOrder ? "Waiting for store to accept" : (isFoodQuick ? "Quick order waiting for restaurant" : "Waiting for restaurant to accept") };
      case 'confirmed': return { ...withDefaults, subtitle: isQuickOrder ? "Store has accepted your order" : (isFoodQuick ? "Quick order accepted — kitchen prioritized" : "Restaurant has accepted your order") };
      case 'preparing': return { ...withDefaults, title: isQuickOrder ? "Items are being packed" : (isFoodQuick ? "Quick prep in progress" : "Food is being prepared"), subtitle: arriveBy || (isQuickOrder ? "Packing your items" : "Cooking your meal") };
      case 'assigned': return { ...withDefaults, subtitle: isQuickOrder ? "A delivery partner is arriving at the store" : (isFoodQuick ? "Priority rider heading to restaurant" : "A delivery partner is arriving at the restaurant") };
      case 'at_pickup': return { ...withDefaults, title: isQuickOrder ? "Rider at store" : "Rider at restaurant", subtitle: "Rider is waiting for your order" };
      case 'ready': return { ...withDefaults, subtitle: "Rider is picking up your order" };
      case 'on_way': return { ...withDefaults, subtitle: arriveBy || "Rider is out for delivery" };
      case 'delivered': {
        const returnLabel =
          order?.returnStatusLabel ||
          (order?.returnStatus ? String(order.returnStatus).replace(/_/g, ' ') : '');
        const refunded = Number(order?.refundedAmount || order?.returnSummary?.refundedAmount || 0);
        const subtitle = returnLabel
          ? refunded > 0
            ? `Delivered · ${returnLabel} · refund ₹${refunded.toFixed(0)}`
            : `Delivered · ${returnLabel}`
          : isQuickOrder
            ? "Enjoy your purchase!"
            : (order?.sla?.breached && Number(order?.sla?.compensationAmount) > 0
              ? `Delivered · SLA credit ₹${Math.round(Number(order.sla.compensationAmount))}`
              : "Enjoy your meal!");
        return { ...withDefaults, subtitle };
      }
      default: return withDefaults;
    }
  }, [orderStatus, isQuickOrder, isFoodQuick, quickPromiseLabel, estimatedTime, order?.sla, order]);

  const isDeliveredOrder = useMemo(() => (
    orderStatus === "delivered" || order?.status === "delivered" || Boolean(order?.deliveredAt)
  ), [orderStatus, order?.status, order?.deliveredAt]);

  const liveReturnEligibility = useMemo(
    () => resolveLiveReturnEligibility(order?.returnEligibility, timerNow),
    [order?.returnEligibility, timerNow],
  );

  const canRequestReturn = Boolean(liveReturnEligibility?.canReturn);

  const visibleDeliveryPartners = useMemo(() => (
    Array.isArray(order?.deliveryPartners) ? order.deliveryPartners.filter(Boolean) : []
  ), [order?.deliveryPartners]);

  const hasMultipleDeliveryPartners = visibleDeliveryPartners.length > 1;

  const hasActiveDeliveryTracking = useMemo(() => (
    visibleDeliveryPartners.length > 0 ||
    Boolean(order?.deliveryPartnerId) ||
    Boolean(order?.deliveryState?.currentLocation) ||
    ['assigned', 'at_pickup', 'ready', 'on_way', 'at_drop', 'delivered'].includes(orderStatus)
  ), [visibleDeliveryPartners.length, order?.deliveryPartnerId, order?.deliveryState?.currentLocation, orderStatus]);

  const previewPickupSource = pickupSources[0] || null;
  const previewPickupLabel = useMemo(() => (
    previewPickupSource?.pickupType === 'quick' ? 'Store' : order?.orderType === 'mixed' ? 'Pickup point' : 'Restaurant'
  ), [previewPickupSource?.pickupType, order?.orderType]);

  const previewPickupAddress = asAddressText(
    previewPickupSource?.address || order?.restaurantAddress,
    'Preparing pickup location',
  );
  const previewDropAddress = useMemo(() => (
    order?.address?.formattedAddress ||
    [order?.address?.street, order?.address?.additionalDetails, order?.address?.city, order?.address?.state, order?.address?.zipCode].filter(Boolean).join(', ') ||
    'Preparing delivery address'
  ), [order?.address]);

  const deliveryAddressSubtitle = useMemo(() => {
    if (order?.address?.formattedAddress && order.address.formattedAddress !== "Select location")
      return order.address.formattedAddress;
    if (order?.address) {
      const parts = [order.address.street, order.address.additionalDetails, order.address.city, order.address.state, order.address.zipCode].filter(Boolean);
      if (parts.length > 0) return parts.join(', ');
    }
    if (defaultAddress?.formattedAddress && defaultAddress.formattedAddress !== "Select location")
      return defaultAddress.formattedAddress;
    if (defaultAddress) {
      const parts = [defaultAddress.street, defaultAddress.additionalDetails, defaultAddress.city, defaultAddress.state, defaultAddress.zipCode].filter(Boolean);
      if (parts.length > 0) return parts.join(', ');
    }
    return 'Add delivery address';
  }, [order?.address, defaultAddress]);

  const customerPinNode = useMemo(() => (
    <div dangerouslySetInnerHTML={{ __html: SAFE_CUSTOMER_PIN }} className="w-6 h-6 [&_svg]:w-full [&_svg]:h-full [&_svg]:block" />
  ), []);

  // ── Effects ──────────────────────────────────────────────────────────────────

  // Sync prefetched order
  useEffect(() => {
    if (!prefetchedOrder) return;
    try {
      const normalized = isQuickOrder ? normalizeQuickOrderForTracking(prefetchedOrder) : prefetchedOrder;
      setOrder((prev) => transformOrderForTracking(normalized, prev));
      setOrderStatus(mapOrderToTrackingUiStatus(normalized));
      setError(null);
      setLoading(false);
    } catch (err) {
      debugError("Failed to sync prefetched order", err);
      setLoading(false);
    }
  }, [isQuickOrder, prefetchedOrder]);

  // Sync orderStatus from order state
  useEffect(() => {
    if (!order) return;
    setOrderStatus(mapOrderToTrackingUiStatus(order));
  }, [order?.status, order?.deliveryState?.currentPhase, order?.deliveryState?.status]);

  // Stop polling when terminal
  useEffect(() => {
    if (!order) return;
    const ui = mapOrderToTrackingUiStatus(order);
    terminalPollStopRef.current = ui === 'delivered' || ui === 'cancelled';
  }, [order]);

  // Clear OTP on terminal status
  useEffect(() => {
    if (!order) return;
    const status = mapOrderToTrackingUiStatus(order);
    if (status !== 'delivered' && status !== 'cancelled') return;
    setSocketDropOtpCode(null);
    setOrder((prev) => {
      if (!prev?.deliveryVerification?.dropOtp?.code) return prev;
      return { ...prev, deliveryVerification: { ...prev.deliveryVerification, dropOtp: { ...prev.deliveryVerification.dropOtp, code: null } } };
    });
  }, [orderStatus]);

  // Socket OTP event
  useEffect(() => {
    const handle = (event) => {
      const detail = event?.detail || {};
      const otp = detail?.otp != null ? String(detail.otp) : null;
      if (!otp) return;
      const evtOrderId = detail?.orderId != null ? String(detail.orderId) : null;
      const evtOrderMongoId = detail?.orderMongoId != null ? String(detail.orderMongoId) : null;
      const currentIds = [String(orderId), order?.orderId, order?.mongoId, order?._id].filter(Boolean).map(String);
      const matches = (evtOrderId && currentIds.includes(evtOrderId)) || (evtOrderMongoId && currentIds.includes(evtOrderMongoId));
      if (!matches) return;
      setSocketDropOtpCode(otp);
      setOrder((prev) => {
        if (!prev) return prev;
        const prevDV = prev.deliveryVerification || {};
        const prevDropOtp = prevDV.dropOtp || {};
        if (prevDropOtp.code === otp) return prev;
        return { ...prev, deliveryVerification: { ...prevDV, dropOtp: { ...prevDropOtp, required: true, verified: false, code: otp } } };
      });
    };
    window.addEventListener('deliveryDropOtp', handle);
    return () => window.removeEventListener('deliveryDropOtp', handle);
  }, [orderId, order?.orderId, order?.mongoId, order?._id]);

  // Order status socket event
  useEffect(() => {
    const handle = (event) => {
      const payload = event?.detail || {};
      const { message, status, estimatedDeliveryTime, orderId: evtOrderId, orderMongoId, orderStatus: evtOrderStatus } = payload;
      const evtKeys = [evtOrderId, orderMongoId, payload?._id].filter(Boolean).map(String);
      const idMatches = evtKeys.length === 0 || evtKeys.some((k) => String(k) === String(orderId)) || evtKeys.some((k) => trackingOrderIdsRef.current.has(k));
      const resolvedStatus = evtOrderStatus || status;
      const next = mapOrderToTrackingUiStatus({ status: resolvedStatus, orderStatus: resolvedStatus, deliveryState: payload.deliveryState });
      if (idMatches) {
        setOrderStatus(next);
        const now = Date.now();
        if (now - lastRealtimeRefreshRef.current > 1500 && !isRefreshing) {
          lastRealtimeRefreshRef.current = now;
          handleRefresh();
        }
      }
      if (message) {
        const isCancelled = String(resolvedStatus || '').toLowerCase().includes('cancel');
        if (isCancelled && idMatches) {
          setCancellationNotice({
            title: isQuickOrder ? 'Order Cancelled' : 'Order Update',
            message,
          });
        } else {
          toast.success(message, { id: `order-status-${orderId}`, duration: 4000, description: estimatedDeliveryTime ? `Estimated delivery in ${Math.round(estimatedDeliveryTime / 60)} minutes` : undefined });
        }
        if (navigator.vibrate) navigator.vibrate([100]);
      }
    };
    window.addEventListener('orderStatusNotification', handle);
    return () => window.removeEventListener('orderStatusNotification', handle);
  }, [orderId, isQuickOrder]);

  // Edit window countdown
  useEffect(() => {
    if (!isEditWindowOpen) return;
    const interval = setInterval(() => setTimerNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isEditWindowOpen]);

  // Return window countdown for delivered Quick Commerce orders
  useEffect(() => {
    if (!isQuickCommerceOrder || !isDeliveredOrder) return undefined;
    const interval = setInterval(() => setTimerNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isQuickCommerceOrder, isDeliveredOrder]);

  // Estimated time countdown
  useEffect(() => {
    const timer = setInterval(() => setEstimatedTime((prev) => Math.max(0, prev - 1)), 60000);
    return () => clearInterval(timer);
  }, []);

  // Confirmation splash
  useEffect(() => {
    if (!confirmed) return;
    confirmationShownAtRef.current = Date.now();
    setShowConfirmation(true);
  }, [confirmed, orderId]);

  useEffect(() => {
    if (!showConfirmation) return;
    const elapsed = Date.now() - confirmationShownAtRef.current;
    const minMs = 250, maxMs = 700;
    const hasData = Boolean(order) || Boolean(error) || !loading;
    const remaining = hasData ? Math.max(0, minMs - elapsed) : Math.max(0, maxMs - elapsed);
    const t = setTimeout(() => setShowConfirmation(false), remaining);
    return () => clearTimeout(t);
  }, [showConfirmation, order, error, loading]);

  // Auto rating popup
  useEffect(() => {
    if (orderStatus !== 'delivered' || !order || ratingModal.open) return;
    const orderIdToRate = order.orderId || order.mongoId || order._id || orderId;
    if (!orderIdToRate) return;
    const idStr = String(orderIdToRate);
    if (shownRatingForOrdersRef.current.has(idStr)) return;
    const sellerRating = order.ratings?.seller || order.ratings?.restaurant;
    const hasRestaurantRating = Number.isFinite(Number(sellerRating?.rating));
    const hasDeliveryPartner = !!order.deliveryPartnerId;
    const hasDeliveryRating = Number.isFinite(Number(order.ratings?.deliveryPartner?.rating));
    const hasRating = hasRestaurantRating && (!hasDeliveryPartner || hasDeliveryRating);
    if (hasRating) return;
    shownRatingForOrdersRef.current = new Set(shownRatingForOrdersRef.current);
    shownRatingForOrdersRef.current.add(idStr);
    saveShownRatings(shownRatingForOrdersRef.current);
    const t = setTimeout(() => {
      setRatingModal({ open: true, order });
      setSelectedRestaurantRating(null);
      setSelectedDeliveryRating(null);
      setRestaurantFeedbackText("");
      setDeliveryFeedbackText("");
    }, 1500);
    return () => clearTimeout(t);
  }, [orderStatus, order, ratingModal.open, orderId]);

  // ── Main polling effect ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!orderId) return;
    const pollGeneration = ++initialPollGenerationRef.current;
    let isSubscribed = true;
    let requestInProgress = false;

    // Keep the loading shell only when we have no matching order yet; avoid flashing it
    // on dependency churn after the first successful load for this orderId.
    const lookupNeedle = normalizeLookupId(orderId);
    const currentMatches = Boolean(
      orderRef.current &&
      [orderRef.current.orderId, orderRef.current.mongoId, orderRef.current._id, orderRef.current.id]
        .map(normalizeLookupId)
        .includes(lookupNeedle),
    );
    if (!prefetchedOrder && !currentMatches) {
      setLoading(true);
    }
    setInitialLoadDone(Boolean(prefetchedOrder) || currentMatches);
    setError(null);

    const poll = async (isInitial = false) => {
      if (!isSubscribed || requestInProgress) return;
      if (terminalPollStopRef.current && !isInitial) return;

      // Ensure lookup ids exist before any API call (avoids race with ref-sync effect).
      const syncIds = [resolvedLookupId, orderId]
        .map(normalizeLookupId)
        .filter(Boolean);
      if (syncIds.length) {
        lookupIdsRef.current = Array.from(new Set([...lookupIdsRef.current, ...syncIds]));
      }

      if (isInitial) {
        const rawContext = isQuickOrder ? null : getOrderByIdRef.current(orderId);
        if (rawContext) {
          setOrder(transformOrderForTracking(rawContext));
          setError(null);
          setInitialLoadDone(true);
          setLoading(false);
        }
      }

      requestInProgress = true;
      try {
        let finalOrderData = null;
        let response = null;

        const loadDetail = async (force = false) => {
          const res = await fetchOrderDetailsWithFallback({ force });
          return { res, payload: extractOrderDetailsPayload(res) };
        };

        if (isInitial && !isQuickOrder) {
          let detail = await loadDetail(true);
          response = detail.res;
          finalOrderData = detail.payload;
          if (!finalOrderData) {
            detail = await loadDetail(true);
            response = detail.res;
            finalOrderData = detail.payload;
          }
          if (!finalOrderData) {
            finalOrderData = await resolveOrderFromList(orderId);
          }
        } else {
          const detail = await loadDetail(isInitial);
          response = detail.res;
          finalOrderData = detail.payload;
        }

        if (!isSubscribed || pollGeneration !== initialPollGenerationRef.current) return;

        if (!finalOrderData && isInitial) {
          finalOrderData = await resolveOrderFromList(orderId);
        }

        if (finalOrderData) {
          setOrder((prev) => {
            const transformed = transformOrderForTracking(
              isQuickOrder ? normalizeQuickOrderForTracking(finalOrderData) : finalOrderData, prev
            );
            const ui = mapOrderToTrackingUiStatus(transformed);
            terminalPollStopRef.current = ui === 'delivered' || ui === 'cancelled';
            return transformed;
          });
          setError(null);
          setInitialLoadDone(true);
          setLoading(false);
          return;
        }

        if (isInitial && !orderRef.current) {
          setError(response?.data?.message || 'Order not found');
        }
      } catch (err) {
        if (!isSubscribed || pollGeneration !== initialPollGenerationRef.current) return;
        if (isInitial && !orderRef.current) {
          try {
            const matched = await resolveOrderFromList(orderId);
            if (matched && isSubscribed && pollGeneration === initialPollGenerationRef.current) {
              setOrder((prev) => transformOrderForTracking(matched, prev));
              setError(null);
              setInitialLoadDone(true);
              setLoading(false);
              return;
            }
          } catch { /* fall through */ }
          setError(err.response?.data?.message || 'Failed to fetch order details');
        }
      } finally {
        requestInProgress = false;
        if (
          isInitial &&
          isSubscribed &&
          pollGeneration === initialPollGenerationRef.current
        ) {
          setInitialLoadDone(true);
          if (!orderRef.current) {
            setLoading(false);
          }
        }
      }
    };

    pollRef.current = poll;
    terminalPollStopRef.current = false;
    poll(true);
    return () => { isSubscribed = false; };
    // getOrderById is read via ref so OrdersContext identity changes do not restart this effect.
  }, [isQuickOrder, orderId, fetchOrderDetailsWithFallback, resolveOrderFromList, resolvedLookupId, prefetchedOrder]);

  // Poll interval — socket-first: REST only when disconnected.
  useEffect(() => {
    if (!orderId) return;
    if (isSocketConnected || window.orderSocketConnected) return undefined;
    const interval = setInterval(() => {
      if (terminalPollStopRef.current || document.hidden) return;
      pollRef.current?.(false);
    }, 20000);
    return () => clearInterval(interval);
  }, [orderId, isSocketConnected]);

  // ── Stable callbacks ─────────────────────────────────────────────────────────
  const handleEtaUpdate = useCallback((newEta) => setEstimatedTime(newEta), []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await stableOpsRef.current.fetchOrderDetailsWithFallback({ force: true });
      const apiOrder = extractOrderDetailsPayload(response);
      if (!apiOrder) return;
      const normalizedOrder = isQuickOrder ? normalizeQuickOrderForTracking(apiOrder) : apiOrder;
      let restaurantCoords = null, restaurantAddress = null;
      if (normalizedOrder.restaurantId?.location?.coordinates?.length >= 2)
        restaurantCoords = normalizedOrder.restaurantId.location.coordinates;
      else if (normalizedOrder.restaurantId?.location?.latitude && normalizedOrder.restaurantId?.location?.longitude)
        restaurantCoords = [normalizedOrder.restaurantId.location.longitude, normalizedOrder.restaurantId.location.latitude];
      else if (normalizedOrder.restaurant?.location?.coordinates)
        restaurantCoords = normalizedOrder.restaurant.location.coordinates;
      else if (!isQuickOrder && typeof normalizedOrder.restaurantId === 'string') {
        try {
          const r = await restaurantAPI.getRestaurantById(normalizedOrder.restaurantId);
          if (r?.data?.success && r.data.data?.restaurant?.location?.coordinates?.length >= 2) {
            restaurantCoords = r.data.data.restaurant.location.coordinates;
            restaurantAddress = r.data.data.restaurant?.location?.formattedAddress || r.data.data.restaurant?.location?.address || null;
          }
        } catch (err) { debugError('Error fetching restaurant details:', err); }
      }
      setOrder((prev) => transformOrderForTracking(normalizedOrder, prev, restaurantCoords, restaurantAddress));
      setOrderStatus(mapOrderToTrackingUiStatus(normalizedOrder));
    } catch (err) {
      debugError('Error refreshing order:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [isQuickOrder]);

  // Phone call helpers — stable, no order dependency needed for the factory
  const makeCall = useCallback((phone) => {
    const clean = String(phone || '').replace(/[^\d+]/g, '');
    if (!clean || clean.length < 5) { toast.error('Phone number not available'); return; }
    try {
      const link = document.createElement('a');
      link.href = `tel:${clean}`;
      link.setAttribute('target', '_self');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch { window.location.assign(`tel:${clean}`); }
  }, []);

  const handleCallRestaurant = useCallback((e) => {
    e?.stopPropagation?.();
    const pickupPhone = Array.isArray(order?.pickupPoints) 
      ? order.pickupPoints.find(p => p.pickupType !== 'quick' && p.phone)?.phone 
      : null;
    const raw = resolveRestaurantContactPhone(
      pickupPhone,
      order?.restaurantPhone,
      order?.restaurantId,
      order?.restaurant,
    );
    if (!raw || String(raw).replace(/[^\d+]/g, '').length < 5) {
      toast.error(`${isQuickOrder ? 'Store' : 'Restaurant'} phone number not available`);
      return;
    }
    makeCall(raw);
  }, [order?.restaurantPhone, order?.restaurantId, order?.restaurant, order?.pickupPoints, isQuickOrder, makeCall]);

  const handleCallPickupSource = useCallback((phone, e) => {
    e?.stopPropagation?.();
    makeCall(phone);
  }, [makeCall]);

  const handleCallRider = useCallback((phone, e) => {
    e?.stopPropagation?.();
    makeCall(phone || order?.deliveryPartner?.phone || '');
  }, [order?.deliveryPartner?.phone, makeCall]);

  const handleCancelOrder = useCallback(() => {
    if (!order) return;
    if (isAdminAccepted && !isEditWindowOpen) { toast.error('Cancellation window ended.'); return; }
    if (order.status === 'cancelled') { toast.error('Order is already cancelled'); return; }
    if (order.status === 'delivered') { toast.error('Cannot cancel a delivered order'); return; }
    const preferredRefund = order?.payment?.refund?.requestedMethod === "wallet" ? "wallet" : "gateway";
    setRefundDestination(canUseWalletRefund ? preferredRefund : "gateway");
    setShowCancelDialog(true);
  }, [order, isAdminAccepted, isEditWindowOpen, canUseWalletRefund]);

  const handleConfirmCancel = useCallback(async () => {
    if (!cancellationReason.trim()) { toast.error('Please provide a reason for cancellation'); return; }
    if (showRefundDestinationChoice && refundDestination === "wallet" && !canUseWalletRefund) {
      toast.error('Please log in to receive refund in your wallet');
      return;
    }
    setIsCancelling(true);
    try {
      const cancelId = lookupIdsRef.current[0] || normalizeLookupId(orderId);
      const cancelPayload = {
        reason: cancellationReason.trim(),
        ...(showRefundDestinationChoice ? { refundTo: refundDestination } : {}),
      };
      const response = isQuickOrder
        ? await customerApi.cancelOrder(cancelId, cancelPayload)
        : await orderAPI.cancelOrder(cancelId, cancelPayload);
      if (response.data?.success) {
        const paymentMethod = order?.payment?.method || order?.paymentMethod;
        const successMessage = response.data?.message || (paymentMethod === 'cash' || paymentMethod === 'cod'
          ? 'Order cancelled successfully. No refund required as payment was not made.'
          : `Order cancelled successfully. Refund will be sent to ${refundDestination === "wallet" ? "your wallet" : "your original payment method"}.`);
        setCancellationNotice({
          title: 'Order Cancelled',
          message: successMessage,
        });
        setShowCancelDialog(false);
        setCancellationReason("");
        setRefundDestination("gateway");
        setOrderStatus('cancelled');
        const orderResponse = await stableOpsRef.current.fetchOrderDetailsWithFallback({ force: true });
        const refreshedOrder = extractOrderDetailsPayload(orderResponse);
        if (refreshedOrder) {
          setOrder((prev) => transformOrderForTracking(
            isQuickOrder ? normalizeQuickOrderForTracking(refreshedOrder) : refreshedOrder,
            prev,
          ));
        }
      } else {
        toast.error(response.data?.message || 'Failed to cancel order');
      }
    } catch (error) {
      debugError('Error cancelling order:', error);
      toast.error(error.response?.data?.message || 'Failed to cancel order');
    } finally {
      setIsCancelling(false);
    }
  }, [cancellationReason, orderId, isQuickOrder, showRefundDestinationChoice, canUseWalletRefund, refundDestination, order?.payment?.method, order?.paymentMethod]);

  const handleUpdateInstructions = useCallback(async () => {
    if (isQuickOrder || typeof orderAPI.updateOrderInstructions !== "function") {
      toast.error("Delivery instructions update is not available for this order yet");
      return;
    }
    setIsUpdatingInstructions(true);
    try {
      const response = await orderAPI.updateOrderInstructions(resolvedLookupId || orderId, deliveryInstructions);
      if (response.data?.success) {
        toast.success("Delivery instructions updated");
        setIsInstructionsModalOpen(false);
        const updated = response.data.data?.order;
        if (updated) setOrder((prev) => transformOrderForTracking(updated, prev));
        else setOrder((prev) => ({ ...prev, note: deliveryInstructions }));
      } else {
        toast.error(response.data?.message || "Failed to update instructions");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update instructions");
    } finally {
      setIsUpdatingInstructions(false);
    }
  }, [isQuickOrder, resolvedLookupId, orderId, deliveryInstructions]);

  const copyTrackingLink = useCallback(async (url) => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        return true;
      } catch {
        // Clipboard API can be blocked; fall through to the execCommand path.
      }
    }

    // Needed for non-secure contexts (plain HTTP) where the clipboard API is missing.
    const textArea = document.createElement("textarea");
    textArea.value = url;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    document.body.removeChild(textArea);
    return copied;
  }, []);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    const restaurantLabel =
      (typeof order?.restaurant === "string" && order.restaurant.trim()) ||
      order?.restaurantName ||
      companyName;
    const shareData = {
      title: `Track my order from ${restaurantLabel}`,
      text: `Hey! Track my order from ${restaurantLabel} with ID #${order?.orderId || order?.id}.`,
      url,
    };

    const canUseNativeShare =
      typeof navigator?.share === "function" &&
      (typeof navigator.canShare !== "function" || navigator.canShare(shareData));

    if (canUseNativeShare) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        // User dismissed the sheet; anything else falls back to copying the link.
        if (error?.name === "AbortError") return;
      }
    }

    if (await copyTrackingLink(url)) {
      toast.success("Tracking link copied to clipboard!");
    } else {
      toast.error("Could not share the tracking link");
    }
  }, [order?.restaurant, order?.restaurantName, order?.orderId, order?.id, companyName, copyTrackingLink]);

  const handleCloseRating = useCallback(() => {
    setRatingModal({ open: false, order: null });
    setSelectedRestaurantRating(null);
    setSelectedDeliveryRating(null);
    setRestaurantFeedbackText("");
    setDeliveryFeedbackText("");
  }, []);

  const handleSubmitRating = useCallback(async () => {
    const hasDeliveryPartner = !!order?.deliveryPartnerId;
    if (!order || selectedRestaurantRating === null || (hasDeliveryPartner && selectedDeliveryRating === null)) {
      toast.error("Please select all required ratings first"); return;
    }
    setSubmittingRating(true);
    try {
      const targetId = order.mongoId || order._id || orderId;
      const response = isQuickOrder 
        ? await customerApi.submitOrderRatings(targetId, {
            sellerRating: selectedRestaurantRating,
            deliveryPartnerRating: hasDeliveryPartner ? selectedDeliveryRating : undefined,
            sellerComment: restaurantFeedbackText || undefined,
            deliveryPartnerComment: hasDeliveryPartner ? (deliveryFeedbackText || undefined) : undefined,
          })
        : await orderAPI.submitOrderRatings(targetId, {
            restaurantRating: selectedRestaurantRating,
            deliveryPartnerRating: hasDeliveryPartner ? selectedDeliveryRating : undefined,
            restaurantComment: restaurantFeedbackText || undefined,
            deliveryPartnerComment: hasDeliveryPartner ? (deliveryFeedbackText || undefined) : undefined,
          });
      const updatedOrderData = response?.data?.data?.order || response?.data?.order || null;
      if (updatedOrderData) setOrder((prev) => transformOrderForTracking(updatedOrderData, prev));
      else setOrder((prev) => ({
        ...prev,
        ratings: {
          ...prev.ratings,
          restaurant: { rating: selectedRestaurantRating, comment: restaurantFeedbackText },
          seller: { rating: selectedRestaurantRating, comment: restaurantFeedbackText },
          deliveryPartner: hasDeliveryPartner ? { rating: selectedDeliveryRating, comment: deliveryFeedbackText } : undefined,
        },
      }));
      toast.success("Thanks for rating your order!");
      handleCloseRating();
    } catch (error) {
      debugError("Error submitting ratings:", error);
      toast.error(error?.response?.data?.message || "Failed to submit ratings.");
    } finally {
      setSubmittingRating(false);
    }
  }, [order, orderId, selectedRestaurantRating, selectedDeliveryRating, restaurantFeedbackText, deliveryFeedbackText, handleCloseRating]);

  const buildInvoiceOrderPayload = useCallback(() => {
    if (!order) return null;

    const isQc =
      String(order.orderType || "").toLowerCase() === "quick" ||
      String(order.orderType || "").toLowerCase() === "mixed" ||
      /^QC/i.test(String(order.orderId || order.id || ""));
    const storeName =
      order.storeName ||
      order.sellerName ||
      order.seller?.shopName ||
      order.seller?.name ||
      order.pickupSources?.find((source) => source?.name)?.name ||
      order.restaurantName ||
      (typeof order.restaurant === "string" ? order.restaurant : "") ||
      "Store";
    const partner =
      order.deliveryPartner ||
      order.deliveryPartners?.[0] ||
      order.dispatch?.deliveryPartnerId ||
      null;

    return {
      ...order,
      orderType: order.orderType || (isQc ? "quick" : order.orderType),
      storeName: isQc ? storeName : order.storeName,
      sellerName: isQc ? (order.sellerName || storeName) : order.sellerName,
      restaurantName: isQc ? storeName : (order.restaurantName || order.restaurant),
      customerName:
        order.customerName ||
        order.userName ||
        order.userId?.name ||
        order.userId?.fullName ||
        order.customer?.name ||
        order.sellerOrder?.customer?.name ||
        profile?.fullName ||
        profile?.name ||
        order.address?.name,
      customerPhone:
        order.customerPhone ||
        order.userPhone ||
        order.userId?.phone ||
        order.customer?.phone ||
        order.sellerOrder?.customer?.phone ||
        profile?.phone ||
        order.address?.phone,
      userName:
        order.userName ||
        order.customerName ||
        profile?.fullName ||
        profile?.name,
      deliveryAddress: {
        ...(order.deliveryAddress || order.address || {}),
        name:
          order.deliveryAddress?.name ||
          order.address?.name ||
          order.customerName ||
          order.userName ||
          profile?.fullName ||
          profile?.name,
        phone:
          order.deliveryAddress?.phone ||
          order.address?.phone ||
          order.customerPhone ||
          order.userPhone ||
          profile?.phone,
      },
      address: {
        ...(order.address || order.deliveryAddress || {}),
        name:
          order.address?.name ||
          order.deliveryAddress?.name ||
          order.customerName ||
          order.userName ||
          profile?.fullName ||
          profile?.name,
        phone:
          order.address?.phone ||
          order.deliveryAddress?.phone ||
          order.customerPhone ||
          order.userPhone ||
          profile?.phone,
      },
      deliveryPartner: partner,
      deliveryPartnerName: order.deliveryPartnerName || partner?.name || "",
      deliveryPartnerPhone: order.deliveryPartnerPhone || partner?.phone || "",
      returnSummary: order.returnSummary || null,
      originalPaidTotal: order.originalPaidTotal,
      refundedAmount: order.refundedAmount,
      netAfterReturn: order.netAfterReturn,
      returnStatus: order.returnStatus,
      returnStatusLabel: order.returnStatusLabel,
      hasReturn: order.hasReturn,
    };
  }, [order, profile?.fullName, profile?.name, profile?.phone]);

  const handleShareInvoice = useCallback(async () => {
    if (invoiceBusy) return;
    const invoiceOrder = buildInvoiceOrderPayload();
    if (!invoiceOrder) {
      toast.error("Order details are not ready yet");
      return;
    }

    setInvoiceBusy(true);
    try {
      const { blob, fileName } = await buildOrderInvoicePdf(invoiceOrder, { audience: "customer" });
      if (invoiceAction.canShare) {
        const shared = await sharePdfBlob(blob, fileName);
        if (shared) {
          toast.success("Invoice ready to share");
          return;
        }
      }

      const saved = await saveBlobAsFile(blob, fileName, { isPdf: true, preferDownload: true });
      if (!saved) throw new Error("Could not download invoice");
      toast.success("Invoice downloaded successfully");
    } catch (error) {
      debugError("Error sharing invoice PDF:", error);
      toast.error(invoiceAction.canShare ? "Failed to share invoice" : "Failed to download invoice");
    } finally {
      setInvoiceBusy(false);
    }
  }, [invoiceBusy, buildInvoiceOrderPayload, invoiceAction.canShare]);

  // ── Instruction modal opener ─────────────────────────────────────────────────
  const openInstructionsModal = useCallback(() => {
    setDeliveryInstructions(order?.note || "");
    setIsInstructionsModalOpen(true);
  }, [order?.note]);

  // ── Early returns (after all hooks) ─────────────────────────────────────────
  const showLoadingShell = loading || (!order && !initialLoadDone);
  if (showLoadingShell) {
    return (
      <AnimatedPage className="min-h-screen bg-gray-50 dark:bg-background p-4">
        <div className="max-w-lg mx-auto text-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-600 dark:text-slate-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-slate-400">Loading order details...</p>
        </div>
      </AnimatedPage>
    );
  }

  if (!order) {
    return (
      <AnimatedPage className="min-h-screen bg-gray-50 dark:bg-background p-4">
        <div className="max-w-lg mx-auto text-center py-20">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-4 text-gray-900 dark:text-slate-100">Order Not Found</h1>
          <p className="text-gray-600 dark:text-slate-400 mb-6">{error || "The order you're looking for doesn't exist."}</p>
          <Link to={backPath}><Button>Back to Orders</Button></Link>
        </div>
      </AnimatedPage>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#0a0a0a]">
      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div {...MOTION_FADE} className="fixed inset-0 z-50 bg-white dark:bg-[#1a1a1a] flex flex-col items-center justify-center">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: "spring" }} className="text-center px-8">
              <AnimatedCheckmark delay={0.3} />
              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="text-2xl font-bold text-gray-900 dark:text-slate-100 mt-6">Order Confirmed!</motion.h1>
              <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }} className="text-gray-600 dark:text-slate-400 mt-2">Your order has been placed successfully</motion.p>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="mt-8">
                <div className="w-8 h-8 border-2 border-[#FF0000] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-500 dark:text-slate-500 mt-3">Loading order details...</p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Green / Red Header */}
      <motion.div className={`${currentStatus.color} text-white sticky top-0 z-40`} {...MOTION_FADE}>
        <div className="flex items-center justify-between px-4 py-3">
          <Link to={backPath}>
            <motion.button className="w-10 h-10 flex items-center justify-center" whileTap={{ scale: 0.9 }}>
              <ArrowLeft className="w-6 h-6" />
            </motion.button>
          </Link>
          <h2 className="font-semibold text-lg">{asDisplayText(order.restaurant || order.restaurantName || order.storeName, isQuickOrder ? "Store" : "Restaurant")}</h2>
          <motion.button className="w-10 h-10 flex items-center justify-center cursor-pointer" whileTap={{ scale: 0.9 }} onClick={handleShare}>
            <Share2 className="w-5 h-5" />
          </motion.button>
        </div>

        {!['at_pickup', 'ready', 'on_way', 'at_drop', 'delivered'].includes(orderStatus) && (
          <div className="px-4 pb-4 text-center">
            {isFoodQuick && (
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Quick Delivery
                {quickPromiseLabel ? <span className="font-semibold normal-case tracking-normal">· {quickPromiseLabel}</span> : null}
              </div>
            )}
            {order?.sla?.breached && Number(order?.sla?.compensationAmount) > 0 && (
              <div className="mb-2 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-xl px-3 py-2">
                SLA compensation ₹{Math.round(Number(order.sla.compensationAmount))} credited to your wallet
              </div>
            )}
            <motion.h1 className="text-2xl font-bold mb-3" key={currentStatus.title} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              {currentStatus.title}
            </motion.h1>
            <motion.div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }}>
              <span className="text-sm">{currentStatus.subtitle}</span>
              {orderStatus === 'preparing' && (<><span className="w-1 h-1 rounded-full bg-white" /><span className="text-sm text-red-200">On time</span></>)}
              <motion.button onClick={handleRefresh} className="ml-1" animate={{ rotate: isRefreshing ? 360 : 0 }} transition={{ duration: 0.5 }}>
                <RefreshCw className="w-4 h-4" />
              </motion.button>
            </motion.div>
          </div>
        )}
      </motion.div>

      {/* Map */}
      {!isDeliveredOrder && orderStatus !== 'cancelled' && (
        <>
          <DeliveryMap
            orderId={orderId} order={order} isVisible={order !== null}
            fallbackCustomerCoords={fallbackCustomerCoords}
            userLiveCoords={userLiveCoords}
            userLocationAccuracy={userLiveLocation?.accuracy ?? null}
            onEtaUpdate={handleEtaUpdate}
          />
          {!hasActiveDeliveryTracking && (
            <motion.div className="mx-4 mt-4 rounded-3xl border border-emerald-100 dark:border-emerald-500/20 bg-gradient-to-br from-emerald-50 via-white to-lime-50 dark:from-emerald-500/10 dark:via-card dark:to-card p-5 shadow-sm" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">Live tracking</p>
                  <h3 className="mt-2 text-lg font-bold text-gray-900 dark:text-slate-100">{orderStatus === 'scheduled' ? 'Order Scheduled' : 'Waiting for delivery partner assignment'}</h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                    {orderStatus === 'scheduled'
                      ? `The ${isQuickOrder ? 'store' : 'restaurant'} will receive your order 15 minutes before the scheduled time.`
                      : 'The route map is ready. Live rider movement will appear here as soon as a rider accepts the trip.'}
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{currentStatus.title}</div>
              </div>
              <div className="mt-5 rounded-2xl border border-white/70 dark:border-white/10 bg-white/90 dark:bg-card/90 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center pt-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-[#FF0000]"><MapPin className="h-5 w-5" /></div>
                    <div className="my-2 h-10 w-px border-l-2 border-dashed border-emerald-200" />
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><HomeIcon className="h-5 w-5" /></div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-slate-500">{previewPickupLabel}</p>
                      <p className="mt-1 font-semibold text-gray-900 dark:text-slate-100">{asDisplayText(previewPickupSource?.name || order?.restaurant, 'Pickup location')}</p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{previewPickupAddress}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-slate-500">Delivery address</p>
                      <p className="mt-1 font-semibold text-gray-900 dark:text-slate-100">Customer location</p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{previewDropAddress}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* Scrollable content */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6 pb-24 md:pb-32">

        {customerDeliveryOtp && orderStatus !== 'delivered' && orderStatus !== 'cancelled' && (
          <motion.div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4 shadow-sm border border-blue-100 dark:border-blue-500/20" {...MOTION_SLIDE_UP(0.28)}>
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Delivery OTP</p>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1 tracking-widest">{customerDeliveryOtp}</p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">Share this 4-digit OTP with your delivery partner at drop-off.</p>
          </motion.div>
        )}

        {isQuickOrder && !customerDeliveryOtp && orderStatus !== 'delivered' && orderStatus !== 'cancelled' && (
          <motion.div {...MOTION_SLIDE_UP(0.28)}>
            <DeliveryOtpDisplay orderId={order?.orderId || order?.mongoId || orderId} />
          </motion.div>
        )}

        {/* Status Card */}
        <motion.div className="bg-white dark:bg-card rounded-xl p-4 shadow-sm border border-transparent dark:border-white/10" {...MOTION_SLIDE_UP(0.3)}>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm border border-gray-100 dark:border-white/10 ${currentStatus.iconType === 'rider' ? 'bg-blue-50 dark:bg-blue-500/15' :
              currentStatus.iconType === 'cancelled' ? 'bg-red-50 dark:bg-red-500/15' :
                currentStatus.iconType === 'delivered' ? 'bg-green-50 dark:bg-green-500/15' : 'bg-red-50 dark:bg-red-500/15'
              }`}>
              {currentStatus.iconType === 'rider' ? (
                <div dangerouslySetInnerHTML={{ __html: String(RIDER_BIKE_SVG || '').replace(/width="\d+"/, 'width="100%"').replace(/height="\d+"/, 'height="100%"') }} style={RIDER_SVG_STYLE} />
              ) : currentStatus.iconType === 'cancelled' ? (
                <div className="w-full h-full flex items-center justify-center p-2 text-red-500"><X className="w-full h-full" /></div>
              ) : currentStatus.iconType === 'delivered' ? (
                <div className="w-full h-full flex items-center justify-center p-2 text-green-500"><Check className="w-full h-full" /></div>
              ) : (
                <img src={circleIcon} alt={currentStatus.title} className="w-10 h-10 object-contain" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 dark:text-slate-100 leading-tight">{currentStatus.title}</p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 leading-snug">{currentStatus.subtitle}</p>
            </div>
          </div>
        </motion.div>

        {/* Delivery Partners */}
        {visibleDeliveryPartners.length > 0 && (
          <motion.div className="bg-white dark:bg-card rounded-xl shadow-sm overflow-hidden border border-transparent dark:border-white/10" {...MOTION_SLIDE_UP(0.55)}>
            <div className="px-4 pt-4 pb-2 border-b border-dashed border-gray-200 dark:border-white/10">
              <p className="font-semibold text-gray-900 dark:text-slate-100">{hasMultipleDeliveryPartners ? 'Express delivery partners' : 'Delivery partner'}</p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                {isDeliveredOrder
                  ? 'Your delivery partner completed this order.'
                  : orderStatus === 'cancelled'
                    ? 'Delivery partner details for this cancelled order.'
                    : hasMultipleDeliveryPartners
                      ? 'Each pickup in your express order can have its own rider.'
                      : 'Your delivery partner is handling this order.'}
              </p>
            </div>
            {visibleDeliveryPartners.map((partner, index) => (
              <div key={partner?.legId || partner?.id || index} className={`flex items-center gap-3 p-4 ${index !== visibleDeliveryPartners.length - 1 ? 'border-b border-dashed border-gray-200 dark:border-white/10' : ''}`}>
                <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-500/15 overflow-hidden flex items-center justify-center flex-shrink-0 border border-blue-100 dark:border-blue-500/20 p-1">
                  <img src={getPartnerDisplayAvatar(partner?.avatar, partner?.name)} alt={partner?.name || 'Rider'} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getPartnerDisplayAvatar("", partner?.name || "Rider"); }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">{partner?.name || 'Delivery Partner'}</p>
                    {hasMultipleDeliveryPartners && <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-500/15 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300">{partner?.label || 'Pickup rider'}</span>}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-slate-400 truncate">
                    {isDeliveredOrder
                      ? 'Delivered your order'
                      : orderStatus === 'cancelled'
                        ? 'This delivery was cancelled'
                        : partner?.sourceName
                          ? `${partner.label} for ${partner.sourceName}`
                          : partner?.statusText || 'Assigned to your order'}
                  </p>
                  {formatPartnerRating(partner?.rating) ? (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-600">
                      <span className="font-semibold">★ {formatPartnerRating(partner?.rating)}</span>
                      <span className="text-gray-400 dark:text-slate-500">{Number(partner?.totalRatings || 0) > 0 ? `(${Number(partner?.totalRatings)} ratings)` : '(New rider)'}</span>
                    </div>
                  ) : <div className="mt-1 text-xs text-gray-400 dark:text-slate-500">Rating not available yet</div>}
                </div>
                <motion.button className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center" onClick={(e) => handleCallRider(partner?.phone, e)} whileTap={{ scale: 0.9 }}>
                  <Phone className="w-5 h-5 text-blue-600" />
                </motion.button>
              </div>
            ))}
            {order?.note && !isDeliveredOrder && (
              <div className="bg-blue-50/50 dark:bg-blue-500/10 p-3 mx-4 mb-4 rounded-lg flex items-start gap-2 border border-blue-100 dark:border-blue-500/20">
                <MessageSquare className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-0.5">Instruction for Rider</p>
                  <p className="text-xs text-gray-700 dark:text-slate-300 leading-relaxed font-medium">"{asDisplayText(order.note)}"</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {!isDeliveredOrder && (
          <motion.button
            type="button"
            onClick={() => setShowSafetyDialog(true)}
            className="w-full bg-white dark:bg-card rounded-xl p-4 shadow-sm flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border border-transparent dark:border-white/10"
            {...MOTION_SLIDE_UP(0.6)}
            whileTap={{ scale: 0.99 }}
          >
            <Shield className="w-6 h-6 text-gray-600 dark:text-slate-400" />
            <span className="flex-1 text-left font-medium text-gray-900 dark:text-slate-100">Learn about delivery partner safety</span>
            <ChevronRight className="w-5 h-5 text-gray-400 dark:text-slate-500" />
          </motion.button>
        )}

        {!isDeliveredOrder && (
          <motion.div className="bg-yellow-50 dark:bg-amber-500/10 rounded-xl p-4 text-center border border-yellow-100 dark:border-amber-500/20" {...MOTION_SLIDE_UP(0.65)}>
            <p className="text-yellow-800 dark:text-amber-200 font-medium">All your delivery details in one place 🚀</p>
          </motion.div>
        )}

        {/* Contact & Address */}
        <motion.div className="bg-white dark:bg-card rounded-xl shadow-sm overflow-hidden border border-transparent dark:border-white/10" {...MOTION_SLIDE_UP(0.7)}>
          <SectionItem
            icon={User}
            title={asDisplayText(order?.userName || order?.userId?.fullName || order?.userId?.name || profile?.fullName || profile?.name, 'Customer')}
            subtitle={asDisplayText(order?.userPhone || order?.userId?.phone || order?.address?.phone || order?.deliveryAddress?.phone || profile?.phone || defaultAddress?.phone, 'Phone number not available')}
            showArrow={false}
          />
          <SectionItem iconNode={customerPinNode} title="Delivery at Location" subtitle={deliveryAddressSubtitle} showArrow={false} truncateSubtitle={false} />
          {!isDeliveredOrder && (
            <SectionItem
              icon={MessageSquare}
              title={order?.note ? "Edit delivery instructions" : "Add delivery instructions"}
              subtitle={(() => {
                const note = asDisplayText(order?.note, "");
                if (!note) return "";
                return note.length > 35 ? `${note.substring(0, 35)}...` : note;
              })()}
              onClick={openInstructionsModal}
            />
          )}
        </motion.div>

        {/* Pickup Sources */}
        <motion.div className="bg-white dark:bg-card rounded-xl shadow-sm overflow-hidden border border-transparent dark:border-white/10" {...MOTION_SLIDE_UP(0.75)}>
          <div className="p-4 border-b border-dashed border-gray-200 dark:border-white/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-slate-500">
                  {order?.orderType === 'mixed' ? 'Pickup Points' : (isQuickOrder ? 'Store' : 'Restaurant')}
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                  {order?.orderType === 'mixed' ? 'Restaurant and store details for this mixed order' : 'Pickup details for your order'}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {pickupSources.map((source, index) => {
                const isQuick = source.pickupType === 'quick';
                const badgeClasses = isQuick
                  ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30'
                  : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30';
                // Single restaurant pickup falls back to the order-level phone resolution.
                const useRestaurantFallbackCall = !isQuick && pickupSources.length === 1;
                return (
                  <div key={source.id || `${source.pickupType}-${index}`} className="rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50/80 dark:bg-white/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className={`inline-flex h-12 w-12 items-center justify-center rounded-full flex-shrink-0 overflow-hidden ${isQuick ? 'bg-sky-100 dark:bg-sky-500/20' : 'bg-red-100 dark:bg-red-500/20'}`}>
                        {source.image ? (
                          <img src={source.image} alt={source.name || 'Restaurant'} className="w-full h-full object-cover" />
                        ) : (
                          <div dangerouslySetInnerHTML={{ __html: SAFE_RESTAURANT_PIN }} className="w-7 h-7 [&_svg]:w-full [&_svg]:h-full [&_svg]:block" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${badgeClasses}`}>
                          {pickupSources.length > 1 ? `${source.label} ${index + 1}` : source.label}
                        </span>
                        <p className="mt-2 font-semibold text-gray-900 dark:text-slate-100">{asDisplayText(source.name, isQuick ? 'Store' : 'Restaurant')}</p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{asAddressText(source.address, 'Address not available')}</p>
                      </div>
                      {(source.phone || useRestaurantFallbackCall) ? (
                        <motion.button
                          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isQuick ? 'bg-sky-50 dark:bg-sky-500/15' : 'bg-red-50 dark:bg-red-500/15'}`}
                          onClick={(e) => (useRestaurantFallbackCall ? handleCallRestaurant(e) : handleCallPickupSource(source.phone, e))}
                          whileTap={{ scale: 0.9 }}
                        >
                          <Phone className={`w-5 h-5 ${isQuick ? 'text-sky-600' : 'text-[#FF0000]'}`} />
                        </motion.button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order Items */}
          <div className="p-4 border-b border-dashed border-gray-200 dark:border-white/10 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors" onClick={() => setShowOrderDetails(true)}>
            <div className="flex items-start gap-3">
              <ShoppingBag className="w-5 h-5 text-gray-500 dark:text-slate-400 mt-0.5" />
              <div className="flex-1">
                <div className="mt-2 space-y-1">
                  {order?.items?.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
                      <span className="w-4 h-4 rounded border border-green-600 dark:border-green-500 flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-green-600 dark:bg-green-500" />
                      </span>
                      <div className="min-w-0">
                        <span className="block truncate">
                          {item.quantity} x {asDisplayText(item.name, "Item")}
                          {item.variantName ? ` (${asDisplayText(item.variantName)})` : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 dark:text-slate-500" />
            </div>
          </div>
        </motion.div>

        {isQuickCommerceOrder && isDeliveredOrder && orderStatus !== 'cancelled' && (
          <motion.div {...MOTION_SLIDE_UP(0.76)} className="space-y-4">
            <ReturnWindowBanner
              eligibility={liveReturnEligibility}
              deliveredAt={
                liveReturnEligibility?.deliveredAt ||
                order?.deliveryState?.deliveredAt ||
                order?.deliveredAt
              }
            />
            <ReturnTrackingPanel
              orderId={order?.orderId || order?.mongoId || orderId}
              order={order}
              onRefresh={handleReturnRefresh}
            />
            <ReturnItemsCta
              orderId={order?.orderId || order?.mongoId || orderId}
              hasActiveReturn={activeReturnCount > 0 || Boolean(order?.hasReturn)}
              canReturn={canRequestReturn}
            />
            {liveReturnEligibility?.returnWindowExpired && activeReturnCount === 0 && !order?.hasReturn && (
              <p className="text-center text-sm text-slate-500 dark:text-slate-400 px-4">
                Return window has expired.
              </p>
            )}
          </motion.div>
        )}

        {isDeliveredOrder && (
          <motion.div className="bg-white dark:bg-card rounded-xl shadow-sm overflow-hidden border border-transparent dark:border-white/10" {...MOTION_SLIDE_UP(0.78)}>
            <SectionItem
              icon={Star}
              title={order?.ratings ? "View your ratings" : "Rate your experience"}
              subtitle={order?.ratings ? "You've already rated this order" : "Tell us how your experience was with the store and delivery partner"}
              onClick={() => {
                    // Always open, pre-fill if already rated
                    setRatingModal({ open: true, order: order });
                    // If already rated, pre-fill the values
                    if (order?.ratings) {
                      const sellerRating = order.ratings.seller || order.ratings.restaurant;
                      setSelectedRestaurantRating(sellerRating?.rating || null);
                      setSelectedDeliveryRating(order.ratings.deliveryPartner?.rating || null);
                      setRestaurantFeedbackText(sellerRating?.comment || "");
                      setDeliveryFeedbackText(order.ratings.deliveryPartner?.comment || "");
                    } else {
                      // Reset if not rated
                      setSelectedRestaurantRating(null);
                      setSelectedDeliveryRating(null);
                      setRestaurantFeedbackText("");
                      setDeliveryFeedbackText("");
                    }
                  }}
            />
          </motion.div>
        )}

        {!isAdminAccepted && !isDeliveredOrder && orderStatus !== 'cancelled' && (
          <motion.div className="bg-white dark:bg-card rounded-xl shadow-sm overflow-hidden border border-transparent dark:border-white/10" {...MOTION_SLIDE_UP(0.8)}>
            <SectionItem icon={CircleSlash} title="Cancel order" subtitle="" onClick={handleCancelOrder} />
          </motion.div>
        )}

        <motion.div className="bg-white dark:bg-card rounded-xl shadow-sm overflow-hidden border border-transparent dark:border-white/10" {...MOTION_SLIDE_UP(0.82)}>
          <SectionItem
            icon={invoiceAction.Icon}
            title={invoiceAction.title}
            subtitle={invoiceAction.subtitle}
            onClick={handleShareInvoice}
            rightContent={
              invoiceBusy ? (
                <Loader2 className="w-5 h-5 animate-spin text-gray-400 dark:text-slate-500 flex-shrink-0" />
              ) : undefined
            }
          />
        </motion.div>
      </div>

      {/* Cancel Dialog */}
      <Dialog open={showSafetyDialog} onOpenChange={setShowSafetyDialog}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-white dark:bg-gray-900">
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3 pr-8">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-[#FF0000]" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Delivery partner safety
                </DialogTitle>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  How {companyName} keeps every delivery safe
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {[
              {
                title: "Verified partners",
                desc: "ID, licence and vehicle documents are checked and approved by our team before a partner can accept orders.",
              },
              {
                title: "Live tracking",
                desc: "Follow your partner on the map for the whole trip, and reach them on call until the order is delivered.",
              },
              {
                title: "Handover OTP",
                desc: "Share the 4-digit OTP only at drop-off, so an order can never be marked delivered without you.",
              },
              {
                title: "Masked contact details",
                desc: "Calls go through the app, so your personal number is never shared with the delivery partner.",
              },
            ].map(({ title, desc }) => (
              <div key={title} className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000] mt-2 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Something feels unsafe?
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Report it and our support team will follow up on this order.
            </p>
            <Link
              to="/food/user/profile/report-safety-emergency"
              onClick={() => setShowSafetyDialog(false)}
              className="mt-3 flex w-full items-center justify-center rounded-lg bg-[#FF0000] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#C83C00] transition-colors"
            >
              Report a safety emergency
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-xl w-[95%] max-w-[600px] bg-white dark:bg-gray-900 border-none">
          <DialogHeader><DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">Cancel Order</DialogTitle></DialogHeader>
          <div className="space-y-5 py-6 px-2">
            {showRefundDestinationChoice && (
              <div className="space-y-3 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-900/20 p-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Refund method</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Choose where you want your refund after cancellation.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { value: "wallet", label: "Wallet", desc: "Amount will be added to your app wallet." },
                    { value: "gateway", label: "Original payment method", desc: "Refund back to Razorpay / UPI / card." },
                  ].map(({ value, label, desc }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRefundDestination(value)}
                      disabled={isCancelling}
                      className={`rounded-xl border px-4 py-3 text-left transition ${refundDestination === value ? "border-red-500 bg-white dark:bg-gray-800 text-red-900 dark:text-red-400 shadow-sm" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"} ${isCancelling ? "cursor-not-allowed opacity-60" : ""}`}>
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Cancellation reason</p>
              <Textarea value={cancellationReason} onChange={(e) => setCancellationReason(e.target.value)} placeholder="e.g., Changed my mind, Wrong address, etc." className="w-full min-h-[100px] resize-none border-2 border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-200 focus:outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:cursor-not-allowed disabled:border-gray-200 dark:disabled:border-gray-800" disabled={isCancelling} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => { setShowCancelDialog(false); setCancellationReason(""); setRefundDestination("gateway"); }} disabled={isCancelling} className="flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</Button>
              <Button onClick={handleConfirmCancel} disabled={isCancelling || !cancellationReason.trim()} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                {isCancelling ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelling...</> : 'Confirm Cancellation'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancellation notice popup */}
      <Dialog open={Boolean(cancellationNotice)} onOpenChange={(open) => { if (!open) setCancellationNotice(null); }}>
        <DialogContent className="sm:max-w-md w-[95%] bg-white dark:bg-gray-900 border-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">{cancellationNotice?.title || 'Order Cancelled'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{cancellationNotice?.message}</p>
            <Button onClick={() => setCancellationNotice(null)} className="w-full bg-red-600 hover:bg-red-700 text-white">
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Details Dialog */}
      <Dialog open={showOrderDetails} onOpenChange={setShowOrderDetails}>
        <DialogContent className="max-w-[calc(100vw-32px)] sm:max-w-md rounded-2xl p-0 overflow-hidden border border-border dark:border-white/10 bg-card dark:bg-[#1a1a1a] text-card-foreground [&_[data-slot=dialog-close]]:text-slate-500 dark:[&_[data-slot=dialog-close]]:text-slate-300 dark:[&_[data-slot=dialog-close]]:hover:bg-white/10">
          <DialogHeader className="p-6 pb-4 border-b border-gray-100 dark:border-white/10 pr-12">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold text-gray-900 dark:text-slate-100">Order Details</DialogTitle>
            </div>
          </DialogHeader>
          <div className="p-6 pt-4 space-y-6 max-h-[70vh] overflow-y-auto">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-4 mt-2">
                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Date & Time</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{order?.createdAt ? new Date(order.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A'}</p>
                </div>
                <div className="h-8 w-px bg-gray-100 dark:bg-white/10" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Status</p>
                  <span className="text-sm font-bold text-green-600 dark:text-green-400 uppercase">{String(order?.status || orderStatus || "placed").replace(/_/g, " ")}</span>
                </div>
              </div>
            </div>
            {order?.note && (
              <div className="bg-red-50/50 dark:bg-red-500/10 rounded-xl p-4 border border-red-100 dark:border-red-500/20 flex gap-3">
                <MessageSquare className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-red-600 dark:text-red-400 font-bold uppercase tracking-wider mb-1">Delivery Instructions</p>
                  <p className="text-sm text-gray-800 dark:text-slate-200 leading-relaxed font-medium capitalize">{asDisplayText(order.note)}</p>
                </div>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Order Items</p>
              <div className="space-y-4">
                {order?.items?.map((item, index) => (
                  <div key={index} className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-5 h-5 rounded border border-green-600 dark:border-green-500 flex items-center justify-center mt-0.5 shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-600 dark:bg-green-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 dark:text-slate-100 leading-tight">{asDisplayText(item.name, "Item")}</p>
                        {item.variantName && <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{asDisplayText(item.variantName)}</p>}
                        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Quantity: {item.quantity}</p>
                      </div>
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-slate-100">₹{((item?.price || 0) * (item?.quantity || 0)).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 space-y-3 border border-gray-100 dark:border-white/10">
              <p className="text-sm font-bold text-gray-900 dark:text-slate-100 uppercase tracking-wider mb-1">Bill Summary</p>
              {[
                ["Item Total", order?.pricing?.subtotal || order?.subtotal],
                Number(order?.pricing?.packagingFee || order?.packagingFee) > 0 && ["Packaging Charges", order?.pricing?.packagingFee || order?.packagingFee],
                Number(order?.pricing?.platformFee || order?.platformFee) > 0 && ["Platform Fee", order?.pricing?.platformFee || order?.platformFee],
                ["Delivery Fee", order?.pricing?.deliveryFee || order?.deliveryFee],
                ["Taxes & Charges (GST)", order?.pricing?.tax || order?.pricing?.gst || order?.gst],
              ].filter(Boolean).map(([label, val]) => (
                <div key={label} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-slate-400">{label}</span>
                  <span className="text-gray-900 dark:text-slate-100 font-medium">₹{Number(val || 0).toFixed(2)}</span>
                </div>
              ))}
              {Number(order?.pricing?.discount || order?.discount) > 0 && (
                <div className="flex justify-between items-center text-sm text-green-600 dark:text-green-400 font-medium">
                  <span>Discount Applied</span>
                  <span>-₹{Number(order?.pricing?.discount || order?.discount).toFixed(2)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-gray-200 dark:border-white/10 flex justify-between items-center">
                <span className="text-base font-bold text-gray-900 dark:text-slate-100">Total Amount</span>
                <span className="text-lg font-bold text-gray-900 dark:text-slate-100">₹{Number(order?.totalAmount || 0).toFixed(2)}</span>
              </div>
              {(order?.hasReturn || Number(order?.refundedAmount || order?.returnSummary?.refundedAmount || 0) > 0) ? (
                <div className="pt-2 border-t border-amber-100 dark:border-amber-500/20 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    {order?.returnStatusLabel || "Return / refund"}
                  </p>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-slate-400">Original paid</span>
                    <span className="text-gray-900 dark:text-slate-100 font-medium">
                      ₹{Number(order?.originalPaidTotal || order?.returnSummary?.originalPaidTotal || order?.totalAmount || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-rose-600 dark:text-rose-400 font-medium">
                    <span>Refunded</span>
                    <span>-₹{Number(order?.refundedAmount || order?.returnSummary?.refundedAmount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold text-amber-800 dark:text-amber-300">
                    <span>Net after return</span>
                    <span>₹{Number(order?.netAfterReturn ?? order?.returnSummary?.netAfterReturn ?? 0).toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500">
                    Delivery, platform and packing fees are not refunded. Item coupon share is adjusted; GST on returned items is refunded.
                  </p>
                </div>
              ) : null}
            </div>
            {order?.paymentMethod && (
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm font-medium">Payment Method</span>
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-slate-100 uppercase tracking-wide">{asDisplayText(order.paymentMethod)}</span>
              </div>
            )}
          </div>
          <div className="p-6 border-t border-gray-100 dark:border-white/10">
            <Button onClick={() => setShowOrderDetails(false)} className="w-full bg-gray-900 dark:bg-slate-100 dark:text-gray-900 text-white font-bold h-12 rounded-xl">Okay</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delivery Instructions Dialog */}
      <Dialog open={isInstructionsModalOpen} onOpenChange={setIsInstructionsModalOpen}>
        <DialogContent hideOverlay={true} className="sm:max-w-md w-[95vw] rounded-3xl p-6 border dark:border-gray-800 shadow-2xl bg-white dark:bg-gray-900 max-h-[90vh] overflow-y-auto z-[200]">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-red-600 to-red-400 bg-clip-text text-transparent">Delivery Instructions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Add instructions for the delivery partner to help them find your address or know where to leave your order.</p>
            <Textarea value={deliveryInstructions} onChange={(e) => setDeliveryInstructions(e.target.value)} placeholder="E.g. Ring the doorbell, leave at the front desk..." className="min-h-[120px] resize-none border-gray-200 dark:border-gray-700 focus:ring-red-500 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-base" />
            <Button onClick={handleUpdateInstructions} disabled={isUpdatingInstructions} className="w-full bg-gradient-to-r from-red-500 to-amber-500 hover:from-red-600 hover:to-amber-600 text-white font-bold h-12 rounded-xl border-none">
              {isUpdatingInstructions ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Save Instructions"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rating Modal */}
      <AnimatePresence>
        {ratingModal.open && ratingModal.order && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-sm rounded-2xl bg-white dark:bg-card shadow-2xl overflow-hidden border border-transparent dark:border-white/10">
              <div className="bg-gradient-to-r from-red-600 to-red-500 px-5 py-4">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2"><Star className="w-4 h-4 fill-white" />Rate Your Experience</h2>
                  <button type="button" onClick={handleCloseRating} className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20"><X className="w-4 h-4" /></button>
                </div>
                <p className="text-xs text-white/90">{ratingModal.order.restaurant}</p>
              </div>
              <div className="px-5 py-4 space-y-4">
                {[
                  { key: 'restaurant', label: isQuickOrder ? 'Store rating' : 'Restaurant rating', rating: selectedRestaurantRating, setRating: setSelectedRestaurantRating, text: restaurantFeedbackText, setText: setRestaurantFeedbackText, placeholder: "Tell us what you liked (optional)", show: true },
                  { key: 'delivery', label: 'Delivery partner rating', rating: selectedDeliveryRating, setRating: setSelectedDeliveryRating, text: deliveryFeedbackText, setText: setDeliveryFeedbackText, placeholder: "How was the delivery? (optional)", show: !!order?.deliveryPartnerId },
                ].filter((s) => s.show).map((section, sIdx) => (
                  <div key={section.key} className={sIdx > 0 ? "pt-3 border-t border-gray-100 dark:border-white/10" : ""}>
                    <p className="text-xs font-semibold text-gray-900 dark:text-slate-100 mb-2">{section.label} (out of 5)</p>
                    <div className="flex items-center justify-center gap-1 mb-2">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button key={`${section.key}-${num}`} type="button" onClick={() => section.setRating(num)} className="p-1 transition-transform hover:scale-125 active:scale-95">
                          <Star className={`w-8 h-8 transition-all ${(section.rating || 0) >= num ? "text-yellow-400 fill-yellow-400 drop-shadow-lg" : "text-gray-200 dark:text-slate-600 hover:text-yellow-200"}`} />
                        </button>
                      ))}
                    </div>
                    <Textarea rows={1} value={section.text} onChange={(e) => section.setText(e.target.value)} className="w-full rounded-lg border-2 border-gray-100 dark:border-white/10 px-3 py-1.5 text-xs text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 bg-white dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none transition-all" placeholder={section.placeholder} />
                  </div>
                ))}
                <Button type="button" disabled={submittingRating || selectedRestaurantRating === null || (!!order?.deliveryPartnerId && selectedDeliveryRating === null)} onClick={handleSubmitRating} className="w-full rounded-lg bg-gradient-to-r from-red-600 to-red-500 text-white text-sm font-bold h-10 hover:from-red-700 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2">
                  {submittingRating ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting...</> : <><Check className="w-4 h-4" />Submit Ratings</>}
                </Button>
                {selectedRestaurantRating === null && <p className="text-[9px] text-center text-gray-400">Please select a rating to enable submission</p>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
