import fs from 'fs';
import os from 'os';
import path from 'path';
import multer from 'multer';

const SETTINGS_UPLOAD_DIR = path.join(os.tmpdir(), 'blaze-global-settings-uploads');

if (!fs.existsSync(SETTINGS_UPLOAD_DIR)) {
    fs.mkdirSync(SETTINGS_UPLOAD_DIR, { recursive: true });
}

const ALLOWED_IMAGE_MIME_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/tiff',
    'image/bmp',
    'image/heic',
    'image/heif',
]);

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, SETTINGS_UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
        const safeOriginalName = String(file.originalname || 'upload')
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .slice(0, 120);
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeOriginalName}`;
        cb(null, uniqueName);
    },
});

const imageFileFilter = (_req, file, cb) => {
    const mimeType = String(file.mimetype || '').toLowerCase();
    if (ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
        return cb(null, true);
    }
    return cb(new Error('Only image files are allowed for global settings uploads'));
};

/**
 * Disk-backed multer for global settings uploads.
 * Avoids loading large files into memory; downstream sharp optimization reads from disk.
 */
export const settingsUpload = multer({
    storage,
    fileFilter: imageFileFilter,
    limits: {
        files: 13,
    },
});

export const SETTINGS_UPLOAD_FIELDS = [
    { name: 'adminLogo', maxCount: 1 },
    { name: 'adminFavicon', maxCount: 1 },
    { name: 'userLogo', maxCount: 1 },
    { name: 'userFavicon', maxCount: 1 },
    { name: 'deliveryLogo', maxCount: 1 },
    { name: 'deliveryFavicon', maxCount: 1 },
    { name: 'restaurantLogo', maxCount: 1 },
    { name: 'restaurantFavicon', maxCount: 1 },
    { name: 'sellerLogo', maxCount: 1 },
    { name: 'sellerFavicon', maxCount: 1 },
    { name: 'loginBanner', maxCount: 1 },
    { name: 'sellerLoginBanner', maxCount: 1 },
    { name: 'restaurantLoginBanner', maxCount: 1 },
];

export const handleSettingsUpload = (req, res, next) => {
    settingsUpload.fields(SETTINGS_UPLOAD_FIELDS)(req, res, (error) => {
        if (!error) return next();

        const message = error?.message || 'Invalid file upload';
        return res.status(400).json({ success: false, message });
    });
};
