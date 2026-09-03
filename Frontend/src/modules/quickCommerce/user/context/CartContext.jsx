import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Store } from "lucide-react";
import { customerApi } from "../services/customerApi";
import { useAuth } from "@core/context/AuthContext";

const CartContext = createContext();
const QUICK_CART_STORAGE_KEY = "quick_commerce_cart";

export const useCart = () => useContext(CartContext);

const isQuickCartItem = (item) => {
  if (!item || typeof item !== "object") return false;
  if (item.orderType === "quick" || item.type === "quick") return true;

  return Boolean(
    item.quickStoreId ||
      item.storeId ||
      item.store?.id ||
      item.store?._id ||
      item.sellerId ||
      item.seller?.id ||
      item.seller?._id,
  );
};

const readStoredQuickCart = () => {
  try {
    const quickCart = localStorage.getItem(QUICK_CART_STORAGE_KEY);
    if (quickCart) {
      const parsedQuickCart = JSON.parse(quickCart);
      return Array.isArray(parsedQuickCart)
        ? parsedQuickCart.filter(isQuickCartItem)
        : [];
    }

    const legacyCart = localStorage.getItem("cart");
    if (!legacyCart) return [];

    const parsedLegacyCart = JSON.parse(legacyCart);
    const quickItems = Array.isArray(parsedLegacyCart)
      ? parsedLegacyCart.filter(isQuickCartItem)
      : [];

    if (quickItems.length > 0) {
      localStorage.setItem(QUICK_CART_STORAGE_KEY, JSON.stringify(quickItems));
    }
    return quickItems;
  } catch (error) {
    console.error("Failed to load quick cart from localStorage", error);
    return [];
  }
};

const normalizeProductId = (value) => {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) return "";
  return rawValue.split("::")[0];
};

const getProductId = (product) =>
  normalizeProductId(
    product?.productId || product?.itemId || product?.id || product?._id,
  );

const getQuickStoreName = (product) =>
  product?.restaurant ||
  product?.restaurantName ||
  product?.storeName ||
  product?.store?.name ||
  product?.storeId?.name ||
  product?.seller?.name ||
  product?.sellerId?.name ||
  "Quick Commerce";

const getQuickStoreId = (product) =>
  product?.restaurantId ||
  product?.restaurant?._id ||
  product?.storeId?._id ||
  product?.storeId?.id ||
  product?.store?._id ||
  product?.store?.id ||
  product?.sellerId?._id ||
  product?.sellerId?.id ||
  product?.seller?._id ||
  product?.seller?.id ||
  "quick-commerce";

const getSellerId = (product) => {
  const candidate =
    product?.sellerId?._id ||
    product?.sellerId?.id ||
    (typeof product?.sellerId === "string" ? product?.sellerId : "") ||
    product?.seller?._id ||
    product?.seller?.id ||
    (typeof product?.seller === "string" ? product?.seller : "") ||
    product?.storeId?._id ||
    product?.storeId?.id ||
    (typeof product?.storeId === "string" ? product?.storeId : "") ||
    product?.store?._id ||
    product?.store?.id ||
    product?.quickStoreId ||
    "";
  return candidate ? String(candidate).trim() : "";
};

const getSellerName = (product) => {
  return (
    product?.seller?.shopName ||
    product?.seller?.name ||
    product?.sellerId?.shopName ||
    product?.sellerId?.name ||
    product?.storeName ||
    product?.store?.shopName ||
    product?.store?.name ||
    product?.storeId?.name ||
    product?.restaurant ||
    product?.restaurantName ||
    product?.quickStoreName ||
    "Current Store"
  );
};

