// src/context/cart-context.jsx
import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react"
import { buildCartLineId } from "@food/utils/foodVariants"
import ReplaceCartModal from "@food/components/user/cart/ReplaceCartModal"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


// Default cart context value to prevent errors during initial render
const defaultCartContext = {
  _isProvider: false, // Flag to identify if this is from the actual provider
  cart: [],
  items: [],
  itemCount: 0,
  total: 0,
  lastAddEvent: null,
  lastRemoveEvent: null,
  addToCart: () => {
    debugWarn('CartProvider not available - addToCart called');
  },
  removeFromCart: () => {
    debugWarn('CartProvider not available - removeFromCart called');
  },
  updateQuantity: () => {
    debugWarn('CartProvider not available - updateQuantity called');
  },
  getCartCount: () => 0,
  isInCart: () => false,
  getCartItem: () => null,
  clearCart: () => {
    debugWarn('CartProvider not available - clearCart called');
  },
  cleanCartForRestaurant: () => {
    debugWarn('CartProvider not available - cleanCartForRestaurant called');
  },
  replaceCart: () => {
    debugWarn('CartProvider not available - replaceCart called');
  },
}

const CartContext = createContext(defaultCartContext)

const getItemOrderType = (item) => (item?.orderType === "quick" ? "quick" : "food")
const getItemSourceId = (item, orderType) =>
  String(
    item?.sourceId ||
      (orderType === "quick"
        ? item?.quickStoreId || item?.storeId || item?.sellerId || item?.restaurantId || ""
        : item?.restaurantId || item?.sourceRestaurantId || ""),
  )

const normalizeCartData = (rawCart) => {
  if (!Array.isArray(rawCart)) return []

  return rawCart
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const parsedQuantity = Number(item.quantity)
      const parsedPrice = Number(item.price)
      const normalizedRestaurantName =
        typeof item.restaurant === "string"
          ? item.restaurant
          : typeof item.restaurant?.name === "string"
            ? item.restaurant.name
            : ""

      const normalizedRestaurantId =
        item.restaurantId ||
        item.restaurant_id ||
        item.restaurant?._id ||
        item.restaurant?.restaurantId ||
        null

      const normalizedImage =
        item.image ||
        item.imageUrl ||
        item.product?.imageUrl ||
        item.product?.image ||
        ""

      const baseItemId =
        item.itemId ||
        item.productId ||
        item.foodId ||
        item.baseItemId ||
        item.menuItemId ||
        item.id ||
        item._id ||
        `cart-item-${index}`

      const variantId = item.variantId || item.variant?._id || item.variant?.id || ""
      const variantName =
        typeof item.variantName === "string"
          ? item.variantName
          : typeof item.variant?.name === "string"
            ? item.variant.name
            : ""
      const parsedVariantPrice = Number(
        item.variantPrice ?? item.variant?.price ?? item.price,
      )
      const orderType = item.orderType === "quick" ? "quick" : "food"
      const sourceId = getItemSourceId(item, orderType)
      const lineItemId =
        item.lineItemId ||
        item.cartLineId ||
        buildCartLineId(baseItemId, variantId)

      return {
        ...item,
        id: lineItemId,
        lineItemId,
        itemId: String(baseItemId),
        productId: String(baseItemId),
        variantId: variantId ? String(variantId) : "",
        variantName,
        variantPrice: Number.isFinite(parsedVariantPrice) ? parsedVariantPrice : 0,
        name: item.name || item.product?.name || "Item",
        orderType,
        type: orderType,
        sourceId,
        sourceName:
          item.sourceName ||
          (orderType === "quick"
            ? item.quickStoreName || item.storeName || item.sellerName || "Quick Commerce"
            : normalizedRestaurantName),
        quantity:
          Number.isFinite(parsedQuantity) && parsedQuantity > 0
            ? Math.floor(parsedQuantity)
            : 1,
        price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
        otherPrice: Number(item.otherPrice) || 0,
        restaurant: normalizedRestaurantName,
        restaurantId: normalizedRestaurantId,
        image: normalizedImage,
        imageUrl: normalizedImage,
      }
    })
}

