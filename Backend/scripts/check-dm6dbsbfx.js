import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const collections = await db.collections();
    const occurrences = [];
    
    for (const coll of collections) {
        const docs = await coll.find().toArray();
        const str = JSON.stringify(docs);
        const matches = str.match(/res\.cloudinary\.com\/dm6dbsbfx\/[^"']+/g);
        if (matches) {
            occurrences.push({ 
                coll: coll.collectionName, 
                count: matches.length, 
                samples: matches.slice(0, 3) 
            });
        }
    }
    
    console.log(JSON.stringify(occurrences, null, 2));
    await mongoose.disconnect();
}

run();
