const isPlaceholderAddressPart = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  return !normalized || normalized === "NA" || normalized === "N/A";
};

export const formatDeliveryAddressText = (address = {}, fallback = "") => {
  if (!address || typeof address !== "object") {
    return String(fallback || "").trim();
  }

  const explicit = String(
    address.formattedAddress ||
      address.completeAddress ||
      address.customerAddress ||
      fallback ||
      "",
  ).trim();

  const parts = [
    address.street || address.address || address.addressLine1,
    address.additionalDetails || address.landmark,
    address.city,
    address.state,
    address.zipCode || address.pincode,
  ]
    .map((part) => String(part || "").trim())
    .filter((part) => !isPlaceholderAddressPart(part));

  const merged = [...new Set(parts)].join(", ");
  if (merged) return merged;

  if (explicit && !isPlaceholderAddressPart(explicit)) {
    return explicit
      .split(",")
      .map((part) => part.trim())
      .filter((part) => !isPlaceholderAddressPart(part))
      .join(", ");
  }

  return "";
};

export const normalizeLocationPoint = (value) => {
  if (!value || typeof value !== "object") return null;

  // Prefer explicit lat/lng (socket payload sets these correctly from GeoJSON).
  // Checking coordinates first can pick swapped [lat,lng] stored by mistake.
  const explicitLat = Number(value.lat ?? value.latitude);
  const explicitLng = Number(value.lng ?? value.longitude);
  if (Number.isFinite(explicitLat) && Number.isFinite(explicitLng)) {
    return { lat: explicitLat, lng: explicitLng };
  }

  if (Array.isArray(value.coordinates) && value.coordinates.length >= 2) {
    const a = Number(value.coordinates[0]);
    const b = Number(value.coordinates[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      // fall through
    } else {
      // GeoJSON is [lng, lat]. Swapped [lat, lng] is common in bad data:
      // for India, lat ≈ 8–35 and lng ≈ 68–97, so |first|<45 & |second|>45 ⇒ swapped.
      const looksSwapped = Math.abs(a) <= 45 && Math.abs(b) > 45;
      const lat = looksSwapped ? a : b;
      const lng = looksSwapped ? b : a;
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  }

  if (value.location && typeof value.location === "object") {
    const nested = normalizeLocationPoint(value.location);
    if (nested) return nested;
  }

  return null;
};

const GENERIC_CUSTOMER_NAMES = new Set(["", "customer", "unknown", "guest", "user"]);

export const isGenericCustomerLabel = (value) =>
  GENERIC_CUSTOMER_NAMES.has(String(value || "").trim().toLowerCase());

/** Real customer name for rider UI. Never keep the placeholder "Customer" if a real name exists. */
export const resolveDeliveryCustomerName = (order, fallback = "Customer") => {
  const candidates = [
    order?.customerName,
    order?.userName,
    order?.customer?.name,
    order?.user?.name,
    order?.userId?.name,
    order?.userId?.fullName,
    order?.deliveryAddress?.name,
    order?.address?.name,
    Array.isArray(order?.pickupPoints) ? order.pickupPoints[0]?.sourceName : "",
    Array.isArray(order?.pickupPoints) ? order.pickupPoints[0]?.name : "",
  ];
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value && !isGenericCustomerLabel(value)) return value;
  }
  return fallback;
};