const resolveCartEntryId = (items, itemId, variantId = "") => {
  const normalizedItemId = String(itemId || "")
  const safeItems = Array.isArray(items) ? items : []

  const directMatch = safeItems.find((item) => item.id === normalizedItemId)
  if (directMatch) return directMatch.id

  const preferredId = buildCartLineId(normalizedItemId, variantId)

  const exactMatch = safeItems.find((item) => item.id === preferredId)
  if (exactMatch) return exactMatch.id

  if (!variantId) {
    const legacyBaseMatch = safeItems.find(
      (item) =>
        String(item.itemId || item.productId || item.id || "") === normalizedItemId &&
        !String(item.variantId || "").trim(),
    )
    if (legacyBaseMatch) return legacyBaseMatch.id
  }

  return preferredId
}

export function CartProvider({ children }) {
  // Safe init (works with SSR and bad JSON)
  const [cart, setCart] = useState(() => {
    if (typeof window === "undefined") return []
    try {
      const saved = localStorage.getItem("cart")
      const parsed = saved ? JSON.parse(saved) : []
      return normalizeCartData(parsed)
    } catch {
      return []
    }
  })

  // Track last add event for animation
  const [lastAddEvent, setLastAddEvent] = useState(null)
  // Track last remove event for animation
  const [lastRemoveEvent, setLastRemoveEvent] = useState(null)

  // Track pending item when user tries to add item from a different restaurant
  const [pendingReplaceItem, setPendingReplaceItem] = useState(null)

  // Stable normalized cart — avoids redundant normalizeCartData calls across all action fns
  const normalizedCart = useMemo(() => normalizeCartData(cart), [cart])

  // Persist to localStorage whenever cart changes
  useEffect(() => {
    try {
      // Only save if we have items or user is authenticated to avoid cluttering localStorage for every guest visitor
      const isAuthenticated = localStorage.getItem("user_authenticated") === "true" || !!localStorage.getItem("user_accessToken");
      if (cart.length > 0) {
        localStorage.setItem("cart", JSON.stringify(normalizeCartData(cart)))
      } else {
        localStorage.removeItem("cart")
      }
    } catch {
      // ignore storage errors (private mode, quota, etc.)
    }
  }, [cart])

  const addToCart = useCallback((item, sourcePosition = null) => {
    if (normalizedCart.length > 0) {
      const currentOrderType = getItemOrderType(normalizedCart[0])
      const nextOrderType = getItemOrderType(item)

      if (currentOrderType === "food" && nextOrderType === "food") {
        const firstItemRestaurantId = normalizedCart[0]?.restaurantId
        const firstItemRestaurantName = normalizedCart[0]?.restaurant
        const newItemRestaurantId = item?.restaurantId
        const newItemRestaurantName = item?.restaurant
        const normalizeName = (name) => (name ? String(name).trim().toLowerCase() : '')

        const firstRestaurantNameNormalized = normalizeName(firstItemRestaurantName)
        const newRestaurantNameNormalized = normalizeName(newItemRestaurantName)
        const hasNameMismatch =
          firstRestaurantNameNormalized &&
          newRestaurantNameNormalized &&
          firstRestaurantNameNormalized !== newRestaurantNameNormalized

        const hasIdMismatch =
          !firstRestaurantNameNormalized &&
          !newRestaurantNameNormalized &&
          firstItemRestaurantId &&
          newItemRestaurantId &&
          String(firstItemRestaurantId) !== String(newItemRestaurantId)

        if (hasNameMismatch || hasIdMismatch) {
          setPendingReplaceItem(prev => {
            if (prev) return prev; // Keep the first modal if already open
            return {
              item,
              sourcePosition,
              previousRestaurantName: firstItemRestaurantName || 'another restaurant',
              newRestaurantName: newItemRestaurantName || 'new restaurant'
            };
          })
          return { ok: true, pendingReplace: true }
        }
      }
    }

    if (!item?.restaurantId && !item?.restaurant) {
      return {
        ok: false,
        error: 'Item is missing restaurant information. Please refresh the page.',
        code: 'MISSING_RESTAURANT'
      }
    }

    setCart((prev) => {
      const safePrev = normalizeCartData(prev)
      const existingOrderType = getItemOrderType(safePrev[0])
      const incomingOrderType = getItemOrderType(item)

      if (safePrev.length > 0 && existingOrderType === "food" && incomingOrderType === "food") {
        const firstItemRestaurantId = safePrev[0]?.restaurantId;
        const firstItemRestaurantName = safePrev[0]?.restaurant;
        const newItemRestaurantId = item?.restaurantId;
        const newItemRestaurantName = item?.restaurant;
        
        const normalizeName = (name) => name ? name.trim().toLowerCase() : '';
        const firstRestaurantNameNormalized = normalizeName(firstItemRestaurantName);
        const newRestaurantNameNormalized = normalizeName(newItemRestaurantName);
        
        if (firstRestaurantNameNormalized && newRestaurantNameNormalized) {
          if (firstRestaurantNameNormalized !== newRestaurantNameNormalized) {
            debugError('❌ Cannot add item: Restaurant name mismatch!', { firstItemRestaurantId, newItemRestaurantId });
            return safePrev;
          }
        } else if (firstItemRestaurantId && newItemRestaurantId) {
          if (firstItemRestaurantId !== newItemRestaurantId) {
            debugError('❌ Cannot add item: Cart contains items from different restaurant!', { firstItemRestaurantId, newItemRestaurantId });
            return safePrev;
          }
        }
      }
      
      const resolvedItemId = resolveCartEntryId(safePrev, item.id || item.itemId || item._id, item.variantId)
      const existing = safePrev.find((i) => i.id === resolvedItemId)
      
      if (existing) {
        if (sourcePosition) {
          setLastAddEvent({ product: { id: item.id, name: item.name, imageUrl: item.image || item.imageUrl }, sourcePosition })
          setTimeout(() => setLastAddEvent(null), 1500)
        }
        return safePrev.map((i) => i.id === resolvedItemId ? { ...i, quantity: i.quantity + 1 } : i)
      }
      
      if (!item.restaurantId && !item.restaurant) {
        debugError('❌ Cannot add item: Missing restaurant information!', item);
        return safePrev;
      }
      
      if (sourcePosition) {
        setLastAddEvent({ product: { id: item.id, name: item.name, imageUrl: item.image || item.imageUrl }, sourcePosition })
        setTimeout(() => setLastAddEvent(null), 1500)
      }
      
      return [...safePrev, { ...item, quantity: 1 }]
    })

    return { ok: true }
  }, [normalizedCart])

  const removeFromCart = useCallback((itemId, sourcePosition = null, productInfo = null) => {
    setCart((prev) => {
      const safePrev = normalizeCartData(prev)
      const resolvedItemId = resolveCartEntryId(safePrev, itemId)
      const itemToRemove = safePrev.find((i) => i.id === resolvedItemId)
      if (itemToRemove && sourcePosition && productInfo) {
        setLastRemoveEvent({
          product: {
            id: productInfo.id || itemToRemove.id,
            name: productInfo.name || itemToRemove.name,
            imageUrl: productInfo.imageUrl || productInfo.image || itemToRemove.image || itemToRemove.imageUrl,
          },
          sourcePosition,
        })
        setTimeout(() => setLastRemoveEvent(null), 1500)
      }
      return safePrev.filter((i) => i.id !== resolvedItemId)
    })
  }, [])

  const updateQuantity = useCallback((itemId, quantity, sourcePosition = null, productInfo = null) => {
    const resolvedItemId = resolveCartEntryId(normalizedCart, itemId)
    if (quantity <= 0) {
      setCart((prev) => {
        const safePrev = normalizeCartData(prev)
        const itemToRemove = safePrev.find((i) => i.id === resolvedItemId)
        if (itemToRemove && sourcePosition && productInfo) {
          // Set last remove event for animation
          setLastRemoveEvent({
            product: {
              id: productInfo.id || itemToRemove.id,
              name: productInfo.name || itemToRemove.name,
              imageUrl: productInfo.imageUrl || productInfo.image || itemToRemove.image || itemToRemove.imageUrl,
            },
            sourcePosition,
          })
          // Clear after animation completes
          setTimeout(() => setLastRemoveEvent(null), 1500)
        }
        return safePrev.filter((i) => i.id !== resolvedItemId)
      })
      return
    }
    
    // When quantity decreases (but not to 0), also trigger removal animation
    setCart((prev) => {
      const safePrev = normalizeCartData(prev)
      const existingItem = safePrev.find((i) => i.id === resolvedItemId)
      if (existingItem && quantity < existingItem.quantity && sourcePosition && productInfo) {
        // Set last remove event for animation when decreasing quantity
        setLastRemoveEvent({
          product: {
            id: productInfo.id || existingItem.id,
            name: productInfo.name || existingItem.name,
            imageUrl: productInfo.imageUrl || productInfo.image || existingItem.image || existingItem.imageUrl,
          },
          sourcePosition,
        })
        // Clear after animation completes
        setTimeout(() => setLastRemoveEvent(null), 1500)
      }
      return safePrev.map((i) => (i.id === resolvedItemId ? { ...i, quantity } : i))
    })
  }, [normalizedCart])

  const getCartCount = useCallback(() =>
    normalizedCart.reduce((total, item) => total + (item.quantity || 0), 0)
  , [normalizedCart])

  const isInCart = useCallback((itemId, variantId = "") => {
    const resolvedItemId = resolveCartEntryId(normalizedCart, itemId, variantId)
    return normalizedCart.some((i) => i.id === resolvedItemId)
  }, [normalizedCart])

  const getCartItem = useCallback((itemId, variantId = "") => {
    const resolvedItemId = resolveCartEntryId(normalizedCart, itemId, variantId)
    return normalizedCart.find((i) => i.id === resolvedItemId) || null
  }, [normalizedCart])

  const clearCart = useCallback(() => setCart([]), [])

  const replaceCart = useCallback((items) => {
    const normalizedItems = normalizeCartData(items).filter((item) => {
      const quantity = Number(item?.quantity)
      return item?.id && (item?.restaurantId || item?.restaurant) && Number.isFinite(quantity) && quantity > 0
    })
    setCart(normalizedItems)
    return { ok: true, count: normalizedItems.length }
  }, [])

  // Clean cart to remove items from different restaurants
  // Keeps only items from the specified restaurant
  const cleanCartForRestaurant = useCallback((restaurantId, restaurantName) => {
    setCart((prev) => {
      const safePrev = normalizeCartData(prev)
      if (safePrev.length === 0) return safePrev;
      
      // Normalize restaurant name for comparison
      const normalizeName = (name) => name ? name.trim().toLowerCase() : '';
      const targetRestaurantNameNormalized = normalizeName(restaurantName);
      
      // Filter cart to keep only items from the target restaurant
      const cleanedCart = safePrev.filter((item) => {
        const itemRestaurantId = item?.restaurantId;
        const itemRestaurantName = item?.restaurant;
        const itemRestaurantNameNormalized = normalizeName(itemRestaurantName);
        
        // Check by restaurant name first (more reliable)
        if (targetRestaurantNameNormalized && itemRestaurantNameNormalized) {
          return itemRestaurantNameNormalized === targetRestaurantNameNormalized;
        }
        // Fallback to ID comparison
        if (restaurantId && itemRestaurantId) {
          return itemRestaurantId === restaurantId || 
                 itemRestaurantId === restaurantId.toString() ||
                 itemRestaurantId.toString() === restaurantId;
        }
        // If no match, remove item
        return false;
      });
      
      if (cleanedCart.length !== safePrev.length) {
        debugWarn('🧹 Cleaned cart: Removed items from different restaurants', {
          before: safePrev.length,
          after: cleanedCart.length,
          removed: safePrev.length - cleanedCart.length
        });
      }
      
      return cleanedCart;
    });
  }, [])

  // Validate and clean cart on mount/load to prevent multiple restaurant items
  // This runs only once on initial load to clean up any corrupted cart data from localStorage
  useEffect(() => {
    const safeCart = normalizeCartData(cart)
    if (safeCart.length !== cart.length) {
      setCart(safeCart)
      return
    }
    if (safeCart.length === 0) return;
    
    // Get unique restaurant IDs and names
    const uniqueOrderTypes = [...new Set(safeCart.map(getItemOrderType))]
    if (uniqueOrderTypes.length > 1) return;
    if (uniqueOrderTypes[0] !== "food") return;

    const restaurantIds = safeCart.map(item => item.restaurantId).filter(Boolean);
    const restaurantNames = safeCart.map(item => item.restaurant).filter(Boolean);
    const uniqueRestaurantIds = [...new Set(restaurantIds)];
    const uniqueRestaurantNames = [...new Set(restaurantNames)];
    
    // Normalize restaurant names for comparison
    const normalizeName = (name) => name ? name.trim().toLowerCase() : '';
    const uniqueRestaurantNamesNormalized = uniqueRestaurantNames.map(normalizeName);
    const uniqueRestaurantNamesSet = new Set(uniqueRestaurantNamesNormalized);
    
    // Check if cart has items from multiple restaurants
    if (uniqueRestaurantIds.length > 1 || uniqueRestaurantNamesSet.size > 1) {
      debugWarn('⚠️ Cart contains items from multiple restaurants. Cleaning cart...', {
        restaurantIds: uniqueRestaurantIds,
        restaurantNames: uniqueRestaurantNames
      });
      
      // Keep items from the first restaurant (most recent or first in cart)
      const firstRestaurantId = uniqueRestaurantIds[0];
      const firstRestaurantName = uniqueRestaurantNames[0];
      
      setCart((prev) => {
        const safePrev = normalizeCartData(prev)
        const normalizeName = (name) => name ? name.trim().toLowerCase() : '';
        const firstRestaurantNameNormalized = normalizeName(firstRestaurantName);
        
        return safePrev.filter((item) => {
          const itemRestaurantId = item?.restaurantId;
          const itemRestaurantName = item?.restaurant;
          const itemRestaurantNameNormalized = normalizeName(itemRestaurantName);
          
          // Check by restaurant name first
          if (firstRestaurantNameNormalized && itemRestaurantNameNormalized) {
            return itemRestaurantNameNormalized === firstRestaurantNameNormalized;
          }
          // Fallback to ID comparison
          if (firstRestaurantId && itemRestaurantId) {
            return itemRestaurantId === firstRestaurantId || 
                   itemRestaurantId === firstRestaurantId.toString() ||
                   itemRestaurantId.toString() === firstRestaurantId;
          }
          return false;
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount to clean up localStorage data

  // Transform cart to match AddToCartAnimation expected structure — uses stable normalizedCart
  const cartForAnimation = useMemo(() => {
    const items = normalizedCart.map(item => ({
      product: {
        id: item.id,
        name: item.name,
        imageUrl: item.image || item.imageUrl,
      },
      quantity: item.quantity || 1,
    }))
    const itemCount = normalizedCart.reduce((total, item) => total + (item.quantity || 0), 0)
    const total = normalizedCart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0)
    return { items, itemCount, total }
  }, [normalizedCart])

  const value = useMemo(
    () => ({
      _isProvider: true,
      cart,
      items: cartForAnimation.items,
      itemCount: cartForAnimation.itemCount,
      total: cartForAnimation.total,
      lastAddEvent,
      lastRemoveEvent,
      addToCart,
      removeFromCart,
      updateQuantity,
      getCartCount,
      isInCart,
      getCartItem,
      clearCart,
      cleanCartForRestaurant,
      replaceCart,
    }),
    // normalizedCart instead of cart: avoids re-creating value object on cart ref change when data is same
    [normalizedCart, cartForAnimation, lastAddEvent, lastRemoveEvent,
     addToCart, removeFromCart, updateQuantity, getCartCount, isInCart, getCartItem,
     clearCart, cleanCartForRestaurant, replaceCart]
  )

  return (
    <CartContext.Provider value={value}>
      {children}
      <ReplaceCartModal
        isOpen={!!pendingReplaceItem}
        onClose={() => setPendingReplaceItem(null)}
        onConfirm={() => {
          if (pendingReplaceItem) {
            // Overwrite cart directly to avoid stale closures with addToCart
            const newItem = { ...pendingReplaceItem.item, quantity: 1 };
            setCart(normalizeCartData([newItem]));
            
            if (pendingReplaceItem.sourcePosition) {
              setLastAddEvent({ 
                product: { 
                  id: newItem.id || newItem._id, 
                  name: newItem.name, 
                  imageUrl: newItem.image || newItem.imageUrl 
                }, 
                sourcePosition: pendingReplaceItem.sourcePosition 
              });
              setTimeout(() => setLastAddEvent(null), 1500);
            }
            
            setPendingReplaceItem(null);
          }
        }}
        previousRestaurantName={pendingReplaceItem?.previousRestaurantName}
        newRestaurantName={pendingReplaceItem?.newRestaurantName}
      />
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  // Check if context is from the actual provider by checking the _isProvider flag
  if (!context || context._isProvider !== true) {
    // In development, log a warning but don't throw to prevent crashes
    if (process.env.NODE_ENV === 'development') {
      debugWarn('⚠️ useCart called outside CartProvider. Using default values.');
      debugWarn('💡 Make sure the component is rendered inside UserLayout which provides CartProvider.');
    }
    // Return default context instead of throwing
    return defaultCartContext
  }
  return context
}

