const mongoose = require('mongoose');

async function test() {
    await mongoose.connect('mongodb://localhost:27017/blaze');
    const db = mongoose.connection.db;
    const foodOrder = await db.collection('foodorders').findOne({ orderId: 'QC78472842' });
    const returnOrder = await db.collection('sellerreturns').findOne({ orderId: 'QC78472842' });
    
    console.log('FoodOrder:', !!foodOrder, foodOrder?.orderType, foodOrder?.tripType, foodOrder?.documentType);
    console.log('SellerReturn:', !!returnOrder, returnOrder?.returnStatus);
    
    process.exit(0);
}

test();
