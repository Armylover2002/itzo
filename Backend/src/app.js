import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitize from 'mongo-sanitize';
import xssClean from 'xss-clean';
import compression from 'compression';
import routes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';
import { apiRateLimiter } from './middleware/rateLimit.js';
import { responseTimeLogger } from './middleware/responseTimeLogger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { healthCheck } from './config/health.js';
import { config } from './config/env.js';
import { corsOptions } from './config/cors.js';
import fs from 'fs';
import { UPLOADS_BASE_DIR } from './services/localStorage.service.js';

const app = express();

// Loud, one-time startup check: uploads vanishing in production almost always traces back
// to this resolving to the wrong directory (relative path inside the deploy folder that a
// redeploy wipes, or a typo vs. the Nginx `location /uploads` alias) rather than anything
// in the upload code itself. Print it so `pm2 logs` makes that obvious instead of silent 404s.
try {
    fs.mkdirSync(UPLOADS_BASE_DIR, { recursive: true });
    fs.accessSync(UPLOADS_BASE_DIR, fs.constants.W_OK);
    // eslint-disable-next-line no-console
    console.log(`[uploads] Serving from: ${UPLOADS_BASE_DIR} (writable)`);
} catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[uploads] ERROR: ${UPLOADS_BASE_DIR} is not writable/accessible — uploads will fail or silently vanish. ${err.message}`);
}

// Trust first proxy (essential for express-rate-limit if behind a proxy)
app.set('trust proxy', 1);

// Request ID tracing (before other middlewares so all logs can use it)
app.use(requestIdMiddleware);

// Health endpoints (no rate limit, minimal JSON, no secrets)
app.get('/health', async (_req, res) => {
    try {
        const data = await healthCheck();
        res.status(200).json(data);
    } catch (err) {
        res.status(503).json({ status: 'DOWN', error: 'Health check failed' });
    }
});
app.get('/ready', (_req, res) => {
    res.status(200).json({ status: 'ready' });
});

// Uploaded files (images, videos, PDFs) stored on this server. Served before helmet/rate
// limiting so <img>/<video> tags on other origins (Vite dev server, live frontend) can load them.
app.use('/uploads', express.static(UPLOADS_BASE_DIR, {
    maxAge: '30d',
    index: false,
    dotfiles: 'ignore',
    setHeaders: (res, filePath) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        // Uploaded SVG/HTML must never run scripts in our origin.
        if (/\.(svg|html?)$/i.test(filePath)) {
            res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
        }
    },
}));

// Security & parsing middlewares
app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } },
    hsts: config.nodeEnv === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    xssFilter: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// CORS — localhost, production domains, Vercel/Render previews, + CORS_ORIGIN/FRONTEND_URL
app.use(cors(corsOptions));

app.use(morgan('dev'));
app.use(express.json({
    limit: config.requestBodyLimit,
    verify: (req, res, buf) => {
        // ✅ Store rawBody for signature verification (Razorpay Webhooks)
        if (req.originalUrl && req.originalUrl.includes('/webhook/razorpay')) {
            req.rawBody = buf;
        }
    }
}));
app.use(express.urlencoded({ extended: true, limit: config.requestBodyLimit }));

// Protect against NoSQL injection and XSS
app.use((req, _res, next) => {
    req.body = mongoSanitize(req.body);
    req.query = mongoSanitize(req.query);
    req.params = mongoSanitize(req.params);
    next();
});
app.use(xssClean());

// Global rate limiting for API routes
app.use('/api', apiRateLimiter);

// Compress all responses
app.use(compression({ level: 6, threshold: 1024 }));

// Optional: log API response time (method, path, status, duration) - no sensitive data
app.use('/api', responseTimeLogger);

// API Routes
app.use('/api', routes);

// Error Handling
app.use(errorHandler);

export default app;