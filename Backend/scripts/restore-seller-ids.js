import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { QuickProduct } from '../src/modules/quick-commerce/models/product.model.js';
import { SellerProduct } from '../src/modules/quick-commerce/seller/models/sellerProduct.model.js';
import { connectDB } from '../src/config/db.js';

const restoreSellerIds = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB. Starting migration...');

    // Find all QuickProducts that do not have a valid sellerId
    const missingSellerIdProducts = await QuickProduct.find({
      $or: [
        { sellerId: { $exists: false } },
        { sellerId: null }
      ]
    });

    console.log(`Found ${missingSellerIdProducts.length} QuickProducts missing sellerId.`);

    let successfullyRestored = 0;
    let failedOrSkipped = 0;
    let ambiguousMatches = 0;
    let alreadyValid = await QuickProduct.countDocuments({ sellerId: { $exists: true, $ne: null } });

    for (const product of missingSellerIdProducts) {
      // Find matching seller products by SKU (primary) or Slug/Name
      const queries = [];
      if (product.sku) {
        queries.push({ sku: product.sku });
      }
      if (product.slug) {
        queries.push({ slug: product.slug });
      }
      queries.push({ name: product.name });

      let matchedSellerProduct = null;
      let matchedCount = 0;

      for (const query of queries) {
        const matches = await SellerProduct.find(query);
        if (matches.length === 1) {
          matchedSellerProduct = matches[0];
          matchedCount = 1;
          break;
        } else if (matches.length > 1) {
          matchedCount = matches.length;
          break; // Stop at first ambiguous match
        }
      }

      if (matchedCount === 1 && matchedSellerProduct) {
        product.sellerId = matchedSellerProduct.sellerId;
        await product.save();
        successfullyRestored++;
        console.log(`[RESTORED] ${product.name} (ID: ${product._id}) -> Seller ID: ${product.sellerId}`);
      } else if (matchedCount > 1) {
        ambiguousMatches++;
        failedOrSkipped++;
        console.log(`[AMBIGUOUS] ${product.name} (ID: ${product._id}) - Found ${matchedCount} possible SellerProducts. Skipping.`);
      } else {
        failedOrSkipped++;
        console.log(`[NOT FOUND] ${product.name} (ID: ${product._id}) - No matching SellerProduct found. Skipping.`);
      }
    }

    console.log('\n--- Migration Report ---');
    console.log(`Total Products Scanned (Missing sellerId): ${missingSellerIdProducts.length}`);
    console.log(`Successfully Restored: ${successfullyRestored}`);
    console.log(`Failed / Skipped: ${failedOrSkipped}`);
    console.log(`Ambiguous Matches: ${ambiguousMatches}`);
    console.log(`Existing valid sellerId preserved: ${alreadyValid}`);
    console.log('------------------------\n');

    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

restoreSellerIds();
