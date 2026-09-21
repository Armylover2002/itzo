/**
 * Payslip Upload Service
 * ──────────────────────────────────────────────────────────────────────────────
 * Stores generated payslip PDF buffers on the server's own disk (the uploads
 * folder) as real .pdf files and returns their /uploads/... URL.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { uploadPdfBuffer } from '../../../../services/upload.service.js';

/**
 * @param {Buffer} buffer   - PDF document buffer
 * @param {string} filename - Descriptive name (used for validation/logging only;
 *                            the stored file gets a unique generated name)
 * @returns {Promise<string>} Public URL of the stored document
 */
export const uploadPayslip = async (buffer, filename) => {
    if (!buffer || !Buffer.isBuffer(buffer)) {
        throw new Error('Invalid buffer provided for payslip upload');
    }
    if (!filename || typeof filename !== 'string') {
        throw new Error('Filename is required for payslip upload');
    }

    try {
        const url = await uploadPdfBuffer(buffer, 'hrms/payslips/generated');
        console.log(`[Payslip Upload] ✅ Stored on server: ${url}`);
        return url;
    } catch (error) {
        throw new Error(`Failed to store payslip on server: ${error.message || error}`);
    }
};
