import mongoose from 'mongoose';

async function test() {
  mongoose.set('debug', true);
  await mongoose.connect('mongodb+srv://powersafeindustries_db_user:GYNNDp6s5oDi8ILY@cluster0.mozt5cr.mongodb.net/itzofood?appName=Cluster0', { autoIndex: false });
  
  const { FoodOrder } = await import('./src/modules/food/orders/models/order.model.js');
  
  const orders = await FoodOrder.find({ 
    orderStatus: 'delivered', 
    'dispatch.deliveryPartnerId': { $exists: true } 
  }).limit(1).lean();
  
  const pId = orders[0]?.dispatch?.deliveryPartnerId;
  console.log('Testing with partner ID:', pId);
  
  if(!pId) {
    console.log('no orders found with delivery partner');
    process.exit(0);
  }
  
  console.log('Found partner ID:', pId);
  
  const { getDeliveryPartnerWalletEnhanced } = await import('./src/modules/food/delivery/services/deliveryFinance.service.js');
  
  try {
    console.log('Calling getDeliveryPartnerWalletEnhanced...');
    console.time('walletAPI');
    try {
      const res = await getDeliveryPartnerWalletEnhanced(pId);
      console.timeEnd('walletAPI');
      console.log('SUCCESS');
    } catch (e) {
      console.timeEnd('walletAPI');
      console.log('ERROR occurred in getDeliveryPartnerWalletEnhanced:', e);
    }
  } catch(e) {
    console.error('ERROR occurred in getDeliveryPartnerWalletEnhanced:', e);
  }
  process.exit(0);
}

test();
