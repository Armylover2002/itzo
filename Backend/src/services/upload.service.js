/**
 * Single entry point for every image/file upload in the backend.
 *
 * All files are written to the server's own disk (Backend/uploads locally,
 * /var/www/uploades on the live server — see config.uploadLocalDir) and served
 * from /uploads/... . Nothing is sent to a third-party storage service.
 */
export {
    UPLOADS_BASE_DIR,
    getOptimizedCloudinaryImageUrl,
    uploadImageBuffer,
    uploadImageBufferDetailed,
    uploadBufferDetailed,
    uploadPdfBuffer,
    uploadFileDetailed,
    destroyAsset,
    readLocalFile,
    getSecurePdfUrl,
    signApplicationUrls,
} from './localStorage.service.js';

/** Kept for callers that still ask which driver is active. */
export const getActiveStorageDriver = () => 'local';
