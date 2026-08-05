import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { QuickCategory } from '../src/modules/quick-commerce/models/category.model.js';

// Map to our local, safe fallback images
const imageMap = {
    // Electronics
    'tv-mobiles': '/uploads/general/electronics.jpg',
    'coolers-fans': '/uploads/general/electronics.jpg',
    'electronics': '/uploads/general/electronics.jpg',
    
    // Kids
    'toys': '/uploads/general/toys.jpg',
    'kids-food': '/uploads/general/toys.jpg',
    'kids-essentials': '/uploads/general/toys.jpg',
    'baby-wipes': '/uploads/general/toys.jpg',
    'kids': '/uploads/general/toys.jpg',
    
    // Spices
    'masalas': '/uploads/general/spices.jpg',
    'spices': '/uploads/general/spices.jpg'
};

const defaultImage = '/uploads/general/grocery.jpg';

async function run() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log("Fetching ALL categories...");
        const categories = await QuickCategory.find({});
        
        console.log(`Found ${categories.length} categories to update.`);
        let updatedCount = 0;
        
        for (const cat of categories) {
            // Any external CDN or Unsplash or Itzo logo gets replaced
            if (!cat.image || cat.image.includes('cdn.grofers.com') || cat.image.includes('unsplash.com') || cat.image.includes('itzo-quick-logo.png')) {
                const match = imageMap[cat.slug] || imageMap[cat.name.toLowerCase()] || defaultImage;
                cat.image = match;
                await cat.save();
                updatedCount++;
                console.log(`Updated ${cat.name} (${cat.slug}) -> ${cat.image}`);
            }
        }
        
        console.log(`Migration complete! Successfully updated ${updatedCount} categories.`);
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        process.exit(0);
    }
}

run();
