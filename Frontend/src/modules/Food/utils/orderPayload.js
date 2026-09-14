const DATA_IMAGE_PREFIX = "data:image/";
const MAX_IMAGE_LENGTH = 2048;
const MAX_NOTE_LENGTH = 500;

export const sanitizeOrderImage = (value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith(DATA_IMAGE_PREFIX)) return undefined;
  if (trimmed.length > MAX_IMAGE_LENGTH) return undefined;
  return trimmed;
};

export const sanitizeOrderNotes = (value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_NOTE_LENGTH);
};
