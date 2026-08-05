import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import https from 'https';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function run() {
    const originalUrl = 'https://res.cloudinary.com/dm6dbsbfx/image/upload/v1783714041/hrms/joining-requests/resumes/magovnzpigkof289vva9.pdf';
    
    // Extract public_id
    const parts = originalUrl.split('/upload/');
    const suffix = parts[1]; // v1783714041/hrms/joining-requests/resumes/magovnzpigkof289vva9.pdf
    let publicIdWithExt = suffix;
    
    // Remove version if exists
    if (/^v\d+\//.test(suffix)) {
        publicIdWithExt = suffix.substring(suffix.indexOf('/') + 1);
    }
    
    // Remove extension
    const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf('.'));
    const ext = publicIdWithExt.substring(publicIdWithExt.lastIndexOf('.') + 1);

    console.log('Public ID:', publicId);

    // Try to get resource via Admin API
    try {
        const result = await cloudinary.api.resource(publicId, { resource_type: ext === 'pdf' ? 'raw' : 'image' });
        console.log('Admin API Result:', result.url);
        
        // Generate signed URL
        const signedUrl = cloudinary.url(publicId, { secure: true, sign_url: true, resource_type: ext === 'pdf' ? 'raw' : 'image' });
        console.log('Signed URL:', signedUrl);
        
        https.get(signedUrl, (res) => {
            console.log('Signed URL Download Status code:', res.statusCode);
        }).on('error', console.error);
        
    } catch (err) {
        console.error('Admin API Error:', err);
    }
}

run();
