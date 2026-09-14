import React from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Plus, Minus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlist } from "../../context/WishlistContext";
import { useCart } from "../../context/CartContext";
import { useToast } from "@shared/components/ui/Toast";
import { useCartAnimation } from "../../context/CartAnimationContext";
import { getCloudinarySrcSet } from "@/shared/utils/cloudinaryUtils";
import { motion, AnimatePresence } from "framer-motion";
import { getQuickProductPath } from "../../utils/routes";
import {
  isProductSoldOut,
} from "../../utils/firstVariantDisplay";
import { withWishlistVariantDisplay } from "../../utils/wishlistVariant";
import { findCartLineForProduct, variantsWithoutPlaceholder } from "../../utils/productMeta";
import { customerApi } from "../../services/customerApi";
import { isStoreCurrentlyOpen, buildShopClosedMessage } from "@shared/utils/timeFormat";
import {
  DEFAULT_PRODUCT_IMAGE,
  handleProductImageError,
  resolveProductImageSrc,
} from "@/shared/utils/productImage";
import VariantPickerSheet from "./VariantPickerSheet";

// ─── Constants (module-level) ─────────────────────────────────────────────────

const HEART_ANIMATE = { scale: [1, 1.3, 1] };
const HEART_INITIAL = { scale: 0 };
const HEART_POPUP_INITIAL = { scale: 0.5, opacity: 1, y: 0 };
const HEART_POPUP_ANIMATE = { scale: 2.5, opacity: 0, y: -60 };
const HEART_POPUP_TRANSITION = { duration: 0.8, ease: "easeOut" };

const IMG_SIZES = "(max-width: 768px) 150px, (max-width: 1024px) 200px, 250px";

// Module-level constant — computed once, no per-render browser reflow
const IS_MOBILE_SCREEN = typeof window !== "undefined" && window.innerWidth < 768;
const HEART_ICON_SIZE = IS_MOBILE_SCREEN ? 12 : 16;


// ─── ScallopedBadge ───────────────────────────────────────────────────────────

