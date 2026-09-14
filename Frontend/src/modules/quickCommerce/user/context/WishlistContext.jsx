import React, { createContext, useContext, useState, useEffect } from "react";
import { customerApi } from "../services/customerApi";
import { useAuth } from "@core/context/AuthContext";
import { useLocation as useAppLocation } from "./LocationContext";
import { applyVariantToProduct } from "../utils/productMeta";
import {
  buildWishlistApiPayload,
  buildWishlistEntryId,
  buildWishlistVariantMeta,
  getWishlistFallbackKey,
  getWishlistItemForProduct,
  getWishlistItemForVariant,
  isSameWishlistVariantEntry,
  isWishlistVariantMatch,
  mergeWishlistVariantFields,
  normalizeWishlistProductId,
  resolveWishlistVariant,
} from "../utils/wishlistVariant";

const WishlistContext = createContext();

export const useWishlist = () => useContext(WishlistContext);

const normalizeWishlistProduct = (item, fallback = {}) => {
  const source =
    typeof item === "string"
      ? { ...fallback, id: item, _id: item }
      : item?.productId
        ? { ...fallback, ...(item || {}), id: item.productId, _id: item.productId }
        : { ...fallback, ...(item || {}) };
  const normalizedId = normalizeWishlistProductId(source.id || source._id);

  if (!normalizedId) return null;

  const merged = mergeWishlistVariantFields(source, fallback);
  const savedVariant = resolveWishlistVariant(merged);
  const withVariant = savedVariant
    ? applyVariantToProduct({ ...merged, id: normalizedId, _id: normalizedId }, savedVariant)
    : merged;
  const variantMeta = buildWishlistVariantMeta(withVariant);
  const entryId = buildWishlistEntryId(normalizedId, variantMeta);

  return {
    ...withVariant,
    id: entryId,
    _id: entryId,
    productId: normalizedId,
    wishlistEntryId: entryId,
    name: withVariant.name,
    price: Number(withVariant.price || withVariant.salePrice || 0),
    salePrice: Number(withVariant.salePrice || withVariant.price || 0),
    originalPrice: Number(
      withVariant.originalPrice || withVariant.mrp || withVariant.salePrice || withVariant.price || 0,
    ),
    image: withVariant.image || withVariant.mainImage || withVariant.galleryImages?.[0] || "",
    mainImage: withVariant.mainImage || withVariant.image || withVariant.galleryImages?.[0] || "",
    stock: Number(withVariant.stock || 0),
    totalStock: Number(withVariant.totalStock ?? withVariant.stock ?? 0),
    variants: Array.isArray(withVariant.variants) ? withVariant.variants : [],
    weight: withVariant.weight,
    unit: withVariant.unit,
    deliveryTime: withVariant.deliveryTime,
    discount: withVariant.discount,
    selectedVariant: savedVariant || withVariant.selectedVariant || null,
    ...variantMeta,
  };
};

const buildWishlistFromProducts = (products = [], fallbackItems = []) => {
  const fallbackMap = new Map(
    fallbackItems
      .map((item) => {
        const normalized = normalizeWishlistProduct(item);
        return normalized ? [getWishlistFallbackKey(normalized), normalized] : null;
      })
      .filter(Boolean),
  );

  return products
    .map((product) => {
      if (product && typeof product === "object" && product.productId && !product.name) {
        const productId = normalizeWishlistProductId(product.productId);
        const fallbackKey = buildWishlistEntryId(productId, product);
        return normalizeWishlistProduct(
          product,
          fallbackMap.get(fallbackKey) || fallbackMap.get(productId) || {},
        );
      }
      const productId = normalizeWishlistProductId(
        typeof product === "string" ? product : product?._id || product?.id,
      );
      const fallbackKey = buildWishlistEntryId(productId, buildWishlistVariantMeta(product));
      return normalizeWishlistProduct(
        product,
        fallbackMap.get(fallbackKey) || fallbackMap.get(productId) || {},
      );
    })
    .filter(Boolean);
};

