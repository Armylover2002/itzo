import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, CreditCard, MapPin, Minus, Plus, ShoppingBag, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@food/components/ui/button";
import { useCart } from "@food/context/CartContext";
import { useProfile } from "@food/context/ProfileContext";
import { sanitizeOrderImage, sanitizeOrderNotes } from "@food/utils/orderPayload";
import { orderAPI } from "@food/api";
import { initRazorpayPayment } from "@food/utils/razorpay";
import { useCompanyName } from "@food/hooks/useCompanyName";
import { createCartPricingRequestController } from "@food/utils/cartPricingRequest";

const RUPEE_SYMBOL = "\u20B9";

const formatFullAddress = (address) => {
  if (!address) return "";
  if (address.formattedAddress && address.formattedAddress !== "Select location") {
    return address.formattedAddress;
  }

  const parts = [
    address.street,
    address.additionalDetails,
    address.city,
    address.state,
    address.zipCode,
  ].filter(Boolean);

  if (parts.length > 0) return parts.join(", ");
  return address.address || "";
};

const getAddressId = (address) =>
  address?._id || address?.id || address?.addressId || address?.placeId || null;

const normalizeAddressLabel = (label) => {
  const value = String(label || "").trim().toLowerCase();
  if (value === "home") return "Home";
  if (value === "office" || value === "work") return "Office";
  return "Other";
};

const isMongoIdLike = (value) => /^[a-fA-F0-9]{24}$/.test(String(value || "").trim());

const getQuickSourceId = (item) =>
  String(
    item?.sourceId ||
      item?.quickStoreId ||
      item?.storeId ||
      item?.sellerId ||
      item?.restaurantId ||
      "",
  ).trim();

const buildOrderAddress = (address, userProfile) => ({
  label: normalizeAddressLabel(address?.label),
  name: userProfile?.name || "Customer",
  street:
    address?.street ||
    address?.address ||
    address?.formattedAddress ||
    "Address unavailable",
  additionalDetails: address?.additionalDetails || "",
  city: address?.city || address?.area || "NA",
  state: address?.state || address?.city || "NA",
  zipCode: address?.zipCode || address?.postalCode || "",
  phone: address?.phone || userProfile?.phone || "",
  ...(Array.isArray(address?.location?.coordinates)
    ? {
        location: {
          type: "Point",
          coordinates: address.location.coordinates,
        },
      }
    : {}),
});

const mapCartItemsToPayload = (cart) =>
  cart.map((item) => ({
    itemId: String(item.id || item._id),
    name: item.name || "Item",
    type: "quick",
    sourceId: getQuickSourceId(item),
    sourceName: item.sourceName || item.quickStoreName || item.storeName || "Quick Commerce",
    quantity: Number(item.quantity || 1),
    price: Number(item.price || 0),
    image: sanitizeOrderImage(item.image || item.imageUrl || ""),
    isVeg: item.isVeg ?? true,
    notes: sanitizeOrderNotes(item.notes || ""),
  }));

