// Neutral inline placeholder (plate + fork/knife) — a random stock photo looked like a real dish image.
export const FOOD_IMAGE_FALLBACK =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#f3f4f6"/>' +
      '<circle cx="400" cy="300" r="110" fill="none" stroke="#d1d5db" stroke-width="14"/>' +
      '<circle cx="400" cy="300" r="70" fill="none" stroke="#e5e7eb" stroke-width="8"/>' +
      '<path d="M235 200v70a18 18 0 0 0 18 18v112M253 200v60M271 200v70a18 18 0 0 1-18 18" fill="none" stroke="#d1d5db" stroke-width="12" stroke-linecap="round"/>' +
      '<path d="M565 400V200c-25 15-35 55-35 95h35" fill="none" stroke="#d1d5db" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  );
export const RUPEE_SYMBOL = "\u20B9";

const toImageUrl = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && value.url) return String(value.url).trim();
  return "";
};

export const buildRestaurantGallery = (restaurant) => {
  if (!restaurant) return [];

  // Banner shows only the restaurant's profile picture (no cover/menu images).
  // Empty result lets the hero fall back to FOOD_IMAGE_FALLBACK.
  const profile = toImageUrl(restaurant.profileImage);
  return profile ? [profile] : [];
};
