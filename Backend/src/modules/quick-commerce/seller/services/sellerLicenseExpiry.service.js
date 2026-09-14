import mongoose from 'mongoose';
import { Seller } from '../models/seller.model.js';
import { upsertSellerNotification } from './sellerNotify.service.js';
import { notifyAdminsSafely } from '../../../../core/notifications/firebase.service.js';
import { emitAdminBellRefresh } from '../../../../core/notifications/ownerInboxNotify.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const toDateLabel = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const startOfToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const nextDay = (date) => new Date(date.getTime() + DAY_MS);

const buildAdminSummary = (seller, expiryType, licenseNumberField, licenseName) => {
    const expiryDate = seller[expiryType] ? new Date(seller[expiryType]) : null;
    if (!expiryDate) return null;

    const sellerName =
        seller?.shopInfo?.shopName ||
        seller?.businessName ||
        seller?.ownerName ||
        'Seller';
    const ownerName = seller?.ownerName || 'Seller owner';
    const expiryLabel = toDateLabel(expiryDate);
    const licenseNumber =
        seller?.compliance?.[licenseNumberField] ||
        seller[licenseNumberField] ||
        'N/A';
    const title = `${licenseName} Expired`;
    const message = `${sellerName} ${licenseName} expired on ${expiryLabel}. Owner: ${ownerName}. Lic No: ${licenseNumber}.`;

    return {
        id: `${expiryType}-expired-${String(seller?._id || '')}`,
        sellerId: String(seller?._id || ''),
        sellerName,
        ownerName,
        ownerPhone: seller?.ownerPhone || seller?.phone || '',
        licenseNumber,
        licenseName,
        expiryDate: expiryDate.toISOString(),
        expiryLabel,
        title,
        message,
        createdAt: expiryDate.toISOString(),
        path: '/admin/quick-commerce/sellers',
        licenseType: expiryType,
    };
};

export const listExpiredSellerLicenses = async () => {
    const today = startOfToday();
    const threshold = nextDay(today);

    const sellers = await Seller.find({
        status: { $in: ['approved', 'pending_approval'] },
        $or: [
            { fssaiExpiry: { $lt: threshold } },
            { medicalLicenseExpiry: { $lt: threshold } },
            { shopLicenseExpiry: { $lt: threshold } },
        ],
    }).lean();

    const results = [];
    sellers.forEach((seller) => {
        if (seller.fssaiExpiry && new Date(seller.fssaiExpiry) < threshold) {
            results.push(buildAdminSummary(seller, 'fssaiExpiry', 'fssaiNumber', 'FSSAI License'));
        }
        if (seller.medicalLicenseExpiry && new Date(seller.medicalLicenseExpiry) < threshold) {
            results.push(
                buildAdminSummary(
                    seller,
                    'medicalLicenseExpiry',
                    'medicalLicenseNumber',
                    'Medical License',
                ),
            );
        }
        if (seller.shopLicenseExpiry && new Date(seller.shopLicenseExpiry) < threshold) {
            results.push(
                buildAdminSummary(seller, 'shopLicenseExpiry', 'shopLicenseNumber', 'Shop License'),
            );
        }
    });

    return results.sort((a, b) => new Date(b.expiryDate) - new Date(a.expiryDate));
};

/**
 * Upsert seller inbox rows (schema-aligned) + FCM, and ping admins once for new expiries.
 */
export const syncExpiredSellerLicenseNotifications = async () => {
    const expiredList = await listExpiredSellerLicenses();
    const candidates = expiredList.filter(
        (summary) =>
            summary.sellerId && mongoose.Types.ObjectId.isValid(summary.sellerId),
    );

    if (!candidates.length) {
        return { totalExpired: 0, createdCount: 0 };
    }

    let createdCount = 0;

    for (const summary of candidates) {
        const key = `license_expiry:${summary.licenseType}:${summary.expiryDate}`;
        const saved = await upsertSellerNotification(summary.sellerId, {
            key,
            type: 'system',
            title: summary.title,
            message: summary.message,
            link: '/seller/profile',
            metadata: {
                licenseNumber: summary.licenseNumber,
                licenseName: summary.licenseName,
                expiryDate: summary.expiryDate,
                licenseType: summary.licenseType,
                source: 'LICENSE_EXPIRY',
            },
        });
        // upsert always returns doc; count “new” loosely via recent createdAt
        if (saved) {
            const ageMs = Date.now() - new Date(saved.createdAt || 0).getTime();
            if (ageMs < 60_000) createdCount += 1;
        }
    }

    if (createdCount > 0) {
        void notifyAdminsSafely({
            title: 'Seller License Expired',
            body: `${createdCount} seller license(s) need attention.`,
            data: {
                type: 'LICENSE_EXPIRY',
                link: '/admin/quick-commerce/sellers',
            },
        });
        void emitAdminBellRefresh();
    }

    return {
        totalExpired: candidates.length,
        createdCount,
    };
};
