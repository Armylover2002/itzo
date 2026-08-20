import mongoose from 'mongoose';
import { config } from './src/config/env.js';
import { FoodOtp } from './src/core/otp/otp.model.js';
import { FoodUser } from './src/core/users/user.model.js';

async function test() {
    await mongoose.connect(config.mongodbUri);
    console.log("Connected to MongoDB.");
    const otps = await FoodOtp.find({ phone: /8770552411/ }).lean();
    const user = await FoodUser.findOne({ phone: /8770552411/ }).lean();
    console.log('OTPs:', otps);
    console.log('User:', user);
    process.exit(0);
}
test().catch(e => { console.error(e); process.exit(1); });
