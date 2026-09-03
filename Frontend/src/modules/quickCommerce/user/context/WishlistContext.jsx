import React, { createContext, useContext, useState, useEffect } from "react";
import { customerApi } from "../services/customerApi";
import { useAuth } from "@core/context/AuthContext";

const WishlistContext = createContext();

export const useWishlist = () => useContext(WishlistContext);

const normalizeWishlistId = (value) => String(value ?? "").split("::")[0];

const normalizeWishlistProduct = (item, fallback = {}) => {
  const source =
    typeof item === "string"
      ? { ...fallback, id: item, _id: item }
      : { ...fallback, ...(item || {}) };
  const normalizedId = normalizeWishlistId(source.id || source._id);

  if (!normalizedId) return null;

  return {
    ...source,
    id: normalizedId,
    _id: normalizedId,
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
        return normalized ? [normalized.id, normalized] : null;
      })
      .filter(Boolean),
  );

  return products
    .map((product) => {
      const productId = normalizeWishlistId(
        typeof product === "string" ? product : product?._id || product?.id,
      );
      return normalizeWishlistProduct(product, fallbackMap.get(productId) || {});
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

  const addToWishlist = async (product) => {
    if (isAuthenticated) {
      try {
        const response = await customerApi.addToWishlist({
          productId: product.id || product._id,
        });
        const products = response?.data?.result?.products || [];
        setWishlist((prev) => buildWishlistFromProducts(products, [...prev, product]));
        setIsFullDataFetched(true);
      } catch (error) {
        console.error("Error adding to wishlist on backend", error);
      }
    } else {
      setWishlist((prev) => {
        const normalizedProduct = normalizeWishlistProduct(product);
        if (!normalizedProduct) return prev;
        if (
          prev.some(
            (item) =>
              normalizeWishlistId(item.id || item._id) === normalizedProduct.id,
          )
        ) {
          return prev;
        }
        return [...prev, normalizedProduct];
      });
    }
  };

  const removeFromWishlist = async (productId) => {
    if (isAuthenticated) {
      try {
        const response = await customerApi.removeFromWishlist(productId);
        const normalizedId = normalizeWishlistId(productId);
        const products = response?.data?.result?.products || [];
        setWishlist((prev) =>
          buildWishlistFromProducts(
            products,
            prev.filter(
              (item) => normalizeWishlistId(item.id || item._id) !== normalizedId,
            ),
          ),
        );
        setIsFullDataFetched(true);
      } catch (error) {
        console.error("Error removing from wishlist on backend", error);
      }
    } else {
      const normalizedId = normalizeWishlistId(productId);
      setWishlist((prev) =>
        prev.filter(
          (item) => normalizeWishlistId(item.id || item._id) !== normalizedId,
        ),
      );
    }
  };

  const toggleWishlist = async (product) => {
    const id = normalizeWishlistId(product.id || product._id);
    if (isAuthenticated) {
      try {
        const response = await customerApi.toggleWishlist({ productId: id });
        const products = response?.data?.result?.products || [];
        setWishlist((prev) => buildWishlistFromProducts(products, [...prev, product]));
        setIsFullDataFetched(true);
      } catch (error) {
        console.error("Error toggling wishlist on backend", error);
      }
    } else {
      if (isInWishlist(id)) {
        removeFromWishlist(id);
      } else {
        addToWishlist(product);
      }
    }
  };

  const isInWishlist = (productId) => {
    const normalizedId = normalizeWishlistId(productId);
    return wishlist.some(
      (item) => normalizeWishlistId(item.id || item._id) === normalizedId,
    );
  };

  const clearWishlist = async () => {
    if (isAuthenticated) {
      try {
        const ids = wishlist
          .map((item) => normalizeWishlistId(item.id || item._id))
          .filter(Boolean);
        await Promise.all(ids.map((id) => customerApi.removeFromWishlist(id)));
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
