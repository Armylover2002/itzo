const STANDALONE_BASE = "/quick";

export const isEmbeddedQuickPath = () => false;

export const getQuickHomePath = () => STANDALONE_BASE;

export const getQuickCartPath = () => `${STANDALONE_BASE}/cart`;

export const getQuickCheckoutPath = () => `${STANDALONE_BASE}/checkout`;

export const getQuickSearchPath = () => `${STANDALONE_BASE}/search`;
export const getQuickProductsPath = () => `${STANDALONE_BASE}/products`;
export const getQuickProductPath = (productId) =>
  `${STANDALONE_BASE}/product/${productId}`;
export const getQuickCategoriesPath = () => `${STANDALONE_BASE}/categories`;
export const getQuickCategoryPath = (categoryId) => {
  const id = typeof categoryId === 'object' && categoryId !== null 
    ? (categoryId._id || categoryId.id || String(categoryId)) 
    : categoryId;
  return `${STANDALONE_BASE}/categories/${id}`;
};
export const getQuickProfilePath = () => `/quick/profile`;
export const getQuickWishlistPath = () => `${STANDALONE_BASE}/wishlist`;
export const getQuickOffersPath = () => `${STANDALONE_BASE}/offers`;
export const getQuickOrdersPath = () => `${STANDALONE_BASE}/orders`;
export const getQuickOrderDetailPath = (orderId) =>
  `${STANDALONE_BASE}/orders/${orderId}`;
export const getQuickAddressesPath = () => `${STANDALONE_BASE}/addresses`;
export const getQuickSupportPath = () => `${STANDALONE_BASE}/support`;
export const getQuickWalletPath = () => `${STANDALONE_BASE}/wallet`;