export const normalizePickupPoints = (order) => {
  const isReturn = isReturnPickupTrip(order);
  const raw = Array.isArray(order?.pickupPoints) ? order.pickupPoints : [];
  const explicitOrderType = String(
    order?.orderType || order?.serviceType || order?.type || "",
  )
    .trim()
    .toLowerCase();
  const normalized = raw
    .map((point, index) => {
      const location = normalizeLocationPoint(point?.location);
      if (!location && !isReturn) return null;
      const pickupType = point?.pickupType === "quick" ? "quick" : "food";
      const sourceName = String(
        (isReturn
          ? (!isGenericCustomerLabel(point?.sourceName) && point?.sourceName) ||
            (!isGenericCustomerLabel(point?.name) && point?.name) ||
            resolveDeliveryCustomerName(order)
          : point?.sourceName ||
            point?.name ||
            (pickupType === "quick" ? "Seller store" : "Restaurant")),
      ).trim();
      const address = String(
        point?.address ||
          point?.formattedAddress ||
          point?.location?.address ||
          point?.location?.formattedAddress ||
          "",
      ).trim();
      return {
        id: point?.legId || `${pickupType || "pickup"}:${point?.sourceId || index}`,
        pickupType,
        sourceId: String(point?.sourceId || ""),
        sourceName,
        address: address || order?.customerAddress || "",
        phone: String(
          point?.phone ||
            point?.contactPhone ||
            order?.customerPhone ||
            order?.userPhone ||
            "",
        ).trim(),
        location,
      };
    })
    .filter(Boolean);

  if (normalized.length > 0) return normalized;

  const dispatchLegLocation = normalizeLocationPoint(
    order?.dispatchLeg?.location ||
      order?.pickupLocation ||
      order?.restaurantLocation ||
      order?.restaurantId,
  );
  const dispatchLegId = String(order?.dispatchLeg?.legId || "").trim();
  if (dispatchLegLocation && dispatchLegId) {
    const pickupType = order?.dispatchLeg?.pickupType === "quick" ? "quick" : "food";
    const sourceName = String(
      order?.dispatchLeg?.sourceName ||
        (pickupType === "quick"
          ? order?.storeName || order?.sellerName || "Seller store"
          : order?.restaurantName || order?.restaurantId?.restaurantName || "Restaurant"),
    ).trim();
    const address = String(
      order?.dispatchLeg?.address ||
        order?.pickupAddress ||
        (pickupType === "quick"
          ? order?.storeAddress || order?.sellerAddress
          : order?.restaurantAddress || order?.restaurantLocation?.address) ||
        "",
    ).trim();

    return [
      {
        id: dispatchLegId,
        pickupType,
        sourceId: String(order?.dispatchLeg?.sourceId || ""),
        sourceName,
        address: address || "",
        phone: String(
          order?.dispatchLeg?.phone ||
            (pickupType === "quick"
              ? order?.storePhone || order?.sellerPhone
              : order?.restaurantPhone || order?.restaurantId?.phone) ||
            "",
        ).trim(),
        location: dispatchLegLocation,
      },
    ];
  }

  const restaurantLocation = normalizeLocationPoint(
    order?.restaurantLocation || order?.restaurantId || order?.storeLocation || order?.sellerLocation,
  );
  if (!restaurantLocation) return [];
  const fallbackPickupType = explicitOrderType === "quick" ? "quick" : "food";
  const fallbackSourceName = String(
    fallbackPickupType === "quick"
      ? order?.storeName ||
          order?.sellerName ||
          order?.seller?.shopName ||
          order?.seller?.name ||
          "Seller store"
      : order?.restaurantName || order?.restaurantId?.restaurantName || order?.restaurantId?.name || "Restaurant",
  ).trim();
  const fallbackAddress = String(
    fallbackPickupType === "quick"
      ? order?.storeAddress ||
          order?.sellerAddress ||
          order?.seller?.location?.address ||
          order?.seller?.location?.formattedAddress ||
          ""
      : order?.restaurantAddress || order?.restaurantLocation?.address || ""
  ).trim();
  const fallbackPhone = String(
    fallbackPickupType === "quick"
      ? order?.storePhone || order?.sellerPhone || order?.seller?.phone || ""
      : order?.restaurantPhone || order?.restaurantId?.phone || ""
  ).trim();

  return [
    {
      id: `${fallbackPickupType}:primary`,
      pickupType: fallbackPickupType,
      sourceId: String(
        fallbackPickupType === "quick"
          ? order?.storeId || order?.sellerId || order?.seller?._id || ""
          : order?.restaurantId?._id || order?.restaurantId || "",
      ),
      sourceName: fallbackSourceName,
      address: fallbackAddress || "",
      phone: fallbackPhone,
      location: restaurantLocation,
    },
  ];
};

export const getPrimaryPickupLocation = (order) => {
  const pickupPoints = normalizePickupPoints(order);
  return pickupPoints[0]?.location || null;
};

export const isReturnPickupTrip = (order) =>
  String(order?.tripType || "").trim() === "return_pickup" ||
  String(order?.documentType || "").trim() === "seller_return";

