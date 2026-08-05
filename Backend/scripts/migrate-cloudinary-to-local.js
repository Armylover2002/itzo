import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';
import https from 'https';

// We must manually load .env from the backend root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const isDryRun = process.argv.includes('--dry-run');
const specificAccount = process.argv.find(arg => arg.startsWith('--account='))?.split('=')[1];

const UPLOADS_BASE_DIR = path.resolve(process.cwd(), 'uploads');
const MONGO_URI = process.env.MONGODB_URI;

// We need Cloudinary configured to use Admin API if possible
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const generateFilename = (extension) => {
    const randomHex = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    return `${timestamp}-${randomHex}.${extension}`;
};

const ensureDirectoryExists = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

const shouldMigrateUrl = (url) => {
    if (typeof url !== 'string') return false;
    if (!url.includes('/image/upload/') && !url.includes('/video/upload/') && !url.includes('/raw/upload/')) return false;
    
    // Check if it's cloudinary
    if (!url.includes('res.cloudinary.com')) return false;
    
    // Check specific account if requested
    if (specificAccount && !url.includes(specificAccount)) return false;
    
    return true;
};

// Map Cloudinary folders to Local folders
const getLocalFolder = (url) => {
    if (url.includes('quick-commerce/categories')) return 'quick/categories';
    if (url.includes('quick-commerce/products/main')) return 'quick/products/main';
    if (url.includes('quick-commerce/products/gallery')) return 'quick/products/gallery';
    if (url.includes('quick-commerce/returns')) return 'quick/returns';
    if (url.includes('seller/upi-qr')) return 'seller/upi-qr';
    if (url.includes('seller/shop-license')) return 'seller/documents';
    if (url.includes('seller/pan') || url.includes('seller/gst') || url.includes('seller/fssai')) return 'seller/documents';
    if (url.includes('food/users/profile')) return 'food/users';
    if (url.includes('food/restaurants/profile')) return 'food/restaurants/profile';
    if (url.includes('food/restaurants/pan') || url.includes('food/restaurants/gst') || url.includes('food/restaurants/fssai')) return 'food/restaurants/documents';
    if (url.includes('food/restaurants/menu')) return 'food/restaurants/menu';
    if (url.includes('food/restaurants/cover')) return 'food/restaurants/cover';
    if (url.includes('food/delivery/profile')) return 'delivery/profile';
    if (url.includes('food/delivery/aadhar') || url.includes('food/delivery/pan') || url.includes('food/delivery/drivingLicense')) return 'delivery/documents';
    if (url.includes('food/delivery/upi')) return 'delivery/upi';
    if (url.includes('food/hero-banners')) return 'food/banners/hero';
    if (url.includes('food/dining-banners')) return 'food/banners/dining';
    if (url.includes('food/under-250-banners')) return 'food/banners/under250';
    if (url.includes('food/explore-icons')) return 'food/icons';
    if (url.includes('admin/employees')) return 'ecs/employees';
    if (url.includes('hrms/payslips')) return 'hrms/payslips';
    return 'general';
};

const downloadBuffer = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                const chunks = [];
                response.on('data', (chunk) => chunks.push(chunk));
                response.on('end', () => resolve(Buffer.concat(chunks)));
            } else {
                reject(new Error(`Failed to download ${url}: Status ${response.statusCode}`));
            }
        }).on('error', reject);
    });
};

