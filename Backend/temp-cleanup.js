
import { connectDB } from './src/config/db.js';
import mongoose from 'mongoose';
import { DeliveryBonusTransaction } from './src/modules/food/admin/models/deliveryBonusTransaction.model.js';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  try {
    await connectDB();
    const res = await DeliveryBonusTransaction.deleteMany({ transactionId: { $regex: '^ADDON-' } });
    console.log('Deleted:', res.deletedCount);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
run();