export const enrichIncomingDeliveryOrder = (order = {}) => {
  return enrichReturnDeliveryOrder({
    ...order,
    pickupPoints: normalizePickupPoints(order),
    customerLocation:
      order.customerLocation ||
      normalizeLocationPoint(order.deliveryAddress?.location) ||
      normalizeLocationPoint(order.deliveryAddress),
    customerAddress: formatDeliveryAddressText(
      order.deliveryAddress,
      order.customerAddress || order.customer_address || "",
    ),
  });
};

export const getReturnPickupStopLabels = () => ({
  pickupLabel: "Pickup From Customer",
  dropLabel: "Drop To Seller",
});

const DEFAULT_RESTAURANT_LOGO =
  "https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png";

const normalizeImageUrl = (raw) => {
  if (!raw) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "object" && typeof raw.url === "string") {
    return raw.url.trim();
  }
  return "";
};

/** Resolve restaurant/store logo for delivery trip UI (pickup modal, map markers). */
export const resolveRestaurantImageUrl = (order = {}) => {
  const ref = order?.restaurantId || order?.restaurant;
  const candidates = [
    order?.restaurantImage,
    order?.restaurant?.logo,
    order?.restaurant?.profileImage,
    order?.restaurant?.image,
    typeof ref === "object" ? ref?.profileImage : null,
    typeof ref === "object" ? ref?.image : null,
    typeof ref === "object" ? ref?.logo : null,
  ];
  for (const raw of candidates) {
    const url = normalizeImageUrl(raw);
    if (url) return url;
  }
  return "";
};

export const resolveRestaurantLogoForDelivery = (order = {}) =>
  resolveRestaurantImageUrl(order) || DEFAULT_RESTAURANT_LOGO;

export const enrichReturnDeliveryOrder = (order = {}) => {
  if (!isReturnPickupTrip(order)) return order;

  const dropPoint = order?.dropPoint || null;
  return {
    ...order,
    tripType: order.tripType || "return_pickup",
    documentType: order.documentType || "seller_return",
    returnId: order.returnId || order.orderMongoId || order._id || order.id,
    customerName: resolveDeliveryCustomerName(order),
    userName: resolveDeliveryCustomerName(order),
    customerPhone: order.customerPhone || order.userPhone || order.pickupPoints?.[0]?.phone || "",
    storeName: order.storeName || dropPoint?.sourceName || order.restaurantName || order.sellerName || "Seller",
    storePhone: order.storePhone || dropPoint?.phone || order.sellerPhone || order.restaurantPhone || "",
    storeAddress: order.storeAddress || dropPoint?.address || order.restaurantAddress || "",
    sellerName: order.sellerName || dropPoint?.sourceName || order.storeName || order.restaurantName || "Seller",
    sellerPhone: order.sellerPhone || dropPoint?.phone || order.storePhone || order.restaurantPhone || "",
    riderEarning:
      order.riderEarning ||
      order.earnings ||
      order.tripEarning ||
      order.walletEarning ||
      0,
    earnings:
      order.earnings ||
      order.riderEarning ||
      order.tripEarning ||
      order.walletEarning ||
      0,
    dropPoint,
  };
};

export const getReturnDropLocation = (order) => {
  const drop = order?.dropPoint;
  if (drop) {
    const location = normalizeLocationPoint(drop?.location);
    if (location) return location;
  }
  return normalizeLocationPoint(
    order?.restaurantLocation ||
      order?.restaurantId ||
      order?.storeLocation ||
      order?.sellerLocation,
  );
};

export const getDeliveryDocumentId = (order) => {
  if (isReturnPickupTrip(order)) {
    return String(order?.returnId || order?.orderMongoId || order?._id || order?.id || "");
  }
  return String(order?.orderId || order?.orderMongoId || order?._id || order?.id || "");
};

export const isMixedOrder = (order) => {
  const explicitType = String(
    order?.orderType || order?.serviceType || order?.type || "",
  )
    .trim()
    .toLowerCase();

  if (explicitType === "mixed") return true;

  const pickupPoints = normalizePickupPoints(order);
  if (pickupPoints.length <= 1) return false;

  const pickupTypes = new Set(
    pickupPoints.map((point) => String(point?.pickupType || "food").toLowerCase()),
  );

  return pickupTypes.size > 1;
};