const normalizeQuickProductForSharedCart = (product) => {
  const id = getProductId(product);
  const quickStoreId = getQuickStoreId(product);
  const quickStoreName = getQuickStoreName(product);
  const salePrice = Number(product?.salePrice || 0);
  const basePrice = Number(product?.price || 0);
  const originalPrice = Number(
    product?.originalPrice ?? product?.mrp ?? product?.price ?? salePrice ?? 0,
  );

  return {
    ...product,
    id,
    _id: product?._id || id,
    orderType: "quick",
    type: "quick",
    image: product?.image || product?.mainImage,
    mainImage: product?.mainImage || product?.image,
    price: salePrice > 0 ? salePrice : basePrice,
    salePrice,
    mrp: originalPrice,
    originalPrice,
    quickStoreName,
    quickStoreId,
    sourceId: quickStoreId,
    sourceName: quickStoreName,
    restaurant: quickStoreName,
    restaurantId: quickStoreId,
  };
};

const getCartItemKey = (product, variant) => {
  const baseId = getProductId(product);
  if (variant?._id) return `${baseId}::${variant._id}`;
  if (variant?.name) return `${baseId}::${variant.name}`;
  return baseId;
};

const shrinkCartItem = (item) => {
  if (!item) return null;
  // Only keep essential fields to minimize localStorage footprint and avoid QuotaExceededError
  return {
    id: item.id || item._id,
    _id: item._id || item.id,
    productId: item.productId || item.id || item._id,
    name: item.name,
    price: Number(item.price || 0),
    salePrice: Number(item.salePrice || 0),
    mrp: Number(item.mrp || 0),
    originalPrice: Number(item.originalPrice || 0),
    quantity: Number(item.quantity || 0),
    image: item.image,
    mainImage: item.mainImage,
    categoryId: item.categoryId || null,
    subcategoryId: item.subcategoryId || null,
    headerId: item.headerId || null,
    quickStoreId: item.quickStoreId,
    quickStoreName: item.quickStoreName,
    variantId: item.variantId || null,
    variantName: item.variantName || null,
    orderType: "quick",
    type: "quick",
  };
};

const persistQuickCartSnapshot = (items) => {
  try {
    if (Array.isArray(items) && items.length > 0) {
      const shrunkItems = items.map(shrinkCartItem).filter(Boolean);
      localStorage.setItem(QUICK_CART_STORAGE_KEY, JSON.stringify(shrunkItems));
    } else {
      localStorage.removeItem(QUICK_CART_STORAGE_KEY);
    }
  } catch (error) {
    if (error.name === "QuotaExceededError") {
      console.warn("Storage quota exceeded. Attempting to clear space...");
      try {
        // Fallback: remove non-essential keys if needed, or just clear this specific key
        // For now, we've shrunk the items, if it still fails, it's a very large cart
        // or other data is hogging space.
        const legacyKeys = [
          "cart",
          "recent_searches",
          "search_history",
          "appzeto_recent_searches",
          "user_recent_searches_v1",
        ];
        legacyKeys.forEach(key => {
            if (key !== QUICK_CART_STORAGE_KEY) localStorage.removeItem(key);
        });
      } catch (e) {
        console.error("Critical storage failure", e);
      }
    }
    console.error("Failed to persist quick cart snapshot", error);
  }
};

