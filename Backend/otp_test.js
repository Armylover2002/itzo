import mongoose from 'mongoose';
import { config } from './src/config/env.js';
import { createOrUpdateOtp, verifyOtp } from './src/core/otp/otp.service.js';
import { FoodOtp } from './src/core/otp/otp.model.js';

async function test() {
    await mongoose.connect(config.mongodbUri);
    console.log("Connected to MongoDB.");
    
    const phone = "8770552411";
    
    // 1. Simulate requestUserOtp
    console.log("Creating OTP...");
    const otp = await createOrUpdateOtp(phone);
    console.log("Generated OTP:", otp);
    
    // 2. Check DB
    const otps = await FoodOtp.find({ phone: phone }).lean();
    console.log('OTPs in DB right after creation:', otps);
    
    // 3. Simulate verifyUserOtp
    console.log("Verifying OTP...");
    const res = await verifyOtp(phone, otp, { keepOnSuccess: true });
    console.log('Verify Result:', res);
    
    // 4. Cleanup
    await FoodOtp.deleteMany({ phone });
    console.log("Cleaned up.");
    
    process.exit(0);
}
test().catch(e => { console.error(e); process.exit(1); });
