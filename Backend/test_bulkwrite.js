import mongoose from 'mongoose';

async function test() {
  await mongoose.connect('mongodb+srv://powersafeindustries_db_user:GYNNDp6s5oDi8ILY@cluster0.mozt5cr.mongodb.net/itzofood?appName=Cluster0');
  const { Transaction } = await import('./src/core/payments/models/transaction.model.js');

  const txn = {
    entityType: 'deliveryBoy',
    entityId: new mongoose.Types.ObjectId(),
    type: 'credit',
    amount: 100,
    description: `Test`,
    category: 'delivery_earning',
    orderId: 'test_order_1',
    metadata: {}
  };

  const bulkTxnOps = [{
    updateOne: {
      filter: { 
        entityType: txn.entityType,
        entityId: txn.entityId,
        orderId: txn.orderId,
        category: txn.category
      },
      update: { $setOnInsert: txn },
      upsert: true
    }
  }];

  try {
    await Transaction.bulkWrite(bulkTxnOps, { ordered: false });
    console.log('SUCCESS');
  } catch (e) {
    console.error('ERROR:', e.message);
  }
  process.exit(0);
}

test();
