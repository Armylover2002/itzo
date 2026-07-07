/**
 * Cloudinary Upload Service (Payslip)
 * ──────────────────────────────────────────────────────────────────────────────
 * Handles uploading generated payslip PNG buffers to Cloudinary.
 * Uses Node's native Readable.from() instead of the `streamifier` package.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import cloudinary from 'cloudinary';
import { Readable } from 'stream';

/**
 * Upload a PNG buffer to Cloudinary.
 *
 * @param {Buffer} buffer   - PNG image buffer
 * @param {string} filename - Desired public_id (without extension)
 * @returns {Promise<string>} Secure URL of the uploaded image
 */
export const uploadPayslipToCloudinary = (buffer, filename) => {
    return new Promise((resolve, reject) => {
        if (!buffer || !Buffer.isBuffer(buffer)) {
            return reject(new Error('Invalid buffer provided for Cloudinary upload'));
        }
        if (!filename || typeof filename !== 'string') {
            return reject(new Error('Filename is required for Cloudinary upload'));
        }

        const publicId = filename.replace(/\.png$/i, '');

        const uploadStream = cloudinary.v2.uploader.upload_stream(
            {
                folder: 'hrms/payslips/generated',
                resource_type: 'image',
                public_id: publicId,
                format: 'png',
                overwrite: true
            },
            (error, result) => {
                if (error) {
                    console.error('[Payslip Upload] Cloudinary upload error:', error);
                    return reject(new Error(`Failed to upload payslip to Cloudinary: ${error.message || error}`));
                }
                console.log(`[Payslip Upload] ✅ Uploaded to Cloudinary: ${result.secure_url}`);
                resolve(result.secure_url);
            }
        );

        // Stream the buffer to Cloudinary using Node's native Readable
        Readable.from(buffer).pipe(uploadStream);
    });
};
