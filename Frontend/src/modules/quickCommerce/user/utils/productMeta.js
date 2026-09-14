const DOSAGE_FORM_LABELS = {
  tablet: "Tablet",
  capsule: "Capsule",
  syrup: "Syrup",
  injection: "Injection",
  drops: "Drops",
  cream: "Cream",
  ointment: "Ointment",
  powder: "Powder",
  spray: "Spray",
  inhaler: "Inhaler",
  medical_device: "Medical Device",
  other: "Other",
};

const PACK_TYPE_LABELS = {
  strip: "Strip",
  bottle: "Bottle",
  box: "Box",
  tube: "Tube",
  vial: "Vial",
  device: "Device",
  piece: "Piece",
};

const UNIT_LABELS = {
  tablet: "Tablets",
  capsule: "Capsules",
  ml: "ml",
  gm: "gm",
  piece: "Pieces",
  vial: "Vials",
  strip: "Strips",
};

const isDefaultPlaceholderVariant = (variant) => {
  if (!variant || typeof variant !== "object") return false;
  const packQty = variant.packQuantity;
  const hasPackQty =
    packQty !== "" &&
    packQty != null &&
    Number.isFinite(Number(packQty)) &&
    Number(packQty) > 0;

  return (
    String(variant.name || "").trim() === "Default" &&
    !String(variant.strength || "").trim() &&
    !String(variant.packType || "").trim() &&
    !hasPackQty &&
    !String(variant.unit || "").trim()
  );
};

export const variantsWithoutPlaceholder = (variants) =>
  (Array.isArray(variants) ? variants : []).filter(
    (v) => !isDefaultPlaceholderVariant(v),
  );

export const getVariantKey = (variant) => {
  if (!variant || typeof variant !== "object") return "";
  // Prefer stable Mongo id, then sku, then display name
  const id = String(variant._id || variant.id || "").trim();
  if (id) return id;
  const sku = String(variant.sku || "").trim();
  if (sku) return sku;
  const name = String(variant.name || "").trim();
  if (name && name !== "Default") return name;
  return name;
};

/** True when two variant refs point at the same catalog variant. */
export const variantsMatch = (a = {}, b = {}) => {
  const aId = String(a?._id || a?.id || "").trim().toLowerCase();
  const bId = String(b?._id || b?.id || "").trim().toLowerCase();
  if (aId && bId && aId === bId) return true;

  const aKey = getVariantKey(a).toLowerCase();
  const bKey = getVariantKey(b).toLowerCase();
  if (aKey && bKey && aKey === bKey) return true;

  const aName = String(a?.name || "").trim().toLowerCase();
  const bName = String(b?.name || "").trim().toLowerCase();
  if (aName && bName && aName === bName) return true;

  const aSku = String(a?.sku || "").trim().toLowerCase();
  const bSku = String(b?.sku || "").trim().toLowerCase();
  if (aSku && bSku && aSku === bSku) return true;

  return false;
};

/**
 * Find cart line for a product (+ optional selected variant).
 * When a variant is specified, only that variant's line matches — other
 * variants of the same product must show ADD, not the sibling's +/-.
 */
export const findCartLineForProduct = (cart = [], product = {}, selectedVariant = null) => {
  const baseId = String(product?.productId || product?.id || product?._id || "")
    .trim()
    .split("::")[0];
  if (!baseId) return null;

  const variant =
    selectedVariant ||
    product?.selectedVariant ||
    null;
  const targetLineId = variant ? getCartLineId(baseId, variant) : baseId;
  const targetName = String(variant?.name || "").trim().toLowerCase();
  const targetKey = getVariantKey(variant).toLowerCase();

  const candidates = (Array.isArray(cart) ? cart : []).filter((item) => {
    const itemBase = String(item?.productId || item?.itemId || item?.id || item?._id || "")
      .trim()
      .split("::")[0];
    return itemBase === baseId;
  });

  if (!candidates.length) return null;

  // Exact composite id match
  const byLineId = candidates.find((item) => {
    const id = String(item?.id || item?._id || "").trim();
    return targetLineId && id === targetLineId;
  });
  if (byLineId) return byLineId;

  if (variant) {
    const byVariant = candidates.find((item) => {
      const itemVariant = item?.selectedVariant || {
        _id: item?.variantKey,
        id: item?.variantKey,
        name: item?.variantName,
        sku: item?.variantSku,
      };
      if (variantsMatch(variant, itemVariant)) return true;
      const itemKey = String(item?.variantKey || getVariantKey(item?.selectedVariant) || "")
        .trim()
        .toLowerCase();
      const itemName = String(item?.variantName || item?.selectedVariant?.name || "")
        .trim()
        .toLowerCase();
      if (targetKey && itemKey && targetKey === itemKey) return true;
      if (targetName && itemName && targetName === itemName) return true;
      return false;
    });
    if (byVariant) return byVariant;

    // Legacy empty-variant line only counts for the product's first sellable variant
    const legacy = candidates.find((item) => {
      const itemKey = String(item?.variantKey || item?.selectedVariant?._id || "").trim();
      const itemName = String(item?.variantName || item?.selectedVariant?.name || "").trim();
      return !itemKey && !itemName;
    });
    if (legacy) {
      const variants = Array.isArray(product?.variants) ? product.variants : [];
      const first =
        variants.find((v) => {
          const name = String(v?.name || "").trim();
          if (!name || name.toLowerCase() === "default") return variants.length === 1;
          return true;
        }) || variants[0] || null;
      if (!first || variantsMatch(variant, first)) return legacy;
    }

    // Specific variant requested but not in cart → ADD (do not fall back to sibling)
    return null;
  }

  // No variant context: prefer bare/legacy line, else first candidate
  const bare = candidates.find((item) => {
    const itemKey = String(item?.variantKey || item?.selectedVariant?._id || "").trim();
    const itemName = String(item?.variantName || item?.selectedVariant?.name || "").trim();
    return !itemKey && !itemName;
  });
  return bare || candidates[0] || null;
};

