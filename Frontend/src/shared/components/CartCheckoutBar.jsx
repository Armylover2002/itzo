import { forwardRef, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronRight, ShoppingBag, Trash2 } from "lucide-react"

const RUPEE_SYMBOL = "₹"

const toImageString = (value) => {
  if (!value) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "object" && value.url) return String(value.url).trim()
  return ""
}

const extractItemImage = (item) => {
  if (!item) return ""
  const candidate =
    item.image ||
    item.imageUrl ||
    item.itemImage ||
    (Array.isArray(item.images) ? item.images[0] : "") ||
    item.product?.image ||
    item.product?.imageUrl ||
    item.mainImage ||
    ""
  return toImageString(candidate)
}

/**
 * Shared "cart summary" bar used wherever the app used to show a "View cart" pill:
 * item/store logo + name, a "Menu" chip back to the store, a green
 * "N items | ₹total / Checkout" button and a clear-cart button.
 *
 * Purely presentational — callers pass their own cart items and actions, so it works
 * for both the Food cart and the Quick Commerce cart.
 */
const CartCheckoutBar = forwardRef(function CartCheckoutBar(
  {
    items = [],
    count,
    total,
    checkoutTo,
    onCheckoutClick,
    onClear,
    menuPath,
    menuLabel = "Menu",
    onMenuClick,
    className = "",
  },
  checkoutRef,
) {
  const summary = useMemo(() => {
    const list = Array.isArray(items) ? items : []
    const first = list[0] || {}
    const sources = new Set(
      list.map((item) => item.sourceId || item.restaurantId || item.restaurant).filter(Boolean),
    )
    const computedTotal = list.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
      0,
    )
    const computedCount = list.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
    const name = first.restaurant || first.sourceName || first.quickStoreName || "Your cart"

    // Prioritize the added item's photo over the restaurant storefront
    const itemWithImage =
      [...list].reverse().find((it) => Boolean(extractItemImage(it))) ||
      list.find((it) => Boolean(extractItemImage(it)))
    const itemImg = itemWithImage ? extractItemImage(itemWithImage) : ""
    const restaurantImg = toImageString(first.restaurantImage)

    return {
      name: sources.size > 1 ? `${name} +${sources.size - 1} more` : name,
      image: itemImg || restaurantImg || "",
      fallbackImage: restaurantImg || "",
      count: Number.isFinite(Number(count)) ? Number(count) : computedCount,
      total: Math.round(Number.isFinite(Number(total)) ? Number(total) : computedTotal),
    }
  }, [items, count, total])

  const [imgSrc, setImgSrc] = useState(summary.image)
  useEffect(() => {
    setImgSrc(summary.image)
  }, [summary.image])

  const handleClear = () => {
    if (window.confirm("Remove all items from your cart?")) onClear?.()
  }

  const checkoutClass =
    "flex-shrink-0 rounded-xl bg-green-600 px-4 py-1.5 text-center text-white shadow-sm transition-colors hover:bg-green-700 active:scale-95"
  const checkoutContent = (
    <>
      <span className="block text-[11px] font-medium leading-tight opacity-95">
        {summary.count} {summary.count === 1 ? "item" : "items"} | {RUPEE_SYMBOL}
        {summary.total}
      </span>
      <span className="block text-base font-bold leading-tight">Checkout</span>
    </>
  )

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-2.5 pl-3 shadow-[0_12px_40px_rgba(0,0,0,0.18)] dark:border-gray-800 dark:bg-zinc-900 ${className}`}
    >
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-100 bg-white dark:border-gray-700">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={summary.name}
            className="h-full w-full object-cover"
            onError={() => {
              if (summary.fallbackImage && imgSrc !== summary.fallbackImage) {
                setImgSrc(summary.fallbackImage)
              } else {
                setImgSrc("")
              }
            }}
          />
        ) : (
          <ShoppingBag className="h-5 w-5 text-[#FB4F01]" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h4 className="truncate text-[15px] font-bold leading-tight text-gray-900 dark:text-white">
          {summary.name}
        </h4>
        {menuPath && (
          <Link
            to={menuPath}
            onClick={onMenuClick}
            className="mt-1 inline-flex items-center gap-0.5 rounded-md bg-orange-50 px-2 py-0.5 text-xs font-semibold text-[#FB4F01] dark:bg-orange-500/15"
          >
            {menuLabel}
            <ChevronRight size={14} strokeWidth={2.5} />
          </Link>
        )}
      </div>

      {checkoutTo ? (
        <Link ref={checkoutRef} to={checkoutTo} onClick={onCheckoutClick} className={checkoutClass}>
          {checkoutContent}
        </Link>
      ) : (
        <button ref={checkoutRef} type="button" onClick={onCheckoutClick} className={checkoutClass}>
          {checkoutContent}
        </button>
      )}

      {onClear && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear cart"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500 transition-colors hover:bg-red-100 active:scale-95 dark:bg-red-500/15"
        >
          <Trash2 size={18} />
        </button>
      )}
    </div>
  )
})

export default CartCheckoutBar
