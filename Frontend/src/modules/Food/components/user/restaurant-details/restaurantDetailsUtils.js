export const FOOD_IMAGE_FALLBACK = "https://picsum.photos/seed/food-fallback/800/600";
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
