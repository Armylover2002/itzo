import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Heart,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { useToast } from "@shared/components/ui/Toast";
import { customerApi } from "../services/customerApi";
import { resolveQuickImageUrl } from "../utils/image";

const getProductIdentifier = (value) =>
  String(value?.productId || value?.itemId || value?.id || value?._id || "").split("::")[0];

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
  const imageCandidates = [
    source.mainImage,
    source.image,
    ...(Array.isArray(source.galleryImages) ? source.galleryImages : []),
  ]
    .map((image) => resolveQuickImageUrl(image) || image)
    .filter(Boolean);

  const images = [...new Set(imageCandidates)];
  const salePrice = normalizePrice(source.salePrice, 0);
  const basePrice = normalizePrice(source.price, salePrice);
  const price = salePrice > 0 ? salePrice : basePrice;
  const originalPrice = Math.max(
    price,
    normalizePrice(source.originalPrice ?? source.mrp ?? source.price, price),
  );
  const stock = normalizePrice(source.stock, 0);

  return {
    ...source,
    id: source.id || source._id,
    _id: source._id || source.id,
    name: source.name || "Product",
    category:
      source.category ||
      source.categoryName ||
      source.categoryId?.name ||
      "Quick Commerce",
    price,
    originalPrice,
    description: cleanDescription(source.description),
    images:
      images.length > 0
        ? images
        : ["https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1200&auto=format&fit=crop"],
    details: [
      {
        label: "Stock",
        value: stock > 0 ? `${stock} available` : "Out of stock",
      },
      {
        label: "Brand",
        value: source.brand || "Quick Select",
      },
    ],
    storeName:
      source.storeName ||
      source.restaurantName ||
      source.seller?.name ||
      source.sellerId?.name ||
      source.store?.name ||
      source.storeId?.name ||
      "Fresh Mart",
    deliveryTime: source.deliveryTime || "8-12 mins",
  };
};

