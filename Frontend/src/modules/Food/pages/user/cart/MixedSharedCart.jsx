import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CreditCard, MapPin, ShoppingBag, Truck, Zap } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@food/components/ui/button";
import { useCart } from "@food/context/CartContext";
import { useProfile } from "@food/context/ProfileContext";
import { orderAPI } from "@food/api";
import { initRazorpayPayment } from "@food/utils/razorpay";
import { useCompanyName } from "@food/hooks/useCompanyName";
import { sanitizeOrderImage, sanitizeOrderNotes } from "@food/utils/orderPayload";
import { createCartPricingRequestController } from "@food/utils/cartPricingRequest";

const RUPEE_SYMBOL = "\u20B9";

const getOrderType = (item) => (item?.orderType === "quick" ? "quick" : "food");

const formatFullAddress = (address) => {
  if (!address) return "";
  if (address.formattedAddress && address.formattedAddress !== "Select location") {
    return address.formattedAddress;
  }
  return [
    address.street,
    address.additionalDetails,
    address.city,
    address.state,
    address.zipCode,
  ]
    .filter(Boolean)
    .join(", ");
};

const normalizeAddressLabel = (label) => {
  const value = String(label || "").trim().toLowerCase();
  if (value === "home") return "Home";
  if (value === "office" || value === "work") return "Office";
  return "Other";
};

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
  cart.map((item) => {
    const type = getOrderType(item);
    return {
      itemId: String(item.itemId || item.id || item._id),
      name: item.name || "Item",
      type,
      sourceId:
        item.sourceId ||
        (type === "quick"
          ? item.quickStoreId || item.storeId || item.sellerId || "quick-commerce"
          : item.restaurantId),
      sourceName:
        item.sourceName ||
        (type === "quick"
          ? item.quickStoreName || item.storeName || "Quick Commerce"
          : item.restaurant || item.restaurantName || "Restaurant"),
      quantity: Number(item.quantity || 1),
      price: Number(item.price || 0),
      variantId: item.variantId || undefined,
      variantName: item.variantName || undefined,
      variantPrice: item.variantPrice || item.price || 0,
      image: sanitizeOrderImage(item.image || item.imageUrl || ""),
      isVeg: item.isVeg ?? true,
      notes: sanitizeOrderNotes(item.notes || ""),
    };
  });

function DeliveryOptionCard({ option, active, onSelect, description }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.code)}
      className={`w-full rounded-3xl border p-4 text-left transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] opacity-70">{option.label}</p>
          <p className={`mt-2 text-sm ${active ? "text-slate-200" : "text-slate-500"}`}>{description}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">
            {RUPEE_SYMBOL}
            {Number(option.total || 0).toFixed(0)}
          </p>
          <p className={`text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>
            Delivery fee {RUPEE_SYMBOL}
            {Number(option.deliveryFee || 0).toFixed(0)}
          </p>
        </div>
      </div>
    </button>
  );
}

