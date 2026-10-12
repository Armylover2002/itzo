import mongoose from 'mongoose';
import { getRestaurantAvailabilityStatus } from 'file:///c:/itzo/Frontend/src/modules/Food/utils/restaurantAvailability.js';

const MONGODB_URI = 'mongodb+srv://powersafeindustries_db_user:GYNNDp6s5oDi8ILY@cluster0.mozt5cr.mongodb.net/itzonewdb?appName=Cluster0';

async function check() {
  await mongoose.connect(MONGODB_URI);
  const schema = new mongoose.Schema({}, { strict: false });
  const FoodRestaurant = mongoose.model('FoodRestaurant', schema, 'food_restaurants');
  const FoodRestaurantOutletTimings = mongoose.model('FoodRestaurantOutletTimings', schema, 'food_restaurant_outlet_timings');

  const now = new Date();
  console.log(`Current Local Time: ${now.toString()}`);

  const docs = await FoodRestaurantOutletTimings.find({}).lean();
  for (const doc of docs) {
    const r = await FoodRestaurant.findById(doc.restaurantId).select('restaurantName name isAcceptingOrders isActive').lean();
    if (!r) continue;
    r.outletTimings = doc.timings;
    const status = getRestaurantAvailabilityStatus(r, now);
    const wednesdayTiming = (doc.timings || []).find(t => t.day === 'Wednesday');
    
    console.log(`\nRestaurant: "${r.restaurantName || r.name}"`);
    console.log(`- isAcceptingOrders: ${r.isAcceptingOrders}`);
    console.log(`- Wednesday Shift:`, JSON.stringify(wednesdayTiming?.shifts || []));
    console.log(`- Status -> isOpen: ${status.isOpen} | isWithinTimings: ${status.isWithinTimings} | reason: ${status.reason}`);
  }

  await mongoose.disconnect();
}

check().catch(console.error);
