import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Store, Clock, MapPin, ArrowLeft, ShoppingBag, AlertCircle, Phone, Package, CheckCircle2 } from "lucide-react";
import { customerApi } from "../services/customerApi";
import { useCart } from "../context/CartContext";
import { resolveQuickImageUrl } from "../utils/image";
import ProductCard from "../components/shared/ProductCard";
export default function ShopDetailPage() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { cartCount } = useCart();
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchShopDetails = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await customerApi.getShopById(shopId);
      if (res?.data?.success && res.data.result) {
        setShop(res.data.result.shop || null);
        setProducts(res.data.result.products || []);
      } else {
        setError("Store not found or currently unavailable.");
      }
    } catch (err) {
      console.error("Failed to load shop details:", err);
      setError(err?.response?.data?.message || "Failed to load store information.");
    } finally {
      setLoading(false);
    }
  }, [shopId]);
  useEffect(() => {
    fetchShopDetails();
  }, [fetchShopDetails]);
  const isOpen = !!shop?.isOpen;
  if (loading) {
    return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-center gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "w-10 h-10 border-4 border-[#FE5502] border-t-transparent rounded-full animate-spin" }), /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold text-slate-500" }, "Loading store details...")));
  }
  if (error || !shop) {
    return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen bg-slate-50 dark:bg-background p-4 flex items-center justify-center" }, /* @__PURE__ */ React.createElement("div", { className: "bg-white dark:bg-card p-6 rounded-3xl border border-slate-100 dark:border-border max-w-md w-full text-center shadow-sm" }, /* @__PURE__ */ React.createElement("div", { className: "w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-3" }, /* @__PURE__ */ React.createElement(AlertCircle, { size: 28 })), /* @__PURE__ */ React.createElement("h2", { className: "text-base font-bold text-slate-900 dark:text-foreground" }, "Store Unavailable"), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500 mt-1" }, error || "This store could not be found."), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => navigate("/quick/shops"),
        className: "mt-4 px-5 py-2 text-xs font-bold bg-[#FE5502] text-white rounded-full hover:bg-orange-600 transition-all shadow-sm"
      },
      "Browse Other Stores"
    )));
  }
  return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen bg-slate-50 dark:bg-background text-slate-900 dark:text-foreground" }, /* @__PURE__ */ React.createElement("div", { className: "sticky top-0 z-40 bg-gradient-to-r from-[#FE5502] via-[#FF6A1A] to-[#FF8533] text-white shadow-md" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => navigate(-1),
      className: "p-1.5 rounded-full hover:bg-white/20 active:scale-95 transition-all text-white",
      "aria-label": "Back"
    },
    /* @__PURE__ */ React.createElement(ArrowLeft, { size: 22 })
  ), /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("h1", { className: "text-lg md:text-xl font-black tracking-tight text-white leading-none truncate" }, shop.shopName), /* @__PURE__ */ React.createElement("p", { className: "text-[11px] text-white/80 font-medium mt-0.5 truncate" }, shop.businessType || "Partner Store", " \u2022 ", shop.address || "Local Marketplace"))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement(
    Link,
    {
      to: "/quick/cart",
      className: "p-2 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 transition-all text-white relative",
      "aria-label": "Cart"
    },
    /* @__PURE__ */ React.createElement(ShoppingBag, { size: 19 }),
    Number(cartCount || 0) > 0 && /* @__PURE__ */ React.createElement("span", { className: "absolute -top-1 -right-1 bg-white text-primary-orange font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow" }, cartCount)
  )))), /* @__PURE__ */ React.createElement("div", { className: "max-w-[1400px] mx-auto px-4 pt-5 pb-6" }, /* @__PURE__ */ React.createElement("div", { className: "md:hidden bg-white dark:bg-card rounded-3xl border border-slate-200/80 dark:border-border shadow-sm overflow-hidden mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "relative h-44 sm:h-56 w-full bg-slate-100 dark:bg-muted overflow-hidden" }, shop.shopImage ? /* @__PURE__ */ React.createElement(
    "img",
    {
      src: resolveQuickImageUrl(shop.shopImage),
      alt: shop.shopName,
      className: "w-full h-full object-cover",
      onError: (e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800&auto=format&fit=crop&q=80";
      }
    }
  ) : /* @__PURE__ */ React.createElement("div", { className: "w-full h-full bg-gradient-to-br from-amber-100 via-orange-50 to-amber-200 dark:from-slate-800 dark:to-slate-900 flex flex-col items-center justify-center text-slate-400" }, /* @__PURE__ */ React.createElement(Store, { size: 48, className: "text-[#FE5502] opacity-80" }), /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold text-slate-500 dark:text-slate-400 mt-1" }, "Verified Partner Store")), /* @__PURE__ */ React.createElement("div", { className: "absolute top-4 right-4" }, isOpen ? /* @__PURE__ */ React.createElement("span", { className: "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-emerald-500 text-white shadow-lg backdrop-blur-md" }, /* @__PURE__ */ React.createElement("span", { className: "w-2.5 h-2.5 rounded-full bg-white animate-pulse" }), "Store Open Now") : /* @__PURE__ */ React.createElement("span", { className: "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-slate-900/90 text-white shadow-lg backdrop-blur-md" }, /* @__PURE__ */ React.createElement("span", { className: "w-2.5 h-2.5 rounded-full bg-rose-400" }), "Store Closed"))), /* @__PURE__ */ React.createElement("div", { className: "p-5" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col gap-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { className: "text-xl font-black text-slate-900 dark:text-foreground" }, shop.shopName), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-600 dark:text-slate-400" }, /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-1" }, /* @__PURE__ */ React.createElement(MapPin, { size: 14, className: "text-slate-400 shrink-0" }), shop.address || "Local Marketplace"), shop.businessType && /* @__PURE__ */ React.createElement("span", { className: "px-2 py-0.5 rounded-md bg-slate-100 dark:bg-muted text-slate-700 dark:text-slate-300 font-semibold text-[11px]" }, shop.businessType), /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-1 font-bold text-[#FE5502]" }, /* @__PURE__ */ React.createElement(Package, { size: 14 }), products.length, " Products"))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-muted/40 border border-slate-100 dark:border-border shrink-0" }, /* @__PURE__ */ React.createElement(Clock, { size: 20, className: isOpen ? "text-emerald-500 shrink-0" : "text-slate-400 shrink-0" }), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold text-slate-800 dark:text-slate-200" }, shop.openingHours || "Regular Business Hours"), /* @__PURE__ */ React.createElement("span", { className: `text-[11px] font-medium ${isOpen ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}` }, shop.timingText || (isOpen ? "Open for orders" : "Closed for orders"))))), !isOpen && /* @__PURE__ */ React.createElement("div", { className: "mt-4 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center gap-3 text-amber-900 dark:text-amber-300" }, /* @__PURE__ */ React.createElement(AlertCircle, { size: 20, className: "text-amber-600 shrink-0" }), /* @__PURE__ */ React.createElement("div", { className: "text-xs leading-relaxed" }, /* @__PURE__ */ React.createElement("span", { className: "font-bold block" }, "This store is currently offline/closed."), "You can browse the catalogue below, but adding products to cart and placing orders will be enabled when the store re-opens (", shop.timingText || shop.openingHours, ").")))), /* @__PURE__ */ React.createElement("div", { className: "hidden md:block bg-white dark:bg-card rounded-3xl border border-slate-200/80 dark:border-border shadow-sm overflow-hidden mb-6 relative" }, /* @__PURE__ */ React.createElement("div", { className: "relative h-[220px] lg:h-[260px] w-full overflow-hidden" }, shop.shopImage ? /* @__PURE__ */ React.createElement(
    "img",
    {
      src: resolveQuickImageUrl(shop.shopImage),
      alt: shop.shopName,
      className: "w-full h-full object-cover",
      onError: (e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800&auto=format&fit=crop&q=80";
      }
    }
  ) : /* @__PURE__ */ React.createElement("div", { className: "w-full h-full bg-gradient-to-br from-amber-100 via-orange-50 to-amber-200 dark:from-slate-800 dark:to-slate-900 flex flex-col items-center justify-center text-slate-400" }, /* @__PURE__ */ React.createElement(Store, { size: 48, className: "text-[#FE5502] opacity-80" }), /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold text-slate-500 dark:text-slate-400 mt-1" }, "Verified Partner Store")), /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 p-6 lg:p-8 flex items-center justify-between z-10" }, /* @__PURE__ */ React.createElement("div", { className: "bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-100 dark:border-slate-800 shadow-xl rounded-2xl p-5 flex flex-col gap-2.5 max-w-[50%] lg:max-w-[45%]" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f0ecfc] text-[#635bff] text-xs font-extrabold shadow-sm" }, /* @__PURE__ */ React.createElement(Store, { size: 14 }), shop.businessType || "Retail Store")), /* @__PURE__ */ React.createElement("h1", { className: "text-2xl lg:text-3xl font-black text-slate-900 dark:text-white leading-tight" }, shop.shopName), /* @__PURE__ */ React.createElement("div", { className: "flex items-start gap-1.5 text-xs lg:text-sm text-slate-700 dark:text-slate-300 font-bold leading-relaxed" }, /* @__PURE__ */ React.createElement(MapPin, { size: 15, className: "text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" }), /* @__PURE__ */ React.createElement("span", null, shop.address || "Local Marketplace"))), /* @__PURE__ */ React.createElement("div", { className: "bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-100 dark:border-slate-800 shadow-xl rounded-2xl p-4 lg:p-5 flex flex-col items-start gap-3 min-w-[220px] lg:min-w-[250px] shrink-0" }, isOpen ? /* @__PURE__ */ React.createElement("span", { className: "w-full inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full text-xs font-black bg-emerald-500 text-white shadow-md" }, /* @__PURE__ */ React.createElement("span", { className: "w-2.5 h-2.5 rounded-full bg-white animate-pulse" }), "Store Open Now") : /* @__PURE__ */ React.createElement("span", { className: "w-full inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full text-xs font-black bg-slate-900 text-white shadow-md" }, /* @__PURE__ */ React.createElement("span", { className: "w-2.5 h-2.5 rounded-full bg-rose-400" }), "Store Closed"), /* @__PURE__ */ React.createElement("div", { className: "flex items-start gap-2.5 text-slate-700 dark:text-slate-200" }, /* @__PURE__ */ React.createElement(Clock, { size: 18, className: isOpen ? "text-emerald-500 shrink-0 mt-0.5" : "text-slate-400 shrink-0 mt-0.5" }), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs font-black text-slate-900 dark:text-slate-100" }, shop.openingHours || "Regular Business Hours"), /* @__PURE__ */ React.createElement("span", { className: `text-[11px] font-bold ${isOpen ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}` }, shop.timingText || (isOpen ? "Open for orders" : "Closed for orders"))))))), !isOpen && /* @__PURE__ */ React.createElement("div", { className: "p-4 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-900/50 flex items-center gap-3 text-amber-900 dark:text-amber-300" }, /* @__PURE__ */ React.createElement(AlertCircle, { size: 20, className: "text-amber-600 shrink-0" }), /* @__PURE__ */ React.createElement("div", { className: "text-xs leading-relaxed" }, /* @__PURE__ */ React.createElement("span", { className: "font-bold block" }, "This store is currently offline/closed."), "You can browse the catalogue below, but adding products to cart and placing orders will be enabled when the store re-opens (", shop.timingText || shop.openingHours, ")."))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-4" }, /* @__PURE__ */ React.createElement("h3", { className: "text-base font-black text-slate-900 dark:text-foreground flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", null, "All Products from ", shop.shopName), /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold text-slate-400" }, "(", products.length, ")"))), products.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "bg-white dark:bg-card p-10 rounded-2xl border border-slate-100 dark:border-border text-center" }, /* @__PURE__ */ React.createElement(Package, { size: 40, className: "text-slate-300 mx-auto mb-2" }), /* @__PURE__ */ React.createElement("p", { className: "text-xs font-bold text-slate-600 dark:text-slate-400" }, "No products currently listed for this store.")) : /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4" }, products.map((product) => /* @__PURE__ */ React.createElement(
    ProductCard,
    {
      key: product.id || product._id,
      product: {
        ...product,
        isShopOpen: isOpen,
        shopStatus: isOpen ? "Open Now" : "Closed",
        seller: {
          ...product.seller,
          isShopOpen: isOpen
        }
      },
      isStoreClosed: !isOpen
    }
  ))))));
}
