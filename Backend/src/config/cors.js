/**
 * Shared CORS allowlist for Express + Socket.IO.
 * Includes local dev, production domains, and optional env overrides.
 */

const DEFAULT_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://www.blazeapp.in',
    'https://blazeapp.in',
   
]

const ORIGIN_PATTERNS = [
    // Local Vite / alternate ports (5173, 4173, 3000, etc.)
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
]

function parseOriginList(value) {
    return String(value || '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && s !== '*');
}

export function getAllowedOrigins() {
    const fromCors = parseOriginList(process.env.CORS_ORIGIN);
    const fromFrontend = parseOriginList(process.env.FRONTEND_URL);
    const fromSocket = parseOriginList(process.env.SOCKET_CORS_ORIGIN);
    return [...new Set([...DEFAULT_ORIGINS, ...fromCors, ...fromFrontend, ...fromSocket])];
}

export function isOriginAllowed(origin) {
    // Non-browser clients (Postman, server-to-server) have no Origin header
    if (!origin) return true;
    const allowed = getAllowedOrigins();
    if (allowed.includes(origin)) return true;
    return ORIGIN_PATTERNS.some((re) => re.test(origin));
}

export const corsOptions = {
    origin(origin, callback) {
        if (isOriginAllowed(origin)) return callback(null, true);
        return callback(null, false);
    },
    credentials: true,
};
