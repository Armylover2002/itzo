import mongoose from 'mongoose';
import { config } from './src/config/env.js';
import { FoodUser } from './src/core/users/user.model.js';

async function test() {
    await mongoose.connect(config.mongodbUri);
    const users = await FoodUser.find({ phone: '8770552411' }).lean();
    console.log(`Found ${users.length} users with phone 8770552411:`);
    users.forEach(u => console.log(`- ID: ${u._id}, Role: ${u.role}, isDeleted: ${u.isDeleted}, isActive: ${u.isActive}`));
    process.exit(0);
}
test().catch(e => { console.error(e); process.exit(1); });
