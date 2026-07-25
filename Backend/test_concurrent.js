import mongoose from 'mongoose';
import { getDeliveryPartnerWalletEnhanced } from './src/modules/food/delivery/services/deliveryFinance.service.js';

async function test() {
  mongoose.set('debug', true);
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
  
  try {
    const [w1, w2] = await Promise.allSettled([
      getDeliveryPartnerWalletEnhanced(pId),
      getDeliveryPartnerWalletEnhanced(pId)
    ]);
    console.log('Call 1:', w1.status, w1.reason?.message || 'Success');
    console.log('Call 2:', w2.status, w2.reason?.message || 'Success');
  } catch(e) {
    console.error('ERROR:', e);
  }
  process.exit(0);
}

test();
