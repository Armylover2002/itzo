import { config } from '../config/env.js';
import * as cloudinaryService from './cloudinary.service.js';
import * as localStorageService from './localStorage.service.js';
import { logger } from '../utils/logger.js';

const getStorageService = () => {
    if (config.uploadStorage === 'cloudinary') {
        return cloudinaryService;
    }
    return localStorageService;
};

export const getOptimizedCloudinaryImageUrl = (url, options) => {
    return getStorageService().getOptimizedCloudinaryImageUrl(url, options);
};

export const uploadImageBuffer = (buffer, folder) => {
    return getStorageService().uploadImageBuffer(buffer, folder);
};

export const uploadImageBufferDetailed = (buffer, folder) => {
    return getStorageService().uploadImageBufferDetailed(buffer, folder);
};

export const uploadBufferDetailed = (buffer, options) => {
    return getStorageService().uploadBufferDetailed(buffer, options);
};

export const uploadPdfBuffer = (buffer, folder) => {
    return getStorageService().uploadPdfBuffer(buffer, folder);
};

export const uploadFileDetailed = (filePath, options) => {
    return getStorageService().uploadFileDetailed(filePath, options);
};

export const getSecurePdfUrl = (url) => {
    return getStorageService().getSecurePdfUrl(url);
};

export const signApplicationUrls = (application) => {
    return getStorageService().signApplicationUrls(application);
};
