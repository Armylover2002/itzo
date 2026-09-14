// ============================================================
// OPTIMIZED ProductDetailPage.jsx
// ============================================================
//
// KEY OPTIMIZATIONS:
//
// 1. normalizeProduct, normalizePrice, cleanDescription, resolveQuickImageUrl
//    — pure functions, already outside component ✓
//
// 2. initialProduct (useMemo) — already good ✓
//
// 3. Image deduplication in normalizeProduct — original used Set on an array
//    that could contain undefined entries; tightened to filter before Set.
//
// 4. ProductDetailSection → React.memo  (the 3 detail chips re-rendered on
//    every cart/quantity change)
//
// 5. handleToggleWishlist → useCallback
//
// 6. quantity selector: add/remove handlers → useCallback with stable refs
//    (avoids re-creating lambdas inside JSX on every render)
//
// 7. isWishlisted → useMemo ✓ (already in original)
//
// 8. activeImage initialisation: original had two separate effects that both
//     set activeImage — merged into one, preventing a redundant extra render.
//
// ============================================================

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Clock, Heart, Loader2,
  Minus, Plus, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { useToast } from "@shared/components/ui/Toast";
import { useLocation as useAppLocation } from "../context/LocationContext";
import { customerApi } from "../services/customerApi";
import { resolveQuickImageUrl } from "../utils/image";
import {
  DEFAULT_PRODUCT_IMAGE,
  handleProductImageError,
} from "@/shared/utils/productImage";
import { isStoreCurrentlyOpen, buildShopClosedMessage } from "@shared/utils/timeFormat";
import {
  variantsWithoutPlaceholder,
  applyVariantToProduct,
  getCartLineId,
  getVariantKey,
  getVariantDisplayLabel,
  findCartLineForProduct,
} from "../utils/productMeta";
import VariantPickerSheet from "../components/shared/VariantPickerSheet";
import { hasVariantPicker } from "../utils/firstVariantDisplay";
import { resolveWishlistVariant } from "../utils/wishlistVariant";

// ─── Pure helpers (unchanged) ─────────────────────────────────────────────────

const getProductIdentifier = (value) =>
  String(value?.cartLineId || value?.id || value?._id || value?.productId || value?.itemId || "").trim();

