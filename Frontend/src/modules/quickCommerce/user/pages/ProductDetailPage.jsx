import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Heart,
  Loader2,
  MessageSquare,
  Minus,
  Plus,
  ShieldCheck,
  Star,
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
        label: "Unit",
        value: source.weight || source.unit || "1 unit",
      },
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
  const [reviews, setReviews] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: "" });

  const { cart, addToCart, updateQuantity, removeFromCart } = useCart();
  const { toggleWishlist: toggleWishlistGlobal, isInWishlist } = useWishlist();
  const { showToast } = useToast();
  const quantity = useMemo(() => {
    if (!product) return 0;
    const cartItem = cart.find(
      (item) => getProductIdentifier(item) === getProductIdentifier(product),
    );
    return cartItem ? cartItem.quantity : 0;
  }, [cart, product]);

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
    if (product?.images?.length) {
      setActiveImage(product.images[0]);
    }
  }, [product]);

  useEffect(() => {
    let cancelled = false;

    const fetchReviews = async () => {
      if (!resolvedProductId) {
        setReviewLoading(false);
        return;
      }

      setReviewLoading(true);

      try {
        const response = await customerApi.getProductReviews(resolvedProductId);
        if (!cancelled) {
          setReviews(response?.data?.results || []);
        }
      } catch (error) {
        if (!cancelled) {
          setReviews([]);
        }
      } finally {
        if (!cancelled) {
          setReviewLoading(false);
        }
      }
    };

    fetchReviews();

    return () => {
      cancelled = true;
    };
  }, [resolvedProductId]);

  const averageRating = useMemo(() => {
    if (!reviews.length) return "4.8";
    const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
    return (total / reviews.length).toFixed(1);
  }, [reviews]);

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

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    if (!resolvedProductId || !newReview.comment.trim()) return;

    try {
      setIsSubmittingReview(true);
      const response = await customerApi.submitReview({
        productId: resolvedProductId,
        rating: newReview.rating,
        comment: newReview.comment.trim(),
      });

      if (response?.data?.success) {
        showToast("Review submitted for moderation", "success");
        setNewReview({ rating: 5, comment: "" });
      }
    } catch (error) {
      showToast(
        error?.response?.data?.message || "Failed to submit review",
        "error",
      );
    } finally {
      setIsSubmittingReview(false);
    }
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
            {product.images.map((image, index) => (
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
              <div className="flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-950/30 px-3 py-1 text-xs font-bold text-red-500">
                <Star size={12} fill="currentColor" />
                {averageRating} ({reviews.length || "0"})
              </div>
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
                {product.price}
              </span>
              {product.originalPrice > product.price && (
                <>
                  <span className="text-lg font-bold text-slate-400 dark:text-slate-500 line-through">
                    {"\u20B9"}
                    {product.originalPrice}
                  </span>
                  <span className="rounded-lg bg-red-50 dark:bg-red-950/30 px-2 py-1 text-xs font-black uppercase text-red-500">
                    {Math.round(
                      ((product.originalPrice - product.price) /
                        product.originalPrice) *
                        100,
                    )}
                    % OFF
                  </span>
                </>
              )}
            </div>

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
                        ? removeFromCart(product.id || product._id)
                        : updateQuantity(product.id || product._id, -1)
                    }
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all hover:bg-white/20"
                  >
                    <Minus size={24} strokeWidth={3} />
                  </button>
                  <span className="flex-1 text-center text-xl font-black">{quantity}</span>
                  <button
                    disabled={quantity >= Number(product.stock ?? Infinity)}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={() => {
                      const stock = Number(product.stock ?? Infinity);
                      if (quantity >= stock) {
                        showToast(`Only ${stock} in stock`, "error");
                        return;
                      }
                      updateQuantity(product.id || product._id, 1);
                    }}
                  >
                    <Plus size={24} strokeWidth={3} />
                  </button>
                </div>
              ) : (
                  <Button
                    onClick={async () => {
                      const stock = Number(product.stock ?? Infinity);
                      if (stock <= 0) {
                        showToast("This product is out of stock", "error");
                        return;
                      }
                      await addToCart(product);
                      showToast(`${product.name} added to cart`, "success");
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

      <div className="mt-20 border-t border-border pt-16">
        <div className="flex flex-col gap-12 lg:flex-row">
          <div className="lg:w-[40%]">
            <div className="sticky top-24 rounded-[2.5rem] border border-border bg-card p-8 shadow-sm transition-colors">
              <h3 className="mb-2 text-2xl font-black text-foreground">Write a Review</h3>
              <p className="mb-6 text-sm font-medium text-slate-500 dark:text-slate-400">
                Share your experience with this product
              </p>

              <form onSubmit={handleReviewSubmit} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Your Rating
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewReview((current) => ({ ...current, rating: star }))}
                        className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-xl transition-all",
                          newReview.rating >= star
                            ? "bg-red-50 dark:bg-red-950/30 text-red-500"
                            : "bg-card dark:bg-background text-slate-300 dark:text-slate-600",
                        )}
                      >
                        <Star
                          className={cn("h-6 w-6", newReview.rating >= star && "fill-current")}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Comment
                  </label>
                  <textarea
                    value={newReview.comment}
                    onChange={(event) =>
                      setNewReview((current) => ({
                        ...current,
                        comment: event.target.value,
                      }))
                    }
                    placeholder="What did you like or dislike?"
                    className="min-h-[120px] w-full rounded-2xl bg-card dark:bg-background border border-border p-4 text-sm font-bold outline-none ring-1 ring-transparent transition-all focus:ring-[#FE5502]/20 dark:text-white"
                  />
                </div>

                <Button
                  onClick={handleReviewSubmit}
                  disabled={isSubmittingReview}
                  className="h-14 rounded-2xl bg-primary-orange hover:bg-primary-hover active:bg-primary-dark font-black text-white transition-colors"
                >
                  {isSubmittingReview ? "SUBMITTING..." : "SUBMIT REVIEW"}
                </Button>
                <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Reviews are moderated before publishing
                </p>
              </form>
            </div>
          </div>

          <div className="space-y-8 lg:w-[60%]">
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-xl border border-primary-orange/10 bg-primary-orange/5 px-4 py-2">
                <MessageSquare size={18} className="text-primary-orange" />
                <span className="font-black text-primary-orange">
                  {reviews.length} Review{reviews.length === 1 ? "" : "s"}
                </span>
              </div>

              {reviewLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="animate-spin text-primary-orange" size={32} />
              </div>
            ) : reviews.length > 0 ? (
              <div className="space-y-6">
                {reviews.map((review) => (
                  <div
                    key={review._id}
                    className="rounded-[2rem] border border-border bg-card p-8 shadow-sm transition-colors"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="ds-h2 flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-card dark:bg-background border border-border text-slate-400 dark:text-slate-500">
                          {(review.userId?.profileImage || review.userId?.image || review.userAvatar) ? (
                            <img
                              src={resolveQuickImageUrl(review.userId?.profileImage || review.userId?.image || review.userAvatar)}
                              alt={review.userId?.name || review.userName || "Reviewer"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            (review.userId?.name || review.userName || "?")[0]
                          )}
                        </div>
                        <div>
                          <h4 className="font-black text-foreground transition-colors">
                            {review.userId?.name || review.userName || "Anonymous"}
                          </h4>
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, index) => (
                              <Star
                                key={index}
                                size={12}
                                className={cn(
                                  index < review.rating
                                    ? "fill-red-400 text-red-400"
                                    : "text-slate-200 dark:text-slate-700",
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {review.createdAt
                          ? new Date(review.createdAt).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                    <p className="font-medium leading-relaxed text-slate-600 dark:text-slate-300 transition-colors">
                      {review.comment}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[3rem] border-2 border-dashed border-border bg-background p-20 text-center">
                <p className="text-sm font-black uppercase text-slate-400">
                  No reviews yet. Be the first!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default ProductDetailPage;
