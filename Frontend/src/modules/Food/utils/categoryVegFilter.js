/**
 * Veg-mode visibility for storefront categories.
 *
 * The public categories API ships live item counts per category (only orderable
 * items from approved + listed restaurants are counted):
 * - `vegItemCount`     → vegetarian items anywhere
 * - `nonVegItemCount`  → non-vegetarian items, i.e. what makes a category "mixed"
 * - `pureVegItemCount` → vegetarian items inside fully vegetarian restaurants
 *
 * The toggle offers the same two choices the restaurant list uses:
 * - "pure" → "Veg from pure veg restaurants only": the category must have veg items
 *   in a pure-veg outlet, and must not be a mixed category.
 * - "all"  → "Veg from all restaurants": any orderable veg dish keeps the category.
 */
export const isCategoryVisibleForVegMode = (category, vegMode) => {
  if (!vegMode) return true;
  if (!category) return false;

  if (String(category.foodTypeScope || "") === "Non-Veg") return false;

  const vegCount = Number(category.vegItemCount);
  // Sources without counts (menu-derived / landing fallbacks) stay visible.
  if (!Number.isFinite(vegCount)) return true;
  if (vegCount <= 0) return false;

  if (vegMode !== "pure") return true;

  const nonVegCount = Number(category.nonVegItemCount);
  if (Number.isFinite(nonVegCount) && nonVegCount > 0) return false;

  const pureVegCount = Number(category.pureVegItemCount);
  if (!Number.isFinite(pureVegCount)) return true;
  return pureVegCount > 0;
};

export const filterCategoriesForVegMode = (categories, vegMode) => {
  if (!vegMode || !Array.isArray(categories)) return categories;
  return categories.filter((category) => isCategoryVisibleForVegMode(category, vegMode));
};