const ScallopedBadge = React.memo(function ScallopedBadge({ text, className }) {
  const hasPct = text.includes("%");
  const parts = hasPct ? text.split(" ") : null;

  return (
    <div className={cn("relative w-9 h-9 flex items-center justify-center", className)}>
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full drop-shadow-[0_1px_3px_rgba(168,85,247,0.4)]"
      >
        <path
          fill="#A364FF"
          d="M50 0 C 54 0, 56 4, 61 5 C 66 6, 70 2, 75 5 C 80 8, 81 14, 84 18 C 88 22, 94 23, 96 28 C 98 33, 94 38, 94 43 C 94 48, 98 52, 98 57 C 98 62, 94 66, 92 71 C 90 76, 92 82, 88 86 C 84 90, 78 89, 73 92 C 68 95, 66 100, 61 100 C 56 100, 53 96, 48 96 C 43 96, 40 100, 35 99 C 30 98, 28 92, 23 90 C 18 88, 12 89, 9 84 C 6 79, 10 74, 9 69 C 8 64, 2 61, 2 56 C 2 51, 6 47, 7 42 C 8 37, 4 31, 6 26 C 8 21, 14 20, 18 16 C 22 12, 24 6, 29 4 C 34 2, 38 6, 43 5 C 48 4, 49 0, 53 0"
        />
      </svg>
      <div className="relative z-10 text-white font-black flex flex-col items-center justify-center leading-none text-center">
        {hasPct ? (
          <>
            <span className="text-[9px] leading-tight">{parts[0]}</span>
            <span className="text-[6px] opacity-90 tracking-tighter uppercase">{parts[1] || "OFF"}</span>
          </>
        ) : (
          <span className="text-[8px] uppercase tracking-tighter">{text}</span>
        )}
      </div>
    </div>
  );
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Calculate discount badge text once */
function getBadgeText(badge, product) {
  if (badge) return badge;
  if (product.discount) return product.discount;
  if (product.originalPrice > product.price && product.originalPrice > 0) {
    return `${Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF`;
  }
  return null;
}

// ─── ProductCard ──────────────────────────────────────────────────────────────

const ProductCard = React.memo(function ProductCard({
  product,
  badge,
  className,
  compact = false,
  neutralBg = false,
  curvedInfo = false,
  variant = "default",
}) {
  const navigate = useNavigate();
  const { toggleWishlist: toggleWishlistGlobal, isVariantWishlisted } = useWishlist();
  const { cart, addToCart, updateQuantity, removeFromCart } = useCart();
  const { showToast } = useToast();
  const { animateAddToCart, animateRemoveFromCart } = useCartAnimation();

  const [showHeartPopup, setShowHeartPopup] = React.useState(false);
  const [showVariantPicker, setShowVariantPicker] = React.useState(false);
  const [pickerProduct, setPickerProduct] = React.useState(null);
  const [loadingPicker, setLoadingPicker] = React.useState(false);
  const imageRef = React.useRef(null);

  const displayProduct = React.useMemo(
    () => withWishlistVariantDisplay(product),
    [product],
  );
  const soldOut = React.useMemo(() => isProductSoldOut(product), [product]);
  const selectableVariants = React.useMemo(
    () => variantsWithoutPlaceholder(product?.variants),
    [product?.variants],
  );

  // Prefer composite line id when first variant is attached
  const productId = displayProduct.id || displayProduct._id || product.id || product._id;
  const baseProductId = String(productId || "").split("::")[0];

  // Find cart item — match by variant identity (not bare product id)
  const cartItem = React.useMemo(
    () => findCartLineForProduct(cart, displayProduct, displayProduct.selectedVariant),
    [cart, displayProduct],
  );

  const quantity = cartItem ? cartItem.quantity : 0;
  const cartLineId = cartItem?.id || cartItem?._id || productId;
  const isWishlisted = isVariantWishlisted(baseProductId, displayProduct.selectedVariant);
  const openingHours =
    displayProduct.openingHours ||
    displayProduct.seller?.shopInfo?.openingHours ||
    displayProduct.seller?.openingHours ||
    "";
  const isShopOpen =
    displayProduct.isShopOpen != null
      ? Boolean(displayProduct.isShopOpen)
      : isStoreCurrentlyOpen(openingHours);

  // Resolve image once — fall back to the default thumbnail when missing
  const resolvedImage = React.useMemo(
    () => resolveProductImageSrc(displayProduct),
    [displayProduct],
  );

  // Compute srcSet once
  const srcSet = React.useMemo(
    () => getCloudinarySrcSet(displayProduct.image || displayProduct.mainImage),
    [displayProduct.image, displayProduct.mainImage],
  );

  // Badge text — compute once
  const badgeText = React.useMemo(() => getBadgeText(badge, displayProduct), [badge, displayProduct]);

  // Formatted prices — compute once
  const formattedPrice = React.useMemo(
    () => Number(displayProduct.price || 0).toLocaleString(),
    [displayProduct.price],
  );
  const formattedOriginalPrice = React.useMemo(
    () => Number(displayProduct.originalPrice || 0).toLocaleString(),
    [displayProduct.originalPrice],
  );

  const handleProductClick = React.useCallback(() => {
    if (showVariantPicker) return;
    if (!baseProductId) return;
    navigate(getQuickProductPath(baseProductId), { state: { product: displayProduct } });
  }, [navigate, baseProductId, displayProduct, showVariantPicker]);

  const toggleWishlist = React.useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isWishlisted) {
        setShowHeartPopup(true);
        setTimeout(() => setShowHeartPopup(false), 1000);
      }
      toggleWishlistGlobal(displayProduct);
      showToast(
        isWishlisted
          ? `${displayProduct.name} removed from wishlist`
          : `${displayProduct.name} added to wishlist`,
        isWishlisted ? "info" : "success",
      );
    },
    [isWishlisted, toggleWishlistGlobal, displayProduct, showToast],
  );

  const openVariantPicker = React.useCallback((sourceProduct = product) => {
    setPickerProduct(sourceProduct);
    setShowVariantPicker(true);
  }, [product]);

  const handleAddToCart = React.useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isShopOpen) {
        showToast(buildShopClosedMessage(openingHours), "error");
        return;
      }
      if (soldOut) {
        showToast("This product is out of stock", "error");
        return;
      }

      if (selectableVariants.length > 0) {
        openVariantPicker(product);
        return;
      }

      if (baseProductId) {
        setLoadingPicker(true);
        try {
          const response = await customerApi.getProductDetails(baseProductId);
          const fetched = response?.data?.result || response?.data?.results || null;
          if (fetched && variantsWithoutPlaceholder(fetched.variants).length > 0) {
            openVariantPicker(fetched);
            return;
          }
        } catch {
          showToast("Could not load variants", "error");
          return;
        } finally {
          setLoadingPicker(false);
        }
      }

      const stock = Number(displayProduct.stock ?? Infinity);
      if (stock <= 0) {
        showToast("This product is out of stock", "error");
        return;
      }
      if (imageRef.current) {
        animateAddToCart(imageRef.current.getBoundingClientRect(), resolvedImage);
      }
      addToCart(displayProduct);
    },
    [
      animateAddToCart,
      displayProduct,
      addToCart,
      resolvedImage,
      showToast,
      isShopOpen,
      openingHours,
      soldOut,
      selectableVariants.length,
      openVariantPicker,
      product,
      baseProductId,
    ],
  );

  const handleIncrement = React.useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isShopOpen) {
        showToast(buildShopClosedMessage(openingHours), "error");
        return;
      }
      const stock = Number(displayProduct.stock ?? Infinity);
      if (quantity >= stock) {
        showToast(`Only ${stock} items are available in stock.`, "error");
        return;
      }
      updateQuantity(cartLineId, 1);
    },
    [updateQuantity, cartLineId, displayProduct.stock, quantity, showToast, isShopOpen, openingHours],
  );

  const handleDecrement = React.useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (quantity === 1) {
        animateRemoveFromCart(displayProduct.image);
        removeFromCart(cartLineId);
      } else {
        updateQuantity(cartLineId, -1);
      }
    },
    [quantity, animateRemoveFromCart, displayProduct.image, removeFromCart, cartLineId, updateQuantity],
  );

  // Icon size — module-level constant (no per-render reflow)
  const heartSize = HEART_ICON_SIZE;

  return (
    <div
      className={cn(
        "flex-shrink-0 w-full flex flex-col h-full cursor-pointer group bg-transparent",
        className,
      )}
      onClick={handleProductClick}
    >
      <div className={cn(
        "flex flex-col h-full w-full overflow-hidden transition-all duration-500 product-card-container premium-wave-shimmer",
        variant === "deal" 
          ? "bg-white dark:bg-card rounded-[20px] border-b-[4px] border-b-[#0c831f] border-x border-t border-slate-100 dark:border-white/10 shadow-sm"
          : "rounded-xl bg-[#FFF5F5] dark:bg-card border border-red-100/50 dark:border-white/10 shadow-sm hover:shadow-md"
      )}>

        {/* Image Section */}
        <div className={cn(
          "relative overflow-hidden w-full",
          variant === "deal" ? "h-[105px] md:h-[135px] p-0" : "h-[90px] md:h-[110px] p-1 md:p-2"
        )}>
          {badgeText && (
            <div className="absolute top-0.5 left-0.5 z-10">
              <ScallopedBadge text={badgeText} />
            </div>
          )}

          {!isShopOpen && (
            <div className="absolute bottom-1 left-1 z-10 rounded-md bg-slate-900/85 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
              Shop Off
            </div>
          )}

          <button
            onClick={toggleWishlist}
            className={cn(
              "absolute z-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center cursor-pointer hover:bg-white transition-all active:scale-90",
              variant === "deal" ? "top-3 right-3 w-8 h-8 shadow-sm" : "top-1 right-1 w-6 h-6 md:w-8 md:h-8 shadow-sm border border-slate-100/50"
            )}
          >
            <motion.div
              whileTap={{ scale: 0.8 }}
              animate={isWishlisted ? HEART_ANIMATE : {}}
            >
              <Heart
                size={heartSize}
                className={cn(
                  isWishlisted
                    ? "text-red-500 fill-red-500"
                    : "text-slate-300 dark:text-slate-500 group-hover:text-slate-400 dark:group-hover:text-slate-300",
                )}
              />
            </motion.div>
          </button>

          <AnimatePresence>
            {showHeartPopup && (
              <motion.div
                initial={HEART_POPUP_INITIAL}
                animate={HEART_POPUP_ANIMATE}
                exit={{ opacity: 0 }}
                transition={HEART_POPUP_TRANSITION}
                className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none text-red-500/30"
              >
                <Heart size={48} fill="currentColor" />
              </motion.div>
            )}
          </AnimatePresence>

          <div className={cn(
            "w-full h-full flex items-center justify-center transition-transform duration-500 group-hover:scale-105",
            variant === "deal" ? "rounded-t-[20px] bg-slate-50 dark:bg-white/5 overflow-hidden" : "rounded-md bg-white dark:bg-white/5 overflow-hidden"
          )}>
            <img
              ref={imageRef}
              src={resolvedImage || DEFAULT_PRODUCT_IMAGE}
              srcSet={srcSet}
              sizes={IMG_SIZES}
              alt={displayProduct.name}
              className={cn(
                "w-full h-full mix-blend-multiply dark:mix-blend-normal",
                variant === "deal" ? "object-cover p-0" : "object-contain p-0.5 md:p-1"
              )}
              loading="lazy"
              onError={handleProductImageError}
            />
          </div>
        </div>

        {/* Content Section */}
        <div className={cn(
          "flex flex-col flex-1 relative product-content-area transition-all duration-300",
          variant === "deal" ? "px-2.5 py-2.5 bg-white dark:bg-card" : "px-1.5 py-1 bg-[#FFF5F5] dark:bg-card border-t border-red-100/30 dark:border-white/10 space-y-0.5"
        )}>
          <div className={variant === "deal" ? "space-y-0.5" : "space-y-0"}>
            <div className={cn(
              "flex items-center tracking-wider",
              variant === "deal" ? "gap-1 md:gap-1.5 text-[9px] md:text-[10.5px] font-semibold text-[#0c831f] uppercase" : "gap-1 text-[7.5px] md:text-[8px] text-slate-500 dark:text-slate-400 font-bold uppercase"
            )}>
              <Clock size={variant === "deal" ? 12 : 7} className={variant === "deal" ? "text-[#0c831f]" : "text-emerald-600 dark:text-emerald-400"} />
              <span>{displayProduct.deliveryTime || "8-15 MINS"}</span>
            </div>
            <h3 className={cn(
              "text-slate-900 dark:text-slate-100",
              variant === "deal" ? "font-semibold text-[13px] md:text-[14px] line-clamp-2 tracking-tight leading-[1.15]" : "font-bold text-[11px] md:text-[12.5px] line-clamp-1 leading-tight"
            )}>
              {displayProduct.name}
            </h3>
            <p className={cn(
              "font-medium",
              variant === "deal" ? "text-[10px] md:text-[11.5px] text-slate-400 dark:text-slate-500 mt-0.5" : "text-[8px] md:text-[10px] text-slate-400 dark:text-slate-500 italic"
            )}>
              {displayProduct.weight || "1 unit"}
            </p>
          </div>

          {variant === "deal" && (
            <div className="w-full border-t border-dashed border-slate-200 dark:border-white/10 my-1.5 md:my-2 opacity-70" />
          )}

          <div className={cn(
            "mt-auto flex items-center justify-between gap-1",
            variant === "deal" ? "" : "pt-0.5 border-t border-slate-200/20 dark:border-white/10"
          )}>
            <div className="flex flex-col justify-center">
              <span className={cn(
                "text-slate-900 dark:text-slate-100 leading-none",
                variant === "deal" ? "font-bold text-[17px] md:text-[20px]" : "font-black text-[12.5px] md:text-[14px]"
              )}>
                ₹{formattedPrice}
              </span>
              {displayProduct.originalPrice > displayProduct.price && variant !== "deal" && (
                <span className="text-[8.5px] md:text-[9.5px] text-slate-400 dark:text-slate-500 line-through font-bold leading-none mt-0.5">
                  ₹{formattedOriginalPrice}
                </span>
              )}
            </div>

            <div className="flex flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              {!isShopOpen ? (
                <div className="flex h-7 items-center justify-center rounded-lg bg-slate-200 dark:bg-white/10 px-2 text-[9px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Shop Off
                </div>
              ) : quantity > 0 ? (
                <div className="flex h-7 items-center rounded-lg bg-red-600 px-0.5 text-white">
                  <button
                    type="button"
                    onClick={handleDecrement}
                    className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-white/20"
                  >
                    <Minus size={12} strokeWidth={2.5} />
                  </button>
                  <span className="min-w-[16px] text-center text-[11px] font-bold">{quantity}</span>
                  <button
                    type="button"
                    onClick={handleIncrement}
                    disabled={quantity >= Number(displayProduct.stock ?? Infinity)}
                    className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-white/20 disabled:opacity-40"
                  >
                    <Plus size={12} strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={soldOut || loadingPicker}
                  className="h-7 rounded-lg bg-red-600 px-2.5 text-[10px] font-bold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {loadingPicker ? "..." : soldOut ? "SOLD OUT" : "ADD"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <VariantPickerSheet
        open={showVariantPicker}
        product={pickerProduct || product}
        variants={variantsWithoutPlaceholder((pickerProduct || product)?.variants)}
        onClose={() => {
          setShowVariantPicker(false);
          setPickerProduct(null);
        }}
        imageRef={imageRef}
      />
    </div>
  );
});

export default ProductCard;