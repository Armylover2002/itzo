import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/env.js';

// Base directory for all uploads. Relative values resolve against the project
// root (Backend/); an absolute value such as /var/www/uploades is used as-is,
// so the live server can store files outside the deployed code folder.
const UPLOADS_BASE_DIR = path.resolve(process.cwd(), config.uploadLocalDir);

/**
 * Detects the real image/file type from the buffer's magic bytes so the file is
 * stored with a truthful extension. Saving a JPEG as ".png" makes browsers and
 * downstream readers (PDF generators, <img> tags) mis-handle it.
 */
const detectExtension = (buffer, fallback = 'bin') => {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) return fallback;

    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
    if (buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') return 'png';
    if (buffer.toString('ascii', 0, 3) === 'GIF') return 'gif';
    if (
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
        return 'webp';
    }
    if (buffer.toString('ascii', 0, 4) === '%PDF') return 'pdf';
    if (buffer.toString('ascii', 4, 8) === 'ftyp') return 'mp4';
    if (buffer[0] === 0x42 && buffer[1] === 0x4d) return 'bmp';

    const head = buffer.toString('utf8', 0, 300).trim().toLowerCase();
    if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) {
        return 'svg';
    }

    return fallback;
};

/**
 * Ensures a directory exists, creating it if necessary.
 */
const ensureDirectoryExists = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

/**
 * Generates a unique filename.
 */
const generateFilename = (extension) => {
    const randomHex = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    return `${timestamp}-${randomHex}.${extension}`;
};

/**
 * Helper to construct the final absolute path and the public URL.
 */
const getFilePaths = (folder, filename) => {
    // Sanitize folder path to prevent directory traversal
    const safeFolder = String(folder || 'uploads').replace(/\.\./g, '').replace(/^\/+/, '');
    const relativePath = path.join(safeFolder, filename).replace(/\\/g, '/');
    const absolutePath = path.join(UPLOADS_BASE_DIR, relativePath);

    // The public URL always starts with /uploads/ (that is the path Express and
    // Nginx serve from); UPLOAD_PUBLIC_BASE_URL can turn it into an absolute URL.
    const publicUrl = `${config.uploadPublicBaseUrl}/uploads/${relativePath}`;

    return { absolutePath, publicUrl };
};

/**
 * Maps a stored public URL/publicId back to its absolute path on disk, staying
 * inside the uploads directory. Returns null for anything that is not a local file.
 */
const resolveLocalPath = (publicId) => {
    if (!publicId || typeof publicId !== 'string') return null;

    let relativePath = publicId.trim();
    if (config.uploadPublicBaseUrl && relativePath.startsWith(config.uploadPublicBaseUrl)) {
        relativePath = relativePath.slice(config.uploadPublicBaseUrl.length);
    }
    if (/^https?:\/\//i.test(relativePath)) return null;

    relativePath = relativePath.replace(/^\/+/, '').replace(/^uploads\//, '');
    if (!relativePath || relativePath.includes('..')) return null;

    const absolutePath = path.resolve(UPLOADS_BASE_DIR, relativePath);
    if (!absolutePath.startsWith(UPLOADS_BASE_DIR)) return null;

    return absolutePath;
};

export const getOptimizedCloudinaryImageUrl = (url, _options = {}) => {
    return url;
};

export const uploadImageBuffer = async (buffer, folder = 'uploads') => {
    if (!buffer) {
        throw new Error('File buffer is required');
    }

    try {
        const filename = generateFilename(detectExtension(buffer, 'png'));
        const { absolutePath, publicUrl } = getFilePaths(folder, filename);

        ensureDirectoryExists(path.dirname(absolutePath));

        fs.writeFileSync(absolutePath, buffer);

        return publicUrl;
    } catch (error) {
        throw new Error(`Local upload failed: ${error.message}`);
    }
};

export const uploadImageBufferDetailed = async (buffer, folder = 'uploads') => {
    if (!buffer) {
        throw new Error('File buffer is required');
    }

    try {
        const extension = detectExtension(buffer, 'png');
        const filename = generateFilename(extension);
        const { absolutePath, publicUrl } = getFilePaths(folder, filename);

        ensureDirectoryExists(path.dirname(absolutePath));

        fs.writeFileSync(absolutePath, buffer);

        return {
            secure_url: publicUrl,
            public_id: publicUrl,
            format: extension,
            bytes: buffer.length,
            width: null, // Cannot determine easily without sharp, but not strictly required
            height: null,
            resource_type: 'image'
        };
    } catch (error) {
        throw new Error(`Local detailed upload failed: ${error.message}`);
    }
};

export const uploadBufferDetailed = async (
    buffer,
    { folder = 'uploads', resourceType = 'auto' } = {}
) => {
    if (!buffer) {
        throw new Error('File buffer is required');
    }

    try {
        if (resourceType === 'image') {
            return await uploadImageBufferDetailed(buffer, folder);
        }

        // The real type always wins; resourceType only supplies the fallback so a
        // video that cannot be sniffed still lands as .mp4 instead of ".auto".
        const extension = detectExtension(buffer, resourceType === 'video' ? 'mp4' : 'bin');

        const filename = generateFilename(extension);
        const { absolutePath, publicUrl } = getFilePaths(folder, filename);

        ensureDirectoryExists(path.dirname(absolutePath));

        fs.writeFileSync(absolutePath, buffer);

        return {
            secure_url: publicUrl,
            public_id: publicUrl,
            format: extension,
            bytes: buffer.length,
            resource_type: resourceType
        };
    } catch (error) {
        throw new Error(`Local buffer upload failed: ${error.message}`);
    }
};

export const uploadPdfBuffer = async (buffer, folder = 'hrms/payslips') => {
    if (!buffer) {
        throw new Error('File buffer is required');
    }

    try {
        const filename = generateFilename('pdf');
        const { absolutePath, publicUrl } = getFilePaths(folder, filename);
        
        ensureDirectoryExists(path.dirname(absolutePath));
        fs.writeFileSync(absolutePath, buffer);

        return publicUrl;
    } catch (error) {
        throw new Error(`Local PDF upload failed: ${error.message}`);
    }
};

export const uploadFileDetailed = async (
    filePath,
    { folder = 'uploads', resourceType = 'auto' } = {}
) => {
    if (!filePath) {
        throw new Error('File path is required');
    }

    try {
        const buffer = fs.readFileSync(filePath);
        return await uploadBufferDetailed(buffer, { folder, resourceType });
    } catch (error) {
        throw new Error(`Local file detailed upload failed: ${error.message}`);
    }
};

/**
 * Deletes a locally stored file. Mirrors cloudinary.uploader.destroy() so callers
 * can delete an asset without knowing which storage driver is active.
 */
export const destroyAsset = async (publicId, _options = {}) => {
    const absolutePath = resolveLocalPath(publicId);
    if (!absolutePath) return { result: 'not found' };

    try {
        if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
            return { result: 'ok' };
        }
        return { result: 'not found' };
    } catch (error) {
        return { result: 'error', error: error.message };
    }
};

export const getSecurePdfUrl = (url) => {
    return url;
};

export const signApplicationUrls = (application) => {
    if (!application) return application;
    const appObj = typeof application.toObject === 'function' ? application.toObject() : application;
    return appObj;
};
