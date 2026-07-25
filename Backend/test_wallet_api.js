import 'dotenv/config';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

async function test() {
  await mongoose.connect('mongodb+srv://powersafeindustries_db_user:GYNNDp6s5oDi8ILY@cluster0.mozt5cr.mongodb.net/itzofood?appName=Cluster0');
  
  const { FoodDeliveryPartner } = await import('./src/modules/food/delivery/models/deliveryPartner.model.js');
  const partner = await FoodDeliveryPartner.findOne({}).lean();
  
  if (!partner) {
    console.log('No partner found');
    process.exit(1);
  }

  // Generate token
  const token = jwt.sign(
    { userId: partner._id, role: 'DELIVERY' },
    process.env.ACCESS_TOKEN_SECRET || 'itzo_secret_key_2024_secure_@123',
    { expiresIn: '1d' }
  );

  console.log(`Making request for partner ${partner._id}...`);
  const startTime = Date.now();

  try {
    const res = await fetch('http://localhost:5000/api/v1/food/delivery/wallet', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const timeTaken = Date.now() - startTime;
    console.log(`Status: ${res.status}`);
    console.log(`Time taken: ${timeTaken}ms`);
    
    const text = await res.text();
    console.log('Response:', text.substring(0, 500));
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
  
  process.exit(0);
}

test();