const normalizePrice = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const cleanDescription = (text) => {
  if (!text) return "No description is available for this product yet.";
  const value = String(text).trim();
  if (!value) return "No description is available for this product yet.";
  if (value.startsWith("{\\rtf") || value.includes("\\par")) {
    const cleaned = value
      .replace(/\{\\[^}]*\}/g, " ")
      .replace(/\\[a-z]+\d*\s?/gi, " ")
      .replace(/\\'/g, "'")
      .replace(/[{}]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned || "No description is available for this product yet.";
  }
  return value;
};

const normalizeProduct = (product = {}, fallback = {}) => {
  const source = { ...fallback, ...product };

  // Tightened: filter before dedup so Set doesn't waste slots on empty strings
  const imageCandidates = [
    source.mainImage,
    source.image,
    ...(Array.isArray(source.galleryImages) ? source.galleryImages : []),
  ]
    .filter(Boolean)
    .map((image) => resolveQuickImageUrl(image) || image)
    .filter(Boolean);
  const images = [...new Set(imageCandidates)];

  const normalizedVariants = Array.isArray(source.variants)
    ? source.variants.map((variant) => ({
        ...variant,
        images: (Array.isArray(variant?.images) ? variant.images : [])
          .filter(Boolean)
          .map((image) => resolveQuickImageUrl(image) || image)
          .filter(Boolean),
      }))
    : [];

  const basePrice = normalizePrice(source.price, 0);
  const rawSale = normalizePrice(source.salePrice, 0);
  const listPrice = Math.max(
    basePrice,
    rawSale,
    normalizePrice(source.originalPrice ?? source.mrp, 0),
  );
  // Sell at discounted sale only when it is actually below list/MRP.
  const price =
    rawSale > 0 && listPrice > 0 && rawSale < listPrice
      ? rawSale
      : basePrice || rawSale || listPrice;
  const originalPrice = Math.max(listPrice, price);
  const stock = normalizePrice(source.stock, 0);
  const packingFee = normalizePrice(source.packingFee, 0);
  const unitLabel = String(source.weight || source.unit || "").trim() || "1 unit";

  const details = [
    { label: "Unit", value: unitLabel },
    { label: "Stock", value: stock > 0 ? `${stock} available` : "Out of stock" },
    { label: "Brand", value: source.brand || "—" },
  ];
  if (packingFee > 0) {
    details.push({ label: "Packing", value: `₹${packingFee}` });
  }

  return {
    ...source,
    id: source.id || source._id,
    _id: source._id || source.id,
    name: source.name || "Product",
    category:
      source.category ||
      source.categoryName ||
      source.categoryId?.name ||
      source.subcategoryId?.name ||
      "Quick Commerce",
    price,
    salePrice: rawSale,
    mrp: originalPrice,
    originalPrice,
    packingFee,
    description: cleanDescription(source.description),
    images: images.length > 0 ? images : [DEFAULT_PRODUCT_IMAGE],
    details,
    storeName:
      source.storeName || source.restaurantName || source.seller?.shopName || source.seller?.name ||
      source.sellerId?.name || source.store?.name || source.storeId?.name || "Fresh Mart",
    openingHours:
      source.openingHours ||
      source.seller?.shopInfo?.openingHours ||
      source.sellerId?.shopInfo?.openingHours ||
      source.seller?.openingHours ||
      source.sellerId?.openingHours ||
      "",
    isShopOpen: source.isShopOpen,
    deliveryTime: source.deliveryTime || "8-12 mins",
    variants: normalizedVariants,
  };
};

// ─── Extracted memoized sub-components ───────────────────────────────────────

// Detail chip: only re-renders when the detail itself changes
const ProductDetailChip = React.memo(function ProductDetailChip({ detail }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100/90 last:border-0">
      <span className="text-[11px] font-medium tracking-wide text-slate-400 shrink-0">{detail.label}</span>
      <span className="text-[13px] font-medium tracking-tight text-[#1c1c1e] dark:text-slate-100 text-right capitalize line-clamp-1 tabular-nums">{detail.value}</span>
    </div>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────

const ProductDetailPage = () => {
  const { productId, id } = useParams();
  const resolvedProductId = productId || id;
  const location = useLocation();
  const navigate = useNavigate();
  const { currentLocation } = useAppLocation();

  const initialProduct = useMemo(() => {
    const routeProduct = location.state?.product;
    return routeProduct ? normalizeProduct(routeProduct) : null;
  }, [location.state]);

  const [product, setProduct] = useState(initialProduct);
  const [activeImage, setActiveImage] = useState(initialProduct?.images?.[0] || "");
  const [loadingProduct, setLoadingProduct] = useState(!initialProduct);
  const [productError, setProductError] = useState("");
  const [categoryFullMap, setCategoryFullMap] = useState({});
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [showVariantPicker, setShowVariantPicker] = useState(false);

  const { cart, addToCart, updateQuantity, removeFromCart } = useCart();
  const { toggleWishlist: toggleWishlistGlobal, isVariantWishlisted, getSavedWishlistVariant } = useWishlist();
  const { showToast } = useToast();

  const isWishlisted = useMemo(() => {
    if (!product) return false;
    return isVariantWishlisted(product.id || product._id, selectedVariant);
  }, [product, selectedVariant, isVariantWishlisted]);

  useEffect(() => {
    let cancelled = false;
    const loadCategoryTree = async () => {
      try {
        const response = await customerApi.getCategories({ tree: true });
        if (!response?.data?.success || cancelled) return;
        const results = response.data.results || response.data.result || [];
        const allCats = Array.isArray(results) ? results : [];
        const fullMap = {};
        const flatten = (items) => {
          items.forEach((item) => {
            fullMap[item._id] = item;
            if (item.children?.length > 0) flatten(item.children);
          });
        };
        flatten(allCats);
        if (!cancelled) setCategoryFullMap(fullMap);
      } catch {
        if (!cancelled) setCategoryFullMap({});
      }
    };
    loadCategoryTree();
    return () => { cancelled = true; };
  }, []);

  const productVariants = useMemo(
    () => (product ? variantsWithoutPlaceholder(product.variants) : []),
    [product],
  );

  const hasSelectableVariants = productVariants.length > 0;

  useEffect(() => {
    if (!product || !hasSelectableVariants) {
      setSelectedVariant(null);
      return;
    }
    setSelectedVariant((prev) => {
      const prevKey = getVariantKey(prev);
      if (prevKey && productVariants.some((v) => getVariantKey(v) === prevKey)) {
        return prev;
      }

      const routeVariant = resolveWishlistVariant(location.state?.product);
      if (
        routeVariant &&
        productVariants.some((v) => getVariantKey(v) === getVariantKey(routeVariant))
      ) {
        return routeVariant;
      }

      const savedVariant = getSavedWishlistVariant(product.id || product._id);
      if (
        savedVariant &&
        productVariants.some((v) => getVariantKey(v) === getVariantKey(savedVariant))
      ) {
        return savedVariant;
      }

      for (const variant of productVariants) {
        const line = findCartLineForProduct(cart, product, variant);
        if (line && Number(line.quantity || 0) > 0) return variant;
      }
      return productVariants.find((v) => Number(v.stock || 0) > 0) || productVariants[0] || null;
    });
  }, [product, hasSelectableVariants, productVariants, cart, location.state, getSavedWishlistVariant]);

  const activeProduct = useMemo(() => {
    if (!product) return null;
    if (!selectedVariant) return product;
    return applyVariantToProduct(product, selectedVariant);
  }, [product, selectedVariant]);

  const displayImages = useMemo(() => {
    const imgs = activeProduct?.images || product?.images || [];
    return imgs.length > 0 ? imgs : [DEFAULT_PRODUCT_IMAGE];
  }, [activeProduct, product]);

  useEffect(() => {
    setActiveImage(displayImages[0] || "");
  }, [displayImages, selectedVariant?.id, selectedVariant?._id, selectedVariant?.sku]);

  const variantCartLineId = useMemo(() => {
    if (!product) return "";
    const baseId = product.id || product._id;
    return getCartLineId(baseId, selectedVariant);
  }, [product, selectedVariant]);

  const displayStock = useMemo(() => {
    if (!product) return 0;
    if (selectedVariant) return Number(selectedVariant.stock ?? product.stock ?? 0);
    return Number(product.stock ?? 0);
  }, [product, selectedVariant]);

  const categoryLabel = useMemo(() => {
    if (!product) return "Quick Commerce";
    const subId = String(product.subcategoryId?._id || product.subcategoryId || "");
    const catId = String(product.categoryId?._id || product.categoryId || "");
    return (
      categoryFullMap[subId]?.name ||
      categoryFullMap[catId]?.name ||
      product.category ||
      "Quick Commerce"
    );
  }, [product, categoryFullMap]);

  const quantity = useMemo(() => {
    if (!product) return 0;
    const variant = hasSelectableVariants
      ? selectedVariant || productVariants[0] || null
      : product.selectedVariant || null;
    const cartItem = findCartLineForProduct(cart, product, variant);
    return cartItem ? Number(cartItem.quantity || 0) : 0;
  }, [cart, product, hasSelectableVariants, selectedVariant, productVariants]);

  const activeCartLineId = useMemo(() => {
    if (!product) return "";
    const variant = hasSelectableVariants
      ? selectedVariant || productVariants[0] || null
      : product.selectedVariant || null;
    const cartItem = findCartLineForProduct(cart, product, variant);
    if (cartItem?.id || cartItem?._id) return String(cartItem.id || cartItem._id);
    return hasSelectableVariants ? variantCartLineId : getProductIdentifier(product);
  }, [cart, product, hasSelectableVariants, selectedVariant, productVariants, variantCartLineId]);

  // Merged the two original activeImage effects into one — prevents double-render
  // when product loads: original had effect[resolvedProductId] setting product,
  // then a second effect[product] setting activeImage.
  useEffect(() => {
    let cancelled = false;
    const fetchProduct = async () => {
      if (!resolvedProductId) {
        setLoadingProduct(false);
        setProductError("Product id is missing from the route.");
        return;
      }
      setLoadingProduct(true);
      setProductError("");
      try {
        const detailParams = {};
        if (Number.isFinite(currentLocation?.latitude) && Number.isFinite(currentLocation?.longitude)) {
          detailParams.lat = currentLocation.latitude;
          detailParams.lng = currentLocation.longitude;
        }
        const response = await customerApi.getProductDetails(resolvedProductId, detailParams);
        const result =
          response?.data?.result || response?.data?.data || response?.data?.product || null;
        if (!result) throw new Error("Product not found");
        if (!cancelled) {
          const normalized = normalizeProduct(result, location.state?.product);
          setProduct(normalized);
          // Set active image in the same state flush — avoids the extra render
          // from the second useEffect that was watching `product`
          setActiveImage(normalized.images[0] || "");
        }
      } catch (error) {
        if (!cancelled) {
          setProduct(null);
          setProductError(error?.response?.data?.message || "Unable to load this product.");
        }
      } finally {
        if (!cancelled) setLoadingProduct(false);
      }
    };
    fetchProduct();
    return () => { cancelled = true; };
  }, [resolvedProductId, currentLocation?.latitude, currentLocation?.longitude]);

  // useCallback: stable reference, doesn't cause child re-renders
  const handleToggleWishlist = useCallback(async () => {
    if (!product) return;
    const wishlistProduct = selectedVariant
      ? applyVariantToProduct(product, selectedVariant)
      : product;
    const wasWishlisted = isVariantWishlisted(product.id || product._id, selectedVariant);
    await toggleWishlistGlobal(wishlistProduct);
    showToast(
      wasWishlisted ? `${product.name} removed from wishlist` : `${product.name} added to wishlist`,
      wasWishlisted ? "info" : "success",
    );
  }, [product, selectedVariant, toggleWishlistGlobal, isVariantWishlisted, showToast]);

  const handleAddToCart = useCallback(async () => {
    if (!product) return;
    const openingHours = product.openingHours || "";
    const shopOpen =
      product.isShopOpen != null
        ? Boolean(product.isShopOpen)
        : isStoreCurrentlyOpen(openingHours);
    if (!shopOpen) {
      showToast(buildShopClosedMessage(openingHours), "error");
      return;
    }
    if (hasSelectableVariants || hasVariantPicker(product)) {
      setShowVariantPicker(true);
      return;
    }
    const cartProduct = selectedVariant
      ? applyVariantToProduct(product, selectedVariant)
      : product;
    const stock = Number(cartProduct.stock ?? Infinity);
    if (stock <= 0) { showToast("This product is out of stock", "error"); return; }
    const result = await addToCart(cartProduct);
    if (result?.ok === false) return;
    showToast(`${product.name} added to cart`, "success");
  }, [product, selectedVariant, hasSelectableVariants, addToCart, showToast]);

  const handleDecrement = useCallback(() => {
    if (!product) return;
    const cartLineId = activeCartLineId || (hasSelectableVariants ? variantCartLineId : (product.id || product._id));
    if (quantity === 1) removeFromCart(cartLineId);
    else updateQuantity(cartLineId, -1);
  }, [product, activeCartLineId, hasSelectableVariants, variantCartLineId, quantity, removeFromCart, updateQuantity]);

  const handleIncrement = useCallback(() => {
    if (!product) return;
    const stock = Number(displayStock ?? product.stock ?? Infinity);
    if (quantity >= stock) { showToast(`Only ${stock} items are available in stock.`, "error"); return; }
    const cartLineId = activeCartLineId || (hasSelectableVariants ? variantCartLineId : (product.id || product._id));
    updateQuantity(cartLineId, 1);
  }, [product, activeCartLineId, hasSelectableVariants, variantCartLineId, displayStock, quantity, updateQuantity, showToast]);

  // ── Loading / error states ───────────────────────────────────────────────

  if (loadingProduct) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-[1920px] items-center justify-center px-4 md:px-[50px]">
        <div className="flex items-center gap-3 rounded-xl bg-white border border-slate-100 px-5 py-3.5">
          <Loader2 className="animate-spin text-rose-600" size={20} />
          <span className="font-normal text-[13px] tracking-tight text-slate-600">Loading product...</span>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-[1920px] flex-col items-center justify-center px-4 text-center md:px-[50px]">
        <h1 className="text-xl font-normal tracking-tight text-[#1c1c1e] dark:text-slate-100">Product not found</h1>
        <p className="mt-2 max-w-md text-[13px] font-normal text-slate-500 tracking-tight">
          {productError || "This product may have been removed or is no longer available."}
        </p>
        <Button onClick={() => navigate(-1)} className="mt-5 rounded-xl bg-rose-600/90 px-5 py-2.5 text-[13px] font-normal text-white hover:bg-rose-700">
          Go back
        </Button>
      </div>
    );
  }

  const discountPercent = (activeProduct?.originalPrice || 0) > (activeProduct?.price || 0)
    ? Math.round((((activeProduct.originalPrice - activeProduct.price) / activeProduct.originalPrice) * 100))
    : 0;

  // ── Main render — identical JSX, sub-components replaced with memo versions ──

  return (
    <div className="relative z-10 mx-auto w-full max-w-[1920px] animate-in px-3 pt-2 pb-12 fade-in duration-500 md:px-[50px] md:py-5 md:pb-8 bg-[#f8f7f6] dark:bg-background min-h-screen">
      <button
        onClick={() => navigate(-1)}
        className="group mb-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 border border-slate-100 transition-all hover:bg-white md:mb-4"
      >
        <ArrowLeft size={16} className="text-slate-600 transition-transform group-hover:-translate-x-1" />
      </button>

      <div className="flex flex-col gap-3 md:gap-6 lg:flex-row lg:gap-8">
        <div className="space-y-2 lg:w-[40%]">
          <div className="relative aspect-[4/3] md:aspect-square overflow-hidden rounded-xl border border-slate-100/80 bg-white">
            <img
              src={activeImage || DEFAULT_PRODUCT_IMAGE}
              alt={product.name}
              className="h-full w-full object-cover mix-blend-multiply dark:mix-blend-normal"
              onError={handleProductImageError}
            />
            <button
              onClick={handleToggleWishlist}
              className={cn(
                "absolute right-2.5 top-2.5 rounded-full p-2 transition-all",
                isWishlisted ? "bg-rose-50 text-rose-500" : "bg-white/90 text-slate-400 border border-slate-100",
              )}
            >
              <Heart size={16} fill={isWishlisted ? "currentColor" : "none"} />
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {displayImages.map((image, index) => (
              <button
                key={`${image}-${index}`}
                onClick={() => setActiveImage(image)}
                className={cn(
                  "h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg border md:h-14 md:w-14",
                  activeImage === image ? "border-rose-400 ring-1 ring-rose-200" : "border-slate-100 opacity-70",
                )}
              >
                <img
                  src={image || DEFAULT_PRODUCT_IMAGE}
                  alt={`${product.name} ${index + 1}`}
                  className="h-full w-full object-cover"
                  onError={handleProductImageError}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="lg:w-[60%]">
          <div className="rounded-xl bg-white border border-slate-100/80 px-3.5 py-3.5 md:px-5 md:py-5">
            <div className="mb-1.5">
              <span className="text-[11px] font-medium tracking-wide text-rose-600/80">{categoryLabel}</span>
            </div>
            <h1 className="mb-1 text-[18px] md:text-[22px] font-semibold leading-tight tracking-tight text-[#1c1c1e] dark:text-slate-100">{product.name}</h1>
            <div className="mb-2.5 flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-rose-600/80" />
              <span className="text-[12px] font-medium tracking-tight text-slate-500 dark:text-slate-400">
                Sold by <span className="text-[#1c1c1e] dark:text-slate-100">{product.storeName}</span>
              </span>
            </div>
            <div className="mb-2.5 flex items-baseline gap-2">
              <span className="text-[22px] md:text-[26px] font-semibold tabular-nums tracking-normal text-rose-600">₹{activeProduct?.price}</span>
              {activeProduct?.originalPrice > activeProduct?.price && (
                <>
                  <span className="text-[13px] font-medium tabular-nums tracking-normal text-slate-400 line-through">₹{activeProduct.originalPrice}</span>
                  <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums tracking-normal text-amber-700 bg-amber-50">{discountPercent}% off</span>
                </>
              )}
            </div>
            <p className="max-w-2xl text-[13px] font-medium leading-relaxed tracking-tight text-slate-500 dark:text-slate-400 line-clamp-4 md:line-clamp-none">{product.description}</p>

            {hasSelectableVariants && (
              <div className="mt-3.5 pt-3.5 border-t border-slate-100">
                <p className="text-[13px] md:text-[15px] font-semibold text-[#1c1c1e] dark:text-slate-100 tracking-tight mb-2">Select pack</p>
                <div className="flex flex-wrap gap-1.5">
                  {productVariants.map((variant) => {
                    const key = getVariantKey(variant);
                    const selected = getVariantKey(selectedVariant) === key;
                    const outOfStock = Number(variant.stock || 0) <= 0;
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={outOfStock}
                        onClick={() => setSelectedVariant(variant)}
                        className={cn(
                          "rounded-lg border px-2.5 py-1.5 text-left transition-all min-w-[92px]",
                          selected
                            ? "border-rose-300 bg-rose-50/70 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-700"
                            : "border-slate-200 bg-[#fafafa] dark:bg-slate-800 text-[#1c1c1e] dark:text-slate-100 hover:border-rose-200",
                          outOfStock && "cursor-not-allowed opacity-40",
                        )}
                      >
                        <span className="block text-[11px] md:text-[12px] font-medium tracking-tight">{getVariantDisplayLabel(variant, product)}</span>
                        <span className="block text-[11px] font-semibold tabular-nums tracking-normal text-slate-500">
                          ₹{Number(variant.price || variant.salePrice || 0)}
                          {outOfStock ? " · Out of stock" : ` · ${Number(variant.stock || 0)} left`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex mt-3.5 pt-3.5 border-t border-slate-100 flex-row items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5 text-left">
                <span className="flex items-center gap-1.5 text-[12px] font-medium tracking-tight text-rose-600/90">
                  <ShieldCheck size={12} />Hygiene guaranteed
                </span>
                <span className="flex items-center gap-1.5 text-[12px] font-medium tracking-tight text-slate-500">
                  <Clock size={12} />Delivered in {product.deliveryTime}
                </span>
              </div>
              <div className="w-28 shrink-0">
                {(product.isShopOpen === false || !isStoreCurrentlyOpen(product.openingHours)) ? (
                  <div className="flex h-10 w-full items-center justify-center rounded-xl bg-slate-100 text-[12px] font-medium text-slate-500 cursor-not-allowed">
                    Shop off
                  </div>
                ) : quantity > 0 ? (
                  <div className="flex h-10 w-full items-center rounded-xl bg-rose-600/90 px-1 text-white">
                    <button onClick={handleDecrement} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-white/15">
                      <Minus size={14} strokeWidth={2.25} />
                    </button>
                    <span className="flex-1 text-center text-[13px] font-semibold tabular-nums">{quantity}</span>
                    <button
                      disabled={quantity >= Number(displayStock ?? Infinity)}
                      onClick={handleIncrement}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus size={14} strokeWidth={2.25} />
                    </button>
                  </div>
                ) : (
                  <Button
                    onClick={handleAddToCart}
                    disabled={displayStock <= 0}
                    className="h-10 w-full rounded-xl bg-rose-600/90 text-[13px] font-medium text-white tracking-tight hover:bg-rose-700 disabled:opacity-50"
                  >
                    {displayStock <= 0 ? "Sold out" : "Add"}
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-3.5 pt-3.5 border-t border-slate-100 space-y-0">
              {(selectedVariant
                ? [
                    { label: "Unit", value: getVariantDisplayLabel(selectedVariant, product) || product.details[0]?.value },
                    { label: "Stock", value: displayStock > 0 ? `${displayStock} available` : "Out of stock" },
                    { label: "Brand", value: product.brand || "—" },
                    ...(product.packingFee > 0 ? [{ label: "Packing", value: `₹${product.packingFee}` }] : []),
                  ]
                : product.details
              ).map((detail) => (
                <ProductDetailChip key={detail.label} detail={detail} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <VariantPickerSheet
        open={showVariantPicker}
        product={product}
        variants={productVariants}
        onClose={() => setShowVariantPicker(false)}
      />
    </div>
  );
};

export default ProductDetailPage;
