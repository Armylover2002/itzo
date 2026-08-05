import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Base directory for all uploads, relative to the project root (Backend/)
const UPLOADS_BASE_DIR = path.resolve(process.cwd(), 'uploads');

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
    const safeFolder = folder.replace(/\.\./g, '').replace(/^\/+/, '');
    const relativePath = path.join(safeFolder, filename).replace(/\\/g, '/');
    const absolutePath = path.join(UPLOADS_BASE_DIR, relativePath);
    
    // The public URL will start with /uploads/ followed by the relative path
    const publicUrl = `/uploads/${relativePath}`;
    
    return { absolutePath, publicUrl };
};

export const getOptimizedCloudinaryImageUrl = (url, _options = {}) => {
    return url;
};

export const uploadImageBuffer = async (buffer, folder = 'uploads') => {
    if (!buffer) {
        throw new Error('File buffer is required');
    }

    try {
        const filename = generateFilename('png'); // Fallback to png for raw buffers if sharp is unavailable
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
        const filename = generateFilename('png');
        const { absolutePath, publicUrl } = getFilePaths(folder, filename);
        
        ensureDirectoryExists(path.dirname(absolutePath));

        fs.writeFileSync(absolutePath, buffer);

        return {
            secure_url: publicUrl,
            public_id: publicUrl,
            format: 'png',
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

        let extension = 'bin';
        if (resourceType === 'video') extension = 'mp4'; 
        else if (resourceType === 'auto') extension = 'auto';

        const filename = generateFilename(extension);
        const { absolutePath, publicUrl } = getFilePaths(folder, filename);
        
        ensureDirectoryExists(path.dirname(absolutePath));
        
        fs.writeFileSync(absolutePath, buffer);

        return {
            secure_url: publicUrl,
            public_id: publicUrl,
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

export const getSecurePdfUrl = (url) => {
    return url;
};

export const signApplicationUrls = (application) => {
    if (!application) return application;
    const appObj = typeof application.toObject === 'function' ? application.toObject() : application;
    return appObj;
};
