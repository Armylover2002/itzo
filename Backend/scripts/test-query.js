import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { QuickOrder } from '../src/modules/quick-commerce/models/order.model.js';
import { connectDB } from '../src/config/db.js';

const checkQuery = async () => {
  try {
    await connectDB();
    const sellerKey = '69f63354b9f4b447ebc8f35d';
    
    // 1. Find ANY order with this sourceId
    const all = await QuickOrder.find().lean();
    console.log('Total QuickOrders:', all.length);
    let foundSourceId = null;
    for (const o of all) {
        if (o.items) {
           for (const item of o.items) {
               if (String(item.sourceId) === sellerKey) {
                   foundSourceId = item.sourceId;
                   console.log(`Found matching item in order ${o.orderId}. Type: typeof item.sourceId is ${typeof item.sourceId}, isObjectId: ${mongoose.isValidObjectId(item.sourceId)}`);
                   break;
               }
           }
        }
    }

    // 2. Test exact query
    const parentQuery = {
      items: { $elemMatch: { sourceId: sellerKey, type: "quick" } }
    };
    console.log('Testing query with sellerKey (String):', JSON.stringify(parentQuery));
    const results = await QuickOrder.find(parentQuery).lean();
    console.log(`String query results: ${results.length}`);

    // 3. Test exact query with ObjectId
    const objectIdQuery = {
      items: { $elemMatch: { sourceId: new mongoose.Types.ObjectId(sellerKey), type: "quick" } }
    };
    const objectIdResults = await QuickOrder.find(objectIdQuery).lean();
    console.log(`ObjectId query results: ${objectIdResults.length}`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
checkQuery();
