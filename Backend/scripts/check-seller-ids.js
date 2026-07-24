import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { QuickProduct } from '../src/modules/quick-commerce/models/product.model.js';
import { connectDB } from '../src/config/db.js';

const checkSellerIds = async () => {
  try {
    await connectDB();
    const products = await QuickProduct.find().lean();
    console.log(`Total QuickProducts: ${products.length}`);
    
    let valid = 0, nulls = 0, undefineds = 0, emptyStrings = 0, others = 0;
    for (const p of products) {
      if (p.sellerId === null) nulls++;
      else if (p.sellerId === undefined) undefineds++;
      else if (p.sellerId === "") emptyStrings++;
      else if (mongoose.isValidObjectId(p.sellerId)) valid++;
      else others++;
    }
    
    console.log(`Valid: ${valid}`);
    console.log(`Nulls: ${nulls}`);
    console.log(`Undefineds: ${undefineds}`);
    console.log(`Empty strings: ${emptyStrings}`);
    console.log(`Others: ${others}`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
checkSellerIds();
