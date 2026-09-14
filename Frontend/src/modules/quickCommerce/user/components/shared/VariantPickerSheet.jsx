import React, { useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "../../context/CartContext";
import { useToast } from "@shared/components/ui/Toast";
import { useCartAnimation } from "../../context/CartAnimationContext";
import {
  applyVariantToProduct,
  findCartLineForProduct,
  getCartLineId,
  getVariantKey,
  getVariantPickerMeta,
} from "../../utils/productMeta";
import { getSelectableVariants } from "../../utils/firstVariantDisplay";
import { isStoreCurrentlyOpen, buildShopClosedMessage } from "@shared/utils/timeFormat";
import {
  DEFAULT_PRODUCT_IMAGE,
  handleProductImageError,
  resolveProductImageSrc,
} from "@/shared/utils/productImage";

const VariantPickerSheet = ({
  open,
  product,
  variants: variantsProp,
  onClose,
  imageRef,
}) => {
  const { cart, addToCart, updateQuantity, removeFromCart } = useCart();
  const { showToast } = useToast();
  const { animateAddToCart, animateRemoveFromCart } = useCartAnimation();

  const variants = useMemo(
    () => (Array.isArray(variantsProp) && variantsProp.length > 0
      ? variantsProp
      : getSelectableVariants(product)),
    [variantsProp, product],
  );

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [open]);

  const baseProductId = useMemo(
    () =>
      String(product?.productId || product?.id || product?._id || "")
        .trim()
        .split("::")[0],
    [product],
  );

  const resolveVariantLineId = useCallback(
    (line, variant) => {
      if (line) {
        return String(line.id || line._id || getCartLineId(baseProductId, variant)).trim();
      }
      return getCartLineId(baseProductId, variant);
    },
    [baseProductId],
  );

  const openingHours =
    product?.openingHours ||
    product?.seller?.shopInfo?.openingHours ||
    product?.seller?.openingHours ||
    "";
  const isShopOpen =
    product?.isShopOpen != null
      ? Boolean(product.isShopOpen)
      : isStoreCurrentlyOpen(openingHours);

  const handleAdd = useCallback(
    async (variant) => {
      if (!product || !variant) return;
      if (!isShopOpen) {
        showToast(buildShopClosedMessage(openingHours), "error");
        return;
      }
      if (Number(variant.stock || 0) <= 0) {
        showToast("This variant is out of stock", "error");
        return;
      }
      const cartProduct = applyVariantToProduct(product, variant);
      if (imageRef?.current) {
        animateAddToCart(
          imageRef.current.getBoundingClientRect(),
          resolveProductImageSrc(cartProduct) || resolveProductImageSrc(product),
        );
      }
      const result = await addToCart(cartProduct);
      if (result?.ok === false) return;
      const meta = getVariantPickerMeta(variant, product);
      showToast(
        `${product.name}${meta.title ? ` (${meta.title})` : ""} added to cart`,
        "success",
      );
    },
    [addToCart, animateAddToCart, imageRef, isShopOpen, openingHours, product, showToast],
  );

  const handleIncrement = useCallback(
    (lineId, variant) => {
      if (!isShopOpen) {
        showToast(buildShopClosedMessage(openingHours), "error");
        return;
      }
      const line = findCartLineForProduct(cart, product, variant);
      const quantity = Number(line?.quantity || 0);
      const stock = Number(variant?.stock ?? Infinity);
      if (quantity >= stock) {
        showToast(`Only ${stock} items are available in stock.`, "error");
        return;
      }
      updateQuantity(lineId, 1);
    },
    [cart, isShopOpen, openingHours, product, showToast, updateQuantity],
  );

  const handleDecrement = useCallback(
    (lineId, quantity, variant) => {
      if (quantity === 1) {
        const meta = getVariantPickerMeta(variant, product);
        animateRemoveFromCart(meta.image || product?.image || product?.mainImage);
        removeFromCart(lineId);
      } else {
        updateQuantity(lineId, -1);
      }
    },
    [animateRemoveFromCart, product, removeFromCart, updateQuantity],
  );

  const stopBubble = useCallback((event) => {
    event.stopPropagation();
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && product && (
        <div
          className="fixed inset-0 z-[720]"
          onClick={stopBubble}
          onMouseDown={stopBubble}
          onTouchStart={stopBubble}
          role="presentation"
        >
          <motion.button
            type="button"
            aria-label="Close variants"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Select variant"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 380 }}
            onClick={stopBubble}
            onMouseDown={stopBubble}
            onTouchStart={stopBubble}
            className="absolute inset-x-0 bottom-0 z-[730] mx-auto w-full max-w-lg rounded-t-2xl bg-white dark:bg-card shadow-[0_-12px_40px_rgba(0,0,0,0.18)]"
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <div className="min-w-0 pr-3">
                <p className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {product.name}
                </p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {variants.length > 1
                    ? `${variants.length} variants available`
                    : "Select a variant"}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose?.();
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto px-4 pb-6 pt-1 space-y-2">
              {variants.map((variant) => {
                const key = getVariantKey(variant);
                const meta = getVariantPickerMeta(variant, product);
                const outOfStock = Number(variant.stock || 0) <= 0;
                const line = findCartLineForProduct(cart, product, variant);
                const quantity = Number(line?.quantity || 0);
                const lineId = resolveVariantLineId(line, variant);
                const price = Number(variant.salePrice || variant.price || 0);
                const mrp = Number(variant.originalPrice || variant.mrp || variant.price || 0);
                const discount =
                  mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
                const imageSrc = resolveProductImageSrc({ image: meta.image }) || DEFAULT_PRODUCT_IMAGE;

                return (
                  <div
                    key={key}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                      outOfStock
                        ? "border-slate-100 dark:border-white/5 opacity-60"
                        : "border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5",
                    )}
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-100 dark:border-white/10 bg-white dark:bg-white/5">
                      <img
                        src={imageSrc}
                        alt={meta.title || product.name}
                        className="h-full w-full object-contain p-1"
                        loading="lazy"
                        onError={handleProductImageError}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {meta.title}
                      </p>
                      {meta.subtitle ? (
                        <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 line-clamp-2">
                          {meta.subtitle}
                        </p>
                      ) : null}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-bold tabular-nums text-slate-900 dark:text-slate-100">
                          ₹{price.toLocaleString("en-IN")}
                        </span>
                        {mrp > price && (
                          <span className="text-[11px] font-medium tabular-nums text-slate-400 line-through">
                            ₹{mrp.toLocaleString("en-IN")}
                          </span>
                        )}
                        {discount > 0 && (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                            {discount}% off
                          </span>
                        )}
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                          {outOfStock ? "Out of stock" : `${Number(variant.stock || 0)} in stock`}
                        </span>
                      </div>
                    </div>

                    {!isShopOpen ? (
                      <div className="h-8 shrink-0 rounded-lg bg-slate-200 dark:bg-white/10 px-2.5 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center">
                        Shop off
                      </div>
                    ) : quantity > 0 ? (
                      <div className="flex h-8 shrink-0 items-center rounded-lg bg-red-600 px-0.5 text-white">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDecrement(lineId, quantity, variant);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/20"
                        >
                          <Minus size={12} strokeWidth={2.5} />
                        </button>
                        <span className="min-w-[18px] text-center text-[12px] font-bold tabular-nums">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleIncrement(lineId, variant);
                          }}
                          disabled={quantity >= Number(variant.stock ?? Infinity)}
                          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/20 disabled:opacity-40"
                        >
                          <Plus size={12} strokeWidth={2.5} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAdd(variant);
                        }}
                        disabled={outOfStock}
                        className="h-8 shrink-0 rounded-lg bg-red-600 px-3 text-[11px] font-bold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {outOfStock ? "SOLD OUT" : "ADD"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default VariantPickerSheet;
