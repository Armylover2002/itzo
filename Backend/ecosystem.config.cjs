/**
 * PM2 process definitions for the Blaze backend.
 *
 * Must stay .cjs — package.json sets "type": "module", so a .js config here would be
 * parsed as ESM and PM2 would fail to load it.
 *
 * The API server is the only producer; workers consume in separate processes so a slow
 * job never blocks the HTTP event loop. Start with:
 *   pm2 start ecosystem.config.cjs --update-env
 */

const path = require('path');

const CWD = __dirname;

/** Workers need longer than PM2's 1.6s default to finish an in-flight job on SIGTERM. */
const worker = (name, script, extra = {}) => ({
    name,
    script: path.join(CWD, script),
    cwd: CWD,
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    max_memory_restart: '400M',
    kill_timeout: 10000,
    time: true,
    env: { NODE_ENV: 'production' },
    ...extra,
});

module.exports = {
    apps: [
        {
            name: 'blaze-backend',
            script: path.join(CWD, 'server.js'),
            cwd: CWD,
            exec_mode: 'fork',
            instances: 1,
            autorestart: true,
            // Heap was sitting at ~90% before this; restart rather than let V8 thrash.
            max_memory_restart: '600M',
            kill_timeout: 10000,
            time: true,
            env: { NODE_ENV: 'production' },
        },

        // Activates scheduled orders at T-15 and runs the 30-min stuck-order watchdog.
        worker('blaze-worker-order', 'src/queues/workers/order.worker.js'),

        // Wallet credits, payment capture, refunds.
        worker('blaze-worker-payment', 'src/queues/workers/payment.worker.js'),

        // High-frequency delivery-partner location persistence.
        worker('blaze-worker-tracking', 'src/queues/workers/tracking.worker.js', {
            max_memory_restart: '300M',
        }),

        // Hourly subscription expiry sweep.
        worker('blaze-worker-subscription', 'src/queues/workers/subscription.worker.js', {
            max_memory_restart: '250M',
        }),

        // Not started: otp.worker.js and notification.worker.js. Their processors are
        // still placeholders that only log and return, so running them does nothing.
        // Add them here once the SMS/FCM logic actually lands in those processors.
    ],
};
