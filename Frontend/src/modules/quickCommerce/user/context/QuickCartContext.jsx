import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import quickApi from '../services/quickApi';

const QuickCartContext = createContext(null);

export function QuickCartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [subtotal, setSubtotal] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const applyCart = useCallback((cart) => {
    setItems(cart?.items || []);
    setSubtotal(cart?.subtotal || 0);
    setDeliveryFee(cart?.deliveryFee || 0);
    setTotal(cart?.total || 0);
  }, []);

  const refreshCart = useCallback(async () => {
    setLoading(true);
    try {
      const cart = await quickApi.getCart();
      applyCart(cart || {});
    } finally {
      setLoading(false);
    }
  }, [applyCart]);

  useEffect(() => {
    refreshCart().catch(() => setLoading(false));
  }, [refreshCart]);

  const addToCart = useCallback(async (product, qty = 1) => {
    if (!product?.id && !product?._id) return;
    const cart = await quickApi.addToCart(product.id || product._id, qty);
    applyCart(cart || {});
  }, [applyCart]);

  const updateQuantity = useCallback(async (productId, quantity) => {
    const cart = await quickApi.updateCart(productId, quantity);
    applyCart(cart || {});
  }, [applyCart]);

  const removeFromCart = useCallback(async (productId) => {
    const cart = await quickApi.removeFromCart(productId);
    applyCart(cart || {});
  }, [applyCart]);

  const clearCart = useCallback(async () => {
    const cart = await quickApi.clearCart();
    applyCart(cart || {});
  }, [applyCart]);

  const placeOrder = useCallback(async () => {
    const order = await quickApi.placeOrder();
    await refreshCart();
    return order;
  }, [refreshCart]);

  const cartCount = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [items]
  );

  const value = useMemo(() => ({
    items,
    subtotal,
    deliveryFee,
    total,
    cartCount,
    loading,
    refreshCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    placeOrder,
  }), [
    items,
    subtotal,
    deliveryFee,
    total,
    cartCount,
    loading,
    refreshCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    placeOrder,
  ]);

  return <QuickCartContext.Provider value={value}>{children}</QuickCartContext.Provider>;
}

export function useQuickCart() {
  const ctx = useContext(QuickCartContext);
  if (!ctx) throw new Error('useQuickCart must be used inside QuickCartProvider');
  return ctx;
}
