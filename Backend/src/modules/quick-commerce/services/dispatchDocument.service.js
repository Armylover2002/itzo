import mongoose from 'mongoose';
import { FoodOrder } from '../../food/orders/models/order.model.js';
import { buildOrderIdentityFilter } from '../../food/orders/services/order.helpers.js';
import { SellerReturn } from '../seller/models/sellerReturn.model.js';
import { DISPATCH_DOCUMENT_TYPES } from '../utils/dispatchDocument.constants.js';

export const resolveDeliveryDocumentType = async (documentId, body = {}) => {
  const explicit = String(body?.documentType || body?.document_type || '').trim();
  if (explicit === DISPATCH_DOCUMENT_TYPES.SELLER_RETURN) {
    return DISPATCH_DOCUMENT_TYPES.SELLER_RETURN;
  }
  if (explicit === DISPATCH_DOCUMENT_TYPES.FORWARD_ORDER) {
    return DISPATCH_DOCUMENT_TYPES.FORWARD_ORDER;
  }

  const identity = buildOrderIdentityFilter(documentId);
  if (identity) {
    const forward = await FoodOrder.findOne(identity).select('_id').lean();
    if (forward) return DISPATCH_DOCUMENT_TYPES.FORWARD_ORDER;
  }

  if (mongoose.isValidObjectId(String(documentId || ''))) {
    const sellerReturn = await SellerReturn.findById(documentId).select('_id').lean();
    if (sellerReturn) return DISPATCH_DOCUMENT_TYPES.SELLER_RETURN;
  }

  return DISPATCH_DOCUMENT_TYPES.FORWARD_ORDER;
};

export const isSellerReturnDelivery = (documentType) =>
  documentType === DISPATCH_DOCUMENT_TYPES.SELLER_RETURN;
