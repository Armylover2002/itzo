import mongoose from 'mongoose';
import { FoodUser } from '../../../core/users/user.model.js';
import { QuickOrder } from '../models/order.model.js';
import { Seller } from '../seller/models/seller.model.js';
import { QuickSupportTicket } from '../models/supportTicket.model.js';

const resolveIdentity = (req) => {
  if (req.user?.userId) {
    return { userId: new mongoose.Types.ObjectId(req.user.userId) };
  }

  const sessionId = String(
    req.headers['x-quick-session'] || req.body?.sessionId || req.query?.sessionId || '',
  ).trim();

  return sessionId ? { sessionId } : null;
};

const mapTicket = (ticket) => {
  const orderDoc =
    ticket.orderId && typeof ticket.orderId === 'object' && ticket.orderId !== null ? ticket.orderId : null;
  const sellerDoc =
    ticket.sellerId && typeof ticket.sellerId === 'object' && ticket.sellerId !== null ? ticket.sellerId : null;
  const userDoc =
    ticket.userId && typeof ticket.userId === 'object' && ticket.userId !== null ? ticket.userId : null;

  return {
    _id: ticket._id,
    id: ticket._id,
    sessionId: ticket.sessionId || '',
    type: ticket.type,
    issueType: ticket.issueType,
    description: ticket.description || '',
    status: ticket.status || 'open',
    adminResponse: ticket.adminResponse || '',
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    orderId: orderDoc?._id || ticket.orderId || null,
    orderNumber: orderDoc?.orderId || '',
    sellerId: sellerDoc?._id || ticket.sellerId || null,
    seller: sellerDoc
      ? {
          _id: sellerDoc._id,
          name: sellerDoc.name || '',
          shopName: sellerDoc.shopName || sellerDoc.name || 'Store',
        }
      : null,
    storeName: sellerDoc?.shopName || sellerDoc?.name || '',
    user: userDoc
      ? {
          _id: userDoc._id,
          name: userDoc.name || '',
          phone: userDoc.phone || '',
          email: userDoc.email || '',
        }
      : null,
  };
};

