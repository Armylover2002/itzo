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
  
  console.log('Calling getDeliveryPartnerEarnings...');
  const { getDeliveryPartnerEarnings } = await import('./src/modules/food/delivery/services/delivery.service.js');
  console.time('earningsAPI');
  try {
    const res = await getDeliveryPartnerEarnings(pId, { period: 'week' });
    console.timeEnd('earningsAPI');
    console.log('SUCCESS');
  } catch (e) {
    console.timeEnd('earningsAPI');
    console.log('ERROR', e);
  }
  console.log('Calling getProfileController...');
  console.time('profileAPI');
  try {
    const { FoodDeliveryPartner } = await import('./src/modules/food/delivery/models/deliveryPartner.model.js');
    await FoodDeliveryPartner.findById(pId).lean();
    console.timeEnd('profileAPI');
  } catch (e) {
    console.timeEnd('profileAPI');
  }

  console.log('Calling getActiveEarningAddonsForPartner...');
  const { getActiveEarningAddonsForPartner } = await import('./src/modules/food/delivery/services/delivery.service.js');
  console.time('addonsAPI');
  try {
    await getActiveEarningAddonsForPartner(pId);
    console.timeEnd('addonsAPI');
  } catch (e) {
    console.timeEnd('addonsAPI');
  }
  process.exit(0);
}

test();