const labelFromMap = (map, value) => {
  if (!value) return "";
  const key = String(value).trim().toLowerCase();
  return map[key] || String(value);
};

const formatPackLine = (packType, packQuantity, unit) => {
  const pLabel = labelFromMap(PACK_TYPE_LABELS, packType);
  const qty = Number(packQuantity);
  const uLabel = labelFromMap(UNIT_LABELS, unit) || unit || "";
  const hasQty = Number.isFinite(qty) && qty > 0;

  if (!pLabel && !hasQty) return "";
  if (pLabel && hasQty) {
    if (pLabel === "Strip") return `Strip of ${qty} ${uLabel || "Units"}`;
    if (pLabel === "Box") return `Box of ${qty} ${uLabel || "Units"}`;
    if (pLabel === "Bottle" || pLabel === "Tube" || pLabel === "Vial") {
      return hasQty && (unit === "ml" || unit === "gm")
        ? `${qty}${unit} ${pLabel}`
        : `${qty} ${uLabel} ${pLabel}`.trim();
    }
    return `${pLabel} of ${qty} ${uLabel || "Units"}`;
  }
  if (hasQty && (unit === "ml" || unit === "gm")) return `${qty}${unit} Bottle`;
  if (pLabel) return pLabel;
  return hasQty ? `${qty} ${uLabel}` : "";
};

const formatStrengthDosage = (strength, dosageForm) => {
  const s = String(strength || "").trim();
  const d = labelFromMap(DOSAGE_FORM_LABELS, dosageForm);
  if (s && d) return `${s} ${d}`;
  return s || d || "";
};

export const getVariantDisplayLabel = (variant, product = {}) => {
  if (!variant) return "";
  const named = String(variant.name || "").trim();
  if (named && named !== "Default") return named;

  const strength = variant.strength || "";
  const packLine = formatPackLine(
    variant.packType || "",
    variant.packQuantity ?? "",
    variant.unit || "",
  );
  const strengthLine = formatStrengthDosage(strength, "");
  return [strengthLine, packLine].filter(Boolean).join(" · ") || named || "Variant";
};

export const getVariantPickerMeta = (variant, product = {}) => {
  if (!variant) {
    return { title: "", subtitle: "", image: "" };
  }

  const title = getVariantDisplayLabel(variant, product);
  const detailLines = [];

  const strengthLine = formatStrengthDosage(variant.strength || "", "");
  const packLine = formatPackLine(
    variant.packType || "",
    variant.packQuantity ?? "",
    variant.unit || "",
  );

  if (strengthLine && strengthLine !== title) detailLines.push(strengthLine);
  if (packLine && packLine !== title) detailLines.push(packLine);

  const sku = String(variant.sku || "").trim();
  if (sku) detailLines.push(`SKU: ${sku}`);

  const unit = String(variant.unit || product.unit || "").trim();
  if (unit && unit !== title && !detailLines.some((line) => line.includes(unit))) {
    detailLines.push(unit);
  }

  const variantImages = Array.isArray(variant.images) ? variant.images.filter(Boolean) : [];
  const image =
    variantImages[0] ||
    product.mainImage ||
    product.image ||
    (Array.isArray(product.galleryImages) ? product.galleryImages[0] : "") ||
    "";

  return {
    title,
    subtitle: detailLines.join(" · "),
    image,
  };
};

export const getCartLineId = (productId, variant) => {
  const baseId = String(productId || "").trim().split("::")[0];
  if (!baseId) return "";
  const variantKey = getVariantKey(variant);
  return variantKey ? `${baseId}::${variantKey}` : baseId;
};

export const applyVariantToProduct = (product = {}, variant = null) => {
  if (!variant) return product;

  const baseId = String(product.id || product._id || "").trim().split("::")[0];
  const basePrice = Number(variant.price || 0);
  const rawSale = Number(variant.salePrice || 0);
  const listPrice = Math.max(
    basePrice,
    rawSale,
    Number(variant.originalPrice ?? variant.mrp ?? 0),
    Number(product.originalPrice ?? product.mrp ?? 0),
  );
  const price =
    rawSale > 0 && listPrice > 0 && rawSale < listPrice
      ? rawSale
      : basePrice || rawSale || listPrice;
  const originalPrice = Math.max(listPrice, price);

  return {
    ...product,
    id: getCartLineId(baseId, variant),
    _id: getCartLineId(baseId, variant),
    productId: baseId,
    selectedVariant: variant,
    price,
    salePrice: rawSale,
    mrp: originalPrice,
    originalPrice,
    stock: Number(variant.stock ?? product.stock ?? 0),
    weight: variant.name || product.weight || product.unit || "",
    unit: variant.unit || product.unit || variant.name || "",
    images: Array.isArray(variant.images) && variant.images.length
      ? variant.images.filter(Boolean)
      : product.images,
    image: Array.isArray(variant.images) && variant.images.length
      ? variant.images[0]
      : product.image,
    mainImage: Array.isArray(variant.images) && variant.images.length
      ? variant.images[0]
      : product.mainImage,
  };
};
