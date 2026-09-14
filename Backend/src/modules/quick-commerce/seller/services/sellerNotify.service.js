import mongoose from 'mongoose';
import { SellerNotification } from '../models/sellerNotification.model.js';
import { Seller } from '../models/seller.model.js';
import { notifyOwnerSafely } from '../../../../core/notifications/firebase.service.js';
import { computeNotificationExpiresAt } from '../../../../core/notifications/utils/notificationTtl.js';
import { getIO, rooms } from '../../../../config/socket.js';
import { sendSellerStatusEmail } from '../../../../utils/email.js';
import { sendTransactionalSms } from '../../../../utils/sms.js';

const isPlaceholderEmail = (email) => {
    const value = String(email || '').trim().toLowerCase();
    return !value || value.endsWith('@seller.local') || value.endsWith('@blaze.local');
};

const isStatusDecisionKey = (key = '') => {
    const value = String(key);
    return (
        value.includes(':approved') ||
        value.includes(':rejected') ||
        value.includes(':decision')
    );
};

const emitSellerLiveUpdate = (sellerId, payload) => {
    try {
        const io = getIO();
        if (!io || !sellerId) return;
        const room = rooms.seller(sellerId);
        io.to(room).emit('seller_notification', payload);
        io.to(room).emit('seller_profile_updated', payload);
        io.to(room).emit('admin_notification', { type: 'seller_inbox_refresh' });
    } catch (error) {
        console.warn('[sellerNotify] socket emit failed:', error?.message || error);
    }
};

/**
 * Writes one entry into a seller's in-app notification list and fans out
 * push / socket / email / SMS. Status decisions always attempt email + SMS.
 *
 * `key` is unique per seller, so repeating the same event (a resubmitted application, a
 * second approval) refreshes the existing row instead of stacking duplicates.
 *
 * Never throws: a notification failure must not fail the action that triggered it.
 * Callers should treat a `null` return as failure (this helper swallows errors).
 */
export const upsertSellerNotification = async (sellerId, notification = {}) => {
    const id = String(sellerId || '');
    const key = String(notification.key || '').trim();
    const title = String(notification.title || '').trim();
    const message = String(notification.message || '').trim();
    const link = String(notification.link || notification.metadata?.link || '').trim() || '/seller';

    if (!mongoose.Types.ObjectId.isValid(id) || !key || !title || !message) return null;

    try {
        const now = new Date();
        const baseMeta =
            notification.metadata && typeof notification.metadata === 'object' && !Array.isArray(notification.metadata)
                ? notification.metadata
                : {};
        const metadata = {
            ...baseMeta,
            ...(link ? { link } : {}),
        };
        const channels = notification.channels || {};
        const sendEmailSms =
            channels.email === true ||
            channels.sms === true ||
            (channels.email !== false && channels.sms !== false && isStatusDecisionKey(key));

        const saved = await SellerNotification.findOneAndUpdate(
            { sellerId: new mongoose.Types.ObjectId(id), key },
            {
                $set: {
                    type: notification.type || 'system',
                    title,
                    message,
                    metadata,
                    isRead: false,
                    createdAt: now,
                    updatedAt: now,
                    // findOneAndUpdate skips pre-validate; always stamp TTL explicitly.
                    expiresAt: computeNotificationExpiresAt(now),
                },
            },
            { new: true, upsert: true, setDefaultsOnInsert: true },
        );

        const livePayload = {
            id: String(saved?._id || ''),
            title,
            message,
            type: notification.type || 'system',
            link,
            key,
            createdAt: now.toISOString(),
            sellerId: id,
        };

        emitSellerLiveUpdate(id, livePayload);

        void notifyOwnerSafely(
            { ownerId: id, ownerType: 'SELLER' },
            {
                title,
                body: message,
                data: {
                    type: notification.type || 'system',
                    link: link || '/seller',
                    audience: 'seller',
                    uniqueKey: key,
                    sellerId: id,
                },
            },
        );

        if (sendEmailSms) {
            const seller = await Seller.findById(id).select('email phone shopInfo.name name').lean();
            if (seller) {
                const shopName = seller.shopInfo?.name || seller.name || '';
                const sellerName = seller.name || shopName || 'Seller';
                if (channels.email !== false && !isPlaceholderEmail(seller.email)) {
                    await sendSellerStatusEmail(seller.email, {
                        name: sellerName,
                        shopName,
                        title,
                        message,
                        status: key.includes('rejected') ? 'rejected' : 'approved',
                    }).catch((error) => {
                        console.warn('[sellerNotify] email failed:', error?.message || error);
                    });
                }
                if (channels.sms !== false && seller.phone) {
                    const smsBody = `${title}. ${message}`.replace(/\s+/g, ' ').trim().slice(0, 300);
                    await sendTransactionalSms(seller.phone, smsBody).catch((error) => {
                        console.warn('[sellerNotify] SMS failed:', error?.message || error);
                    });
                }
            }
        }

        return saved;
    } catch (error) {
        console.error('upsertSellerNotification failed:', error?.message || error);
        return null;
    }
};
