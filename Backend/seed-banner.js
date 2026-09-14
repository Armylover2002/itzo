import fs from 'fs';
import mongoose from 'mongoose';
import { FoodHeroBanner } from './src/modules/food/landing/models/heroBanner.model.js';
import { uploadImageBufferDetailed } from './src/services/cloudinary.service.js';
import dotenv from 'dotenv';

// Load env vars
dotenv.config();

const run = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log('Reading image file...');
        const buffer = fs.readFileSync('C:/Users/trish/.gemini/antigravity-ide/brain/935743b2-6833-4bad-b230-eabcc536d1c1/media__1784793733767.jpg');
        
        console.log('Uploading to Cloudinary...');
        const uploadResult = await uploadImageBufferDetailed(buffer, 'food/hero-banners');
        
        console.log('Saving to database...');
        const count = await FoodHeroBanner.countDocuments();
        
        await FoodHeroBanner.create({
            imageUrl: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            title: 'Indian Food Offer',
            ctaText: 'Order Now',
            sortOrder: count,
            isActive: true
        });
        
        console.log('Successfully seeded Indian food banner!');
        process.exit(0);
    } catch(e) {
        console.error('Error seeding banner:', e);
        process.exit(1);
    }
}

run();
