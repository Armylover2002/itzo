// Shared between admin (Offer Sections) and customer (Offers page) for consistent section styling.

export const BACKGROUND_COLOR_OPTIONS = [
  {
    id: "yellow",
    label: "Yellow",
    value: "#FCD34D",
    start: "#FEF3C7",
    end: "#FACC15",
  },
  {
    id: "orange",
    label: "Orange",
    value: "#FB923C",
    start: "#FED7AA",
    end: "#FB923C",
  },
  {
    id: "green",
    label: "Green",
    value: "#0c831f",
    start: "#BBF7D0",
    end: "#16A34A",
  },
  {
    id: "blue",
    label: "Blue",
    value: "#3B82F6",
    start: "#DBEAFE",
    end: "#2563EB",
  },
  {
    id: "pink",
    label: "Pink",
    value: "#EC4899",
    start: "#FCE7F3",
    end: "#EC4899",
  },
  {
    id: "purple",
    label: "Purple",
    value: "#8B5CF6",
    start: "#EDE9FE",
    end: "#8B5CF6",
  },
];

export const SIDE_IMAGE_OPTIONS = [
  {
    key: "hair-care",
    label: "Hair Care",
    imageUrl:
      "https://images.unsplash.com/photo-1522338242762-594f63bcf581?w=200&h=200&fit=crop",
  },
  {
    key: "grocery",
    label: "Grocery",
    imageUrl:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&h=200&fit=crop",
  },
  {
    key: "electronics",
    label: "Electronics",
    imageUrl:
      "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=200&h=200&fit=crop",
  },
  {
    key: "beauty",
    label: "Beauty",
    imageUrl:
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=200&h=200&fit=crop",
  },
  {
    key: "kitchen",
    label: "Kitchen",
    imageUrl:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200&h=200&fit=crop",
  },
  {
    key: "fashion",
    label: "Fashion",
    imageUrl:
      "https://images.unsplash.com/photo-1445205170230-053b83016050?w=200&h=200&fit=crop",
  },
];

export const getSideImageByKey = (key) =>
  SIDE_IMAGE_OPTIONS.find((o) => o.key === key)?.imageUrl ||
  SIDE_IMAGE_OPTIONS[0].imageUrl;

export const getBackgroundColorByValue = (value) =>
  value || BACKGROUND_COLOR_OPTIONS[0].value;

export const getBackgroundGradientByValue = (value) => {
  const opt =
    BACKGROUND_COLOR_OPTIONS.find((o) => o.value === value) ||
    BACKGROUND_COLOR_OPTIONS[0];
  return `linear-gradient(135deg, ${opt.start}, ${opt.end})`;
};