const ProductDetailPage = () => {
  const { productId, id } = useParams();
  const resolvedProductId = productId || id;
  const location = useLocation();
  const navigate = useNavigate();

  const initialProduct = useMemo(() => {
    const routeProduct = location.state?.product;
    return routeProduct ? normalizeProduct(routeProduct) : null;
  }, [location.state]);

  const [product, setProduct] = useState(initialProduct);
  const [activeImage, setActiveImage] = useState(initialProduct?.images?.[0] || "");
  const [loadingProduct, setLoadingProduct] = useState(!initialProduct);
  const [productError, setProductError] = useState("");
  const [selectedVariant, setSelectedVariant] = useState(null);

  const { cart, addToCart, updateQuantity, removeFromCart } = useCart();
  const { toggleWishlist: toggleWishlistGlobal, isInWishlist } = useWishlist();
  const { showToast } = useToast();

  // Each variant carries its own photos — the gallery follows whichever
  // variant is selected, falling back to the product-level images for
  // older products saved before per-variant photos existed.
  const displayImages = useMemo(() => {
    const variantImages = Array.isArray(selectedVariant?.images)
      ? selectedVariant.images.map((img) => resolveQuickImageUrl(img) || img).filter(Boolean)
      : [];
    return variantImages.length > 0 ? variantImages : (product?.images || []);
  }, [selectedVariant, product]);

  const cartKey = useMemo(() => {
    if (!product) return "";
    const baseId = product.id || product._id || "";
    if (selectedVariant?._id) return `${baseId}::${selectedVariant._id}`;
    if (selectedVariant?.name) return `${baseId}::${selectedVariant.name}`;
    return baseId;
  }, [product, selectedVariant]);

  const quantity = useMemo(() => {
    if (!product || !cartKey) return 0;
    const cartItem = cart.find((item) => {
      const itemId = String(item?.productId || item?.itemId || item?.id || item?._id || "");
      return itemId === cartKey;
    });
    return cartItem ? cartItem.quantity : 0;
  }, [cart, product, cartKey]);

  const currentStock = useMemo(() => {
    const rawStock =
      selectedVariant?.stock !== undefined ? selectedVariant.stock : product?.stock;
    return normalizePrice(rawStock, 0);
  }, [product?.stock, selectedVariant?.stock]);

  const productDetails = useMemo(() => {
    if (!product) return [];
    return [
      {
        label: "Stock",
        value: currentStock > 0 ? `${currentStock} available` : "Out of stock",
        isOutOfStock: currentStock <= 0,
      },
      {
        label: "Brand",
        value: product.brand || "Quick Select",
      },
    ];
  }, [product, currentStock]);

  const isWishlisted = product
    ? isInWishlist(product.id || product._id, selectedVariant)
    : false;

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
        const response = await customerApi.getProductDetails(resolvedProductId);
        const result =
          response?.data?.result ||
          response?.data?.data ||
          response?.data?.product ||
          null;

        if (!result) {
          throw new Error("Product not found");
        }

        if (!cancelled) {
          const normalized = normalizeProduct(result, location.state?.product);
          setProduct(normalized);
          setActiveImage((currentImage) => currentImage || normalized.images[0]);
        }
      } catch (error) {
        if (!cancelled) {
          setProduct(null);
          setProductError(
            error?.response?.data?.message || "Unable to load this product.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingProduct(false);
        }
      }
    };

    fetchProduct();

    return () => {
      cancelled = true;
    };
  }, [location.state, resolvedProductId]);

  useEffect(() => {
    // Arriving from a wishlist card carries the specific variant that was
    // liked (see ProductCard/WishlistContext) — that must be pre-selected so
    // the heart icon reflects it correctly, instead of always defaulting to
    // the first variant.
    if (product?.variants?.length > 0) {
      const wishlistedVariantId = location.state?.product?.variantId;
      const matched = wishlistedVariantId
        ? product.variants.find(
            (v) => String(v._id) === String(wishlistedVariantId) || v.name === wishlistedVariantId,
          )
        : null;
      setSelectedVariant(matched || product.variants[0]);
    } else {
      setSelectedVariant(null);
      if (product?.images?.length) {
        setActiveImage(product.images[0]);
      }
    }
  }, [product, location.state]);

  // Swap the shown image to the newly-selected variant's own photos.
  useEffect(() => {
    if (displayImages.length) {
      setActiveImage(displayImages[0]);
    }
  }, [displayImages]);

  const handleToggleWishlist = () => {
    if (!product) return;
    toggleWishlistGlobal(product, selectedVariant);
    const variantLabel = selectedVariant?.name ? ` (${selectedVariant.name})` : "";
    showToast(
      isWishlisted
        ? `${product.name}${variantLabel} removed from wishlist`
        : `${product.name}${variantLabel} added to wishlist`,
      isWishlisted ? "info" : "success",
    );
  };

  if (loadingProduct) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-[1920px] items-center justify-center px-4 md:px-[50px]">
        <div className="flex items-center gap-3 rounded-2xl bg-card border border-border px-6 py-4 shadow-sm">
          <Loader2 className="animate-spin text-[#FE5502]" size={22} />
          <span className="font-bold text-slate-600 dark:text-slate-400">Loading product...</span>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-[1920px] flex-col items-center justify-center px-4 text-center md:px-[50px]">
        <h1 className="text-2xl font-black text-foreground">Product not found</h1>
        <p className="mt-2 max-w-md text-sm font-medium text-slate-500 dark:text-slate-400">
          {productError || "This product may have been removed or is no longer available."}
        </p>
        <Button
          onClick={() => navigate(-1)}
          className="mt-6 rounded-2xl bg-primary-orange hover:bg-primary-hover active:bg-primary-dark px-6 py-3 text-white transition-colors"
        >
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="relative z-10 mx-auto w-full max-w-[1920px] animate-in px-4 py-4 pb-28 fade-in duration-700 md:px-[50px] md:py-8 lg:pb-8">
      <button
        onClick={() => navigate(-1)}
        className="group mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 transition-colors hover:text-[#FE5502] dark:hover:text-orange-400 md:mb-6 md:text-base"
      >
        <ArrowLeft
          size={18}
          className="transition-transform group-hover:-translate-x-1 md:h-5 md:w-5"
        />
        Back
      </button>

      <div className="flex flex-col gap-4 lg:flex-row lg:gap-16">
        <div className="space-y-3 lg:w-[45%] xl:w-[40%]">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-card dark:bg-background shadow-sm transition-colors md:rounded-[2rem]">
            <img
              src={activeImage}
              alt={product.name}
              className="h-full w-full object-contain p-4 mix-blend-multiply dark:mix-blend-normal md:p-6"
            />
            <button
              onClick={handleToggleWishlist}
              className={cn(
                "absolute right-3 top-3 rounded-full p-2.5 shadow-lg transition-all md:right-5 md:top-5 md:p-3.5",
                isWishlisted
                  ? "bg-red-50 dark:bg-red-950/30 text-red-500"
                  : "bg-card dark:bg-background text-slate-400 dark:text-slate-300",
              )}
            >
              <Heart size={18} fill={isWishlisted ? "currentColor" : "none"} className={cn("md:h-5 md:w-5", isWishlisted && "fill-current")} />
            </button>
          </div>

          <div className="flex gap-2.5 overflow-x-auto pb-2 md:gap-3">
            {displayImages.map((image, index) => (
              <button
                key={`${image}-${index}`}
                onClick={() => setActiveImage(image)}
                className={cn(
                  "h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl border-2 transition-all md:h-24 md:w-24 md:rounded-2xl",
                  activeImage === image
                    ? "scale-95 border-[#FE5502] shadow-lg"
                    : "border-transparent opacity-70 hover:opacity-100",
                )}
              >
                <img
                  src={image}
                  alt={`${product.name} ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 md:space-y-8 lg:w-[55%] xl:w-[60%]">
          <div>
            <div className="mb-2.5 flex items-center gap-3 md:mb-4">
              <span className="rounded-full border border-primary-orange/20 bg-primary-orange/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-primary-orange md:px-3 md:text-[10px]">
                {product.category}
              </span>
            </div>

            <h1 className="mb-1.5 text-xl font-black leading-tight text-foreground md:mb-2 md:text-4xl transition-colors">
              {product.name}
            </h1>

            <div className="mb-3 flex items-center gap-2 md:mb-6">
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-orange-100 text-primary-orange md:h-5 md:w-5">
                <Store size={11} className="md:hidden" />
                <Store size={12} className="hidden md:block" />
              </div>
              <span className="text-[11px] font-bold text-slate-500 md:text-xs">
                Sold by{" "}
                <span className="text-foreground underline decoration-orange-500/30 decoration-2 underline-offset-4">
                  {product.storeName}
                </span>
              </span>
            </div>

            <div className="mb-3 flex items-baseline gap-2.5 md:mb-5 md:gap-4">
              <span className="text-2xl font-black text-[#FE5502] dark:text-orange-500 md:text-4xl">
                {"\u20B9"}
                {selectedVariant ? (normalizePrice(selectedVariant.salePrice, 0) > 0 ? selectedVariant.salePrice : selectedVariant.price) : product.price}
              </span>
              {(() => {
                const displayPrice = selectedVariant ? (normalizePrice(selectedVariant.salePrice, 0) > 0 ? selectedVariant.salePrice : selectedVariant.price) : product.price;
                const displayOriginal = selectedVariant ? selectedVariant.price : product.originalPrice;
                return displayOriginal > displayPrice ? (
                  <>
                    <span className="text-sm font-bold text-slate-400 dark:text-slate-500 line-through md:text-lg">
                      {"\u20B9"}
                      {displayOriginal}
                    </span>
                    <span className="rounded-lg bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 text-[10px] font-black uppercase text-red-500 md:px-2 md:py-1 md:text-xs">
                      {Math.round(
                        ((displayOriginal - displayPrice) /
                          displayOriginal) *
                          100,
                      )}
                      % OFF
                    </span>
                  </>
                ) : null;
              })()}
            </div>

            {product.variants && product.variants.length > 0 && (
              <div className="mb-3 md:mb-5">
                <h4 className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 md:mb-3 md:text-[10px]">
                  Select Variant
                </h4>
                <div className="flex flex-wrap gap-2 md:gap-3">
                  {product.variants.map((v, idx) => (
                    <button
                      key={v._id || idx}
                      onClick={() => setSelectedVariant(v)}
                      className={cn(
                        "relative overflow-hidden rounded-xl px-3 py-2 text-xs font-bold transition-all border-2 md:px-4 md:py-2.5 md:text-sm",
                        selectedVariant?._id === v._id
                          ? "bg-orange-50 dark:bg-orange-950/30 border-[#FE5502] text-[#FE5502] shadow-md"
                          : "bg-card dark:bg-slate-800 border-border text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/10 hover:shadow-sm",
                      )}
                    >
                      {v.name}
                      {selectedVariant?._id === v._id && (
                        <div className="absolute right-0 top-0 h-3 w-3 rounded-bl-lg bg-[#FE5502]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="max-w-2xl whitespace-pre-line text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300 transition-colors md:text-lg">
              {product.description}
            </p>
          </div>

          {/* Stock & Brand Details */}
          <div className="grid grid-cols-2 max-w-xs sm:max-w-sm gap-2.5 md:gap-4">
            {productDetails.map((detail) => (
              <div
                key={detail.label}
                className="rounded-xl border border-border bg-card p-3 text-center shadow-sm transition-colors md:rounded-2xl md:p-4"
              >
                <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 md:text-[10px]">
                  {detail.label}
                </p>
                <p
                  className={cn(
                    "text-xs font-black md:text-sm",
                    detail.isOutOfStock ? "text-red-500" : "text-foreground",
                  )}
                >
                  {detail.value}
                </p>
              </div>
            ))}
          </div>

          {/* Add to Cart: placed directly below the stock value */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:gap-6 rounded-2xl border border-border bg-card p-4 md:rounded-[2rem] md:p-6 shadow-sm dark:bg-slate-900/50 transition-colors">
            <div className="w-full sm:w-72">
              {quantity > 0 ? (
                <div className="flex h-12 w-full items-center rounded-xl bg-primary-orange hover:bg-primary-hover active:bg-primary-dark px-2 text-white shadow-xl transition-colors md:h-16 md:rounded-2xl">
                  <button
                    onClick={() =>
                      quantity === 1
                        ? removeFromCart(cartKey)
                        : updateQuantity(cartKey, -1)
                    }
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all hover:bg-white/20 md:h-12 md:w-12"
                    aria-label="Decrease quantity"
                  >
                    <Minus size={20} strokeWidth={3} className="md:h-6 md:w-6" />
                  </button>
                  <span className="flex-1 text-center text-base font-black md:text-xl">{quantity}</span>
                  <button
                    disabled={quantity >= currentStock}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed md:h-12 md:w-12"
                    aria-label="Increase quantity"
                    onClick={() => {
                      if (quantity >= currentStock) {
                        showToast(`Only ${currentStock} in stock`, "error");
                        return;
                      }
                      updateQuantity(cartKey, 1);
                    }}
                  >
                    <Plus size={20} strokeWidth={3} className="md:h-6 md:w-6" />
                  </button>
                </div>
              ) : (
                <Button
                  onClick={async () => {
                    if (currentStock <= 0) {
                      showToast("This product is out of stock", "error");
                      return;
                    }
                    await addToCart(product, selectedVariant);
                    showToast(
                      selectedVariant
                        ? `${product.name} (${selectedVariant.name}) added to cart`
                        : `${product.name} added to cart`,
                      "success",
                    );
                  }}
                  disabled={currentStock <= 0}
                  className="h-12 w-full rounded-xl bg-primary-orange hover:bg-primary-hover active:bg-primary-dark text-sm font-black text-white shadow-xl transition-all md:h-16 md:rounded-2xl md:text-lg md:hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="mr-2" size={18} strokeWidth={3} />
                  {currentStock <= 0 ? "OUT OF STOCK" : "ADD TO CART"}
                </Button>
              )}
            </div>

            <div className="flex flex-row sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-1 text-left">
              <span className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-[#FE5502]">
                <ShieldCheck size={14} />
                Hygiene Guaranteed
              </span>
              <span className="flex items-center gap-1 text-xs sm:text-sm font-bold text-slate-400 dark:text-slate-500">
                <Clock size={14} />
                Delivered in {product.deliveryTime}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
