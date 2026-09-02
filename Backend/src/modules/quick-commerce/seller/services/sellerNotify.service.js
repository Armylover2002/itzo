import { SellerNotification } from "../models/sellerNotification.model.js";

// Upsert-by-key so re-firing the same event (e.g. re-saving an approval) updates
// the existing notification in place instead of spamming duplicates.
export const upsertSellerNotification = async (sellerId, { key, type, title, message, link, metadata } = {}) => {
  if (!sellerId || !key) return null;

  return SellerNotification.findOneAndUpdate(
    { sellerId, key },
    {
      $set: {
        type: type || "system",
        title,
        message,
        metadata: { ...(metadata || {}), ...(link ? { link } : {}) },
      },
      $setOnInsert: { isRead: false },
    },
    { upsert: true, new: true },
  );
};
