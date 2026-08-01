const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/itzo')
  .then(async () => {
    try {
      const leg = await mongoose.connection.collection('quick_seller_returns').findOne({});
      if (leg) {
          console.log('LEG:', leg);
          const order = await mongoose.connection.collection('food_orders').findOne({ orderId: leg.orderId });
          console.log('ORDER:', order);
      }
      process.exit(0);
    } catch (e) { console.error(e); process.exit(1); }
  });
