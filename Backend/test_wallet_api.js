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
    { userId: partner._id, role: 'DELIVERY_PARTNER' },
    process.env.JWT_ACCESS_SECRET || 'ndjdhjhdasdjdhasdjadaskdjasndaskdjadasndaskdjsndaskdjasdkasnddjkdndkjdnda',
    { expiresIn: '1d' }
  );

  console.log(`Making request for partner ${partner._id}...`);
  try {
    const endpoints = [
      '/api/v1/food/delivery/wallet',
      '/api/v1/food/delivery/profile',
      '/api/v1/food/delivery/earnings?period=week',
      '/api/v1/food/delivery/cash-limit'
    ];

    for (const ep of endpoints) {
      console.log(`\nTesting ${ep}...`);
      const start = Date.now();
      const response = await fetch(`http://localhost:5000${ep}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      console.log(`Status: ${response.status}`);
      console.log(`Time taken: ${Date.now() - start}ms`);
      if (response.status !== 200) {
        console.log(`Response:`, JSON.stringify(data));
      } else {
        console.log(`SUCCESS`);
      }
    }
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
  
  process.exit(0);
}

test();
