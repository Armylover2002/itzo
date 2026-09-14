import express from 'express';
import { mapsRateLimiter, requireMapsApiAccess } from '../../../middleware/rateLimit.js';
import { optionalAuthMiddleware } from '../../../core/auth/auth.middleware.js';
import { getDistance, getDistancesBatch, reverseGeocode } from '../controllers/maps.controller.js';

const router = express.Router();

router.use(mapsRateLimiter);
router.use(optionalAuthMiddleware);
router.use(requireMapsApiAccess);

router.get('/distance', getDistance);
router.post('/distance/batch', getDistancesBatch);
router.get('/reverse-geocode', reverseGeocode);

export default router;
