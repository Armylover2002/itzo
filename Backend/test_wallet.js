import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://powersafeindustries_db_user:GYNNDp6s5oDi8ILY@cluster0.mozt5cr.mongodb.net/itzofood?appName=Cluster0');
  
  const { FoodDeliveryPartner } = await import('./src/modules/food/delivery/models/deliveryPartner.model.js');
  const { FoodOrder } = await import('./src/modules/food/orders/models/order.model.js');
  
  const order = await FoodOrder.findOne({ "dispatch.deliveryPartnerId": { $exists: true }, orderStatus: "delivered" }).lean();
  
  if (!order) {
    console.error('No delivered order found');
    process.exit(1);
  }
  
  const partnerId = order.dispatch.deliveryPartnerId;
  const { Transaction } = await import('./src/core/payments/transaction.model.js');
  const debits = await Transaction.find({ entityId: partnerId, type: 'debit' }).lean();
  console.log('Debits:', JSON.stringify(debits, null, 2));
  
  const { FoodDeliveryWallet } = await import('./src/modules/food/delivery/models/deliveryWallet.model.js');
  console.log('Raw Wallet:', JSON.stringify(rawWallet, null, 2));
  
  process.exit(0);
}
test();
