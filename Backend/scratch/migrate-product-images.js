import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { QuickProduct } from '../src/modules/quick-commerce/models/product.model.js';

// Extremely safe fallback product images from Grofers CDN
const defaultProductImage = 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png';

async function verifyImage(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.status === 200;
    } catch {
        return false;
    }
}

async function run() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log("Fetching ALL products...");
        const products = await QuickProduct.find({});
        
        console.log(`Found ${products.length} products to verify.`);
        let updatedCount = 0;
        
        for (const product of products) {
            let needsUpdate = false;
            let updates = {};
            
            // Check mainImage
            if (!product.mainImage || product.mainImage.includes('itzo-quick-logo.png')) {
                updates.mainImage = defaultProductImage;
                needsUpdate = true;
            } else {
                const ok = await verifyImage(product.mainImage);
                if (!ok) {
                    updates.mainImage = defaultProductImage;
                    needsUpdate = true;
                }
            }

            // Check image
            if (!product.image || product.image.includes('itzo-quick-logo.png')) {
                updates.image = defaultProductImage;
                needsUpdate = true;
            } else {
                const ok = await verifyImage(product.image);
                if (!ok) {
                    updates.image = defaultProductImage;
                    needsUpdate = true;
                }
            }
            
            if (needsUpdate) {
                await QuickProduct.updateOne({ _id: product._id }, { $set: updates });
                updatedCount++;
                console.log(`Updated product: ${product.name} (${product.slug})`);
            }
        }
        
        console.log(`Product Migration complete! Successfully updated ${updatedCount} products.`);
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        process.exit(0);
    }
}

run();
