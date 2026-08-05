import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { QuickCategory } from '../src/modules/quick-commerce/models/category.model.js';

// Extremely safe fallback images from Grofers CDN or solid unsplash links
const imageMap = {
    // Electronics
    'tv-mobiles': 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png',
    'coolers-fans': 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png',
    'electronics': 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png',
    
    // Kids
    'toys': 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png',
    'kids-food': 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png',
    'kids-essentials': 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png',
    'baby-wipes': 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png',
    'kids': 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png',
    
    // Wedding
    'bridal': 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png',
    'wedding': 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png',
    
    // Grocery
    'grocery': 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png',
    'dairy': 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout_item/2022-09/44910.png',
    'masalas': 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png',
    'fruitsandvegetables': 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout_item/2022-09/44889.png',
    'aata-dal-rice': 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout_item/2022-11/44889.png',
    
    // Drinks
    'coffee': 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout_item/2023-01/44907.png',
    'tea': 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout_item/2023-01/44907.png',
};

const defaultImage = 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png';

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
        
        console.log("Fetching ALL categories...");
        const categories = await QuickCategory.find({});
        
        console.log(`Found ${categories.length} categories to verify.`);
        let updatedCount = 0;
        
        for (const cat of categories) {
            // Check if current image is broken or itzo logo or empty
            let isBroken = false;
            if (!cat.image || cat.image.includes('itzo-quick-logo.png')) {
                isBroken = true;
            } else {
                const ok = await verifyImage(cat.image);
                if (!ok) isBroken = true;
            }
            
            if (isBroken) {
                const match = imageMap[cat.slug] || imageMap[cat.name.toLowerCase()] || defaultImage;
                const matchOk = await verifyImage(match);
                cat.image = matchOk ? match : defaultImage;
                
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