const useStandaloneQuickCart = () => {
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState(() => readStoredQuickCart());
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [conflictData, setConflictData] = useState(null);

  const [loading, setLoading] = useState(Boolean(isAuthenticated));
  const pendingRequestsRef = useRef(0);
  const debounceTimersRef = useRef(new Map());
  const pendingSyncRef = useRef(new Map());

  // Cleanup pending debounce timers on unmount
  useEffect(() => {
    return () => {
      debounceTimersRef.current.forEach((timer) => clearTimeout(timer));
      debounceTimersRef.current.clear();
      pendingSyncRef.current.clear();
    };
  }, []);

  const resolveConflict = async (proceed) => {
    if (!proceed || !conflictData) {
      setConflictData(null);
      return;
    }
    const { product, variant } = conflictData;
    setConflictData(null);

    // Optimistically clear local cart
    setCart([]);
    localStorage.removeItem(QUICK_CART_STORAGE_KEY);

    // Add new product with bypassConflict = true
    addToCart(product, variant, true);
  };

  const normalizeBackendCart = (items) => {
    if (!items) return [];
    return items.map((item) => ({
      ...item,
      quickStoreId: getQuickStoreId(item),
      quickStoreName: getQuickStoreName(item),
      ...item,
      id: getProductId(item),
      _id: getProductId(item),
      productId: getProductId(item),
      itemId: getProductId(item),
      quantity: Number(item.quantity || 1),
      categoryId: item.categoryId || null,
      subcategoryId: item.subcategoryId || null,
      headerId: item.headerId || null,
      image: item.mainImage || item.image || "",
      mainImage: item.mainImage || item.image || "",
      price: Number(item.price || 0),
      mrp: Number(item.mrp || item.price || 0),
      orderType: "quick",
      type: "quick",
      sourceId: getQuickStoreId(item),
      sourceName: getQuickStoreName(item),
      restaurant: getQuickStoreName(item),
      restaurantId: getQuickStoreId(item),
    }));
  };

  const syncCart = (backendItems) => {
    if (pendingRequestsRef.current === 0) {
      setCart((prev) => {
        // Keep variant items from local state (backend doesn't understand variants)
        const localVariantItems = prev.filter((item) => item.variantId || item.variantName);
        const backendNormalized = normalizeBackendCart(backendItems);
        // Exclude backend items whose base productId already has variant items locally
        const variantBaseIds = new Set(localVariantItems.map((item) =>
          normalizeProductId(item.baseProductId || item.productId || item.id || item._id)
        ));
        const filteredBackend = backendNormalized.filter(
          (item) => !variantBaseIds.has(getProductId(item))
        );
        return [...filteredBackend, ...localVariantItems];
      });
    }
  };

  const fetchCart = async () => {
    if (isAuthenticated) {
      setLoading(true);
      try {
        const response = await customerApi.getCart();
        const items = response.data?.result?.items || response.data?.items || [];
        const backendNormalized = normalizeBackendCart(items);
        setCart((prev) => {
          // Preserve variant items from local/localStorage state
          const localVariantItems = prev.filter((item) => item.variantId || item.variantName);
          const variantBaseIds = new Set(localVariantItems.map((item) =>
            normalizeProductId(item.baseProductId || item.productId || item.id || item._id)
          ));
          const filteredBackend = backendNormalized.filter(
            (item) => !variantBaseIds.has(getProductId(item))
          );
          return [...filteredBackend, ...localVariantItems];
        });
      } catch (error) {
        console.error("Failed to fetch cart from backend", error);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchCart();
    } else {
      try {
        setLoading(false);
        setCart(readStoredQuickCart());
      } catch (error) {
        setCart([]);
      }
    }
  }, [isAuthenticated]);

  // Sync cart when localStorage changes (e.g., cleared from another tab)
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === QUICK_CART_STORAGE_KEY) {
        if (!e.newValue) {
          setCart([]);
        } else {
          try {
            const parsed = JSON.parse(e.newValue);
            if (Array.isArray(parsed)) setCart(parsed);
          } catch {}
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    persistQuickCartSnapshot(cart);
  }, [cart]);

  const addToCart = async (product, variant = null, bypassConflict = false) => {
    const baseId = getProductId(product);
    if (!baseId) return false;

    const newSellerId = getSellerId(product);
    const newSellerName = getSellerName(product);

    // Single-seller rule: Check if cart already has items from another store
    if (!bypassConflict && cart.length > 0 && newSellerId) {
      const existingSellerItem = cart.find((it) => getSellerId(it));
      const existingSellerId = existingSellerItem ? getSellerId(existingSellerItem) : null;
      if (existingSellerId && String(existingSellerId) !== String(newSellerId)) {
        setConflictData({
          existingStoreName: getSellerName(existingSellerItem),
          newStoreName: newSellerName,
          product,
          variant,
        });
        return false;
      }
    }

    const cartKey = getCartItemKey(product, variant);

    // Build variant-aware price fields
    const variantSalePrice = variant ? Number(variant.salePrice || 0) : 0;
    const variantBasePrice = variant ? Number(variant.price || 0) : 0;
    const effectivePrice = variant
      ? (variantSalePrice > 0 ? variantSalePrice : variantBasePrice)
      : Number(product.salePrice || product.price || 0);
    const effectiveStock = variant ? Number(variant.stock ?? product.stock ?? Infinity) : Number(product.stock ?? Infinity);

    setCart((prev) => {
      const currentList = bypassConflict ? [] : prev;
      const existingItem = currentList.find((item) => {
        const itemKey = item.variantId
          ? `${normalizeProductId(item.productId || item.id || item._id)}::${item.variantId}`
          : item.variantName
            ? `${normalizeProductId(item.productId || item.id || item._id)}::${item.variantName}`
            : normalizeProductId(item.productId || item.id || item._id);
        return itemKey === cartKey;
      });
      if (existingItem) {
        const stock = Number(existingItem.stock ?? effectiveStock);
        if (existingItem.quantity >= stock) return currentList; // already at stock limit
        return currentList.map((item) => {
          const itemKey = item.variantId
            ? `${normalizeProductId(item.productId || item.id || item._id)}::${item.variantId}`
            : item.variantName
              ? `${normalizeProductId(item.productId || item.id || item._id)}::${item.variantName}`
              : normalizeProductId(item.productId || item.id || item._id);
          return itemKey === cartKey ? { ...item, quantity: item.quantity + 1 } : item;
        });
      }
      return [
        ...currentList,
        {
          ...product,
          id: cartKey,
          _id: cartKey,
          productId: cartKey,
          itemId: cartKey,
          baseProductId: baseId,
          orderType: "quick",
          type: "quick",
          sellerId: newSellerId,
          sellerName: newSellerName,
          quickStoreId: getQuickStoreId(product),
          quickStoreName: getQuickStoreName(product),
          sourceId: getQuickStoreId(product),
          sourceName: getQuickStoreName(product),
          restaurant: getQuickStoreName(product),
          restaurantId: getQuickStoreId(product),
          quantity: 1,
          price: effectivePrice,
          salePrice: variant ? variantSalePrice : Number(product.salePrice || 0),
          originalPrice: variant ? variantBasePrice : Number(product.originalPrice || product.mrp || product.price || 0),
          mrp: variant ? variantBasePrice : Number(product.mrp || product.originalPrice || product.price || 0),
          stock: effectiveStock,
          variantId: variant?._id || null,
          variantName: variant?.name || null,
          name: variant ? `${product.name} (${variant.name})` : product.name,
          categoryId: product.categoryId || null,
          subcategoryId: product.subcategoryId || null,
          headerId: product.headerId || null,
          image: product.image || product.mainImage,
          mainImage: product.mainImage || product.image,
        },
      ];
    });

    if (isAuthenticated) {
      pendingRequestsRef.current += 1;
      try {
        const response = await customerApi.addToCart({
          productId: baseId,
          quantity: 1,
          clearPrevious: bypassConflict,
        });
        pendingRequestsRef.current -= 1;
        // Skip syncing backend response when variant is involved, because the backend
        // has no variant awareness and would overwrite variant-specific prices with
        // the base product price, causing incorrect totals.
        if (!variant) {
          syncCart(response.data?.result?.items || response.data?.items);
        }
      } catch (error) {
        pendingRequestsRef.current -= 1;
        if (!variant && pendingRequestsRef.current === 0) await fetchCart();
      }
    }
  };

  const getItemCartKey = (item) => {
    const baseId = normalizeProductId(item?.productId || item?.itemId || item?.id || item?._id);
    if (item?.variantId) return `${baseId}::${item.variantId}`;
    if (item?.variantName) return `${baseId}::${item.variantName}`;
    return baseId;
  };

  const scheduleBackendSync = (baseProductId, targetQuantity) => {
    if (!isAuthenticated || !baseProductId) return;

    // Record the latest intended quantity
    pendingSyncRef.current.set(baseProductId, targetQuantity);

    // Cancel existing pending debounce timer for this product
    if (debounceTimersRef.current.has(baseProductId)) {
      clearTimeout(debounceTimersRef.current.get(baseProductId));
    }

    const timer = setTimeout(async () => {
      debounceTimersRef.current.delete(baseProductId);
      const finalQty = pendingSyncRef.current.get(baseProductId);
      pendingSyncRef.current.delete(baseProductId);

      if (finalQty === undefined) return;

      pendingRequestsRef.current += 1;
      try {
        if (finalQty <= 0) {
          const response = await customerApi.removeFromCart(baseProductId);
          pendingRequestsRef.current -= 1;
          syncCart(response.data?.result?.items || response.data?.items);
        } else {
          const response = await customerApi.updateCartQuantity({
            productId: baseProductId,
            quantity: finalQty,
          });
          pendingRequestsRef.current -= 1;
          syncCart(response.data?.result?.items || response.data?.items);
        }
      } catch (error) {
        pendingRequestsRef.current -= 1;
        // If item not found in backend cart, try fallback addToCart
        if (error?.response?.status === 404 && finalQty > 0) {
          try {
            await customerApi.addToCart({
              productId: baseProductId,
              quantity: finalQty,
            });
          } catch (addError) {
            console.error("Failed to fallback-add item to cart", addError);
          }
        } else if (pendingRequestsRef.current === 0) {
          await fetchCart();
        }
      }
    }, 450); // 450ms debounce window to prevent rapid successive API calls

    debounceTimersRef.current.set(baseProductId, timer);
  };

  const removeFromCart = (cartKeyOrProductId) => {
    if (!cartKeyOrProductId) return;
    const baseProductId = normalizeProductId(cartKeyOrProductId);

    setCart((prev) => prev.filter((item) => getItemCartKey(item) !== cartKeyOrProductId));

    scheduleBackendSync(baseProductId, 0);
  };

  const updateQuantity = (cartKeyOrProductId, delta) => {
    if (!cartKeyOrProductId) return;
    const baseProductId = normalizeProductId(cartKeyOrProductId);

    const currentItem = cart.find((item) => getItemCartKey(item) === cartKeyOrProductId);
    if (!currentItem) return;
    const stock = Number(currentItem.stock ?? Infinity);
    const newQty = Math.max(0, Math.min(currentItem.quantity + delta, stock));
    if (newQty === currentItem.quantity && delta > 0) return; // already at stock limit
    if (newQty === 0) {
      removeFromCart(cartKeyOrProductId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        getItemCartKey(item) === cartKeyOrProductId ? { ...item, quantity: newQty } : item,
      ),
    );

    scheduleBackendSync(baseProductId, newQty);
  };

  const clearCart = async () => {
    debounceTimersRef.current.forEach((timer) => clearTimeout(timer));
    debounceTimersRef.current.clear();
    pendingSyncRef.current.clear();

    setCart([]); // optimistic clear immediately

    if (isAuthenticated) {
      try {
        await customerApi.clearCart();
      } catch (error) {
        console.error("Error clearing cart on backend", error);
      }
    }
  };

  const cartTotal = cart.reduce(
    (total, item) => total + (item.price || 0) * item.quantity,
    0,
  );
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  return {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    cartTotal,
    cartCount,
    loading,
    appliedCoupon,
    setAppliedCoupon,
    conflictData,
    resolveConflict,
    getCartItemKey,
    getItemCartKey,
  };
};

export const CartProvider = ({ children }) => {
  const standaloneCart = useStandaloneQuickCart();
  const { conflictData, resolveConflict } = standaloneCart;

  return (
    <CartContext.Provider value={standaloneCart}>
      {children}
      {conflictData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-card w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-border text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-950/40 text-[#FE5502] flex items-center justify-center mx-auto shadow-inner">
              <Store size={28} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base md:text-lg font-black text-slate-900 dark:text-foreground">
                Replace cart items?
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Your cart already contains items from <span className="font-bold text-slate-900 dark:text-slate-100">"{conflictData.existingStoreName}"</span>. Do you want to clear your current cart and add items from <span className="font-bold text-[#FE5502]">"{conflictData.newStoreName}"</span>?
              </p>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => resolveConflict(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-border text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => resolveConflict(true)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#FE5502] hover:bg-[#ea580c] text-xs font-black text-white shadow-md transition-all active:scale-95"
              >
                Discard & Add
              </button>
            </div>
          </div>
        </div>
      )}
    </CartContext.Provider>
  );
};
