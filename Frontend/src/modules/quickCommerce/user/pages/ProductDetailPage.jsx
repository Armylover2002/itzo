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

  const isWishlisted = product
    ? isInWishlist(product.id || product._id)
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
    // Auto-select first variant when product loads
    if (product?.variants?.length > 0) {
      setSelectedVariant(product.variants[0]);
    } else {
      setSelectedVariant(null);
      if (product?.images?.length) {
        setActiveImage(product.images[0]);
      }
    }
  }, [product]);

  // Swap the shown image to the newly-selected variant's own photos.
  useEffect(() => {
    if (displayImages.length) {
      setActiveImage(displayImages[0]);
    }
  }, [displayImages]);

  const handleToggleWishlist = () => {
    if (!product) return;
    toggleWishlistGlobal(product);
    showToast(
      isWishlisted
        ? `${product.name} removed from wishlist`
        : `${product.name} added to wishlist`,
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
    <div className="relative z-10 mx-auto w-full max-w-[1920px] animate-in px-4 py-4 fade-in duration-700 md:px-[50px] md:py-8">
      <button
        onClick={() => navigate(-1)}
        className="group mb-6 inline-flex items-center gap-2 font-bold text-slate-500 dark:text-slate-400 transition-colors hover:text-[#FE5502] dark:hover:text-orange-400"
      >
        <ArrowLeft
          size={20}
          className="transition-transform group-hover:-translate-x-1"
        />
        Back
      </button>

      <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">
        <div className="space-y-4 lg:w-[45%] xl:w-[40%]">
          <div className="relative aspect-square overflow-hidden rounded-[2rem] border border-border bg-card dark:bg-background shadow-sm transition-colors">
            <img
              src={activeImage}
              alt={product.name}
              className="h-full w-full object-contain p-6 mix-blend-multiply dark:mix-blend-normal"
            />
            <button
              onClick={handleToggleWishlist}
              className={cn(
                "absolute right-5 top-5 rounded-full p-3.5 shadow-lg transition-all",
                isWishlisted
                  ? "bg-red-50 dark:bg-red-950/30 text-red-500"
                  : "bg-card dark:bg-background text-slate-400 dark:text-slate-300",
              )}
            >
              <Heart size={20} fill={isWishlisted ? "currentColor" : "none"} className={cn(isWishlisted && "fill-current")} />
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2">
            {displayImages.map((image, index) => (
              <button
                key={`${image}-${index}`}
                onClick={() => setActiveImage(image)}
                className={cn(
                  "h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border-2 transition-all md:h-24 md:w-24",
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

        <div className="space-y-6 md:space-y-8 lg:w-[55%] xl:w-[60%]">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-full border border-primary-orange/20 bg-primary-orange/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-primary-orange">
                {product.category}
              </span>
            </div>

            <h1 className="mb-2 text-3xl font-black leading-tight text-foreground md:text-4xl transition-colors">
              {product.name}
            </h1>

            <div className="mb-6 flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-primary-orange">
                <Store size={12} />
              </div>
              <span className="text-xs font-bold text-slate-500">
                Sold by{" "}
                <span className="text-foreground underline decoration-orange-500/30 decoration-2 underline-offset-4">
                  {product.storeName}
                </span>
              </span>
            </div>

            <div className="mb-5 flex items-baseline gap-4">
              <span className="text-4xl font-black text-[#FE5502] dark:text-orange-500">
                {"\u20B9"}
                {selectedVariant ? (normalizePrice(selectedVariant.salePrice, 0) > 0 ? selectedVariant.salePrice : selectedVariant.price) : product.price}
              </span>
              {(() => {
                const displayPrice = selectedVariant ? (normalizePrice(selectedVariant.salePrice, 0) > 0 ? selectedVariant.salePrice : selectedVariant.price) : product.price;
                const displayOriginal = selectedVariant ? selectedVariant.price : product.originalPrice;
                return displayOriginal > displayPrice ? (
                  <>
                    <span className="text-lg font-bold text-slate-400 dark:text-slate-500 line-through">
                      {"\u20B9"}
                      {displayOriginal}
                    </span>
                    <span className="rounded-lg bg-red-50 dark:bg-red-950/30 px-2 py-1 text-xs font-black uppercase text-red-500">
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
              <div className="mb-5">
                <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                  Select Variant
                </h4>
                <div className="flex flex-wrap gap-3">
                  {product.variants.map((v, idx) => (
                    <button
                      key={v._id || idx}
                      onClick={() => setSelectedVariant(v)}
                      className={cn(
                        "relative overflow-hidden rounded-xl px-4 py-2.5 text-sm font-bold transition-all border-2",
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

            <p className="max-w-2xl text-lg font-medium leading-relaxed text-slate-600 dark:text-slate-300 transition-colors">
              {product.description}
            </p>
          </div>

          <div className="flex flex-col items-center gap-6 rounded-[2.5rem] border border-border bg-card dark:bg-slate-900/50 p-6 sm:flex-row transition-colors">
            <div className="w-full sm:w-72">
              {quantity > 0 ? (
                <div className="flex h-16 w-full items-center rounded-2xl bg-primary-orange hover:bg-primary-hover active:bg-primary-dark px-2 text-white shadow-xl transition-colors">
                  <button
                    onClick={() =>
                      quantity === 1
                        ? removeFromCart(cartKey)
                        : updateQuantity(cartKey, -1)
                    }
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all hover:bg-white/20"
                  >
                    <Minus size={24} strokeWidth={3} />
                  </button>
                  <span className="flex-1 text-center text-xl font-black">{quantity}</span>
                  <button
                    disabled={quantity >= Number((selectedVariant?.stock ?? product.stock) ?? Infinity)}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={() => {
                      const stock = Number((selectedVariant?.stock ?? product.stock) ?? Infinity);
                      if (quantity >= stock) {
                        showToast(`Only ${stock} in stock`, "error");
                        return;
                      }
                      updateQuantity(cartKey, 1);
                    }}
                  >
                    <Plus size={24} strokeWidth={3} />
                  </button>
                </div>
              ) : (
                  <Button
                    onClick={async () => {
                      const stock = Number((selectedVariant?.stock ?? product.stock) ?? Infinity);
                      if (stock <= 0) {
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
                    className="h-16 w-full rounded-2xl bg-primary-orange hover:bg-primary-hover active:bg-primary-dark text-lg font-black text-white shadow-xl transition-all hover:-translate-y-1"
                  >
                  <Plus className="mr-2" size={24} strokeWidth={3} />
                  ADD TO CART
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-1 text-center sm:text-left">
              <span className="flex items-center justify-center gap-1 text-xs font-black uppercase tracking-widest text-[#FE5502] sm:justify-start">
                <ShieldCheck size={14} />
                Hygiene Guaranteed
              </span>
              <span className="flex items-center justify-center gap-1 text-sm font-bold text-slate-400 dark:text-slate-500 sm:justify-start">
                <Clock size={14} />
                Delivered in {product.deliveryTime}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {product.details.map((detail) => (
              <div
                key={detail.label}
                className="rounded-2xl border border-border bg-card p-4 text-center shadow-sm transition-colors"
              >
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {detail.label}
                </p>
                <p className="text-sm font-black text-foreground">{detail.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
