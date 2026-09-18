import { useState, useEffect, useRef, useCallback } from 'react';
import axiosInstance from '@core/api/axios';

/**
 * useLocationTracker — Custom hook for field employee GPS tracking.
 * 
 * Features:
 * - Uses navigator.geolocation.watchPosition for continuous tracking
 * - Batches GPS points and sends them periodically to the server
 * - Handles permission denied, GPS disabled, accuracy thresholds
 * - Browser Visibility API integration for battery optimization
 * - Queues points locally when offline, syncs on reconnect
 * - Stops tracking on check-out
 */
export function useLocationTracker({ 
    enabled = false, 
    intervalSeconds = 60,
    accuracyThreshold = 50 
}) {
    const [isTracking, setIsTracking] = useState(false);
    const [error, setError] = useState(null);
    const [lastLocation, setLastLocation] = useState(null);
    const [pointsCount, setPointsCount] = useState(0);

    const watchIdRef = useRef(null);
    const batchRef = useRef([]);
    const intervalRef = useRef(null);
    const mountedRef = useRef(true);

    // Flush batched points to server
    const flushBatch = useCallback(async () => {
        if (batchRef.current.length === 0) return;

        const points = [...batchRef.current];
        batchRef.current = [];

        try {
            await axiosInstance.post('/hrms/location-tracks', { points });
            if (mountedRef.current) {
                setPointsCount(prev => prev + points.length);
            }
        } catch (err) {
            // Re-queue failed points for retry (offline support)
            console.error('Location batch save failed, re-queuing:', err.message);
            batchRef.current = [...points, ...batchRef.current];

            // Store in sessionStorage for recovery after page refresh
            try {
                const queued = JSON.parse(sessionStorage.getItem('hrms_queued_points') || '[]');
                sessionStorage.setItem('hrms_queued_points', JSON.stringify([...queued, ...points]));
            } catch (e) { /* ignore storage errors */ }
        }
    }, []);

    // Flush any queued points from previous sessions
    const flushQueuedPoints = useCallback(async () => {
        try {
            const queued = JSON.parse(sessionStorage.getItem('hrms_queued_points') || '[]');
            if (queued.length > 0) {
                await axiosInstance.post('/hrms/location-tracks', { points: queued });
                sessionStorage.removeItem('hrms_queued_points');
                if (mountedRef.current) {
                    setPointsCount(prev => prev + queued.length);
                }
            }
        } catch (e) {
            console.error('Failed to flush queued points:', e.message);
        }
    }, []);

    // Start tracking
    const startTracking = useCallback(() => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser');
            return;
        }

        setError(null);
        setIsTracking(true);

        // Flush any queued points from previous sessions
        flushQueuedPoints();

        // Watch position
        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy, speed } = position.coords;

                // Skip low-accuracy readings
                if (accuracy > accuracyThreshold) return;

                const point = {
                    latitude,
                    longitude,
                    accuracy: Math.round(accuracy),
                    speed: speed || 0,
                    timestamp: new Date().toISOString()
                };

                batchRef.current.push(point);
                if (mountedRef.current) {
                    setLastLocation(point);
                }
            },
            (err) => {
                if (mountedRef.current) {
                    switch (err.code) {
                        case err.PERMISSION_DENIED:
                            setError('Location permission denied. Please enable GPS.');
                            break;
                        case err.POSITION_UNAVAILABLE:
                            setError('GPS signal unavailable. Please try in an open area.');
                            break;
                        case err.TIMEOUT:
                            setError('GPS request timed out. Retrying...');
                            break;
                        default:
                            setError('Unable to get location');
                    }
                }
            },
            {
                enableHighAccuracy: true,
                maximumAge: 10000,
                timeout: 30000
            }
        );

        // Set up periodic batch flush
        intervalRef.current = setInterval(() => {
            flushBatch();
        }, intervalSeconds * 1000);

    }, [intervalSeconds, accuracyThreshold, flushBatch, flushQueuedPoints]);

    // Stop tracking
    const stopTracking = useCallback(async () => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        // Final flush
        await flushBatch();
        
        if (mountedRef.current) {
            setIsTracking(false);
        }
    }, [flushBatch]);

    // Get current position (one-shot) for check-in/check-out
    const getCurrentPosition = useCallback(() => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: Math.round(position.coords.accuracy)
                    });
                },
                (err) => {
                    let msg = 'Unable to get location';
                    if (err.code === err.PERMISSION_DENIED) msg = 'Location permission denied. Please enable GPS in your browser settings.';
                    if (err.code === err.POSITION_UNAVAILABLE) msg = 'GPS signal unavailable.';
                    if (err.code === err.TIMEOUT) msg = 'GPS request timed out.';
                    reject(new Error(msg));
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
            );
        });
    }, []);

    // Browser Visibility API — pause/resume tracking when tab is hidden/visible
    useEffect(() => {
        if (!enabled || !isTracking) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Tab hidden — flush current batch to save data
                flushBatch();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [enabled, isTracking, flushBatch]);

    // Auto-start/stop based on enabled prop
    useEffect(() => {
        if (enabled && !isTracking) {
            startTracking();
        } else if (!enabled && isTracking) {
            stopTracking();
        }
    }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

    // Cleanup on unmount
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            // Final flush on unmount
            if (batchRef.current.length > 0) {
                const points = [...batchRef.current];
                axiosInstance.post('/hrms/location-tracks', { points }).catch(() => {});
            }
        };
    }, []);

    return {
        isTracking,
        error,
        lastLocation,
        pointsCount,
        startTracking,
        stopTracking,
        getCurrentPosition
    };
}
