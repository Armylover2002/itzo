/**
 * Cloudinary Upload Service (Payslip)
 * ──────────────────────────────────────────────────────────────────────────────
 * Handles uploading generated payslip PDF buffers to Cloudinary.
 * Uses Node's native Readable.from() instead of the `streamifier` package.
 *
 * CLOUDINARY ACL WORKAROUND:
 * Cloudinary free-tier blocks delivery of raw PDF files (returns 401 Unauthorized).
 * To bypass this, we upload with format:'png' so the stored URL ends in .png.
 * The binary content is still a valid PDF — the extension is just a disguise.
 * The backend proxy endpoint fetches the .png URL (which Cloudinary serves fine)
 * and re-serves it to the frontend with the correct application/pdf Content-Type.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import cloudinary from 'cloudinary';
import { Readable } from 'stream';
import { getActiveStorageDriver, uploadPdfBuffer } from '../../../../services/upload.service.js';

/**
 * Upload a payslip PDF buffer to whichever storage driver is active.
 *
 * On the live server (UPLOAD_STORAGE=local) the PDF is written into the server's
 * uploads folder as a real .pdf — the Cloudinary ".png masquerade" workaround
 * below is only needed for Cloudinary's free-tier delivery block.
 *
 * @param {Buffer} buffer   - PDF document buffer
 * @param {string} filename - Desired public_id (without extension)
 * @returns {Promise<string>} Secure URL of the uploaded document
 */
export const uploadPayslipToCloudinary = (buffer, filename) => {
    return new Promise((resolve, reject) => {
        if (!buffer || !Buffer.isBuffer(buffer)) {
            return reject(new Error('Invalid buffer provided for Cloudinary upload'));
        }
        if (!filename || typeof filename !== 'string') {
            return reject(new Error('Filename is required for Cloudinary upload'));
        }

        if (getActiveStorageDriver() === 'local') {
            return uploadPdfBuffer(buffer, 'hrms/payslips/generated')
                .then((url) => {
                    console.log(`[Payslip Upload] ✅ Stored on server: ${url}`);
                    resolve(url);
                })
                .catch((error) =>
                    reject(new Error(`Failed to store payslip on server: ${error.message || error}`)),
                );
        }

        const cleanName = filename.replace(/\.(png|pdf)$/i, '');

        const uploadStream = cloudinary.v2.uploader.upload_stream(
            {
                folder: 'hrms/payslips/generated',
                resource_type: 'raw',
                format: 'png',  // Masquerade as PNG to bypass Cloudinary free-tier PDF delivery block (401)
                public_id: cleanName,
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

