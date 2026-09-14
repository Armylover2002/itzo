import { Server } from 'socket.io';
import { config } from './env.js';
import { isOriginAllowed } from './cors.js';
import { logger } from '../utils/logger.js';
import { verifyAccessToken } from '../core/auth/token.util.js';
import { getFirebaseDB } from './firebase.js';

let io = null;

function logDeliverySocket(message, extra = {}) {
    const suffix = Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : '';
    logger.info(`[DeliverySocket] ${message}${suffix}`);
}

function getTokenFromHandshake(socket) {
    const authToken = socket?.handshake?.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) return authToken.trim();
    const header = socket?.handshake?.headers?.authorization || socket?.handshake?.headers?.Authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) return header.substring(7).trim();
    const queryToken = socket?.handshake?.query?.token;
    if (typeof queryToken === 'string' && queryToken.trim()) return queryToken.trim();
    return null;
}

function maskToken(token) {
    if (!token || typeof token !== 'string') return null;
    const trimmed = token.trim();
    if (!trimmed) return null;
    return `${trimmed.slice(0, 12)}...${trimmed.slice(-6)}`;
}

const roomNames = {
    admin: (id) => `admin:${String(id)}`,
    restaurant: (id) => `restaurant:${String(id)}`,
    user: (id) => `user:${String(id)}`,
    seller: (id) => `seller:${String(id)}`,
    delivery: (id) => `delivery:${String(id)}`,
    tracking: (orderId) => `tracking:${String(orderId)}`
};

/**
 * Initializes Socket.IO with the provided HTTP server.
 * When REDIS_ENABLED=true and REDIS_URL is set, attaches Redis adapter for horizontal scaling.
 * @param {import('http').Server} server
 * @returns {Promise<Server>}
 */
