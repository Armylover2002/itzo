import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const errorHandler = (err, req, res, next) => {
    // Multer size/count limits are client mistakes, not server faults.
    const isUploadLimit = err.name === 'MulterError' && ['LIMIT_FILE_SIZE', 'LIMIT_FILE_COUNT'].includes(err.code);
    const statusCode = err.statusCode || (isUploadLimit ? 413 : 500);
    const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large. Maximum allowed size is 5MB per image.'
        : err.code === 'LIMIT_FILE_COUNT'
            ? 'Too many files in one upload.'
            : err.message || 'Server Error';
    const requestId = req.requestId || '-';

    logger.error(
        `[${requestId}] ${req.method} ${req.originalUrl} ${statusCode} - ${err.name || 'Error'} - ${message}`
    );
    if (config.nodeEnv === 'development' && err.stack) {
        logger.error(`[${requestId}] ${err.stack}`);
    }

    res.status(statusCode).json({
        success: false,
        error: message,
        message,
        ...(err.code ? { code: err.code } : {}),
    });
};

export default errorHandler;