export default function MixedSharedCart({ initialAddress = null, addressMode = "saved" }) {
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
  const companyName = useCompanyName();
  const { cart, updateQuantity, clearCart } = useCart();
  const { addresses = [], getDefaultAddress, userProfile } = useProfile();

  const [pricing, setPricing] = useState(null);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("cash");
  const [selectedDeliveryMode, setSelectedDeliveryMode] = useState("normal");
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const pricingRequestControllerRef = useRef(null);
  if (!pricingRequestControllerRef.current) {
    pricingRequestControllerRef.current = createCartPricingRequestController();
  }

  const foodItems = cart.filter((item) => getOrderType(item) === "food");
  const quickItems = cart.filter((item) => getOrderType(item) === "quick");
  
  const savedAddress = getDefaultAddress?.() || null;

  // Use initialAddress if provided, otherwise fallback to profile default or saved
  const defaultAddress = useMemo(() => {
    if (initialAddress) return initialAddress;
    
    if (addressMode === "current") {
      // For mixed cart, we might not have currentLocationAddress directly here
      // but if it's passed via initialAddress, we're good.
      return savedAddress;
    }
    
    return savedAddress;
  }, [initialAddress, savedAddress, addressMode]);

  const addressText = formatFullAddress(defaultAddress);
  const deliveryAddress = useMemo(
    () => (defaultAddress ? buildOrderAddress(defaultAddress, userProfile) : null),
    [defaultAddress, userProfile?.phone, userProfile?.name],
  );

  const mappedItems = useMemo(() => mapCartItemsToPayload(cart), [cart]);

  const mixedPricingRequestKey = useMemo(() => {
    if (foodItems.length === 0 || quickItems.length === 0 || !deliveryAddress) {
      return null;
    }
    const cartKey = mappedItems
      .map(
        (item) =>
          `${item.itemId || ""}:${item.variantId || ""}:${item.quantity || 1}:${item.type || ""}`,
      )
      .join("|");
    const coords = deliveryAddress?.location?.coordinates;
    const addressKey = Array.isArray(coords)
      ? coords.map(Number).join(",")
      : formatFullAddress(deliveryAddress);
    return `${cartKey}::${addressKey}`;
  }, [foodItems.length, quickItems.length, deliveryAddress, mappedItems]);

  useEffect(() => {
    if (!mixedPricingRequestKey) {
      setPricing(null);
      setIsPricingLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        setIsPricingLoading(true);
        const result = await pricingRequestControllerRef.current.calculate({
          orderType: "mixed",
          items: mappedItems,
          address: deliveryAddress,
        });

        if (!cancelled && !result.stale) {
          setPricing(result.pricing || null);
          setSelectedDeliveryMode("normal");
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Mixed order pricing failed", error);
          toast.error(
            error?.response?.data?.message ||
              error?.response?.data?.error?.message ||
              "Couldn't load mixed delivery options",
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
  }, [mixedPricingRequestKey]);

  const selectedDeliveryOption =
    pricing?.deliveryOptions?.find((option) => option.code === selectedDeliveryMode) || null;
  const subtotal =
    pricing?.subtotal ||
    cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
  const tax = pricing?.tax ?? (isPricingLoading ? 0 : null);
  const platformFee = pricing?.platformFee ?? (isPricingLoading ? 0 : null);
  const discount = pricing?.discount || 0;
  const deliveryFee = selectedDeliveryOption?.deliveryFee ?? pricing?.deliveryFee ?? (isPricingLoading ? 0 : null);
  const total =
    selectedDeliveryOption?.total ??
    pricing?.total ??
    (tax === null ? subtotal : Math.max(0, subtotal + tax + platformFee + (deliveryFee || 0) - discount));

  const increment = (item) => updateQuantity(item.id, Number(item.quantity || 1) + 1);
  const decrement = (item) => updateQuantity(item.id, Number(item.quantity || 1) - 1);

  const handlePlaceOrder = async () => {
    // Check authentication first
    const isAuthenticated = !!localStorage.getItem('accessToken') || !!localStorage.getItem('user_accessToken');
    if (!isAuthenticated) {
      toast.error("Please login to place an order");
      navigate('/user/auth/login?redirect=/cart');
      return;
    }

    if (foodItems.length === 0 || quickItems.length === 0) {
      toast.error("Add both food and quick items to continue");
      return;
    }
    if (!defaultAddress) {
      toast.error("Please select a delivery address first");
      navigate("/cart/address-selector", { state: addressSelectorState });
      return;
    }

    try {
      setIsPlacingOrder(true);

      let resolvedPricing = null;
      try {
        const result = await pricingRequestControllerRef.current.calculate(
          {
            orderType: "mixed",
            items: mappedItems,
            address: deliveryAddress,
            deliveryFleet: selectedDeliveryMode,
          },
          { force: true },
        );
        resolvedPricing = result?.pricing || null;
        if (resolvedPricing) setPricing(resolvedPricing);
      } catch (pricingError) {
        toast.error(
          pricingError?.response?.data?.message ||
            "Could not refresh pricing. Please try again.",
        );
        return;
      }

      const selectedOption =
        resolvedPricing?.deliveryOptions?.find(
          (option) => option.code === selectedDeliveryMode,
        ) || null;
      const serverTotal = Number(
        selectedOption?.total ?? resolvedPricing?.total,
      );
      if (!resolvedPricing || !Number.isFinite(serverTotal)) {
        toast.error("Pricing unavailable. Please try again.");
        return;
      }

      const orderPayload = {
        orderType: "mixed",
        items: mappedItems,
        address: deliveryAddress,
        restaurantId: foodItems[0]?.restaurantId,
        restaurantName: foodItems[0]?.restaurant || undefined,
        pricing: {
          ...resolvedPricing,
          deliveryFee: selectedOption?.deliveryFee ?? resolvedPricing.deliveryFee,
          total: serverTotal,
          packagingFee: resolvedPricing?.packagingFee || 0,
          currency: resolvedPricing?.currency || "INR",
        },
        paymentMethod: selectedPaymentMethod,
        deliveryFleet: selectedDeliveryMode,
      };

      const orderResponse = await orderAPI.createOrder(orderPayload);
      const { order, razorpay } = orderResponse?.data?.data || {};

      if (selectedPaymentMethod === "cash") {
        toast.success("Mixed order placed successfully");
        clearCart();
        navigate(`/user/orders/${order?.orderId || order?._id}?confirmed=true`, {
          state: order ? { prefetchedOrder: order } : undefined,
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
        description: `Mixed order ${order?.orderId || ""}`,
        prefill: {
          name: userProfile?.name || "",
          email: userProfile?.email || "",
          contact: (userProfile?.phone || defaultAddress?.phone || "").replace(/\D/g, "").slice(-10),
        },
        notes: {
          orderId: order?.orderId || "",
          orderType: "mixed",
          deliveryMode: selectedDeliveryMode,
        },
        handler: async (response) => {
          const verifyResponse = await orderAPI.verifyPayment({
            orderId: order?._id || order?.id || order?.orderId,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });

          if (verifyResponse?.data?.success) {
            toast.success("Mixed order placed successfully");
            clearCart();
            navigate(`/user/orders/${order?.orderId || order?._id}?confirmed=true`, {
              state: order ? { prefetchedOrder: order } : undefined,
            });
          } else {
            throw new Error("Payment verification failed");
          }
        },
        onClose: async () => {
          try {
            const cancelId = order?._id || order?.id || order?.orderId;
            if (cancelId) {
              await orderAPI.cancelOrder(cancelId, {
                reason: "Payment Cancelled",
                note: "User closed payment modal in Mixed Cart",
              });
            }
          } catch (err) {
            console.error("Failed to cancel mixed order after close", err);
          }
          setIsPlacingOrder(false);
        },
        onError: async (error) => {
          try {
            const cancelId = order?._id || order?.id || order?.orderId;
            if (cancelId) {
              await orderAPI.cancelOrder(cancelId, {
                reason: "Payment Failed",
                note: error?.message || "Payment failed in Mixed Cart",
              });
            }
          } catch (err) {
            console.error("Failed to cancel mixed order after error", err);
          }
          setIsPlacingOrder(false);
        },
      });
    } catch (error) {
      console.error("Mixed order failed", error);
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error?.message ||
          error?.message ||
          "Could not place mixed order",
      );
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (foodItems.length === 0 || quickItems.length === 0) {
    navigate("/food/user/cart");
    return null;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 pb-28">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <button
          type="button"
          onClick={() => navigate("/food/user")}
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to shopping
        </button>

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-4">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Mixed checkout</h1>
                  <p className="text-sm text-slate-500">
                    Food and quick items can now be placed together from one checkout.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Delivery Address</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {addressText || "Choose an address to continue"}
                  </p>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full border-slate-200"
                >
                  <Link to="/cart/address-selector" state={addressSelectorState}>
                    <MapPin className="mr-2 h-4 w-4" />
                    Change
                  </Link>
                </Button>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-slate-700" />
                <h2 className="text-lg font-bold text-slate-900">Delivery plan</h2>
              </div>
              <div className="mt-4 space-y-3">
                {Array.isArray(pricing?.deliveryOptions) && pricing.deliveryOptions.length > 0 ? (
                  <>
                    <DeliveryOptionCard
                      option={pricing.deliveryOptions[0]}
                      active={selectedDeliveryMode === pricing.deliveryOptions[0].code}
                      onSelect={setSelectedDeliveryMode}
                      description="One rider can collect both pickups because the restaurant and store are close and aligned."
                    />
                    {/* Express delivery option hidden as per request */}
                    {/* {pricing.deliveryOptions[1] && (
                      <DeliveryOptionCard
                        option={pricing.deliveryOptions[1]}
                        active={selectedDeliveryMode === pricing.deliveryOptions[1].code}
                        onSelect={setSelectedDeliveryMode}
                        description="Two nearby riders will handle the food and quick pickups separately for a faster drop."
                      />
                    )} */}
                    <p className="text-xs font-medium text-slate-500">
                      Pickup gap {Number(pricing?.pickupDistanceKm || 0).toFixed(1)} km. Same direction routing is available.
                    </p>
                  </>
                ) : (
                  <div className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-600">
                    {!deliveryAddress 
                      ? "Please select a delivery address to see your delivery plan."
                      : isPricingLoading 
                        ? "Calculating best delivery plan..."
                        : pricing?.eligibilityReason
                          ? `${pricing.eligibilityReason}. Separate deliveries will be assigned automatically.`
                          : `Separate deliveries will be assigned automatically because these pickups are either farther than ${Number(pricing?.mixedOrderDistanceLimit ?? 2).toFixed(1)} km apart or not in the same direction.`}
                  </div>
                )}
              </div>
            </section>

            <section className="grid min-w-0 gap-4 md:grid-cols-2">
              {[{ title: "Food items", items: foodItems }, { title: "Quick items", items: quickItems }].map((section) => (
                <div key={section.title} className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900">{section.title}</h2>
                  <div className="mt-4 space-y-3">
                    {section.items.map((item) => (
                      <div key={item.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 p-3">
                        <img
                          src={item.image || item.imageUrl || "https://placehold.co/96x96?text=Item"}
                          alt={item.name || "Item"}
                          className="h-16 w-16 rounded-2xl object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-900">{item.name || "Item"}</p>
                          <p className="truncate text-xs text-slate-500">
                            {item.sourceName || item.restaurant || item.quickStoreName || "Store"}
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {RUPEE_SYMBOL}
                            {Number(item.price || 0).toFixed(0)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 px-2 py-1">
                          <button type="button" onClick={() => decrement(item)} className="px-2 text-sm font-bold text-slate-600">
                            -
                          </button>
                          <span className="min-w-5 text-center text-sm font-bold text-slate-900">{item.quantity || 1}</span>
                          <button type="button" onClick={() => increment(item)} className="px-2 text-sm font-bold text-slate-600">
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6 lg:h-fit">
            <h2 className="text-lg font-bold text-slate-900">Pay and place order</h2>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Payment</p>
                <div className="grid gap-2">
                  {[
                    { id: "cash", label: "Cash on delivery", icon: Truck },
                    { id: "razorpay", label: "Online payment", icon: CreditCard },
                  ].map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setSelectedPaymentMethod(method.id)}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold ${
                        selectedPaymentMethod === method.id
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 text-slate-700"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <method.icon className="h-4 w-4" />
                        {method.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{RUPEE_SYMBOL}{subtotal.toFixed(0)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Delivery fee</span>
                  <span>{deliveryFee === null ? "--" : `${RUPEE_SYMBOL}${deliveryFee.toFixed(0)}`}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Platform fee</span>
                  <span>{platformFee === null ? "--" : `${RUPEE_SYMBOL}${platformFee.toFixed(0)}`}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Tax</span>
                  <span>{tax === null ? "--" : `${RUPEE_SYMBOL}${tax.toFixed(0)}`}</span>
                </div>
                {discount > 0 && (
                  <div className="flex items-center justify-between text-emerald-600">
                    <span>Discount</span>
                    <span>-{RUPEE_SYMBOL}{discount.toFixed(0)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-bold text-slate-900">
                  <span>Total</span>
                  <span>{RUPEE_SYMBOL}{total.toFixed(0)}</span>
                </div>
              </div>

              <Button
                type="button"
                onClick={handlePlaceOrder}
                disabled={isPlacingOrder || isPricingLoading || !defaultAddress}
                className="h-12 w-full rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
              >
                {isPlacingOrder ? "Placing order..." : "Place mixed order"}
              </Button>

              {/* {selectedDeliveryMode === "express" && (
                <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="flex items-center gap-2 font-bold">
                    <Zap className="h-4 w-4" />
                    Express split dispatch
                  </p>
                  <p className="mt-1 text-amber-800">
                    Food and quick pickups will be assigned to separate nearby riders when available.
                  </p>
                </div>
              )} */}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
