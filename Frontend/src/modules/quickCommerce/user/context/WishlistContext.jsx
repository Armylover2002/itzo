import React, { createContext, useContext, useState, useEffect } from "react";
import { customerApi } from "../services/customerApi";
import { useAuth } from "@core/context/AuthContext";

const WishlistContext = createContext();

export const useWishlist = () => useContext(WishlistContext);

const normalizeProductId = (value) => String(value ?? "").split("::")[0];
const normalizeVariantId = (variant) => {
  if (variant && typeof variant === "object") {
    return String(variant._id || variant.name || "");
  }
  return String(variant ?? "");
};

// One wishlist entry is identified by (productId, variantId) together, not
// productId alone — liking two variants of the same product must keep both,
// and toggling one must never touch the other.
const getWishlistKey = (productId, variantId) =>
  variantId ? `${productId}::${variantId}` : productId;

const normalizeWishlistProduct = (item, fallback = {}) => {
  const source =
    typeof item === "string"
      ? { ...fallback, id: item, _id: item }
      : { ...fallback, ...(item || {}) };
  const productId = normalizeProductId(source.id || source._id);
  if (!productId) return null;

  const variantId = normalizeVariantId(source.variantId || "");

  return {
    ...source,
    id: productId,
    _id: productId,
    variantId,
    variantName: source.variantName || "",
    wishlistKey: getWishlistKey(productId, variantId),
    name: source.name,
    price: Number(source.price || source.salePrice || 0),
    salePrice: Number(source.salePrice || source.price || 0),
    originalPrice: Number(
      source.originalPrice || source.mrp || source.salePrice || source.price || 0,
    ),
    image: source.image || source.mainImage,
    mainImage: source.mainImage || source.image,
    deliveryTime: source.deliveryTime,
    discount: source.discount,
  };
};

const buildWishlistFromProducts = (products = [], fallbackItems = []) => {
  const fallbackMap = new Map(
    fallbackItems
      .map((item) => {
        const normalized = normalizeWishlistProduct(item);
        return normalized ? [normalized.wishlistKey, normalized] : null;
      })
      .filter(Boolean),
  );

  return products
    .map((product) => {
      const productId = normalizeProductId(
        typeof product === "string" ? product : product?._id || product?.id,
      );
      const variantId = normalizeVariantId(
        (typeof product === "object" && product?.variantId) || "",
      );
      const key = getWishlistKey(productId, variantId);
      return normalizeWishlistProduct(product, fallbackMap.get(key) || {});
    })
    .filter(Boolean);
};

