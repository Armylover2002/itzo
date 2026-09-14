export const FOOD_VARIANT_UNITS = [
  { value: "piece", label: "Piece" },
  { value: "pieces", label: "Pieces" },
  { value: "pcs", label: "Pcs" },
  { value: "plate", label: "Plate" },
  { value: "bowl", label: "Bowl" },
  { value: "glass", label: "Glass" },
  { value: "cup", label: "Cup" },
  { value: "serving", label: "Serving" },
  { value: "serves", label: "Serves" },
  { value: "slice", label: "Slice" },
  { value: "slices", label: "Slices" },
  { value: "g", label: "Gram (g)" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "ml", label: "Millilitre (ml)" },
  { value: "litre", label: "Litre" },
  { value: "pack", label: "Pack" },
  { value: "box", label: "Box" },
  { value: "cms", label: "cm" },
]

export const DEFAULT_FOOD_VARIANT_UNIT = "piece"

export const normalizeFoodVariantUnit = (value) => {
  const normalized = String(value || "").trim().toLowerCase()
  const match = FOOD_VARIANT_UNITS.find((unit) => unit.value === normalized)
  return match?.value || DEFAULT_FOOD_VARIANT_UNIT
}

export const getFoodVariantUnitLabel = (value) => {
  const normalized = normalizeFoodVariantUnit(value)
  return FOOD_VARIANT_UNITS.find((unit) => unit.value === normalized)?.label || normalized
}
