import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const fetchCoupons = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const coupons = await mongoose.connection.db.collection('quick_coupons').find().toArray();
    console.log(JSON.stringify(coupons, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
};

fetchCoupons();
