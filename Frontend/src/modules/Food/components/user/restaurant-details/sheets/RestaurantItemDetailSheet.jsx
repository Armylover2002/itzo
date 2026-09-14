import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ChevronLeft, ChevronRight, Bookmark, Share2, Plus, Minus, Clock, Sparkles, Tag } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { RUPEE_SYMBOL } from "../restaurantDetailsUtils"
import { getFoodDisplayPrice, getFoodVariants, hasFoodVariants } from "@food/utils/foodVariants"
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability"
import ItemSlotAvailabilityNote from "@food/components/user/ItemSlotAvailabilityNote"
import { normalizeFoodVariantUnit } from "@food/constants/foodVariantUnits"
import BottomSheetPortal from "./BottomSheetPortal"

function VegIndicator({ isVeg, size = "md" }) {
  const box = size === "sm" ? "h-4 w-4" : "h-5 w-5"
  const dot = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5"
  return (
    <div
      className={`${box} rounded border-2 flex items-center justify-center shrink-0 ${
        isVeg ? "border-green-600 bg-green-50" : "border-red-600 bg-red-50"
      }`}
    >
      <div className={`${dot} rounded-full ${isVeg ? "bg-green-600" : "bg-red-600"}`} />
    </div>
  )
}

function PriceTag({ price, otherPrice, label }) {
  const numericPrice = Number(price) || 0
  const numericOther = Number(otherPrice) || 0
  const showStrike = numericOther > numericPrice

  return (
    <div className="flex flex-col items-end gap-0.5">
      {label ? <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</span> : null}
      <div className="flex items-center gap-2">
        {showStrike && (
          <span className="text-xs text-gray-400 line-through">
            {RUPEE_SYMBOL}{Math.round(numericOther)}
          </span>
        )}
        <span className="text-base font-bold text-gray-900 dark:text-white">
          {RUPEE_SYMBOL}{Math.round(numericPrice)}
        </span>
      </div>
      {showStrike && (
        <span className="text-[10px] font-semibold text-emerald-600">
          Save {RUPEE_SYMBOL}{Math.round(numericOther - numericPrice)}
        </span>
      )}
    </div>
  )
}

