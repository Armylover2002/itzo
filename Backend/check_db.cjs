const mongoose = require('mongoose');

async function checkRestaurant() {
  try {
    await mongoose.connect('mongodb+srv://powersafeindustries_db_user:GYNNDp6s5oDi8ILY@cluster0.mozt5cr.mongodb.net/itzofood?appName=Cluster0', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    const collection = mongoose.connection.collection('foodrestaurants');
    
    // Update the specific restaurant by phone
    const updateResult = await collection.updateMany(
      { primaryPhone: { $regex: /6264715409/ } },
      { $set: { businessType: 'Street Food Vendor' } }
    );
    
    console.log(`Updated ${updateResult.modifiedCount} restaurants by phone to Street Food Vendor.`);
    
    // Also try unconditionally updating all restaurants if there are only a few
    const allCount = await collection.countDocuments({});
    if (updateResult.modifiedCount === 0 && allCount < 10) {
       console.log('Updating all restaurants since there are very few...');
       const r = await collection.updateMany({}, { $set: { businessType: 'Street Food Vendor' } });
       console.log(`Updated all ${r.modifiedCount} restaurants.`);
    }
    

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkRestaurant();
