import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

async function fixEmptyCategories() {
    try {
        if (!process.env.MONGODB_URI) {
            console.error("MONGODB_URI not found in .env");
            return;
        }

        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected.");

        const db = mongoose.connection.db;
        const collection = db.collection('food_categories');

        const result = await collection.updateMany(
            { $or: [{ image: "" }, { image: null }, { image: { $exists: false } }] },
            { $set: { image: "/itzo-quick-logo.png" } }
        );

        console.log(`Updated ${result.modifiedCount} categories with empty/null images.`);

    } catch (error) {
        console.error("Error updating categories:", error);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected.");
    }
}

fixEmptyCategories();
