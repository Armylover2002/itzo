import puppeteer from 'puppeteer';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cloudinary from 'cloudinary';
import streamifier from 'streamifier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standard Chromium paths across Ubuntu VPS, Linux distributions, Windows, and macOS
const COMMON_CHROME_PATHS = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    '/snap/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);

/**
 * Intelligent Executable Detection
 * Scans environment variables and standard OS paths for an installed Chromium/Chrome browser.
 */
const findBrowserExecutable = () => {
    // 1. Check if Puppeteer has its own downloaded Chromium
    try {
        const bundledPath = puppeteer.executablePath();
        if (bundledPath && fs.existsSync(bundledPath)) {
            console.log(`[Payslip PDF] Using bundled Puppeteer Chromium: ${bundledPath}`);
            return bundledPath;
        }
    } catch (err) {
        // Bundled browser not found or skipped during install
    }

    // 2. Scan known system paths on Ubuntu VPS / Linux / Windows / Mac
    for (const execPath of COMMON_CHROME_PATHS) {
        if (fs.existsSync(execPath)) {
            console.log(`[Payslip PDF] Using system Chrome/Chromium executable: ${execPath}`);
            return execPath;
        }
    }

    console.warn('[Payslip PDF] No explicit Chromium executable path found. Relying on default Puppeteer launch.');
    return undefined;
};

// Singleton browser instance pool to avoid memory/CPU spikes on production servers
let browserInstance = null;
let isLaunching = false;

/**
 * Retrieves a reused Puppeteer browser instance or launches a new one with production-safe Linux flags.
 */
const getBrowser = async () => {
    if (browserInstance && browserInstance.connected) {
        return browserInstance;
    }

    if (isLaunching) {
        // Wait briefly if another concurrent request is launching the browser
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 250));
            if (browserInstance && browserInstance.connected) {
                return browserInstance;
            }
        }
    }

    isLaunching = true;
    try {
        const execPath = findBrowserExecutable();
        const launchOptions = {
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-extensions',
                '--memory-pressure-off',
                '--disable-background-networking',
                '--disable-default-apps',
                '--disable-sync',
                '--disable-translate',
                '--hide-scrollbars',
                '--metrics-recording-only',
                '--mute-audio',
                '--no-default-browser-check'
            ]
        };

        if (execPath) {
            launchOptions.executablePath = execPath;
        }

        console.log('[Payslip PDF] Launching Puppeteer browser instance with production flags...');
        browserInstance = await puppeteer.launch(launchOptions);

        // Handle browser disconnection or crash
        browserInstance.on('disconnected', () => {
            console.warn('[Payslip PDF] Browser instance disconnected or crashed. Resetting singleton pool.');
            browserInstance = null;
        });

        return browserInstance;
    } catch (error) {
        console.error('[Payslip PDF] Failed to launch browser:', error.message);
        browserInstance = null;
        throw new Error(`PDF Generation failed: Unable to launch Chrome/Chromium browser on server. Root cause: ${error.message}. Please install chromium-browser or google-chrome-stable on the VPS (e.g. 'sudo apt-get install -y chromium-browser') or set PUPPETEER_EXECUTABLE_PATH in .env.`);
    } finally {
        isLaunching = false;
    }
};

/**
 * Compiles Handlebars template with data and generates a PDF Buffer via Puppeteer.
 * @param {Object} data - Payroll and employee data
 * @returns {Promise<Buffer>} - PDF Buffer
 */
export const generatePdfBuffer = async (data) => {
    // Helper to convert number to words
    handlebars.registerHelper('amountInWords', (amount) => {
        if (!amount) return 'Zero Rupees Only';
        return data.amountInWords || 'Amount verified';
    });

    const templatePath = path.join(__dirname, '../templates/payslipTemplate.hbs');
    if (!fs.existsSync(templatePath)) {
        throw new Error(`Payslip template not found at ${templatePath}`);
    }
    const templateHtml = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateHtml);
    const html = template(data);

    let page = null;
    try {
        const browser = await getBrowser();
        page = await browser.newPage();

        // Strict timeout handling for production safety
        page.setDefaultNavigationTimeout(30000);
        page.setDefaultTimeout(30000);

        await page.setContent(html, { waitUntil: ['load', 'networkidle0'], timeout: 25000 });

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

        return Buffer.from(pdfBuffer);
    } catch (error) {
        console.error('[Payslip PDF] Error generating PDF buffer:', error);
        if (browserInstance && !browserInstance.connected) {
            browserInstance = null;
        }
        throw new Error(`Failed to generate PDF document: ${error.message}`);
    } finally {
        if (page && !page.isClosed()) {
            await page.close().catch(err => console.error('[Payslip PDF] Error closing page:', err.message));
        }
    }
};

/**
 * Uploads PDF Buffer to Cloudinary under 'raw' resource type so browsers can view, download, and print cleanly.
 * @param {Buffer} buffer - PDF Buffer
 * @param {String} filename - Desired filename
 * @returns {Promise<String>} - Secure URL of uploaded PDF
 */
export const uploadPdfToCloudinary = (buffer, filename) => {
    return new Promise((resolve, reject) => {
        const publicId = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
        
        const uploadStream = cloudinary.v2.uploader.upload_stream(
            {
                folder: 'hrms/payslips/generated',
                resource_type: 'image',
                public_id: publicId,
                format: 'pdf'
            },
            (error, result) => {
                if (error) {
                    console.error('[Payslip PDF] Cloudinary upload error:', error);
                    return reject(new Error(`Failed to upload PDF to Cloudinary: ${error.message || error}`));
                }
                console.log(`[Payslip PDF] Successfully uploaded PDF to Cloudinary: ${result.secure_url}`);
                resolve(result.secure_url);
            }
        );

        streamifier.createReadStream(buffer).pipe(uploadStream);
    });
};
