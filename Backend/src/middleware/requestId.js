import crypto from 'crypto';

const HEADER = 'x-request-id';

/**
 * Assigns a request ID from X-Request-ID header or generates one.
 * Attaches to req.requestId and sets response header.
 */
export const requestIdMiddleware = (req, res, next) => {
    const id = req.headers[HEADER] || crypto.randomUUID();
    req.requestId = id;
    res.setHeader(HEADER, id);
    next();
};
