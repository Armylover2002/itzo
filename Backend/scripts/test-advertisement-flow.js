import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { FoodRestaurant } from '../src/modules/food/restaurant/models/restaurant.model.js';
import { FoodAdvertisement } from '../src/modules/food/admin/models/advertisement.model.js';
import {
    createRestaurantAdvertisement,
    listRestaurantAdvertisements,
    listAdminAdvertisementRequests,
} from '../src/modules/food/restaurant/services/advertisement.service.js';

const TINY_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
);

async function main() {
    if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI missing');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const restaurant = await FoodRestaurant.findOne({
        status: 'approved',
        isDeleted: { $ne: true },
        isActive: { $ne: false },
    })
        .select('_id restaurantName status')
        .lean();

    if (!restaurant) {
        console.error('No approved restaurant found for test');
        process.exit(1);
    }

    const restaurantId = String(restaurant._id);
    console.log('Using restaurant:', restaurantId, restaurant.restaurantName);

    const beforeCount = await FoodAdvertisement.countDocuments({ restaurantId });
    console.log('Ads before:', beforeCount);

    const created = await createRestaurantAdvertisement(
        restaurantId,
        {
            title: 'E2E Test Ad',
            adsType: 'Image Promotion',
            validity: '2026-08-01 to 2026-08-31',
            description: 'Automated test',
        },
        {
            image: [{ buffer: TINY_PNG, originalname: 'test.png', mimetype: 'image/png' }],
        }
    );

    console.log('Created ad:', {
        id: created.id,
        adsId: created.adsId,
        status: created.status,
        lifecycleStatus: created.lifecycleStatus,
        requestType: created.requestType,
    });

    const list = await listRestaurantAdvertisements(restaurantId);
    const found = list.find((ad) => ad.adsId === created.adsId);
    console.log('Listed in restaurant view:', Boolean(found), found?.status);

    const requests = await listAdminAdvertisementRequests();
    const inQueue = requests.find((r) => r.adsId === created.adsId);
    console.log('Visible in admin requests:', Boolean(inQueue), inQueue?.status);

    await FoodAdvertisement.deleteOne({ _id: created._id });
    console.log('Cleaned up test ad');

    await mongoose.disconnect();
    console.log('PASS: advertisement creation flow works');
}

main().catch((err) => {
    console.error('FAIL:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
});
