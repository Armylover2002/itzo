import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { QuickProduct } from '../src/modules/quick-commerce/models/product.model.js';

// Extremely safe fallback product images from local uploads
const defaultProductImage = '/uploads/general/grocery.jpg';
const spiceProductImage = '/uploads/general/spices.jpg';
const electronicsProductImage = '/uploads/general/electronics.jpg';

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
            
            // Determine best local image
            let match = defaultProductImage;
            const name = product.name.toLowerCase();
            const slug = product.slug.toLowerCase();
            if (name.includes('cumin') || name.includes('tattva') || name.includes('cardamom') || name.includes('chilli') || name.includes('saunf') || name.includes('masala')) {
                match = spiceProductImage;
            } else if (name.includes('tv') || name.includes('mobile')) {
                match = electronicsProductImage;
            }
            
            // Check mainImage
            if (!product.mainImage || product.mainImage.includes('itzo-quick-logo.png') || product.mainImage.includes('cdn.grofers.com') || product.mainImage.includes('unsplash.com')) {
                updates.mainImage = match;
                needsUpdate = true;
            }

            // Check image
            if (!product.image || product.image.includes('itzo-quick-logo.png') || product.image.includes('cdn.grofers.com') || product.image.includes('unsplash.com')) {
                updates.image = match;
                needsUpdate = true;
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
