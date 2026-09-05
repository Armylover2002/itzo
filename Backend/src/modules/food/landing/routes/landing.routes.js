import express from 'express';
import { upload } from '../../../../middleware/upload.js';
import {
    listHeroBannersController,
    uploadHeroBannersController,
    deleteHeroBannerController,
    updateHeroBannerOrderController,
    toggleHeroBannerStatusController,
    updateHeroBannerController
} from '../controllers/heroBanner.controller.js';
import {
    listUnder250BannersController,
    uploadUnder250BannersController,
    deleteUnder250BannerController,
    updateUnder250BannerOrderController,
    toggleUnder250BannerStatusController
} from '../controllers/under250Banner.controller.js';
import {
    getAdminLandingSettingsController,
    updateAdminLandingSettingsController,
    uploadAdminLandingHeaderVideoController,
    deleteAdminLandingHeaderVideoController
} from '../controllers/landingSettings.controller.js';
import {
    listExploreMoreController,
    createExploreMoreController,
    updateExploreMoreController,
    deleteExploreMoreController,
    toggleExploreMoreStatusController,
    updateExploreMoreOrderController
} from '../controllers/exploreIcon.controller.js';
import {
    getPublicHeroBannersController,
    getPublicUnder250BannersController,
    getPublicExploreIconsController,
    getPublicGourmetController,
    getPublicLandingSettingsController
} from '../controllers/publicLanding.controller.js';
import { detectZonePublicController, listZonesPublicController, listZonesNearbyPublicController } from '../controllers/zonePublic.controller.js';
import { getPublicEnvController } from '../controllers/publicEnv.controller.js';
import {
    listGourmetAdmin,
    createGourmetAdmin,
    deleteGourmetAdmin,
    updateGourmetOrderAdmin,
    toggleGourmetStatusAdmin
} from '../controllers/top10GourmetAdmin.controller.js';
import { getPublicPageController } from '../../admin/controllers/pageContent.controller.js';
import { getPublicReferralSettingsController } from '../controllers/publicReferralSettings.controller.js';

const router = express.Router();

// Public CMS pages (About + legal). No auth required.
router.get('/pages/:key', getPublicPageController);
// Public referral settings (no auth required).
router.get('/referral-settings', getPublicReferralSettingsController);

// Public Careers API
import careerRoutes from './career.route.js';
router.use('/careers', careerRoutes);
router.use('/landing/careers', careerRoutes);

// Admin hero banner management (DEV: auth temporarily disabled for faster integration)
router.get('/hero-banners', listHeroBannersController);
router.post(
    '/hero-banners/multiple',
    upload.array('files'),
    uploadHeroBannersController
);
router.delete('/hero-banners/:id', deleteHeroBannerController);
router.patch('/hero-banners/:id/order', updateHeroBannerOrderController);
router.patch('/hero-banners/:id/status', toggleHeroBannerStatusController);
router.patch('/hero-banners/:id', updateHeroBannerController);

// Admin under 250 banners
router.get('/hero-banners/under-250', listUnder250BannersController);
router.post(
    '/hero-banners/under-250/multiple',
    upload.array('files'),
    uploadUnder250BannersController
);
router.delete('/hero-banners/under-250/:id', deleteUnder250BannerController);
router.patch('/hero-banners/under-250/:id/order', updateUnder250BannerOrderController);
router.patch('/hero-banners/under-250/:id/status', toggleUnder250BannerStatusController);

// Admin Explore More (icons)
router.get('/hero-banners/landing/explore-more', listExploreMoreController);
router.post(
    '/hero-banners/landing/explore-more',
    upload.single('image'),
    createExploreMoreController
);
router.delete('/hero-banners/landing/explore-more/:id', deleteExploreMoreController);
router.patch('/hero-banners/landing/explore-more/:id/status', toggleExploreMoreStatusController);
router.patch('/hero-banners/landing/explore-more/:id/order', updateExploreMoreOrderController);
router.patch(
    '/hero-banners/landing/explore-more/:id',
    upload.single('image'),
    updateExploreMoreController
);

// Admin Gourmet (hero-banners)
router.get('/hero-banners/gourmet', listGourmetAdmin);
router.post('/hero-banners/gourmet', createGourmetAdmin);
router.delete('/hero-banners/gourmet/:id', deleteGourmetAdmin);
router.patch('/hero-banners/gourmet/:id/order', updateGourmetOrderAdmin);
router.patch('/hero-banners/gourmet/:id/status', toggleGourmetStatusAdmin);

// Public landing endpoints (Food user app)
router.get('/hero-banners/public', getPublicHeroBannersController);
router.get('/hero-banners/under-250/public', getPublicUnder250BannersController);
router.get('/explore-icons/public', getPublicExploreIconsController);
router.get('/hero-banners/gourmet/public', getPublicGourmetController);
router.get('/landing/settings/public', getPublicLandingSettingsController);
router.get('/zones/detect', detectZonePublicController);
router.get('/zones/nearby', listZonesNearbyPublicController);
router.get('/zones/public', listZonesPublicController);
router.get('/public/env', getPublicEnvController);
// Admin landing settings (old paths used by admin UI)
router.get('/hero-banners/landing/settings', getAdminLandingSettingsController);
router.patch('/hero-banners/landing/settings', updateAdminLandingSettingsController);
router.post('/hero-banners/landing/settings/header-video', upload.single('video'), uploadAdminLandingHeaderVideoController);
router.delete('/hero-banners/landing/settings/header-video', deleteAdminLandingHeaderVideoController);

export default router;

