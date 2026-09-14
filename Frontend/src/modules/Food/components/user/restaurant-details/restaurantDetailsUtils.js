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

  const covers = (Array.isArray(restaurant.coverImages) ? restaurant.coverImages : [])
    .map(toImageUrl)
    .filter(Boolean);
  const menus = (Array.isArray(restaurant.menuImages) ? restaurant.menuImages : [])
    .map(toImageUrl)
    .filter(Boolean);
  const profile = toImageUrl(restaurant.profileImage);
  const primary = toImageUrl(restaurant.image);

  const combined = [...covers, ...menus, profile, primary].filter(Boolean);
  return combined.filter((url, index) => combined.indexOf(url) === index);
};
