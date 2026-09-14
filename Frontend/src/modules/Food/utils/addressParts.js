/**
 * Shared Google Geocoder / Places address_components → outlet address fields.
 * Used by restaurant ZoneSetup / EditRestaurantAddress so admin review gets city/area/etc.
 */

export function extractAddressPartsFromGoogleComponents(components = []) {
  const parts = {
    addressLine1: "",
    area: "",
    city: "",
    state: "",
    pincode: "",
    landmark: "",
  };
  if (!Array.isArray(components) || !components.length) return parts;

  const getFirst = (types) => {
    for (const type of types) {
      const match = components.find(
        (comp) => Array.isArray(comp?.types) && comp.types.includes(type) && comp.long_name,
      );
      if (match?.long_name) return String(match.long_name).trim();
    }
    return "";
  };

  const streetBits = [];
  for (const type of ["premise", "street_number", "route", "sublocality_level_3"]) {
    const value = getFirst([type]);
    if (value && !streetBits.includes(value)) streetBits.push(value);
  }
  parts.addressLine1 = streetBits.join(", ");

  // India often uses plain "sublocality" without level_1/2.
  parts.area = getFirst([
    "sublocality_level_1",
    "sublocality_level_2",
    "sublocality",
    "neighborhood",
  ]);

  // City is frequently administrative_area_level_2/3 when "locality" is missing.
  parts.city = getFirst([
    "locality",
    "administrative_area_level_3",
    "administrative_area_level_2",
  ]);

  parts.state = getFirst(["administrative_area_level_1"]);
  parts.pincode = getFirst(["postal_code"]);

  return parts;
}

/**
 * Fill any still-empty fields from a formatted address string
 * e.g. "Bholaram Ustad Marg, Sector C, Sarvanand Nagar, Indore, Madhya Pradesh 452001, India"
 */
export function fillAddressPartsFromFormatted(formatted = "", parts = {}) {
  const next = {
    addressLine1: String(parts.addressLine1 || "").trim(),
    area: String(parts.area || "").trim(),
    city: String(parts.city || "").trim(),
    state: String(parts.state || "").trim(),
    pincode: String(parts.pincode || "").trim(),
    landmark: String(parts.landmark || "").trim(),
  };

  const text = String(formatted || "").trim();
  if (!text) return next;

  const pinMatch = text.match(/\b(\d{6})\b/);
  if (!next.pincode && pinMatch) next.pincode = pinMatch[1];

  const chunks = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^india$/i.test(part));

  if (!chunks.length) return next;

  // Last chunk often "Madhya Pradesh 452001"
  const last = chunks[chunks.length - 1] || "";
  const lastWithoutPin = last.replace(/\b\d{6}\b/, "").trim();
  if (!next.state && lastWithoutPin) next.state = lastWithoutPin;

  if (!next.city && chunks.length >= 2) {
    next.city = chunks[chunks.length - 2];
  }
  if (!next.area && chunks.length >= 3) {
    next.area = chunks[chunks.length - 3];
  }
  if (!next.addressLine1 && chunks[0]) {
    next.addressLine1 = chunks[0];
  }

  return next;
}

/** Normalize parts after geocode + formatted fallback. */
export function resolveOutletAddressParts(components, formattedAddress) {
  return fillAddressPartsFromFormatted(
    formattedAddress,
    extractAddressPartsFromGoogleComponents(components),
  );
}