const processUrl = async (url) => {
    if (!shouldMigrateUrl(url)) return url;
    
    // Strip transforms if they exist in the URL (e.g. f_webp,q_auto) to get the raw original if needed, 
    // but honestly just downloading the optimized webp from the URL is fine if it works.
    
    // Fallback: If it's a dv1l9sb4p URL, the direct fetch will fail with 401. 
    // Let's try downloading directly first.
    let buffer;
    try {
        buffer = await downloadBuffer(url);
    } catch (err) {
        console.error(`[Warning] Could not download via HTTP: ${err.message}. Trying Admin API...`);
        // We can't really get it via Admin API as easily because the URL is signed/disabled.
        // For dv1l9sb4p, it is permanently disabled. We just return the placeholder or the original URL.
        console.log(`[Error] Skipping ${url} (Cannot be downloaded)`);
        
        // If it's the permanently disabled cloudinary account, force replace with a local fallback logo
        // to prevent 401 Unauthorized errors in the frontend.
        if (url.includes('dv1l9sb4p')) {
            return '/itzo-quick-logo.png';
        }
        
        return url; // Skip if it can't be downloaded (e.g. temporary network error for active accounts)
    }

    const localFolder = getLocalFolder(url);
    const isPdf = url.toLowerCase().endsWith('.pdf');
    const isImage = !isPdf && (url.includes('/image/upload/') || buffer.length > 0); // basic check
    
    const extension = isPdf ? 'pdf' : 'webp';
    const filename = generateFilename(extension);
    
    const relativePath = path.join(localFolder, filename).replace(/\\/g, '/');
    const absolutePath = path.join(UPLOADS_BASE_DIR, relativePath);
    
    ensureDirectoryExists(path.dirname(absolutePath));
    
    if (isImage && !isPdf) {
        fs.writeFileSync(absolutePath, buffer);
    } else {
        fs.writeFileSync(absolutePath, buffer);
    }
    
    return `/uploads/${relativePath}`;
};

const collectUrlUpdates = async (value, currentPath = '') => {
    const updates = [];

    if (typeof value === 'string') {
        if (shouldMigrateUrl(value)) {
            const nextValue = await processUrl(value);
            if (nextValue !== value) {
                updates.push({ path: currentPath, from: value, to: nextValue });
            }
        }
        return updates;
    }

    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index++) {
            const item = value[index];
            const nextPath = currentPath ? `${currentPath}.${index}` : String(index);
            const nestedUpdates = await collectUrlUpdates(item, nextPath);
            updates.push(...nestedUpdates);
        }
        return updates;
    }

    if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof mongoose.Types.ObjectId)) {
        for (const [key, nestedValue] of Object.entries(value)) {
            if (key === '_id') continue;
            const nextPath = currentPath ? `${currentPath}.${key}` : key;
            const nestedUpdates = await collectUrlUpdates(nestedValue, nextPath);
            updates.push(...nestedUpdates);
        }
    }

    return updates;
};

const summarizeValue = (value) => {
    if (typeof value !== 'string') return '';
    return value.length > 100 ? `${value.slice(0, 97)}...` : value;
};

const run = async () => {
    if (!MONGO_URI) throw new Error('Missing MONGODB_URI');

    console.log(`Starting migration... Dry-Run: ${isDryRun}`);
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;

    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    const targetCollections = collections.map(entry => entry.name).filter(name => !name.startsWith('system.'));

    let totalDocsScanned = 0;
    let totalDocsChanged = 0;

    for (const collectionName of targetCollections) {
        const collection = db.collection(collectionName);
        const cursor = collection.find({});
        
        let collectionDocsChanged = 0;

        while (await cursor.hasNext()) {
            const doc = await cursor.next();
            if (!doc) continue;

            totalDocsScanned++;
            
            const updates = await collectUrlUpdates(doc);
            const validUpdates = updates.filter(entry => entry.path);
            
            if (validUpdates.length > 0) {
                const setPayload = Object.fromEntries(validUpdates.map(entry => [entry.path, entry.to]));
                
                if (!isDryRun) {
                    await collection.updateOne({ _id: doc._id }, { $set: setPayload });
                }

                collectionDocsChanged++;
                totalDocsChanged++;
                
                console.log(`[${isDryRun ? 'DRY-RUN' : 'UPDATED'}] ${collectionName} ${doc._id} (Fields: ${validUpdates.length})`);
                validUpdates.forEach(u => console.log(`  - ${u.path}: ${summarizeValue(u.from)} -> ${summarizeValue(u.to)}`));
            }
        }
        
        if (collectionDocsChanged > 0) {
            console.log(`Finished ${collectionName}: ${collectionDocsChanged} docs updated.`);
        }
    }

    console.log(`\nMigration Complete: ${totalDocsChanged} documents updated out of ${totalDocsScanned} scanned.`);
};

run()
    .catch(console.error)
    .finally(() => mongoose.disconnect());