export const WishlistProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { currentLocation } = useAppLocation();
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

  const shrinkWishlistItem = (item) => normalizeWishlistProduct(item);

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
        const params = { idsOnly: false };
        if (Number.isFinite(currentLocation?.latitude) && Number.isFinite(currentLocation?.longitude)) {
          params.lat = currentLocation.latitude;
          params.lng = currentLocation.longitude;
        }
        const response = await customerApi.getWishlist(params);
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
      try {
        const savedWishlist = localStorage.getItem("wishlist");
        setWishlist(savedWishlist ? JSON.parse(savedWishlist) : []);
        setIsFullDataFetched(true);
      } catch (error) {
        setWishlist([]);
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      try {
        const shrunkWishlist = wishlist.map(shrinkWishlistItem).filter(Boolean);
        localStorage.setItem("wishlist", JSON.stringify(shrunkWishlist));
      } catch (error) {
        if (error.name === "QuotaExceededError") {
          try {
            localStorage.removeItem("recent_searches");
            localStorage.removeItem("search_history");
            localStorage.removeItem("appzeto_recent_searches");
            localStorage.removeItem("user_recent_searches_v1");
          } catch {
            // ignore cleanup errors
          }
        }
        console.error("Failed to save wishlist to localStorage", error);
      }
    }
  }, [wishlist, isAuthenticated]);

  const addToWishlist = async (product) => {
    const payload = buildWishlistApiPayload(product);
    const wishlistProduct = normalizeWishlistProduct(product);

    if (isAuthenticated) {
      try {
        const response = await customerApi.addToWishlist(payload);
        const products = response?.data?.result?.products || [];
        setWishlist((prev) => buildWishlistFromProducts(products, prev));
        setIsFullDataFetched(true);
      } catch (error) {
        console.error("Error adding to wishlist on backend", error);
      }
    } else {
      setWishlist((prev) => {
        if (!wishlistProduct) return prev;
        const others = prev.filter(
          (item) =>
            normalizeWishlistProductId(item.id || item._id) !== wishlistProduct.productId ||
            !isSameWishlistVariantEntry(item, wishlistProduct.selectedVariant),
        );
        return [...others, wishlistProduct];
      });
    }
  };

  const removeFromWishlist = async (productId, variant = null) => {
    const normalizedId = normalizeWishlistProductId(productId);
    const variantMeta = variant ? buildWishlistVariantMeta({ selectedVariant: variant }) : null;
    if (isAuthenticated) {
      try {
        const response = await customerApi.removeFromWishlist(normalizedId, variantMeta);
        const products = response?.data?.result?.products || [];
        setWishlist((prev) =>
          buildWishlistFromProducts(
            products,
            prev.filter((item) => {
              if (normalizeWishlistProductId(item.id || item._id) !== normalizedId) return true;
              return !isWishlistVariantMatch(item, variant);
            }),
          ),
        );
        setIsFullDataFetched(true);
      } catch (error) {
        console.error("Error removing from wishlist on backend", error);
      }
    } else {
      setWishlist((prev) =>
        prev.filter((item) => {
          if (normalizeWishlistProductId(item.id || item._id) !== normalizedId) return true;
          return !isWishlistVariantMatch(item, variant);
        }),
      );
    }
  };

  const toggleWishlist = async (product) => {
    const payload = buildWishlistApiPayload(product);
    const id = payload.productId;
    const selectedVariant = product?.selectedVariant || null;
    const existing = getWishlistItemForVariant(wishlist, id, selectedVariant);
    const shouldRemove = Boolean(existing);
    const optimisticProduct = normalizeWishlistProduct(product);

    setWishlist((prev) => {
      const others = prev.filter((item) => {
        if (normalizeWishlistProductId(item.id || item._id) !== id) return true;
        return !isSameWishlistVariantEntry(item, selectedVariant);
      });
      if (shouldRemove || !optimisticProduct) return others;
      return [...others, optimisticProduct];
    });

    if (isAuthenticated) {
      try {
        const response = await customerApi.toggleWishlist(payload);
        const products = response?.data?.result?.products || [];
        setWishlist((prev) => buildWishlistFromProducts(products, prev));
        setIsFullDataFetched(true);
      } catch (error) {
        console.error("Error toggling wishlist on backend", error);
        fetchWishlistIds();
      }
      return;
    }

    if (shouldRemove) {
      await removeFromWishlist(id, selectedVariant);
      return;
    }
    await addToWishlist(product);
  };

  const isInWishlist = (productId) => {
    const normalizedId = normalizeWishlistProductId(productId);
    return wishlist.some(
      (item) => normalizeWishlistProductId(item.id || item._id) === normalizedId,
    );
  };

  const isVariantWishlisted = (productId, variant = null) => {
    return Boolean(getWishlistItemForVariant(wishlist, productId, variant));
  };

  const getSavedWishlistVariant = (productId) => {
    const normalizedId = normalizeWishlistProductId(productId);
    const item = wishlist.find(
      (entry) => normalizeWishlistProductId(entry.id || entry._id) === normalizedId,
    );
    return item ? resolveWishlistVariant(item) : null;
  };

  const clearWishlist = async () => {
    if (isAuthenticated) {
      try {
        const uniqueProductIds = [
          ...new Set(
            wishlist
              .map((item) => normalizeWishlistProductId(item.id || item._id))
              .filter(Boolean),
          ),
        ];
        await Promise.all(uniqueProductIds.map((id) => customerApi.removeFromWishlist(id)));
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
        isVariantWishlisted,
        getSavedWishlistVariant,
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
