const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/itzo')
  .then(() => mongoose.connection.collection('quick_return_requests').find({}).sort({createdAt: -1}).limit(1).toArray())
  .then(async (reqs) => {
    const req = reqs[0];
    console.log('RETURN REQ:', req._id);
    console.log('RETURN REQ ORDER ID:', req.orderMongoId);
    if (req.orderMongoId) {
       const order = await mongoose.connection.collection('food_orders').findOne({_id: req.orderMongoId});
       console.log('ORDER DELIVERY ADDRESS:', JSON.stringify(order?.deliveryAddress, null, 2));
    }
    process.exit(0);
  }).catch(console.error);
