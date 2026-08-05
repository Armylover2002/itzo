import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { QuickCategory } from '../src/modules/quick-commerce/models/category.model.js';

// Mapping of common categories to high-quality unsplash/grofers placeholder images
const imageMap = {
    // Electronics
    'tv-mobiles': 'https://images.unsplash.com/photo-1598327105666-5b89351cb315?q=80&w=400&auto=format&fit=crop',
    'coolers-fans': 'https://images.unsplash.com/photo-1616875569476-eb34d310ea09?q=80&w=400&auto=format&fit=crop',
    'electronics': 'https://images.unsplash.com/photo-1498049794561-7780e7231661?q=80&w=400&auto=format&fit=crop',
    
    // Kids
    'toys': 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?q=80&w=400&auto=format&fit=crop',
    'kids-food': 'https://images.unsplash.com/photo-1514068339196-01589d709ad9?q=80&w=400&auto=format&fit=crop',
    'kids-essentials': 'https://images.unsplash.com/photo-1519689680058-324335c77eba?q=80&w=400&auto=format&fit=crop',
    'baby-wipes': 'https://images.unsplash.com/photo-1555252586-7ebfa377f374?q=80&w=400&auto=format&fit=crop',
    'bathing-needs': 'https://images.unsplash.com/photo-1540552726581-228723cb8d23?q=80&w=400&auto=format&fit=crop',
    'health-safety': 'https://images.unsplash.com/photo-1584308666744-24d59ce637be?q=80&w=400&auto=format&fit=crop',
    'kids': 'https://images.unsplash.com/photo-1519689680058-324335c77eba?q=80&w=400&auto=format&fit=crop',
    
    // Wedding
    'bridal': 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=400&auto=format&fit=crop',
    'wedding': 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=400&auto=format&fit=crop',
    
    // Grocery
    'grocery': 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=400&auto=format&fit=crop',
    'dairy': 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?q=80&w=400&auto=format&fit=crop',
    'masalas': 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?q=80&w=400&auto=format&fit=crop',
    'fruitsandvegetables': 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=400&auto=format&fit=crop',
    'aata-dal-rice': 'https://images.unsplash.com/photo-1586201375761-83865001e8ac?q=80&w=400&auto=format&fit=crop',
    
    // Snacks
    'nachos': 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?q=80&w=400&auto=format&fit=crop',
    'namkeen-snacks': 'https://images.unsplash.com/photo-1601000938259-9e92002320b2?q=80&w=400&auto=format&fit=crop',
    'popcorn': 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?q=80&w=400&auto=format&fit=crop',
    'candies-gum': 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?q=80&w=400&auto=format&fit=crop',
    'chocolates': 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?q=80&w=400&auto=format&fit=crop',
    
    // Drinks
    'coffee': 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=400&auto=format&fit=crop',
    'tea': 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?q=80&w=400&auto=format&fit=crop',
    
    // Dessert
    'ice-cream-frozen-dessert': 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?q=80&w=400&auto=format&fit=crop',
    'indian-sweets': 'https://images.unsplash.com/photo-1605197136128-4ce312b9d214?q=80&w=400&auto=format&fit=crop'
};

const defaultImage = 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=400&auto=format&fit=crop';

async function run() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log("Fetching categories with Itzo logo...");
        const categories = await QuickCategory.find({
            $or: [
                { image: "/itzo-quick-logo.png" },
                { image: "itzo-quick-logo.png" },
                { image: "" },
                { image: null },
                { image: { $exists: false } }
            ]
        });
        
        console.log(`Found ${categories.length} categories to update.`);
        let updatedCount = 0;
        
        for (const cat of categories) {
            const match = imageMap[cat.slug] || imageMap[cat.name.toLowerCase()] || defaultImage;
            
            cat.image = match;
            await cat.save();
            updatedCount++;
            console.log(`Updated ${cat.name} (${cat.slug}) -> ${match}`);
        }
        
        console.log(`Migration complete! Successfully updated ${updatedCount} categories.`);
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        process.exit(0);
    }
}

run();
