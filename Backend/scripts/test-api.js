import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const testApi = async () => {
  try {
    const token = jwt.sign(
      { id: '69f63354b9f4b447ebc8f35d', role: 'SELLER' },
      'ndjdhjhdasdjdhasdjadaskdjasndaskdjadasndaskdjsndaskdjasdkasnddjkdndkjdnda'
    );
    console.log('Token:', token);

    const res = await fetch('http://localhost:5000/api/v1/seller/orders', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);

    process.exit(0);
  } catch (err) {
    console.error('API Test Error:', err);
    process.exit(1);
  }
};

testApi();
