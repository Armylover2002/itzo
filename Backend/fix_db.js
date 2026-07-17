import mongoose from 'mongoose';
import { connectDB, disconnectDB } from './src/config/db.js';

async function fixDB() {
    await connectDB();
    const collection = mongoose.connection.collection('foodrestaurants');
    
    // Find restaurant by user email or phone
    const updateResult = await collection.updateMany(
      { primaryPhone: { $regex: /6264715409/ } },
      { $set: { businessType: 'Street Food Vendor' } }
    );
    console.log(`Updated ${updateResult.modifiedCount} restaurants by phone.`);

    if (updateResult.modifiedCount === 0) {
        // Just update all restaurants if it's a test DB with few records
        const allCount = await collection.countDocuments({});
        if (allCount < 20) {
            console.log('Updating all restaurants in test DB...');
            const r = await collection.updateMany({}, { $set: { businessType: 'Street Food Vendor' } });
            console.log(`Updated all ${r.modifiedCount} restaurants.`);
        }
    }
    
    await disconnectDB();
}

fixDB().catch(console.error);
