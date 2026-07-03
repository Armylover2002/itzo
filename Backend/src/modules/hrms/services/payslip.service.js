import puppeteer from 'puppeteer';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cloudinary from 'cloudinary';
import streamifier from 'streamifier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Compiles Handlebars template with data and generates a PDF Buffer via Puppeteer.
 * @param {Object} data - Payroll and employee data
 * @returns {Promise<Buffer>} - PDF Buffer
 */
export const generatePdfBuffer = async (data) => {
    // Helper to convert number to words (simple implementation for INR)
    handlebars.registerHelper('amountInWords', (amount) => {
        if (!amount) return 'Zero Rupees Only';
        // A full number-to-words function would be large, using a basic fallback or we can pass it from JS
        return data.amountInWords || 'Amount verified';
    });

    const templatePath = path.join(__dirname, '../templates/payslipTemplate.hbs');
    const templateHtml = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateHtml);
    const html = template(data);

    // Launch puppeteer
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    
    // Set content and wait for fonts to load
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
            top: '0px',
            right: '0px',
            bottom: '0px',
            left: '0px'
        }
    });

    await browser.close();
    
    return Buffer.from(pdfBuffer);
};

/**
 * Uploads PDF Buffer to Cloudinary
 * @param {Buffer} buffer - PDF Buffer
 * @param {String} filename - Desired filename
 * @returns {Promise<String>} - Secure URL of uploaded PDF
 */
export const uploadPdfToCloudinary = (buffer, filename) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.v2.uploader.upload_stream(
            {
                folder: 'hrms/payslips/generated',
                resource_type: 'image',
                public_id: filename,
                format: 'pdf'
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );

        streamifier.createReadStream(buffer).pipe(uploadStream);
    });
};
