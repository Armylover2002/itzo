import fs from 'fs';
import path from 'path';
import https from 'https';

const DOWNLOAD_DIR = path.join(process.cwd(), 'uploads', 'general');

const images = {
    'grocery.jpg': 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=400&auto=format&fit=crop',
    'spices.jpg': 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?q=80&w=400&auto=format&fit=crop',
    'electronics.jpg': 'https://images.unsplash.com/photo-1498049794561-7780e7231661?q=80&w=400&auto=format&fit=crop',
    'toys.jpg': 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?q=80&w=400&auto=format&fit=crop'
};

if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

async function downloadImage(filename, url) {
    return new Promise((resolve, reject) => {
        const dest = path.join(DOWNLOAD_DIR, filename);
        const file = fs.createWriteStream(dest);
        const options = {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        };
        https.get(url, options, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log(`Downloaded: ${filename}`);
                    resolve();
                });
            } else if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
                downloadImage(filename, response.headers.location).then(resolve).catch(reject);
            } else {
                reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
            }
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function run() {
    try {
        console.log("Starting downloads...");
        for (const [filename, url] of Object.entries(images)) {
            await downloadImage(filename, url);
        }
        console.log("All downloads completed!");
        process.exit(0);
    } catch (err) {
        console.error("Download failed:", err);
        process.exit(1);
    }
}

run();