export const initSocket = async (server) => {
    io = new Server(server, {
        cors: {
            origin: (origin, callback) => {
                if (isOriginAllowed(origin)) return callback(null, true);
                return callback(null, false);
            },
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });

    // Socket auth middleware (Bearer token).
    io.use(async (socket, next) => {
        try {
            const token = getTokenFromHandshake(socket);
            if (!token) {
                logger.warn(`Socket auth failed: token missing for socket ${socket.id}`);
                logger.warn(`[DeliverySocket] Handshake auth missing`, {
                    socketId: socket.id,
                    origin: socket?.handshake?.headers?.origin || null,
                    host: socket?.handshake?.headers?.host || null,
                    userAgent: socket?.handshake?.headers?.['user-agent'] || null,
                    hasAuthToken: Boolean(socket?.handshake?.auth?.token),
                    hasAuthorizationHeader: Boolean(
                        socket?.handshake?.headers?.authorization || socket?.handshake?.headers?.Authorization
                    ),
                    hasQueryToken: Boolean(socket?.handshake?.query?.token),
                });
                return next(new Error('AUTH_MISSING'));
            }
            logger.info(`[DeliverySocket] Handshake token received`, {
                socketId: socket.id,
                origin: socket?.handshake?.headers?.origin || null,
                host: socket?.handshake?.headers?.host || null,
                transport: socket?.handshake?.query?.transport || null,
                tokenPreview: maskToken(token),
            });
            const decoded = verifyAccessToken(token);
            if (
                decoded?.purpose === 'restaurant_onboarding' ||
                decoded?.purpose === 'seller_onboarding'
            ) {
                return next(new Error('AUTH_INVALID'));
            }
            const normalizedRole = String(decoded.role || '').trim().toUpperCase();
            const userId = decoded.userId || decoded.sub;
            if (!userId) {
                return next(new Error('AUTH_INVALID'));
            }

            // Live account-status check (mirrors HTTP authMiddleware)
            if (normalizedRole === 'USER') {
                const { FoodUser } = await import('../core/users/user.model.js');
                const doc = await FoodUser.findById(userId).select('isActive').lean();
                if (!doc || doc.isActive === false) {
                    return next(new Error('AUTH_INACTIVE'));
                }
            } else if (normalizedRole === 'DELIVERY_PARTNER') {
                const { FoodDeliveryPartner } = await import('../modules/food/delivery/models/deliveryPartner.model.js');
                const doc = await FoodDeliveryPartner.findById(userId).select('isActive').lean();
                if (!doc || doc.isActive === false) {
                    return next(new Error('AUTH_INACTIVE'));
                }
            } else if (normalizedRole === 'ADMIN' || normalizedRole === 'EMPLOYEE') {
                const { FoodAdmin } = await import('../core/admin/admin.model.js');
                const doc = await FoodAdmin.findById(userId).select('isActive').lean();
                if (!doc || doc.isActive === false) {
                    return next(new Error('AUTH_INACTIVE'));
                }
            } else if (normalizedRole === 'RESTAURANT') {
                const { FoodRestaurant } = await import('../modules/food/restaurant/models/restaurant.model.js');
                const doc = await FoodRestaurant.findById(userId)
                    .select('status isActive isDeleted accountStatus')
                    .lean();
                if (!doc || doc.isDeleted === true || doc.accountStatus === 'deleted') {
                    return next(new Error('AUTH_INACTIVE'));
                }
                const status = String(doc.status || '').toLowerCase();
                if (status === 'rejected') {
                    return next(new Error('AUTH_INACTIVE'));
                }
                if (doc.isActive === false && status !== 'pending') {
                    return next(new Error('AUTH_INACTIVE'));
                }
            }

            socket.user = { userId, role: decoded.role, authType: 'food' };
            socket.auth = {
                sub: userId,
                role: String(decoded.role || '').toLowerCase(),
                authType: 'food',
            };

            logger.info(`Socket auth success: ${socket.user.role}:${socket.user.userId} for socket ${socket.id}`);
            return next();
        } catch (err) {
            logger.error(`Socket auth failed for socket ${socket.id}: ${err.message}`);
            logger.error(`[DeliverySocket] Handshake auth invalid`, {
                socketId: socket.id,
                origin: socket?.handshake?.headers?.origin || null,
                host: socket?.handshake?.headers?.host || null,
                transport: socket?.handshake?.query?.transport || null,
                tokenPreview: maskToken(getTokenFromHandshake(socket)),
                errorMessage: err.message,
                errorName: err.name || null,
            });
            return next(new Error('AUTH_INVALID'));
        }
    });

    if (config.redisEnabled && config.redisUrl) {
        try {
            const { createAdapter } = await import('@socket.io/redis-adapter');
            const { createClient } = await import('redis');
            const pubClient = createClient({ url: config.redisUrl });
            const subClient = pubClient.duplicate();
            pubClient.on('error', (err) => logger.error(`Socket.IO Redis pub client: ${err.message}`));
            subClient.on('error', (err) => logger.error(`Socket.IO Redis sub client: ${err.message}`));
            await Promise.all([pubClient.connect(), subClient.connect()]);
            io.adapter(createAdapter(pubClient, subClient));
            logger.info('Socket.IO Redis adapter attached for horizontal scaling');
        } catch (err) {
            logger.warn(`Socket.IO Redis adapter skipped (using in-memory): ${err.message}`);
        }
    }

    io.on('connection', (socket) => {
        const userId = socket.user?.userId;
        const role = socket.user?.role;
        logger.info(`Socket client connected: ${socket.id} (${role || 'UNKNOWN'}:${userId || '-'})`);

        // Auto-join role rooms (lets us emit without a custom join).
        if (userId && role) {
            if (role === 'ADMIN' || role === 'EMPLOYEE') socket.join(roomNames.admin(userId));
            if (role === 'RESTAURANT') socket.join(roomNames.restaurant(userId));
            if (role === 'USER') socket.join(roomNames.user(userId));
            if (role === 'SELLER') socket.join(roomNames.seller(userId));
            if (role === 'DELIVERY_PARTNER') {
                socket.join(roomNames.delivery(userId));
                logDeliverySocket('Auto-joined delivery room on connect', {
                    socketId: socket.id,
                    deliveryPartnerId: String(userId),
                    room: roomNames.delivery(userId),
                });
            }
        }

        // Explicit join (used by existing restaurant client hook).
        socket.on('join-restaurant', (restaurantId) => {
            if (socket.user?.role !== 'RESTAURANT') return;
            // Security: only join your own restaurant room.
            if (String(socket.user?.userId) !== String(restaurantId)) return;
            socket.join(roomNames.restaurant(restaurantId));
            socket.emit('restaurant-room-joined', { room: roomNames.restaurant(restaurantId), restaurantId: String(restaurantId) });
        });

        // Explicit join (used by existing delivery client hook).
        socket.on('join-delivery', (deliveryPartnerId) => {
            if (socket.user?.role !== 'DELIVERY_PARTNER') {
                logDeliverySocket('Rejected join-delivery for non-delivery role', {
                    socketId: socket.id,
                    role: socket.user?.role || 'UNKNOWN',
                    requestedDeliveryPartnerId: String(deliveryPartnerId || ''),
                });
                return;
            }
            // Security: only join your own delivery room.
            if (String(socket.user?.userId) !== String(deliveryPartnerId)) {
                logDeliverySocket('Rejected join-delivery due to user mismatch', {
                    socketId: socket.id,
                    authDeliveryPartnerId: String(socket.user?.userId || ''),
                    requestedDeliveryPartnerId: String(deliveryPartnerId || ''),
                });
                return;
            }
            const room = roomNames.delivery(deliveryPartnerId);
            socket.join(room);
            const roomSize = io?.sockets?.adapter?.rooms?.get(room)?.size || 0;
            logDeliverySocket('Delivery room joined', {
                socketId: socket.id,
                deliveryPartnerId: String(deliveryPartnerId),
                room,
                roomSize,
            });
            socket.emit('delivery-room-joined', { room, deliveryPartnerId: String(deliveryPartnerId) });
        });

        // ─── Live Tracking Events ───────────────────────────────────────

        // Users / restaurants subscribe to an order's real-time tracking room.
        socket.on('join-tracking', (orderId) => {
            if (!orderId) return;
            const role = socket.user?.role;
            if (role !== 'USER' && role !== 'RESTAURANT' && role !== 'DELIVERY_PARTNER' && role !== 'SELLER' && role !== 'ADMIN') return;
            const room = roomNames.tracking(orderId);
            socket.join(room);
            logger.info(`Socket ${socket.id} (${role}:${userId}) joined tracking room ${room}`);
            socket.emit('tracking-room-joined', { room, orderId: String(orderId) });
        });

        // Backward-compatible alias used by some quick-commerce screens.
        socket.on('join_order', (orderId) => {
            if (!orderId) return;
            const role = socket.user?.role;
            if (role !== 'USER' && role !== 'RESTAURANT' && role !== 'DELIVERY_PARTNER' && role !== 'SELLER' && role !== 'ADMIN') return;
            const room = roomNames.tracking(orderId);
            socket.join(room);
            socket.emit('tracking-room-joined', { room, orderId: String(orderId) });
        });

        socket.on('leave_order', (orderId) => {
            if (!orderId) return;
            socket.leave(roomNames.tracking(orderId));
        });

        socket.on('leave-tracking', (orderId) => {
            if (!orderId) return;
            socket.leave(roomNames.tracking(orderId));
        });

        // Delivery partner emits live GPS location for an active order.
        // Broadcasts to the tracking room so users see the bike move in real time.
        const _lastLocationBroadcast = {};
        const _lastFirebaseTrackingSync = {};
        socket.on('update-location', async (data) => {
            if (socket.user?.role !== 'DELIVERY_PARTNER') return;
            if (!data || !data.orderId) return;

            const lat = Number(data.lat);
            const lng = Number(data.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

            const heading = Number.isFinite(Number(data.heading)) ? Number(data.heading) : 0;
            const speed = Number.isFinite(Number(data.speed)) ? Number(data.speed) : 0;
            const accuracy = Number.isFinite(Number(data.accuracy)) ? Number(data.accuracy) : null;

            // Throttle: max one broadcast per 2s per orderId
            const now = Date.now();
            const lastTS = _lastLocationBroadcast[data.orderId] || 0;
            if (now - lastTS < 2000) return;
            _lastLocationBroadcast[data.orderId] = now;

            const payload = {
                orderId: String(data.orderId),
                deliveryPartnerId: String(userId),
                lat,
                lng,
                boy_lat: lat, // Add boy_lat/lng for compatibility
                boy_lng: lng,
                riderLocation: [lat, lng], // Add array format for safety
                heading,
                speed,
                accuracy,
                timestamp: now,
                polyline: data.polyline || null,
                eta: data.eta ?? null,
                status: data.status || 'on_the_way',
            };

            logDeliverySocket('Location update received', {
                socketId: socket.id,
                deliveryPartnerId: String(userId),
                orderId: String(data.orderId),
                lat,
                lng,
                status: data.status || 'on_the_way',
            });

            // Broadcast to tracking room (all users watching this order)
            const trackingRoom = roomNames.tracking(data.orderId);
            socket.to(trackingRoom).emit('location-update', payload);

            // Also emit to the specific user room if userId is provided
            if (data.userId) {
                socket.to(roomNames.user(data.userId)).emit('location-update', payload);
            }

            if (data.restaurantId) {
                socket.to(roomNames.restaurant(data.restaurantId)).emit('location-update', payload);
            }

            // ─── Scalable Persistence (BullMQ + Redis "Hot" Buffering) ───
            try {
                const { getTrackingQueue } = await import('../queues/index.js');
                const { getRedisClient } = await import('../config/redis.js');
                const trackingQueue = getTrackingQueue();
                const redis = getRedisClient();

                if (trackingQueue && redis) {
                    const coordString = JSON.stringify({ lat, lng, timestamp: now });
                    
                    // 1. Immediately buffer the newest location in high-speed Redis Hash (HOT storage)
                    await Promise.all([
                        redis.hSet('rider:locations:hot', String(userId), coordString),
                        redis.hSet('order:locations:hot', String(data.orderId), coordString)
                    ]);

                    // 2. Schedule a deferred MongoDB write (COLD storage)
                    // jobId debulks updates: if a job is already waiting, BullMQ ignores the new add()
                    // Delay (30s) ensures we don't spam MongoDB while the rider is moving fast
                    const syncJobId = `sync:loc:${data.orderId}`;
                    trackingQueue.add('sync-hot-locations', 
                        { userId, orderId: data.orderId }, 
                        { jobId: syncJobId, delay: 30000, removeOnComplete: true }
                    ).catch(e => logger.error(`BullMQ sync schedule failed: ${e.message}`));
                }
            } catch (err) {
                logger.error(`Real-time persistence layer error: ${err.message}`);
            }

            // ─── Firebase Realtime Database Sync (Cost Optimization) ───
            try {
                const db = getFirebaseDB();
                const lastFirebaseSyncAt = _lastFirebaseTrackingSync[data.orderId] || 0;
                const shouldSyncFirebase = now - lastFirebaseSyncAt >= 10000;

                if (db && shouldSyncFirebase) {
                    _lastFirebaseTrackingSync[data.orderId] = now;
                    // 1. Update order-specific tracking node
                    const orderRef = db.ref(`active_orders/${data.orderId}`);
                    orderRef.update({
                        lat,
                        lng,
                        boy_lat: lat,
                        boy_lng: lng,
                        heading,
                        speed,
                        accuracy,
                        polyline: data.polyline || null,
                        eta: data.eta ?? null,
                        last_updated: now,
                        status: data.status || 'on_the_way'
                    }).catch(e => logger.error(`Firebase orderRef update error: ${e.message}`));

                    // 2. Update global delivery boy status node
                    const boyRef = db.ref(`delivery_boys/${userId}`);
                    boyRef.update({
                        lat,
                        lng,
                        accuracy,
                        last_updated: now,
                        status: 'online'
                    }).catch(e => logger.error(`Firebase boyRef update error: ${e.message}`));
                }
            } catch (err) {
                // Silently skip if Firebase not initialized yet
                logger.debug(`Firebase RTDB sync skipped: ${err.message}`);
            }
        });

        // Leave tracking room on user navigation away.
        socket.on('leave-tracking', (orderId) => {
            if (!orderId) return;
            const room = roomNames.tracking(orderId);
            socket.leave(room);
        });

        socket.on('disconnect', (reason) => {
            logger.info(`Socket client disconnected: ${socket.id}`);
            if (role === 'DELIVERY_PARTNER') {
                logDeliverySocket('Delivery socket disconnected', {
                    socketId: socket.id,
                    deliveryPartnerId: String(userId || ''),
                });
            }

        });

        // Resync State on Reconnect — supports optional ACK callback from client.
        socket.on('resync', async (ack) => {
          try {
            if (role === 'DELIVERY_PARTNER') {
              logDeliverySocket('Resync requested', {
                socketId: socket.id,
                deliveryPartnerId: String(userId || ''),
              });
            }
            const { resyncState } = await import('../modules/food/orders/services/order.service.js');
            const state = await resyncState(userId, role);
            if (state.activeOrder) {
              const eventName = role === 'USER' ? 'order_state' : 'active_order';
              socket.emit(eventName, state.activeOrder);
              if (role === 'DELIVERY_PARTNER') {
                logDeliverySocket('Resync emitted active order', {
                  socketId: socket.id,
                  deliveryPartnerId: String(userId || ''),
                  orderId: String(
                    state.activeOrder?.orderId ||
                    state.activeOrder?.orderMongoId ||
                    ''
                  ),
                  eventName,
                });
              }
              
              // Re-emit OTP if user is in drop phase
              if (role === 'USER' && state.activeOrder.handoverOtp) {
                socket.emit('delivery_drop_otp', {
                  orderId: state.activeOrder.orderId,
                  otp: state.activeOrder.handoverOtp,
                  message: 'Share this OTP with your delivery partner.'
                });
              }
            }
            const completePayload = {
              ok: true,
              timestamp: Date.now(),
              hasActiveOrder: Boolean(state.activeOrder),
            };
            socket.emit('resync_complete', completePayload);
            if (typeof ack === 'function') {
              ack(completePayload);
            }
            if (role === 'DELIVERY_PARTNER') {
              logDeliverySocket('Resync complete', {
                socketId: socket.id,
                deliveryPartnerId: String(userId || ''),
                hasActiveOrder: Boolean(state.activeOrder),
              });
            }
          } catch (err) {
            logger.error(`Resync failed for ${role}:${userId} — ${err.message}`);
            if (typeof ack === 'function') {
              ack({ ok: false, error: err.message });
            }
          }
        });

    });

    logger.info('Socket.IO infrastructure initialized');
    return io;
};

/**
 * Returns the initialized Socket.IO instance.
 * @returns {Server | null}
 */
export const getIO = () => {
    if (!io) {
        logger.warn('Socket.IO not initialized');
    }
    return io;
};

export const rooms = roomNames;
