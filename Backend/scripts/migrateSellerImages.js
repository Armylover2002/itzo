import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { uploadImageBuffer } from '../src/services/cloudinary.service.js';
import { SellerProduct } from '../src/modules/quick-commerce/seller/models/sellerProduct.model.js';
import { Seller } from '../src/modules/quick-commerce/seller/models/seller.model.js';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const BATCH_SIZE = 10;
const DATA_URL_REGEX = /^data:image\/[^;]+;base64,(.+)$/;

async function uploadBase64ToCloudinary(base64DataUrl, folder) {
    if (!base64DataUrl || typeof base64DataUrl !== 'string' || !base64DataUrl.startsWith('data:image/')) {
        return base64DataUrl;
    }
    const match = base64DataUrl.match(DATA_URL_REGEX);
    if (!match || !match[1]) return base64DataUrl;
    
    try {
        const buffer = Buffer.from(match[1], 'base64');
        const url = await uploadImageBuffer(buffer, folder);
        return url;
    } catch (error) {
        console.error(`[Cloudinary Error] Failed to upload image to ${folder}:`, error.message);
        throw error;
    }
}

async function migrateProducts() {
    console.log('--- Starting Products Migration ---');
    const products = await SellerProduct.find({
        $or: [
            { mainImage: { $regex: /^data:image\// } },
            { image: { $regex: /^data:image\// } },
            { galleryImages: { $regex: /^data:image\// } }
        ]
    });

    console.log(`Found ${products.length} products to migrate.`);
    let migratedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
        const batch = products.slice(i, i + BATCH_SIZE);
        const updates = [];

        await Promise.all(batch.map(async (product) => {
            try {
                let updated = false;
                const patch = {};

                if (product.mainImage && product.mainImage.startsWith('data:image/')) {
                    patch.mainImage = await uploadBase64ToCloudinary(product.mainImage, 'quick-commerce/products/main');
                    updated = true;
                }

                if (product.image && product.image.startsWith('data:image/')) {
                    patch.image = await uploadBase64ToCloudinary(product.image, 'quick-commerce/products/main');
                    updated = true;
                }

                if (product.galleryImages && product.galleryImages.length > 0) {
                    const newGallery = [];
                    for (const img of product.galleryImages) {
                        if (img && img.startsWith('data:image/')) {
                            const newUrl = await uploadBase64ToCloudinary(img, 'quick-commerce/products/gallery');
                            newGallery.push(newUrl);
                            updated = true;
                        } else {
                            newGallery.push(img);
                        }
                    }
                    if (updated) patch.galleryImages = newGallery;
                }

                if (updated) {
                    updates.push({
                        updateOne: {
                            filter: { _id: product._id },
                            update: { $set: patch }
                        }
                    });
                }
            } catch (error) {
                console.error(`[Error] Failed migrating product ${product._id}:`, error.message);
                failedCount++;
            }
        }));

        if (updates.length > 0) {
            await SellerProduct.bulkWrite(updates);
            migratedCount += updates.length;
            console.log(`Processed batch ${i / BATCH_SIZE + 1} - Migrated ${migratedCount}/${products.length}`);
        }
    }

    console.log(`--- Products Migration Complete ---`);
    console.log(`Successfully migrated: ${migratedCount}`);
    console.log(`Failed: ${failedCount}`);
}

async function migrateSellers() {
    console.log('\n--- Starting Sellers Migration ---');
    const sellers = await Seller.find({
        $or: [
            { 'bankInfo.upiQrImage': { $regex: /^data:image\// } },
            { 'documents.shopLicenseImage': { $regex: /^data:image\// } }
        ]
    });

    console.log(`Found ${sellers.length} sellers to migrate.`);
    let migratedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < sellers.length; i += BATCH_SIZE) {
        const batch = sellers.slice(i, i + BATCH_SIZE);
        const updates = [];

        await Promise.all(batch.map(async (seller) => {
            try {
                let updated = false;
                const patch = {};

                if (seller.bankInfo?.upiQrImage && seller.bankInfo.upiQrImage.startsWith('data:image/')) {
                    patch['bankInfo.upiQrImage'] = await uploadBase64ToCloudinary(seller.bankInfo.upiQrImage, 'seller/upi-qr');
                    updated = true;
                }

                if (seller.documents?.shopLicenseImage && seller.documents.shopLicenseImage.startsWith('data:image/')) {
                    patch['documents.shopLicenseImage'] = await uploadBase64ToCloudinary(seller.documents.shopLicenseImage, 'seller/shop-license');
                    updated = true;
                }

                if (updated) {
                    updates.push({
                        updateOne: {
                            filter: { _id: seller._id },
                            update: { $set: patch }
                        }
                    });
                }
            } catch (error) {
                console.error(`[Error] Failed migrating seller ${seller._id}:`, error.message);
                failedCount++;
            }
        }));

        if (updates.length > 0) {
            await Seller.bulkWrite(updates);
            migratedCount += updates.length;
            console.log(`Processed batch ${i / BATCH_SIZE + 1} - Migrated ${migratedCount}/${sellers.length}`);
        }
    }

    console.log(`--- Sellers Migration Complete ---`);
    console.log(`Successfully migrated: ${migratedCount}`);
    console.log(`Failed: ${failedCount}`);
}

async function main() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI is not defined in .env');
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB.\n');

        await migrateProducts();
        await migrateSellers();

        console.log('\nMigration script completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
        process.exit(0);
    }
}

main();
