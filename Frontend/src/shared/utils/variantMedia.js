export const MAX_PRODUCT_VARIANTS = 5;
export const MAX_VARIANT_IMAGES = 3;
export const MIN_VARIANT_IMAGES = 1;

export const countVariantMedia = (variant = {}) =>
  (Array.isArray(variant.media) ? variant.media : []).filter(
    (item) => item && (item.file || item.preview || item.url),
  ).length;

export const dataUrlToFile = (dataUrl, filename = "variant.jpg") => {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1] || "image/jpeg";
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const ext = String(mime.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const safeName = filename.includes(".") ? filename : `${filename}.${ext}`;
  return new File([bytes], safeName, { type: mime });
};

export const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    if (!(file instanceof File) && !(file instanceof Blob)) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export const hydrateVariantMedia = (media = []) =>
  (Array.isArray(media) ? media : [])
    .map((item, index) => {
      const preview = String(item?.preview || item?.url || "").trim();
      if (!preview || preview.startsWith("blob:")) return null;
      const file =
        item?.file instanceof File
          ? item.file
          : preview.startsWith("data:")
            ? dataUrlToFile(preview, `variant-${index + 1}.jpg`)
            : null;
      return {
        id: item?.id || `restored-${index}-${preview.slice(-10)}`,
        preview,
        url: item?.url && String(item.url).startsWith("http") ? item.url : null,
        ...(file ? { file } : {}),
      };
    })
    .filter(Boolean)
    .slice(0, MAX_VARIANT_IMAGES);

const fileFromMediaItem = (item, fallbackName) => {
  if (item?.file instanceof File) return item.file;
  if (typeof item?.preview === "string" && item.preview.startsWith("data:")) {
    return dataUrlToFile(item.preview, fallbackName);
  }
  return null;
};

export const buildVariantMediaFromImages = (images = []) =>
  (Array.isArray(images) ? images : [])
    .filter(Boolean)
    .slice(0, MAX_VARIANT_IMAGES)
    .map((url, index) => ({
      id: `existing-${index}-${String(url).slice(-12)}`,
      preview: url,
      url,
    }));

export const serializeVariantsForApi = (variants = []) =>
  variants.map(({ id, media, imageFiles, images, ...rest }) => ({
    ...rest,
    images: (media || [])
      .filter((item) => item?.url && !String(item.url).startsWith("data:"))
      .map((item) => item.url),
    imageFileCount: (media || [])
      .map((item) => fileFromMediaItem(item, "variant.jpg"))
      .filter(Boolean)
      .slice(0, MAX_VARIANT_IMAGES).length,
  }));

export const appendVariantImageFiles = (formData, variants = []) => {
  const sharedFiles = [];
  variants.forEach((variant, variantIndex) => {
    (variant.media || [])
      .slice(0, MAX_VARIANT_IMAGES)
      .forEach((item, imageIndex) => {
        const file = fileFromMediaItem(item, `variant-${variantIndex + 1}-${imageIndex + 1}.jpg`);
        if (!file) return;
        formData.append(`variantImages_${variantIndex}`, file);
        sharedFiles.push(file);
      });
  });
  if (!sharedFiles.length) return;
  // Also send cover/gallery aliases so older APIs still receive the files.
  formData.append("mainImage", sharedFiles[0]);
  sharedFiles.slice(1, 9).forEach((file) => formData.append("galleryImages", file));
};
