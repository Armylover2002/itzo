import React from "react";
import {
  HiOutlinePlus,
  HiOutlineSquaresPlus,
  HiOutlineTrash,
  HiOutlinePhoto,
  HiOutlineXMark,
} from "react-icons/hi2";
import {
  MAX_PRODUCT_VARIANTS,
  MAX_VARIANT_IMAGES,
  MIN_VARIANT_IMAGES,
  countVariantMedia,
  fileToDataUrl,
} from "@/shared/utils/variantMedia";

export const newVariant = () => ({
  id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: "",
  costPrice: "",
  price: "",
  salePrice: "",
  stock: "",
  sku: "",
  media: [],
});

/**
 * Shared variant editor used by both Add Product and Edit Product (seller).
 * Each variant carries its own price/stock/sku and 1-3 images — there is no
 * separate top-level price/stock/photo anymore, variants are the only source.
 */
const VariantEditor = ({ variants, onChange }) => {
  const list = Array.isArray(variants) && variants.length > 0 ? variants : [newVariant()];

  const updateVariant = (index, patch) => {
    const next = list.map((v, i) => (i === index ? { ...v, ...patch } : v));
    onChange(next);
  };

  const addVariant = () => {
    if (list.length >= MAX_PRODUCT_VARIANTS) return;
    onChange([...list, newVariant()]);
  };

  const removeVariant = (index) => {
    if (list.length <= 1) return;
    onChange(list.filter((_, i) => i !== index));
  };

  const addImages = async (index, files) => {
    const variant = list[index];
    const room = MAX_VARIANT_IMAGES - countVariantMedia(variant);
    if (room <= 0) return;
    const picked = Array.from(files || []).slice(0, room);
    const newMedia = await Promise.all(
      picked.map(async (file) => ({
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        preview: await fileToDataUrl(file),
      })),
    );
    updateVariant(index, { media: [...(variant.media || []), ...newMedia] });
  };

  const removeImage = (index, mediaId) => {
    const variant = list[index];
    updateVariant(index, {
      media: (variant.media || []).filter((item) => item.id !== mediaId),
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Product Variants</h4>
          <p className="text-xs text-slate-600 font-medium">
            Add up to {MAX_PRODUCT_VARIANTS} sizes, colors or weights. Each variant needs its own
            cost price (for stock valuation), selling price, stock and {MIN_VARIANT_IMAGES}-{MAX_VARIANT_IMAGES} photos.
          </p>
        </div>
        <button
          type="button"
          onClick={addVariant}
          disabled={list.length >= MAX_PRODUCT_VARIANTS}
          className="flex items-center space-x-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-bold hover:bg-primary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          <HiOutlineSquaresPlus className="h-4 w-4" />
          <span>
            ADD VARIANT ({list.length}/{MAX_PRODUCT_VARIANTS})
          </span>
        </button>
      </div>

      <div className="space-y-4">
        {list.map((variant, index) => {
          const media = variant.media || [];
          const imageCount = countVariantMedia(variant);
          const belowMin = imageCount < MIN_VARIANT_IMAGES;

          const priceNum = Number(variant.price);
          const hasPrice = variant.price !== "" && variant.price != null;
          const hasPriceError = hasPrice && (isNaN(priceNum) || priceNum <= 0);

          const hasCost = variant.costPrice !== "" && variant.costPrice != null;
          const costNum = Number(variant.costPrice);
          const hasCostNegativeError = hasCost && (isNaN(costNum) || costNum < 0);
          const hasCostExceedsPriceError = hasCost && costNum > 0 && hasPrice && priceNum > 0 && costNum > priceNum;

          const hasSale = variant.salePrice !== "" && variant.salePrice != null;
          const saleNum = Number(variant.salePrice);
          const hasSaleNegativeError = hasSale && (isNaN(saleNum) || saleNum <= 0);
          const hasSaleExceedsPriceError = hasSale && priceNum > 0 && saleNum > priceNum;
          const hasSaleLessThanCostError = hasSale && saleNum > 0 && hasCost && costNum > 0 && saleNum < costNum;
          const hasCostExceedsSaleError = hasCost && costNum > 0 && hasSale && saleNum > 0 && costNum > saleNum;

          const hasPriceLessThanCostError = hasPrice && priceNum > 0 && hasCost && costNum > 0 && priceNum < costNum;
          const hasPriceLessThanSaleError = hasPrice && priceNum > 0 && hasSale && saleNum > 0 && priceNum < saleNum;

          const hasAnyCostError = hasCostNegativeError || hasCostExceedsPriceError || hasCostExceedsSaleError;
          const hasAnyPriceError = hasPriceError || hasPriceLessThanCostError || hasPriceLessThanSaleError;
          const hasAnySaleError = hasSaleNegativeError || hasSaleExceedsPriceError || hasSaleLessThanCostError;

          const isPricingValid =
            hasPrice &&
            priceNum > 0 &&
            !hasAnyPriceError &&
            !hasAnyCostError &&
            !hasAnySaleError;

          const hasDiscount = hasSale && priceNum > 0 && saleNum > 0 && saleNum < priceNum && !hasSaleExceedsPriceError;
          const discountPct = hasDiscount ? Math.round(((priceNum - saleNum) / priceNum) * 100) : 0;
          const discountAmount = hasDiscount ? priceNum - saleNum : 0;

          const effSellingPrice = hasSale && saleNum > 0 ? saleNum : priceNum;
          const hasProfit = isPricingValid && hasCost && costNum > 0 && effSellingPrice >= costNum;
          const profitPerUnit = hasProfit ? effSellingPrice - costNum : 0;
          const marginPct = hasProfit && effSellingPrice > 0 ? Math.round((profitPerUnit / effSellingPrice) * 100) : 0;

          return (
            <div
              key={variant.id}
              className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                <div className="col-span-12 md:col-span-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                      Variant Name <span className="text-rose-500">*</span>
                    </label>
                    {variant.sku && (
                      <span className="text-[9px] font-mono text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded">
                        {variant.sku}
                      </span>
                    )}
                  </div>
                  <input
                    value={variant.name}
                    onChange={(e) => updateVariant(index, { name: e.target.value })}
                    placeholder="e.g. 1kg Bag"
                    className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div className="col-span-6 md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-amber-800 uppercase tracking-widest ml-1">
                    Cost Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={variant.costPrice ?? ""}
                    onChange={(e) => updateVariant(index, { costPrice: e.target.value })}
                    placeholder="350"
                    className={`w-full px-3 py-2 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 ${hasAnyCostError ? "bg-red-50 ring-2 ring-red-400 text-red-600 focus:ring-red-400" : "bg-amber-50/60 ring-1 ring-amber-200/80 text-amber-950 focus:ring-amber-300"}`}
                  />
                  {hasCostNegativeError && (
                    <p className="text-[10px] font-semibold text-rose-500 leading-tight">Must be ≥ 0</p>
                  )}
                  {!hasCostNegativeError && hasCostExceedsSaleError && (
                    <p className="text-[10px] font-semibold text-rose-500 leading-tight">
                      Cannot exceed Sale Price (₹{variant.salePrice})
                    </p>
                  )}
                  {!hasCostNegativeError && !hasCostExceedsSaleError && hasCostExceedsPriceError && (
                    <p className="text-[10px] font-semibold text-rose-500 leading-tight">
                      Cannot exceed Regular Price (₹{variant.price})
                    </p>
                  )}
                  {!hasAnyCostError && (
                    <p className="text-[10px] font-medium text-amber-700/80 leading-tight">Stock valuation</p>
                  )}
                </div>
                <div className="col-span-6 md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={variant.price}
                    onChange={(e) => updateVariant(index, { price: e.target.value })}
                    placeholder="500"
                    className={`w-full px-3 py-2 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 ${hasAnyPriceError ? "bg-red-50 ring-2 ring-red-400 text-red-600 focus:ring-red-400" : "bg-white ring-1 ring-slate-200 focus:ring-primary/10"}`}
                  />
                  {hasPriceError && (
                    <p className="text-[10px] font-semibold text-rose-500 leading-tight">Must be &gt; 0</p>
                  )}
                  {!hasPriceError && hasPriceLessThanCostError && (
                    <p className="text-[10px] font-semibold text-rose-500 leading-tight">
                      Must be ≥ Cost Price (₹{variant.costPrice})
                    </p>
                  )}
                  {!hasPriceError && !hasPriceLessThanCostError && hasPriceLessThanSaleError && (
                    <p className="text-[10px] font-semibold text-rose-500 leading-tight">
                      Must be ≥ Sale Price (₹{variant.salePrice})
                    </p>
                  )}
                  {!hasAnyPriceError && (
                    <p className="text-[10px] font-medium text-slate-400 leading-tight">MRP / Regular price</p>
                  )}
                </div>
                <div className="col-span-6 md:col-span-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest ml-1">
                      Sale Price (₹)
                    </label>
                    {hasDiscount && (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded">
                        {discountPct}% off
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={variant.salePrice}
                    onChange={(e) => updateVariant(index, { salePrice: e.target.value })}
                    placeholder="450"
                    className={`w-full px-3 py-2 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 ${hasAnySaleError ? "bg-red-50 ring-2 ring-red-400 text-red-600 focus:ring-red-400" : "bg-emerald-50 ring-1 ring-emerald-100 text-emerald-700 focus:ring-emerald-200"}`}
                  />
                  {hasSaleExceedsPriceError && (
                    <p className="text-[10px] font-semibold text-rose-500 leading-tight">
                      Cannot exceed Regular Price (₹{variant.price})
                    </p>
                  )}
                  {!hasSaleExceedsPriceError && hasSaleLessThanCostError && (
                    <p className="text-[10px] font-semibold text-rose-500 leading-tight">
                      Cannot be less than Cost Price (₹{variant.costPrice})
                    </p>
                  )}
                  {!hasSaleExceedsPriceError && !hasSaleLessThanCostError && hasSaleNegativeError && (
                    <p className="text-[10px] font-semibold text-rose-500 leading-tight">Must be &gt; 0</p>
                  )}
                  {!hasAnySaleError && (
                    <p className="text-[10px] font-medium text-emerald-600/80 leading-tight">
                      {hasDiscount ? `Save ₹${discountAmount}` : "Offer / Discounted price"}
                    </p>
                  )}
                </div>
                <div className="col-span-6 md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Stock <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={variant.stock}
                    onChange={(e) => updateVariant(index, { stock: e.target.value })}
                    placeholder="10"
                    className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div className="col-span-12 md:col-span-1 flex justify-end pt-5">
                  <button
                    type="button"
                    onClick={() => removeVariant(index)}
                    disabled={list.length <= 1}
                    className="p-2 text-slate-300 hover:text-rose-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    <HiOutlineTrash className="h-4 w-4" />
                  </button>
                </div>

                {hasProfit && (
                  <div className="col-span-12 flex flex-wrap items-center gap-2 px-3 py-1.5 bg-emerald-50/70 border border-emerald-200/60 rounded-xl text-emerald-800 text-[11px] font-bold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    <span>Margin Preview:</span>
                    <span className="font-extrabold text-emerald-900">₹{profitPerUnit} profit/unit ({marginPct}% margin)</span>
                    <span className="text-slate-500 font-normal ml-auto text-[10px]">
                      Cost ₹{costNum} → Sell ₹{effSellingPrice} {hasDiscount ? `(MRP ₹${priceNum})` : ""}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Variant Photos <span className="text-rose-500">*</span>
                  </label>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${belowMin ? "text-rose-500" : "text-emerald-600"}`}>
                    {imageCount}/{MAX_VARIANT_IMAGES} (min {MIN_VARIANT_IMAGES})
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {media.map((item) => (
                    <div
                      key={item.id}
                      className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 group">
                      <img src={item.preview || item.url} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(index, item.id)}
                        className="absolute top-0.5 right-0.5 p-1 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <HiOutlineXMark className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {imageCount < MAX_VARIANT_IMAGES && (
                    <label
                      className={`w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${belowMin ? "border-rose-200 bg-rose-50 hover:border-rose-400" : "border-slate-200 bg-white hover:border-primary hover:bg-primary/5"}`}>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          addImages(index, e.target.files);
                          e.target.value = "";
                        }}
                      />
                      <HiOutlinePhoto className={`h-5 w-5 ${belowMin ? "text-rose-300" : "text-slate-300"}`} />
                      <span className={`text-[8px] font-bold mt-1 uppercase ${belowMin ? "text-rose-400" : "text-slate-500"}`}>
                        Add
                      </span>
                    </label>
                  )}
                </div>
                {belowMin && (
                  <p className="text-[10px] font-semibold text-rose-500 ml-1">
                    At least {MIN_VARIANT_IMAGES} image is required for this variant.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VariantEditor;