export const createSupportTicketController = async (req, res, next) => {
  try {
    const identity = resolveIdentity(req);
    if (!identity) {
      return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
    }

    const body = req.body || {};
    const type = String(body.type || '').trim().toLowerCase();
    const issueType = String(body.issueType || '').trim();
    const description = String(body.description || '').trim();

    if (!['order', 'seller', 'other'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket type' });
    }

    if (!issueType) {
      return res.status(400).json({ success: false, message: 'issueType required' });
    }

    const doc = {
      ...identity,
      type,
      issueType,
      description,
    };

    if (type === 'order') {
      if (!body.orderId || !mongoose.Types.ObjectId.isValid(body.orderId)) {
        return res.status(400).json({ success: false, message: 'orderId required' });
      }

      const order = await QuickOrder.findOne({
        _id: new mongoose.Types.ObjectId(body.orderId),
        orderType: 'quick',
        ...(identity.userId ? { userId: identity.userId } : { sessionId: identity.sessionId }),
      })
        .select('orderId items')
        .lean();

      if (!order) {
        return res.status(404).json({ success: false, message: 'Quick order not found' });
      }

      doc.orderId = order._id;
      const firstSellerId = String(
        order.items?.find((item) => item?.type === 'quick')?.sourceId ||
          order.items?.[0]?.sourceId ||
          '',
      ).trim();
      if (mongoose.Types.ObjectId.isValid(firstSellerId)) {
        doc.sellerId = new mongoose.Types.ObjectId(firstSellerId);
      }
    }

    if (type === 'seller') {
      if (!body.sellerId || !mongoose.Types.ObjectId.isValid(body.sellerId)) {
        return res.status(400).json({ success: false, message: 'sellerId required' });
      }

      const seller = await Seller.findById(body.sellerId).select('_id').lean();
      if (!seller) {
        return res.status(404).json({ success: false, message: 'Store not found' });
      }
      doc.sellerId = seller._id;

      if (body.orderId && mongoose.Types.ObjectId.isValid(body.orderId)) {
        doc.orderId = new mongoose.Types.ObjectId(body.orderId);
      }
    }

    const created = await QuickSupportTicket.create(doc);
    const populated = await QuickSupportTicket.findById(created._id)
      .populate('userId', 'name phone email')
      .populate('sellerId', 'name shopName')
      .populate('orderId', 'orderId')
      .lean();

    try {
      const { notifyAdminsSafely } = await import(
        '../../../core/notifications/firebase.service.js'
      );
      const { emitAdminBellRefresh } = await import(
        '../../../core/notifications/ownerInboxNotify.js'
      );
      void notifyAdminsSafely({
        title: 'QC support ticket',
        body: String(doc.issueType || doc.subject || 'New quick-commerce support ticket'),
        data: {
          type: 'qc_support_ticket',
          ticketId: String(created._id),
          link: '/admin/quick-commerce/support',
        },
      });
      void emitAdminBellRefresh({ type: 'qc_support_ticket' });
    } catch (_) { /* non-blocking */ }

    return res.status(201).json({
      success: true,
      message: 'Quick support ticket created',
      data: { ticket: mapTicket(populated) },
    });
  } catch (error) {
    next(error);
  }
};

export const listMySupportTicketsController = async (req, res, next) => {
  try {
    const identity = resolveIdentity(req);
    if (!identity) {
      return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
    }

    const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 20, 1), 50);
    const page = Math.max(parseInt(req.query?.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
      QuickSupportTicket.find(identity)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sellerId', 'name shopName')
        .populate('orderId', 'orderId')
        .lean(),
      QuickSupportTicket.countDocuments(identity),
    ]);

    return res.json({
      success: true,
      message: 'Quick support tickets fetched',
      data: {
        tickets: tickets.map(mapTicket),
        total,
        page,
        limit,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminSupportTicketsController = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 50, 1), 200);
    const page = Math.max(parseInt(req.query?.page, 10) || 1, 1);
    const skip = (page - 1) * limit;
    const search = String(req.query?.search || '').trim();

    const filter = {};
    if (req.query?.status && ['open', 'in-progress', 'resolved'].includes(String(req.query.status))) {
      filter.status = String(req.query.status);
    }
    if (req.query?.type && ['order', 'seller', 'other'].includes(String(req.query.type))) {
      filter.type = String(req.query.type);
    }

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const [sellerIds, userIds, orderIds] = await Promise.all([
        Seller.find({ $or: [{ name: searchRegex }, { shopName: searchRegex }] }).select('_id').lean(),
        FoodUser.find({ name: searchRegex }).select('_id').lean(),
        QuickOrder.find({ orderType: 'quick', orderId: searchRegex }).select('_id').lean(),
      ]);

      filter.$or = [
        { issueType: searchRegex },
        { description: searchRegex },
        { adminResponse: searchRegex },
        { sessionId: searchRegex },
        ...(sellerIds.length ? [{ sellerId: { $in: sellerIds.map((item) => item._id) } }] : []),
        ...(userIds.length ? [{ userId: { $in: userIds.map((item) => item._id) } }] : []),
        ...(orderIds.length ? [{ orderId: { $in: orderIds.map((item) => item._id) } }] : []),
      ];
    }

    const [tickets, total] = await Promise.all([
      QuickSupportTicket.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name phone email')
        .populate('sellerId', 'name shopName')
        .populate('orderId', 'orderId')
        .lean(),
      QuickSupportTicket.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      message: 'Quick support tickets fetched',
      data: {
        tickets: tickets.map(mapTicket),
        total,
        page,
        limit,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminSupportTicketController = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid support ticket id' });
    }

    const set = {};
    if (req.body?.status && ['open', 'in-progress', 'resolved'].includes(String(req.body.status))) {
      set.status = String(req.body.status);
    }
    if (typeof req.body?.adminResponse === 'string') {
      set.adminResponse = String(req.body.adminResponse);
    }

    if (!Object.keys(set).length) {
      return res.status(400).json({ success: false, message: 'No valid support ticket fields provided' });
    }

    const updated = await QuickSupportTicket.findByIdAndUpdate(
      id,
      { $set: set },
      { new: true },
    )
      .populate('userId', 'name phone email')
      .populate('sellerId', 'name shopName')
      .populate('orderId', 'orderId')
      .lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Support ticket not found' });
    }

    try {
      const { notifyOwnerWithInbox } = await import(
        '../../../core/notifications/ownerInboxNotify.js'
      );
      const { upsertSellerNotification } = await import(
        '../seller/services/sellerNotify.service.js'
      );
      const statusLabel = set.status || updated.status || 'updated';
      const bodyText = set.adminResponse
        ? String(set.adminResponse).slice(0, 200)
        : `Your support ticket status is now ${statusLabel}.`;

      if (updated.userId) {
        await notifyOwnerWithInbox(
          { ownerType: 'USER', ownerId: updated.userId._id || updated.userId },
          {
            title: 'Support ticket update',
            body: bodyText,
            data: {
              type: 'qc_support_ticket',
              ticketId: String(updated._id),
              status: String(statusLabel),
              link: '/quick/support',
            },
          },
        );
      }
      if (updated.sellerId) {
        await upsertSellerNotification(updated.sellerId._id || updated.sellerId, {
          key: `support:${String(updated._id)}:${statusLabel}`,
          type: 'system',
          title: 'Support ticket update',
          message: bodyText,
          link: '/seller/support',
          metadata: { ticketId: String(updated._id), status: statusLabel },
        });
      }
    } catch (err) {
      console.warn('QC support ticket notify failed:', err?.message || err);
    }

    return res.json({
      success: true,
      message: 'Quick support ticket updated',
      data: { ticket: mapTicket(updated) },
    });
  } catch (error) {
    next(error);
  }
};
