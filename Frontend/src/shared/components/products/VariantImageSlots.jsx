import React, { useRef } from "react";
import { HiOutlinePhoto, HiOutlinePlus, HiOutlineXMark } from "react-icons/hi2";
import { toast } from "sonner";
import { compressImage } from "@/shared/utils/imageCompression";
import {
  MAX_VARIANT_IMAGES,
  MIN_VARIANT_IMAGES,
  countVariantMedia,
  fileToDataUrl,
} from "@/shared/utils/variantMedia";

const VariantImageSlots = ({
  variant,
  onChange,
  label = "Variant photos",
  compact = false,
}) => {
  const inputRef = useRef(null);
  const media = Array.isArray(variant?.media) ? variant.media : [];
  const mediaRef = useRef(media);
  mediaRef.current = media;
  const slots = Array.from({ length: MAX_VARIANT_IMAGES }, (_, index) => media[index] || null);

  const emitMedia = (nextMedia) => {
    onChange({
      ...variant,
      id: variant?.id,
      media: nextMedia.slice(0, MAX_VARIANT_IMAGES),
    });
  };

  const persistPreview = async (itemId, sourceFile) => {
    try {
      const compressed = await compressImage(sourceFile, {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 900,
        fileType: "image/jpeg",
        initialQuality: 0.72,
      });
      const dataUrl = await fileToDataUrl(compressed);
      if (!dataUrl) return;
      const current = mediaRef.current || [];
      const previous = current.find((item) => item?.id === itemId);
      if (previous?.preview?.startsWith("blob:")) {
        URL.revokeObjectURL(previous.preview);
      }
      emitMedia(
        current.map((item) =>
          item?.id === itemId
            ? { ...item, preview: dataUrl, file: compressed }
            : item,
        ),
      );
    } catch {
      // Keep the in-memory File + blob preview; submit still works.
    }
  };

  const handlePick = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }

    if (countVariantMedia(variant) >= MAX_VARIANT_IMAGES) {
      toast.error(`Maximum ${MAX_VARIANT_IMAGES} images per variant`);
      return;
    }

    const id = `new-${Date.now()}`;
    emitMedia([
      ...media,
      {
        id,
        preview: URL.createObjectURL(file),
        file,
      },
    ]);
    persistPreview(id, file);
  };

  const removeAt = (index) => {
    const removed = media[index];
    if (removed?.preview?.startsWith("blob:")) {
      URL.revokeObjectURL(removed.preview);
    }
    emitMedia(media.filter((_, itemIndex) => itemIndex !== index));
  };

  const slotSize = compact ? "w-16 h-16" : "w-20 h-20 sm:w-24 sm:h-24";

  return (
    <div className="col-span-12 space-y-1.5">
      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
        {label}{" "}
        <span className="text-rose-500">*</span>
        <span className="ml-1 normal-case font-medium text-slate-500">
          ({MIN_VARIANT_IMAGES}–{MAX_VARIANT_IMAGES} photos)
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        {slots.map((item, index) => (
          <div
            key={item?.id || `slot-${index}`}
            className={`${slotSize} rounded-xl border-2 border-dashed border-slate-200 bg-white relative overflow-hidden group`}
          >
            {item ? (
              <>
                <img
                  src={item.preview || item.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/55 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove photo"
                >
                  <HiOutlineXMark className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="w-full h-full flex flex-col items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50/40 transition-colors"
              >
                <HiOutlinePlus className="h-4 w-4" />
                <span className="text-[9px] font-semibold mt-0.5 uppercase tracking-wide">
                  Add
                </span>
              </button>
            )}
          </div>
        ))}
        {countVariantMedia(variant) < MAX_VARIANT_IMAGES && media.length > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={`${slotSize} rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50/40 transition-colors`}
          >
            <HiOutlinePhoto className="h-5 w-5" />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePick}
      />
    </div>
  );
};

export default VariantImageSlots;
