import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://powersafeindustries_db_user:GYNNDp6s5oDi8ILY@cluster0.mozt5cr.mongodb.net/itzofood?appName=Cluster0');
  const { FoodAdmin } = await import('./src/core/admin/admin.model.js');
  const admin = await FoodAdmin.findOne();
  
  const token = jwt.sign(
    { id: admin._id, role: 'admin' },
    process.env.JWT_SECRET || 'ndjdhjhdasdjdhasdjadaskdjasndaskdjadasndaskdjsndaskdjasdkasnddjkdndkjdnda',
    { expiresIn: '1d' }
  );

  const { FoodDeliveryCashLimit } = await import('./src/modules/food/admin/models/deliveryCashLimit.model.js');
  try {
    const doc = new FoodDeliveryCashLimit({ deliveryCashLimit: NaN });
    await doc.validate();
    console.log('Validation passed for NaN');
  } catch(e) {
    console.log('Validation failed for NaN:', e.message);
  }
  process.exit(0);
}
test();
