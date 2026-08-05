import dotenv from 'dotenv';
import mongoose from 'mongoose';
import https from 'https';

dotenv.config();

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const collections = await db.collections();
    
    let urlToTest = null;
    for (const coll of collections) {
        const docs = await coll.find().toArray();
        const str = JSON.stringify(docs);
        const match = str.match(/(https:\/\/res\.cloudinary\.com\/dm6dbsbfx\/[^"']+)/);
        if (match) {
            urlToTest = match[1];
            break;
        }
    }

    if (urlToTest) {
        console.log('Testing URL:', urlToTest);
        https.get(urlToTest, (res) => {
            console.log('Status code:', res.statusCode);
        }).on('error', console.error);
    } else {
        console.log('No dm6dbsbfx URL found.');
    }

    await mongoose.disconnect();
}

run();
