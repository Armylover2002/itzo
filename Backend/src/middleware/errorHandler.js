import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import http from 'http';

function reportDebug(event, data) {
    const payload = JSON.stringify({
        sessionId: 'topup-500-crash',
        runId: 'pre',
        timestamp: new Date().toISOString(),
        event,
        data
    });
    const req = http.request('http://127.0.0.1:7778/event', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    });
    req.on('error', () => {});
    req.write(payload);
    req.end();
}

const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Server Error';
    const requestId = req.requestId || '-';

    // #region debug-point error-handler-entry
    reportDebug('error-handler-reached', { 
        statusCode, 
        message, 
        name: err.name, 
        stack: err.stack,
        url: req.originalUrl,
        method: req.method
    });
    // #endregion

    logger.error(
        `[${requestId}] ${req.method} ${req.originalUrl} ${statusCode} - ${err.name || 'Error'} - ${message}`
    );
    
    // Always log stack traces for 500 errors or in development mode for easier debugging
    if ((config.nodeEnv === 'development' || statusCode === 500) && err.stack) {
        logger.error(`[${requestId}] Stack Trace:\n${err.stack}`);
    }

    res.status(statusCode).json({
        success: false,
        error: message,
        message,
        ...(err.code && { code: err.code })
    });
};

export default errorHandler;