export const WishlistProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [wishlist, setWishlist] = useState(() => {
    try {
      const savedWishlist = localStorage.getItem("wishlist");
      return savedWishlist ? JSON.parse(savedWishlist) : [];
    } catch (error) {
      console.error("Failed to load wishlist from localStorage", error);
      return [];
    }
  });

  const [loading, setLoading] = useState(false);
  const [isFullDataFetched, setIsFullDataFetched] = useState(false);

  const shrinkWishlistItem = (item) => {
    return normalizeWishlistProduct(item);
  };

  // Fetch wishlist from backend on mount or authentication change
  const fetchWishlistIds = async () => {
    if (isAuthenticated) {
      setLoading(true);
      try {
        const response = await customerApi.getWishlist({ idsOnly: true });
        const products = response.data.result.products || [];
        setWishlist((prev) => buildWishlistFromProducts(products, prev));
        setIsFullDataFetched(false);
      } catch (error) {
        console.error("Failed to fetch wishlist from backend", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const fetchFullWishlist = async () => {
    if (isAuthenticated) {
      setLoading(true);
      try {
        const response = await customerApi.getWishlist({ idsOnly: false });
        const products = response.data.result.products || [];
        setWishlist((prev) => buildWishlistFromProducts(products, prev));
        setIsFullDataFetched(true);
      } catch (error) {
        console.error("Failed to fetch full wishlist from backend", error);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchWishlistIds();
    } else {
      // Clear state or load from local storage
      try {
        const savedWishlist = localStorage.getItem("wishlist");
        setWishlist(savedWishlist ? JSON.parse(savedWishlist) : []);
        setIsFullDataFetched(true); // Local storage always has full data
      } catch (error) {
        setWishlist([]);
      }
    }
  }, [isAuthenticated]);

  // Save local wishlist to localStorage (fallback/guest mode)
  useEffect(() => {
    if (!isAuthenticated) {
      try {
        const shrunkWishlist = wishlist.map(shrinkWishlistItem).filter(Boolean);
        localStorage.setItem("wishlist", JSON.stringify(shrunkWishlist));
      } catch (error) {
        if (error.name === "QuotaExceededError") {
          console.warn("Wishlist storage quota exceeded. Attempting to clear space...");
          try {
            localStorage.removeItem("recent_searches");
            localStorage.removeItem("search_history");
            localStorage.removeItem("appzeto_recent_searches");
            localStorage.removeItem("user_recent_searches_v1");
          } catch (e) {
            // ignore cleanup errors
          }
        }
        console.error("Failed to save wishlist to localStorage", error);
      }
    }
  }, [wishlist, isAuthenticated]);

  const addToWishlist = async (product, variant) => {
    const variantId = normalizeVariantId(variant);
    const variantName = variant?.name || "";
    const productWithVariant = { ...product, variantId, variantName };

    if (isAuthenticated) {
      try {
        const response = await customerApi.addToWishlist({
          productId: product.id || product._id,
          variantId,
        });
        const products = response?.data?.result?.products || [];
        setWishlist((prev) => buildWishlistFromProducts(products, [...prev, productWithVariant]));
        setIsFullDataFetched(true);
      } catch (error) {
        console.error("Error adding to wishlist on backend", error);
      }
    } else {
      setWishlist((prev) => {
        const normalizedProduct = normalizeWishlistProduct(productWithVariant);
        if (!normalizedProduct) return prev;
        if (prev.some((item) => item.wishlistKey === normalizedProduct.wishlistKey)) {
          return prev;
        }
        return [...prev, normalizedProduct];
      });
    }
  };

  const removeFromWishlist = async (productId, variant) => {
    const baseId = normalizeProductId(productId);
    const variantId = normalizeVariantId(variant);
    const key = getWishlistKey(baseId, variantId);

    if (isAuthenticated) {
      try {
        const response = await customerApi.removeFromWishlist(baseId, variantId);
        const products = response?.data?.result?.products || [];
        setWishlist((prev) =>
          buildWishlistFromProducts(
            products,
            prev.filter((item) => item.wishlistKey !== key),
          ),
        );
        setIsFullDataFetched(true);
      } catch (error) {
        console.error("Error removing from wishlist on backend", error);
      }
    } else {
      setWishlist((prev) => prev.filter((item) => item.wishlistKey !== key));
    }
  };

  const toggleWishlist = async (product, variant) => {
    const productId = product.id || product._id;
    const variantId = normalizeVariantId(variant);

    if (isAuthenticated) {
      try {
        const response = await customerApi.toggleWishlist({ productId, variantId });
        const productWithVariant = { ...product, variantId, variantName: variant?.name || "" };
        const products = response?.data?.result?.products || [];
        setWishlist((prev) => buildWishlistFromProducts(products, [...prev, productWithVariant]));
        setIsFullDataFetched(true);
      } catch (error) {
        console.error("Error toggling wishlist on backend", error);
      }
    } else {
      if (isInWishlist(productId, variant)) {
        removeFromWishlist(productId, variant);
      } else {
        addToWishlist(product, variant);
      }
    }
  };

  const isInWishlist = (productId, variant) => {
    const key = getWishlistKey(normalizeProductId(productId), normalizeVariantId(variant));
    return wishlist.some((item) => item.wishlistKey === key);
  };

  const clearWishlist = async () => {
    if (isAuthenticated) {
      try {
        const keys = wishlist
          .map((item) => ({ productId: normalizeProductId(item.id || item._id), variantId: item.variantId }))
          .filter((entry) => entry.productId);
        await Promise.all(keys.map(({ productId, variantId }) => customerApi.removeFromWishlist(productId, variantId)));
      } catch (error) {
        console.error("Error clearing wishlist on backend", error);
      }
    }

    setWishlist([]);
    setIsFullDataFetched(true);
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlist,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        isInWishlist,
        clearWishlist,
        fetchFullWishlist,
        isFullDataFetched,
        count: wishlist.length,
        loading,
      }}>
      {children}
    </WishlistContext.Provider>
  );
};
