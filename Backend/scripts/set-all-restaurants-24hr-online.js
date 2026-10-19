import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { FoodRestaurant } from '../src/modules/food/restaurant/models/restaurant.model.js';
import { FoodRestaurantOutletTimings } from '../src/modules/food/restaurant/models/outletTimings.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from Backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const build24HrTimings = () =>
  DAY_NAMES.map((day) => ({
    day,
    isOpen: true,
    openingTime: '00:00',
    closingTime: '23:59',
    shifts: [
      {
        openingTime: '00:00',
        closingTime: '23:59',
      },
    ],
  }));

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in environment variables!');
    process.exit(1);
  }

  console.log(`=======================================================`);
  console.log(`  24-Hour Online Migration Script for Restaurants      `);
  console.log(`  Mode: ${isDryRun ? '🔍 DRY RUN (No changes will be saved)' : '🚀 LIVE EXECUTION'}`);
  console.log(`=======================================================\n`);

  console.log('Connecting to database...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB successfully.\n');

  try {
    // Find all active / non-deleted restaurants
    const filter = { isDeleted: { $ne: true } };
    const restaurants = await FoodRestaurant.find(filter)
      .select('_id restaurantId restaurantName status isAcceptingOrders openDays openingTime closingTime')
      .lean();

    console.log(`Found ${restaurants.length} restaurant(s) to process.\n`);

    if (restaurants.length === 0) {
      console.log('No restaurants found. Exiting.');
      return;
    }

    const twentyFourHrSchedule = build24HrTimings();
    let updatedCount = 0;

    for (const [index, r] of restaurants.entries()) {
      const restName = r.restaurantName || r.restaurantId || String(r._id);
      console.log(
        `[${index + 1}/${restaurants.length}] Processing "${restName}" (_id: ${r._id})...`
      );
      console.log(`   - Previous status: isAcceptingOrders = ${r.isAcceptingOrders}, status = ${r.status}`);
      console.log(`   - Previous openDays: ${JSON.stringify(r.openDays || [])}`);
      console.log(`   - Previous timings: ${r.openingTime || 'N/A'} - ${r.closingTime || 'N/A'}`);

      if (!isDryRun) {
        // 1. Update FoodRestaurant document
        await FoodRestaurant.updateOne(
          { _id: r._id },
          {
            $set: {
              isAcceptingOrders: true,
              openDays: SHORT_DAYS,
              openingTime: '00:00',
              closingTime: '23:59',
            },
            $unset: {
              pendingOpenDays: '',
            },
          }
        );

        // 2. Upsert FoodRestaurantOutletTimings document (all 7 days, 00:00 - 23:59)
        await FoodRestaurantOutletTimings.findOneAndUpdate(
          { restaurantId: r._id },
          {
            $set: {
              restaurantId: r._id,
              timings: twentyFourHrSchedule,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }

      console.log(`   -> Set to: 24/7 ONLINE (Mon-Sun, 00:00 - 23:59, isAcceptingOrders: true) ✅\n`);
      updatedCount++;
    }

    console.log(`=======================================================`);
    if (isDryRun) {
      console.log(`🔍 DRY RUN COMPLETE: ${updatedCount} restaurant(s) would be updated.`);
      console.log(`   (To apply changes, run without the --dry-run flag)`);
    } else {
      console.log(`🎉 COMPLETED: Successfully updated ${updatedCount} restaurant(s) to 24-hr online!`);
    }
    console.log(`=======================================================`);
  } catch (error) {
    console.error('❌ Error updating restaurants:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed.');
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
