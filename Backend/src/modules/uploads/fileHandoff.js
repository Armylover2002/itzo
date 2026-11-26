import crypto from 'crypto';
import { sendResponse, sendError } from '../../utils/response.js';

/**
 * One-time download links for client-generated PDFs (invoices).
 *
 * The Android app shell cannot open or save `blob:` URLs, so the web app posts the PDF here and
 * opens the returned https link instead. Files are kept in memory for a few minutes only and
 * are reachable solely through an unguessable 128-bit id, so no invoice stays on disk.
 *
 * shortcut: in-process Map, so this assumes a single backend instance (pm2 fork mode as deployed);
 * move to Redis if the API is ever clustered.
 */
const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 200;
const store = new Map(); // id -> { buffer, fileName, expiresAt }

const purge = (now = Date.now()) => {
    for (const [id, entry] of store) {
        if (entry.expiresAt <= now) store.delete(id);
    }
    // Map keeps insertion order, so the oldest entries go first if someone floods uploads.
    while (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value);
};

const safeFileName = (name) =>
    String(name || 'document.pdf').replace(/[^\w.\- ]+/g, '_').slice(0, 80) || 'document.pdf';

export const uploadHandoffFile = (req, res) => {
    const buffer = req.file?.buffer;
    if (!buffer || buffer.length < 5 || buffer.toString('ascii', 0, 4) !== '%PDF') {
        return sendError(res, 400, 'A PDF file is required');
    }

    purge();
    const id = crypto.randomBytes(16).toString('hex');
    store.set(id, {
        buffer,
        fileName: safeFileName(req.body?.fileName || req.file.originalname),
        expiresAt: Date.now() + TTL_MS,
    });

    return sendResponse(res, 201, 'File ready', { url: `/api/v1/files/handoff/${id}` });
};

export const downloadHandoffFile = (req, res) => {
    const entry = /^[a-f0-9]{32}$/.test(req.params.id) ? store.get(req.params.id) : null;
    if (!entry || entry.expiresAt <= Date.now()) {
        if (entry) store.delete(req.params.id);
        return res.status(404).type('text/plain').send('This download link has expired. Please try again.');
    }

    res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${entry.fileName}"`,
        'Content-Length': entry.buffer.length,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
    });
    return res.send(entry.buffer);
};
