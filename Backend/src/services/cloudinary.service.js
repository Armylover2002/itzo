import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/env.js';

cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret
});

export const getOptimizedCloudinaryImageUrl = (url, { format = 'webp', quality = 'auto' } = {}) => {
    if (!url || typeof url !== 'string' || !url.includes('/image/upload/')) {
        return url;
    }

    if (url.includes(`/upload/f_${format},q_${quality}/`)) {
        return url;
    }

    return url.replace('/upload/', `/upload/f_${format},q_${quality}/`);
};

const getImageUploadOptions = (folder) => ({
    folder,
    resource_type: 'image',
    format: 'webp',
    quality: 'auto'
});

export const uploadImageBuffer = async (buffer, folder = 'uploads') => {
    if (!buffer) {
        throw new Error('File buffer is required');
    }

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            getImageUploadOptions(folder),
            (error, result) => {
                if (error) {
                    return reject(error);
                }
                return resolve(getOptimizedCloudinaryImageUrl(result.secure_url));
            }
        );

        stream.end(buffer);
    });
};

export const uploadImageBufferDetailed = async (buffer, folder = 'uploads') => {
    if (!buffer) {
        throw new Error('File buffer is required');
    }

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            getImageUploadOptions(folder),
            (error, result) => {
                if (error) {
                    return reject(error);
                }
                return resolve({
                    ...result,
                    secure_url: getOptimizedCloudinaryImageUrl(result.secure_url)
                });
            }
        );

        stream.end(buffer);
    });
};

export const uploadBufferDetailed = async (
    buffer,
    { folder = 'uploads', resourceType = 'auto' } = {}
) => {
    if (!buffer) {
        throw new Error('File buffer is required');
    }

    return new Promise((resolve, reject) => {
        const stream = (resourceType === 'video' ? cloudinary.uploader.upload_chunked_stream : cloudinary.uploader.upload_stream)(
            resourceType === 'image'
                ? getImageUploadOptions(folder)
                : { folder, resource_type: resourceType },
            (error, result) => {
                if (error) {
                    return reject(error);
                }
                if (resourceType === 'image') {
                    return resolve({
                        ...result,
                        secure_url: getOptimizedCloudinaryImageUrl(result.secure_url)
                    });
                }

                return resolve(result);
            }
        );

        stream.end(buffer);
    });
};

export const uploadPdfBuffer = async (buffer, folder = 'hrms/payslips') => {
    if (!buffer) {
        throw new Error('File buffer is required');
    }

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { 
                folder, 
                resource_type: 'image',
                format: 'pdf'
            },
            (error, result) => {
                if (error) {
                    return reject(error);
                }
                return resolve(result.secure_url);
            }
        );

        stream.end(buffer);
    });
};

export const uploadFileDetailed = async (
    filePath,
    { folder = 'uploads', resourceType = 'auto' } = {}
) => {
    if (!filePath) {
        throw new Error('File path is required');
    }

    const options = resourceType === 'image'
        ? getImageUploadOptions(folder)
        : { folder, resource_type: resourceType };

    // Use upload_large for videos/files to handle chunked uploading from disk safely
    return new Promise((resolve, reject) => {
        const uploader = resourceType === 'video' ? cloudinary.uploader.upload_large : cloudinary.uploader.upload;
        
        uploader(filePath, options, (error, result) => {
            if (error) {
                return reject(error);
            }
            if (resourceType === 'image') {
                return resolve({
                    ...result,
                    secure_url: getOptimizedCloudinaryImageUrl(result.secure_url)
                });
            }
            return resolve(result);
        });
    });
};

/**
 * Generates a secure, signed private download URL for restricted Cloudinary PDF assets.
 * Handles legacy URLs that were uploaded under the 'image' resource type.
 */
export const getSecurePdfUrl = (url) => {
    if (!url || typeof url !== 'string') return url;

    // Only target legacy PDF uploads that are under /image/upload/
    if (url.includes('/image/upload/') && url.toLowerCase().endsWith('.pdf')) {
        try {
            // Extract public ID from the URL:
            // Format: https://res.cloudinary.com/cloud_name/image/upload/v12345678/folder/subfolder/public_id.pdf
            const match = url.match(/\/image\/upload\/(?:v\d+\/)?(.+?)\.pdf$/i);
            if (match && match[1]) {
                const publicId = decodeURIComponent(match[1]);
                return cloudinary.utils.private_download_url(publicId, 'pdf', {
                    resource_type: 'image',
                    type: 'upload',
                    expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiration
                });
            }
        } catch (error) {
            console.error('Error generating secure PDF URL:', error);
        }
    }
    return url;
};

/**
 * Wraps an application document (or plain object) and signs all PDF document URLs
 * to bypass restricted Cloudinary delivery policies.
 */
export const signApplicationUrls = (application) => {
    if (!application) return application;

    // If it's a mongoose document, convert to plain object
    const appObj = typeof application.toObject === 'function' ? application.toObject() : application;

    if (appObj.resumeUrl) {
        appObj.resumeUrl = getSecurePdfUrl(appObj.resumeUrl);
    }
    if (appObj.coverLetterUrl) {
        appObj.coverLetterUrl = getSecurePdfUrl(appObj.coverLetterUrl);
    }
    if (appObj.additionalFiles && Array.isArray(appObj.additionalFiles)) {
        appObj.additionalFiles = appObj.additionalFiles.map(url => getSecurePdfUrl(url));
    }
    return appObj;
};