export default function QuickSharedCart({ initialAddress = null, addressMode = "saved" }) {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const addressSelectorState = {
    from:
      `${routerLocation.pathname || ""}${routerLocation.search || ""}${routerLocation.hash || ""}` ||
      "/cart",
    backTo:
      `${routerLocation.pathname || ""}${routerLocation.search || ""}${routerLocation.hash || ""}` ||
      "/cart",
  };
  const { cart, updateQuantity, clearCart } = useCart();
  const { addresses = [], getDefaultAddress, userProfile } = useProfile();
  const companyName = useCompanyName();
  const isUserCodAllowed = userProfile?.isCodAllowed !== false;

  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("cash");
  const [pricing, setPricing] = useState(null);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const pricingRequestControllerRef = useRef(null);
  if (!pricingRequestControllerRef.current) {
    pricingRequestControllerRef.current = createCartPricingRequestController();
  }

  useEffect(() => {
    if (!isUserCodAllowed && selectedPaymentMethod === "cash") {
      setSelectedPaymentMethod("razorpay");
    }
  }, [isUserCodAllowed, selectedPaymentMethod]);

  const quickCart = useMemo(
    () => cart.filter((item) => (item.orderType || "food") === "quick"),
    [cart],
  );

  const savedAddress = getDefaultAddress?.() || null;

  const defaultAddress = useMemo(() => {
    if (initialAddress) return initialAddress;
    return savedAddress;
  }, [initialAddress, savedAddress]);

  useEffect(() => {
    const defaultId = getAddressId(defaultAddress);
    if (defaultId && !selectedAddressId) {
      setSelectedAddressId(defaultId);
    }
  }, [defaultAddress, selectedAddressId]);

  const selectedAddress = useMemo(() => {
    if (initialAddress) return initialAddress;
    if (!selectedAddressId) return savedAddress;
    return (
      addresses.find((address) => getAddressId(address) === selectedAddressId) ||
      savedAddress
    );
  }, [addresses, savedAddress, selectedAddressId, initialAddress]);

  const quickPricingRequestKey = useMemo(() => {
    if (quickCart.length === 0) return null;
    const cartKey = quickCart
      .map(
        (item) =>
          `${item.itemId || item.id || ""}:${item.variantId || ""}:${Number(item.quantity) || 1}`,
      )
      .join("|");
    const coords = selectedAddress?.location?.coordinates;
    const addressKey = selectedAddress
      ? getAddressId(selectedAddress) ||
        (Array.isArray(coords) ? coords.map(Number).join(",") : formatFullAddress(selectedAddress))
      : "";
    return `${cartKey}::${addressKey}::${userProfile?.phone || ""}`;
  }, [quickCart, selectedAddress, userProfile?.phone]);

  useEffect(() => {
    if (!quickPricingRequestKey) {
      setPricing(null);
      setIsPricingLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        setIsPricingLoading(true);
        const deliveryAddress = selectedAddress
          ? buildOrderAddress(selectedAddress, userProfile)
          : undefined;
        const result = await pricingRequestControllerRef.current.calculate({
          orderType: "quick",
          items: mapCartItemsToPayload(quickCart),
          ...(deliveryAddress ? { address: deliveryAddress } : {}),
        });
        if (!cancelled && !result.stale) {
          setPricing(result.pricing || null);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Quick order pricing failed", error);
          toast.error(
            error?.response?.data?.message ||
              error?.response?.data?.error?.message ||
              "Couldn't load pricing",
          );
          setPricing(null);
        }
      } finally {
        if (!cancelled) setIsPricingLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      pricingRequestControllerRef.current?.abort?.();
    };
  }, [quickPricingRequestKey]);

  const subtotal =
    pricing?.subtotal ??
    quickCart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
  const deliveryFee = pricing?.deliveryFee ?? (isPricingLoading ? 0 : null);
  const platformFee = pricing?.platformFee ?? (isPricingLoading ? 0 : null);
  const tax = pricing?.tax ?? (isPricingLoading ? 0 : null);
  const total =
    pricing?.total ??
    (deliveryFee == null || platformFee == null || tax == null
      ? subtotal
      : Math.max(0, subtotal + deliveryFee + platformFee + tax));

  const handlePlaceOrder = async () => {
    // Check authentication first
    const isAuthenticated = !!localStorage.getItem('accessToken') || !!localStorage.getItem('user_accessToken');
    if (!isAuthenticated) {
      toast.error("Please login to place an order");
      navigate('/user/auth/login?redirect=/cart');
      return;
    }

    if (quickCart.length === 0) {
      toast.error("Your quick cart is empty");
      return;
    }

    if (!selectedAddress) {
      toast.error("Please select a delivery address first");
      navigate("/cart/address-selector", { state: addressSelectorState });
      return;
    }

    const invalidQuickItems = quickCart.filter((item) => !isMongoIdLike(getQuickSourceId(item)));
    if (invalidQuickItems.length > 0) {
      console.error("Quick cart contains items without a valid seller/store id", invalidQuickItems);
      toast.error("Some quick-cart items are missing store info. Clear the cart and add them again.");
      return;
    }

    if (!isUserCodAllowed && selectedPaymentMethod === "cash") {
      toast.error("Cash on delivery is not available for your account");
      return;
    }

    try {
      setIsPlacingOrder(true);
      const deliveryAddress = buildOrderAddress(selectedAddress, userProfile);
      const items = mapCartItemsToPayload(quickCart);
      let resolvedPricing = pricing;
      try {
        const result = await pricingRequestControllerRef.current.calculate(
          {
            orderType: "quick",
            items,
            address: deliveryAddress,
          },
          { force: true },
        );
        resolvedPricing = result?.pricing || pricing;
        if (resolvedPricing) setPricing(resolvedPricing);
      } catch (pricingError) {
        console.error("Quick order pricing refresh failed", pricingError);
      }

      if (!resolvedPricing) {
        toast.error("Couldn't calculate order total. Please try again.");
        return;
      }

      const orderPayload = {
        orderType: "quick",
        items,
        address: deliveryAddress,
        customerName: userProfile?.name || "Customer",
        customerPhone: deliveryAddress.phone,
        pricing: {
          subtotal: Number(resolvedPricing.subtotal || 0),
          deliveryFee: Number(resolvedPricing.deliveryFee || 0),
          platformFee: Number(resolvedPricing.platformFee || 0),
          tax: Number(resolvedPricing.tax || 0),
          discount: Number(resolvedPricing.discount || 0),
          packagingFee: Number(resolvedPricing.packagingFee || 0),
          total: Number(resolvedPricing.total || 0),
          currency: resolvedPricing.currency || "INR",
        },
        paymentMethod: selectedPaymentMethod,
      };

      const orderResponse = await orderAPI.createOrder(orderPayload);
      const { order, razorpay } = orderResponse?.data?.data || {};

      if (selectedPaymentMethod === "cash") {
        toast.success("Quick order placed successfully");
        clearCart();
        navigate(`/food/user/orders/${order?._id || order?.orderId || order?.id}?confirmed=true`, {
          state: order ? { prefetchedOrder: order, orderType: "quick" } : { orderType: "quick" },
        });
        return;
      }

      if (!razorpay?.orderId || !razorpay?.key) {
        throw new Error("Payment gateway is not ready");
      }

      await initRazorpayPayment({
        key: razorpay.key,
        amount: razorpay.amount,
        currency: razorpay.currency || "INR",
        order_id: razorpay.orderId,
        name: companyName,
        description: `Quick order ${order?.orderId || ""}`,
        prefill: {
          name: userProfile?.name || "",
          email: userProfile?.email || "",
          contact: String(deliveryAddress.phone || "").replace(/\D/g, "").slice(-10),
        },
        notes: {
          orderId: order?._id || order?.orderId || "",
          orderType: "quick",
        },
        handler: async (response) => {
          const verifyResponse = await orderAPI.verifyPayment({
            orderId: order?._id || order?.id || order?.orderId,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });

          if (verifyResponse?.data?.success) {
            toast.success("Quick order placed successfully");
            clearCart();
            navigate(`/food/user/orders/${order?._id || order?.orderId || order?.id}?confirmed=true`, {
              state: order ? { prefetchedOrder: order, orderType: "quick" } : { orderType: "quick" },
            });
            return;
          }

          throw new Error("Payment verification failed");
        },
        onClose: async () => {
          try {
            const cancelId = order?._id || order?.id || order?.orderId;
            if (cancelId) {
              await orderAPI.cancelOrder(cancelId, {
                reason: "Payment Cancelled",
                note: "User closed payment modal in Quick Cart",
              });
            }
          } catch (err) {
            console.error("Failed to cancel quick order after close", err);
          }
          setIsPlacingOrder(false);
        },
        onError: async (error) => {
          try {
            const cancelId = order?._id || order?.id || order?.orderId;
            if (cancelId) {
              await orderAPI.cancelOrder(cancelId, {
                reason: "Payment Failed",
                note: error?.message || "Payment failed in Quick Cart",
              });
            }
          } catch (err) {
            console.error("Failed to cancel quick order after error", err);
          }
          setIsPlacingOrder(false);
        },
      });
    } catch (error) {
      console.error("Quick shared order failed", error);
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error?.message ||
          error?.message ||
          "Could not place quick order",
      );
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (quickCart.length === 0) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ShoppingBag className="mx-auto h-12 w-12 text-emerald-600" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Your quick cart is empty</h1>
          <p className="mt-2 text-sm text-slate-500">Add a few essentials and come back here for checkout.</p>
          <Link
            to="/quick"
            className="mt-6 inline-flex rounded-full bg-emerald-600 px-5 py-3 text-sm font-bold text-white"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 pb-28">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <button
          type="button"
          onClick={() => navigate("/quick")}
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to quick shopping
        </button>

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">Shared Cart</p>
                  <h1 className="mt-1 text-2xl font-bold text-slate-900">Quick checkout in the food flow</h1>
                </div>
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-sm font-semibold text-slate-500 hover:text-rose-600"
                >
                  Clear cart
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {quickCart.map((item) => (
                <article
                  key={item.id || item._id}
                  className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex min-w-0 gap-3 sm:gap-4">
                    <img
                      src={item.image || item.imageUrl}
                      alt={item.name}
                      className="h-20 w-20 rounded-2xl object-cover bg-slate-100"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
                        {item.quickStoreName || "Quick Commerce"}
                      </p>
                      <h2 className="mt-1 truncate text-lg font-bold text-slate-900">{item.name}</h2>
                      <div className="mt-3 flex min-w-0 items-center justify-between gap-3">
                        <p className="text-base font-bold text-slate-900">
                          {RUPEE_SYMBOL}
                          {Number(item.price || 0) * Number(item.quantity || 1)}
                        </p>
                        <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id || item._id, Math.max(0, Number(item.quantity || 1) - 1))}
                            className="rounded-full p-1 text-slate-700 hover:bg-white"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="min-w-6 text-center text-sm font-bold text-slate-900">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id || item._id, Number(item.quantity || 1) + 1)}
                            className="rounded-full p-1 text-slate-700 hover:bg-white"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Delivery Address</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {selectedAddress ? formatFullAddress(selectedAddress) : "Add a delivery address"}
                  </p>
                </div>
                <MapPin className="h-5 w-5 text-emerald-600" />
              </div>
              <button
                type="button"
                onClick={() => navigate("/cart/address-selector", { state: addressSelectorState })}
                className="mt-4 text-sm font-bold text-emerald-700"
              >
                {selectedAddress ? "Change address" : "Select address"}
              </button>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Payment</p>
              <div className="mt-4 grid gap-3">
                {isUserCodAllowed ? (
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod("cash")}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left ${
                      selectedPaymentMethod === "cash"
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-slate-200"
                    }`}
                  >
                    <span className="flex items-center gap-3 font-semibold text-slate-900">
                      <Wallet className="h-4 w-4" />
                      Cash on delivery
                    </span>
                    <span className="text-xs font-bold text-slate-500">Pay later</span>
                  </button>
                ) : (
                  <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Cash on delivery is not available for your account. Please pay online.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod("razorpay")}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left ${
                    selectedPaymentMethod === "razorpay"
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-200"
                  }`}
                >
                  <span className="flex items-center gap-3 font-semibold text-slate-900">
                    <CreditCard className="h-4 w-4" />
                    Pay online
                  </span>
                  <span className="text-xs font-bold text-slate-500">UPI / Card</span>
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-300">Summary</p>
              <div className="mt-4 space-y-3 text-sm text-white/80">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{RUPEE_SYMBOL}{subtotal.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery fee</span>
                  <span>
                    {deliveryFee == null ? "--" : `${RUPEE_SYMBOL}${Number(deliveryFee).toFixed(0)}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Platform fee</span>
                  <span>
                    {platformFee == null ? "--" : `${RUPEE_SYMBOL}${Number(platformFee).toFixed(0)}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Taxes</span>
                  <span>
                    {tax == null ? "--" : `${RUPEE_SYMBOL}${Number(tax).toFixed(0)}`}
                  </span>
                </div>
                <div className="border-t border-white/10 pt-3 text-base font-bold text-white">
                  <div className="flex justify-between">
                    <span>Total</span>
                    <span>
                      {isPricingLoading || pricing == null
                        ? "--"
                        : `${RUPEE_SYMBOL}${Number(total).toFixed(0)}`}
                    </span>
                  </div>
                </div>
              </div>

              <Button
                onClick={handlePlaceOrder}
                disabled={isPlacingOrder || isPricingLoading}
                className="mt-5 h-12 w-full rounded-full bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              >
                {isPlacingOrder
                  ? selectedPaymentMethod === "razorpay"
                    ? "Opening payment..."
                    : "Placing order..."
                  : isPricingLoading
                    ? "Refreshing total..."
                    : selectedPaymentMethod === "razorpay"
                      ? "Pay & place quick order"
                      : "Place quick order"}
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
