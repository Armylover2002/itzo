import express from 'express';
import { upload } from '../../../middleware/upload.js';
import { uploadImageBuffer, uploadBufferDetailed } from '../../../services/cloudinary.service.js';

const router = express.Router();

// POST /v1/uploads/image or /v1/uploads/file
router.post(['/image', '/file'], upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({
                success: false,
                message: 'No file provided'
            });
        }

        const folder = typeof req.body?.folder === 'string' && req.body.folder.trim()
            ? req.body.folder.trim()
            : 'uploads';

        const originalName = (req.file.originalname || '').toLowerCase();
        const mimeType = (req.file.mimetype || '').toLowerCase();
        const isDocument = req.path === '/file' ||
            originalName.endsWith('.pdf') || originalName.endsWith('.doc') || originalName.endsWith('.docx') ||
            originalName.endsWith('.txt') || originalName.endsWith('.csv') || originalName.endsWith('.xls') ||
            originalName.endsWith('.xlsx') || mimeType.includes('pdf') || mimeType.includes('msword') ||
            mimeType.includes('document') || mimeType.includes('sheet');

        let finalUrl = '';
        let publicId = null;

        if (isDocument) {
            const result = await uploadBufferDetailed(req.file.buffer, { folder, resourceType: 'auto' });
            finalUrl = typeof result === 'string' ? result : (result?.secure_url || result?.url);
            publicId = typeof result === 'string' ? null : (result?.public_id || null);
        } else {
            const url = await uploadImageBuffer(req.file.buffer, folder);
            finalUrl = url;
        }

        return res.status(200).json({
            success: true,
            message: 'File uploaded successfully',
            url: finalUrl,
            data: {
                url: finalUrl,
                publicId
            }
        });
    } catch (error) {
        next(error);
    }
});

export default router;

