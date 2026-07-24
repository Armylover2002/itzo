import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { QuickProduct } from '../src/modules/quick-commerce/models/product.model.js';
import { connectDB } from '../src/config/db.js';

const testSchema = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB. Starting test...');

    // 1. Create a dummy product with a sellerId
    const dummySellerId = new mongoose.Types.ObjectId();
    const dummyCategoryId = new mongoose.Types.ObjectId();
    const product = new QuickProduct({
      name: 'Test Product ' + Date.now(),
      slug: 'test-product-' + Date.now(),
      categoryId: dummyCategoryId,
      price: 100,
      mrp: 120,
      sellerId: dummySellerId
    });

    await product.save();
    console.log('Created product with sellerId:', product.sellerId);

    // 2. Fetch the product from DB
    const fetchedProduct = await QuickProduct.findById(product._id);
    console.log('Fetched product sellerId:', fetchedProduct.sellerId);
    
    if (fetchedProduct.sellerId.toString() !== dummySellerId.toString()) {
      throw new Error('SellerId was not saved!');
    }

    // 3. Update the product
    fetchedProduct.price = 90;
    await fetchedProduct.save();

    // 4. Fetch again and verify
    const updatedProduct = await QuickProduct.findById(product._id).lean();
    console.log('Updated product sellerId:', updatedProduct.sellerId);

    if (updatedProduct.sellerId.toString() !== dummySellerId.toString()) {
      throw new Error('SellerId was stripped during update!');
    }

    console.log('✅ TEST PASSED: sellerId is preserved during creation and updates.');

    // Cleanup
    await QuickProduct.findByIdAndDelete(product._id);
    
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
};

testSchema();
