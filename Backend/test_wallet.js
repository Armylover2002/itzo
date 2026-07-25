import mongoose from 'mongoose';

async function test() {
  await mongoose.connect('mongodb+srv://powersafeindustries_db_user:GYNNDp6s5oDi8ILY@cluster0.mozt5cr.mongodb.net/itzofood?appName=Cluster0');
  
  const { FoodOrder } = await import('./src/modules/food/orders/models/order.model.js');
  
  const orders = await FoodOrder.find({ 
    orderStatus: 'delivered', 
    'dispatch.deliveryPartnerId': { $exists: true } 
  }).lean();
  
  const pId = orders[0]?.dispatch?.deliveryPartnerId;
  
  if(!pId) {
    console.log('no orders found with delivery partner');
    process.exit(0);
  }
  
  console.log('Found partner ID:', pId);
  
  const { getDeliveryPartnerWalletEnhanced } = await import('./src/modules/food/delivery/services/deliveryFinance.service.js');
  
  try {
    const w = await getDeliveryPartnerWalletEnhanced(pId);
    console.log('SUCCESS');
  } catch(e) {
    console.error('ERROR occurred in getDeliveryPartnerWalletEnhanced:', e);
  }
  process.exit(0);
}

test();