export default function RestaurantItemDetailSheet({
  open,
  onClose,
  selectedItem,
  selectedItemImageIndex,
  setSelectedItemImageIndex,
  selectedVariantId,
  setSelectedVariantId,
  restaurant,
  shouldShowGrayscale,
  isRecommendedItem,
  handleBookmarkClick,
  isDishFavorite,
  getDishQuantity,
  updateItemQuantity,
  getVariantForDish,
  handleShareClick,
  showBookmark = true,
  showShare = true,
}) {
  const [localQuantity, setLocalQuantity] = useState(1)

  // Reset local quantity when item or variant changes
  useEffect(() => {
    setLocalQuantity(1)
  }, [selectedItem?.id, selectedVariantId])

  if (!selectedItem) return null

  const variants = getFoodVariants(selectedItem)
  const itemHasVariants = hasFoodVariants(selectedItem)
  const selectedVariant = itemHasVariants
    ? getVariantForDish(selectedItem, selectedVariantId)
    : null
  const activePrice = selectedVariant?.price ?? getFoodDisplayPrice(selectedItem)
  const activeOtherPrice =
    selectedVariant?.otherPrice ?? selectedItem.otherPrice ?? selectedItem.originalPrice ?? 0
  const quantity = getDishQuantity(selectedItem, selectedVariantId)
  const isVeg = selectedItem.foodType === "Veg" || selectedItem.isVeg === true
  const restaurantId = restaurant?.restaurantId || restaurant?._id || restaurant?.id
  const restaurantName = restaurant?.name || selectedItem.restaurant || ""
  const categoryName =
    selectedItem.categoryName || selectedItem.category || selectedItem.sectionName || ""

  // Ensure we correctly grey out the item if the restaurant is offline,
  // regardless of where this sheet was opened from (e.g. RecommendedSection, Under250).
  const availabilityStatus = restaurant ? getRestaurantAvailabilityStatus(restaurant) : { isOpen: true }
  const isRestaurantOffline = !availabilityStatus.isOpen
  const effectiveGrayscale = shouldShowGrayscale || isRestaurantOffline

  const allImages = (() => {
    const images = (selectedItem.images || []).filter((img) => img && typeof img === "string")
    if (selectedItem.image && !images.includes(selectedItem.image)) {
      images.unshift(selectedItem.image)
    }
    return images
  })()

  return (
    <BottomSheetPortal
      open={open}
      onClose={onClose}
      sheetClassName="fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:w-[700px] lg:w-[850px] flex flex-col md:flex-row max-h-[92vh] md:max-h-[600px]"
    >
      <div className="absolute -top-[44px] left-1/2 -translate-x-1/2 md:left-auto md:right-0 md:translate-x-0 md:-top-[16px] md:-translate-y-full z-[10001]">
        <motion.button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-900 transition-colors shadow-lg"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          aria-label="Close"
        >
          <X className="h-5 w-5 text-white" />
        </motion.button>
      </div>

      {/* Image */}
      <div className="relative w-full md:w-1/2 h-56 sm:h-64 md:h-full overflow-hidden rounded-t-3xl md:rounded-t-none md:rounded-l-3xl bg-gray-100 dark:bg-gray-800 shrink-0">
        {allImages.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-sm text-gray-400">No image available</span>
          </div>
        ) : (
          <div className="relative w-full h-full">
            <AnimatePresence mode="wait">
              <motion.img
                key={selectedItemImageIndex}
                src={allImages[selectedItemImageIndex]}
                alt={`${selectedItem.name} - Image ${selectedItemImageIndex + 1}`}
                className="w-full h-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </AnimatePresence>
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

            {allImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedItemImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length)
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow z-10"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-900" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedItemImageIndex((prev) => (prev + 1) % allImages.length)
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow z-10"
                >
                  <ChevronRight className="w-4 h-4 text-gray-900" />
                </button>
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full z-10">
                  <span className="text-white text-[10px] font-semibold">
                    {selectedItemImageIndex + 1} / {allImages.length}
                  </span>
                </div>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
                  {allImages.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedItemImageIndex(idx)
                      }}
                      className={`rounded-full transition-all ${
                        idx === selectedItemImageIndex ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {(showBookmark || showShare) && (
          <div className="absolute bottom-4 right-4 flex items-center gap-2 z-10">
            {showBookmark && handleBookmarkClick && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleBookmarkClick(selectedItem)
                }}
                className={`h-10 w-10 rounded-full border flex items-center justify-center transition-all ${
                  isDishFavorite?.(selectedItem.id, restaurantId)
                    ? "border-red-500 bg-red-50 text-red-500"
                    : "border-white bg-white/95 text-gray-600 hover:bg-white"
                }`}
              >
                <Bookmark
                  className={`h-5 w-5 ${isDishFavorite?.(selectedItem.id, restaurantId) ? "fill-red-500" : ""}`}
                />
              </button>
            )}
            {showShare && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (handleShareClick) {
                    handleShareClick(selectedItem);
                  }
                }}
                className="h-10 w-10 rounded-full border border-white bg-white/95 text-gray-600 hover:bg-white flex items-center justify-center"
              >
                <Share2 className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right Column for Desktop (Content + Footer) */}
      <div className="flex-1 flex flex-col w-full md:w-1/2">
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <VegIndicator isVeg={isVeg} />
            {categoryName ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                <Tag className="h-3 w-3" />
                {categoryName}
              </span>
            ) : null}
            {isRecommendedItem?.(selectedItem) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                <Sparkles className="h-3 w-3" />
                Bestseller
              </span>
            )}
            {itemHasVariants && (
              <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                Customisable
              </span>
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight">
            {selectedItem.name}
          </h2>

          {restaurantName ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{restaurantName}</p>
          ) : null}
        </div>

        {selectedItem.description ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {selectedItem.description}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
          {selectedItem.preparationTime && String(selectedItem.preparationTime).trim() ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-1.5">
              <Clock className="h-4 w-4 text-gray-400" />
              {String(selectedItem.preparationTime).trim()}
            </span>
          ) : null}
          <ItemSlotAvailabilityNote item={selectedItem} />
          {!itemHasVariants && (
            <PriceTag price={activePrice} otherPrice={activeOtherPrice} />
          )}
        </div>

        {isRecommendedItem?.(selectedItem) && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 bg-emerald-200 rounded-full overflow-hidden">
                <div className="h-full w-3/4 bg-emerald-500 rounded-full" />
              </div>
              <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">
                Highly recommended
              </span>
            </div>
          </div>
        )}

        {selectedItem.notEligibleForCoupons && (
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Not eligible for coupons
          </p>
        )}

        {itemHasVariants && (
          <div className="space-y-3">
            <div className="space-y-2">
              {variants.map((variant) => {
                const isSelected = String(selectedVariantId || "") === String(variant.id)
                const unitDisplay = normalizeFoodVariantUnit(variant.unit)
                const variantOther = Number(variant.otherPrice) || 0
                const variantPrice = Number(variant.price) || 0
                const showSave = variantOther > variantPrice

                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setSelectedVariantId(variant.id)}
                    className={`w-full rounded-2xl border px-4 py-3.5 text-left transition-all ${
                      isSelected
                        ? "border-red-500 bg-red-50/80 ring-1 ring-red-200 dark:border-red-400 dark:bg-red-900/20"
                        : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-[#222]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-sm font-bold ${isSelected ? "text-red-700 dark:text-red-200" : "text-gray-900 dark:text-white"}`}>
                          {variant.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{unitDisplay}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-base font-bold ${isSelected ? "text-red-700 dark:text-red-200" : "text-gray-900 dark:text-white"}`}>
                          {RUPEE_SYMBOL}{Math.round(variantPrice)}
                        </p>
                        {showSave && (
                          <>
                            <p className="text-xs text-gray-400 line-through">
                              {RUPEE_SYMBOL}{Math.round(variantOther)}
                            </p>
                            <p className="text-[10px] font-semibold text-emerald-600">
                              Save {RUPEE_SYMBOL}{Math.round(variantOther - variantPrice)}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-gray-800 px-5 py-4 bg-white dark:bg-[#1a1a1a] shrink-0">
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 border-2 rounded-xl px-2.5 h-12 bg-white dark:bg-[#2a2a2a] ${
              effectiveGrayscale
                ? "border-gray-200 opacity-50"
                : "border-gray-200 dark:border-gray-700"
            }`}
          >
            <button
              type="button"
              onClick={(e) => {
                if (!effectiveGrayscale && localQuantity > 1) {
                  setLocalQuantity(localQuantity - 1)
                }
              }}
              disabled={localQuantity <= 1 || effectiveGrayscale}
              className="w-9 h-9 flex items-center justify-center text-gray-600 disabled:text-gray-300"
            >
              <Minus className="h-5 w-5" />
            </button>
            <span className="text-lg font-bold min-w-[1.5rem] text-center text-gray-900 dark:text-white">
              {localQuantity}
            </span>
            <button
              type="button"
              onClick={(e) => {
                if (!effectiveGrayscale) {
                  setLocalQuantity(localQuantity + 1)
                }
              }}
              disabled={effectiveGrayscale}
              className="w-9 h-9 flex items-center justify-center text-gray-600"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          <Button
            type="button"
            className={`flex-1 h-12 rounded-xl font-semibold flex items-center justify-center gap-2 ${
              effectiveGrayscale
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-red-500 hover:bg-red-600 text-white"
            }`}
            onClick={(e) => {
              if (!effectiveGrayscale) {
                // If item is already in cart, get Dish Quantity to add to the existing quantity!
                // Wait! If the item is already in the cart, updating with localQuantity will overwrite it to `localQuantity` instead of adding.
                // updateItemQuantity adds the absolute amount to the cart state.
                updateItemQuantity(
                  selectedItem,
                  quantity + localQuantity,
                  e,
                  getVariantForDish(selectedItem, selectedVariantId),
                )
                onClose()
              }
            }}
            disabled={effectiveGrayscale}
          >
            <span>Add item</span>
            <span className="font-bold">
              {RUPEE_SYMBOL}{Math.round(activePrice * localQuantity)}
              {localQuantity > 1 ? ` · Qty ${localQuantity}` : ""}
            </span>
          </Button>
        </div>
      </div>
      </div>
    </BottomSheetPortal>
  )
}
