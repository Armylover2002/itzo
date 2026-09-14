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
        const stream = cloudinary.uploader.upload_stream(
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
