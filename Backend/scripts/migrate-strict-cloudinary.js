import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import https from 'https';
import { v2 as cloudinary } from 'cloudinary';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const isDryRun = process.argv.includes('--dry-run');
const UPLOADS_BASE_DIR = path.resolve(process.cwd(), 'uploads');
const MONGO_URI = process.env.MONGODB_URI;

const getLocalFolder = (url) => {
    if (url.includes('hrms/payslips')) return 'hrms/payslips';
    if (url.includes('hrms/joining-requests/resumes')) return 'hrms/resumes';
    if (url.includes('careers/resumes')) return 'careers/resumes';
    if (url.includes('hrms/joining-requests/aadhaars')) return 'hrms/aadhaar';
    return 'hrms/misc';
};

const ensureDirectoryExists = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

const downloadBuffer = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                const chunks = [];
                response.on('data', (chunk) => chunks.push(chunk));
                response.on('end', () => resolve(Buffer.concat(chunks)));
            } else {
                reject(new Error(`Status ${response.statusCode}`));
            }
        }).on('error', reject);
    });
};

const processUrl = async (url) => {
    if (typeof url !== 'string') return url;
    if (!url.includes('res.cloudinary.com/dm6dbsbfx/')) return url;

    // Use cloudinary to get the direct asset if it returns 401 on standard GET
    let buffer;
    try {
        console.log(`[Info] Attempting to download ${url}`);
        buffer = await downloadBuffer(url);
    } catch (err) {
        console.log(`[Warning] Direct download failed (${err.message}). Generating signed URL...`);
        try {
            // Reconstruct the URL without version to use Cloudinary SDK
            const parts = url.split('/upload/');
            const suffix = parts[1];
            let publicIdWithExt = suffix;
            if (/^v\d+\//.test(suffix)) {
                publicIdWithExt = suffix.substring(suffix.indexOf('/') + 1);
            }
            const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf('.'));
            const ext = publicIdWithExt.substring(publicIdWithExt.lastIndexOf('.') + 1);
            
            const signedUrl = cloudinary.url(publicId, { 
                secure: true, 
                sign_url: true, 
                resource_type: ext === 'pdf' ? 'raw' : 'image' 
            });
            console.log(`[Info] Signed URL generated. Downloading...`);
            buffer = await downloadBuffer(signedUrl);
        } catch (signedErr) {
            console.log(`[Error] Signed URL download also failed: ${signedErr.message}. Skipping...`);
            return url;
        }
    }

    const localFolder = getLocalFolder(url);
    const filename = path.basename(url);
    
    const relativePath = path.join(localFolder, filename).replace(/\\/g, '/');
    const absolutePath = path.join(UPLOADS_BASE_DIR, relativePath);
    
    ensureDirectoryExists(path.dirname(absolutePath));
    fs.writeFileSync(absolutePath, buffer);
    
    return `/uploads/${relativePath}`;
};

const collectUrlUpdates = async (value, currentPath = '') => {
    const updates = [];

    if (typeof value === 'string') {
        if (value.includes('res.cloudinary.com/dm6dbsbfx/')) {
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

const run = async () => {
    if (!MONGO_URI) throw new Error('Missing MONGODB_URI');

    console.log(`Starting strict migration... Dry-Run: ${isDryRun}`);
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;

    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    const targetCollections = collections.map(c => c.name).filter(n => !n.startsWith('system.'));

    let totalDocsChanged = 0;

    for (const collectionName of targetCollections) {
        const collection = db.collection(collectionName);
        const cursor = collection.find({});
        
        while (await cursor.hasNext()) {
            const doc = await cursor.next();
            if (!doc) continue;

            const updates = await collectUrlUpdates(doc);
            const validUpdates = updates.filter(entry => entry.path);
            
            if (validUpdates.length > 0) {
                const setPayload = Object.fromEntries(validUpdates.map(entry => [entry.path, entry.to]));
                
                if (!isDryRun) {
                    await collection.updateOne({ _id: doc._id }, { $set: setPayload });
                }

                totalDocsChanged++;
                
                console.log(`[${isDryRun ? 'DRY-RUN' : 'UPDATED'}] ${collectionName} ${doc._id}`);
                validUpdates.forEach(u => console.log(`  - ${u.from} -> ${u.to}`));
            }
        }
    }

    console.log(`\nMigration Complete: ${totalDocsChanged} documents updated.`);
};

run()
    .catch(console.error)
    .finally(() => mongoose.disconnect());
