import puppeteer from 'puppeteer';
import { install, Browser, detectBrowserPlatform, resolveBuildId } from '@puppeteer/browsers';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import os from 'os';
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
            console.log(`[Payslip] Using bundled Puppeteer Chromium: ${bundledPath}`);
            return bundledPath;
        }
    } catch (err) {
        // Bundled browser not found or skipped during install
    }

    // 2. Scan known system paths on Ubuntu VPS / Linux / Windows / Mac
    for (const execPath of COMMON_CHROME_PATHS) {
        if (fs.existsSync(execPath)) {
            console.log(`[Payslip] Using system Chrome/Chromium: ${execPath}`);
            return execPath;
        }
    }

    console.warn('[Payslip] No Chrome/Chromium executable found on this system.');
    return undefined;
};

// ──────────────────────────────────────────────────────────────────────────────
// Auto-Install Chrome (one-time, uses @puppeteer/browsers which ships with puppeteer)
// ──────────────────────────────────────────────────────────────────────────────
let autoInstallAttempted = false;

const autoInstallChrome = async () => {
    if (autoInstallAttempted) return null;
    autoInstallAttempted = true;

    try {
        const platform = detectBrowserPlatform();
        const cacheDir = process.env.PUPPETEER_CACHE_DIR || path.join(os.homedir(), '.cache', 'puppeteer');

        console.log(`[Payslip] Chrome not found. Auto-downloading for platform: ${platform}`);
        console.log(`[Payslip] Download cache directory: ${cacheDir}`);

        // Resolve the latest stable Chrome build for this platform
        const buildId = await resolveBuildId(Browser.CHROME, platform, 'stable');
        console.log(`[Payslip] Downloading Chrome build ${buildId}... (this may take 1-3 minutes on first run)`);

        const result = await install({
            browser: Browser.CHROME,
            buildId,
            cacheDir,
        });

        console.log(`[Payslip] ✅ Chrome ${buildId} installed at: ${result.executablePath}`);
        return result.executablePath;
    } catch (error) {
        console.error(`[Payslip] ❌ Chrome auto-install failed: ${error.message}`);
        return null;
    }
};

// Singleton browser instance pool to avoid memory/CPU spikes on production servers
let browserInstance = null;
let isLaunching = false;

/**
 * Retrieves a reused Puppeteer browser instance or launches a new one.
 * Auto-installs Chrome on first use if it's not found on the system.
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

        // Step 1: Try finding an existing Chrome binary
        let execPath = findBrowserExecutable();
        if (execPath) {
            launchOptions.executablePath = execPath;
        }

        // Step 2: Try launching
        try {
            console.log('[Payslip] Launching Chrome browser...');
            browserInstance = await puppeteer.launch(launchOptions);
        } catch (launchError) {
            // Step 3: If Chrome is not found, auto-install and retry
            if (launchError.message.includes('Could not find') || launchError.message.includes('Failed to launch') || launchError.message.includes('No usable sandbox')) {
                console.warn(`[Payslip] Initial launch failed: ${launchError.message}`);
                
                const installedPath = await autoInstallChrome();
                if (installedPath) {
                    launchOptions.executablePath = installedPath;
                    console.log('[Payslip] Retrying launch with auto-installed Chrome...');
                    browserInstance = await puppeteer.launch(launchOptions);
                } else {
                    // Final attempt: let Puppeteer try its default resolution
                    delete launchOptions.executablePath;
                    browserInstance = await puppeteer.launch(launchOptions);
                }
            } else {
                throw launchError;
            }
        }

        // Handle browser disconnection or crash
        browserInstance.on('disconnected', () => {
            console.warn('[Payslip] Browser instance disconnected. Resetting pool.');
            browserInstance = null;
        });

        return browserInstance;
    } catch (error) {
        console.error('[Payslip] Failed to launch browser:', error.message);
        browserInstance = null;
        throw new Error(`Payslip generation failed: Unable to launch Chrome on server. ${error.message}. If this persists, SSH into your VPS and run: sudo apt-get install -y chromium-browser`);
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
