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
 * Scans: 1) Puppeteer's expected bundled path, 2) Puppeteer cache for ANY version,
 * 3) Standard system Chrome paths. This handles version mismatches between
 * Puppeteer's expected Chrome and what was actually downloaded.
 */
const findBrowserExecutable = () => {
    // 1. Check if Puppeteer has its expected bundled Chromium
    try {
        const bundledPath = puppeteer.executablePath();
        if (bundledPath && fs.existsSync(bundledPath)) {
            console.log(`[Payslip] Using bundled Puppeteer Chromium: ${bundledPath}`);
            return bundledPath;
        }
    } catch (err) {
        // Bundled browser not found or skipped during install
    }

    // 2. Scan Puppeteer cache for ANY downloaded Chrome version
    //    (fixes mismatch: Puppeteer expects v131 but auto-install downloaded v150)
    try {
        const cacheDir = process.env.PUPPETEER_CACHE_DIR || path.join(os.homedir(), '.cache', 'puppeteer');
        const chromeCacheDir = path.join(cacheDir, 'chrome');
        if (fs.existsSync(chromeCacheDir)) {
            const versions = fs.readdirSync(chromeCacheDir)
                .filter(d => fs.statSync(path.join(chromeCacheDir, d)).isDirectory())
                .sort().reverse(); // newest version first
            for (const ver of versions) {
                // Linux path pattern
                const linuxPath = path.join(chromeCacheDir, ver, 'chrome-linux64', 'chrome');
                if (fs.existsSync(linuxPath)) {
                    console.log(`[Payslip] Using cached Chrome (${ver}): ${linuxPath}`);
                    return linuxPath;
                }
                // Windows path pattern
                const winPath = path.join(chromeCacheDir, ver, 'chrome-win64', 'chrome.exe');
                if (fs.existsSync(winPath)) {
                    console.log(`[Payslip] Using cached Chrome (${ver}): ${winPath}`);
                    return winPath;
                }
                // Mac path pattern
                const macPath = path.join(chromeCacheDir, ver, 'chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
                if (fs.existsSync(macPath)) {
                    console.log(`[Payslip] Using cached Chrome (${ver}): ${macPath}`);
                    return macPath;
                }
            }
        }
    } catch (err) {
        // Cache scanning failed, continue to system paths
    }

    // 3. Scan known system paths on Ubuntu VPS / Linux / Windows / Mac
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
// Chrome Management — Non-blocking one-time setup
// ──────────────────────────────────────────────────────────────────────────────

let isDownloadingChrome = false;
let isInstallingDeps = false;
let depsInstalled = false;

/**
 * Ensures a working Chrome binary is available. Returns the executable path.
 * If missing, starts download in background and throws a fast friendly error.
 */
const ensureChromeInstalled = async () => {
    // 1. Check if Chrome is already available
    const existing = findBrowserExecutable();
    if (existing) return existing;

    if (isDownloadingChrome) {
        throw new Error('Server is performing one-time setup (Downloading PDF Engine). This takes 1-2 minutes. Please try again shortly.');
    }

    // 2. Start background download
    isDownloadingChrome = true;
    console.log('[Payslip] No Chrome found. Starting background download...');
    
    // Fire and forget background task
    (async () => {
        try {
            const platform = detectBrowserPlatform();
            const cacheDir = process.env.PUPPETEER_CACHE_DIR || path.join(os.homedir(), '.cache', 'puppeteer');
            const buildId = await resolveBuildId(Browser.CHROME, platform, 'stable');
            
            console.log(`[Payslip] Downloading Chrome ${buildId} to ${cacheDir}...`);
            await install({ browser: Browser.CHROME, buildId, cacheDir });
            console.log(`[Payslip] ✅ Chrome download complete.`);
        } catch (dlError) {
            console.error(`[Payslip] Chrome download failed: ${dlError.message}`);
        } finally {
            isDownloadingChrome = false;
        }
    })();

    throw new Error('Server is performing one-time setup (Downloading PDF Engine). This takes 1-2 minutes. Please try again shortly.');
};

/**
 * Install system libraries required by Chrome on Ubuntu/Debian VPS.
 * Runs in background to avoid 504 Gateway timeouts.
 */
let installAttemptCount = 0;

const installSystemDependencies = async () => {
    // Stop trying after 3 attempts to prevent infinite loops
    if (depsInstalled || installAttemptCount >= 3) return;
    
    if (isInstallingDeps) {
        throw new Error('Server is performing one-time setup (Installing System Libraries). This takes 1-2 minutes. Please try again shortly.');
    }

    isInstallingDeps = true;
    installAttemptCount++;
    console.log(`[Payslip] Starting background system dependencies installation (Attempt ${installAttemptCount})...`);

    // Fire and forget background task
    (async () => {
        try {
            const { exec } = await import('child_process');
            const runAsync = (cmd, timeout = 180000) => new Promise((resolve) => {
                exec(cmd, { timeout }, (err) => resolve(!err));
            });

            await runAsync('apt-get update -qq 2>/dev/null', 60000);

            // Strategy 1: Install chromium system package
            if (await runAsync('apt-get install -y --no-install-recommends chromium-browser 2>/dev/null') ||
                await runAsync('apt-get install -y --no-install-recommends chromium 2>/dev/null')) {
                console.log('[Payslip] ✅ Deps installed via system chromium package.');
                depsInstalled = true;
                return;
            }

            // Strategy 2: Install individual libs one-by-one, including Ubuntu 24.04 t64 variants
            console.log('[Payslip] Installing individual libraries...');
            const libs = [
                'libatk1.0-0', 'libatk1.0-0t64',
                'libatk-bridge2.0-0', 'libatk-bridge2.0-0t64',
                'libcups2', 'libcups2t64',
                'libdrm2',
                'libxkbcommon0',
                'libxcomposite1',
                'libxdamage1',
                'libxrandr2',
                'libgbm1',
                'libpango-1.0-0',
                'libcairo2',
                'libasound2', 'libasound2t64',
                'libatspi2.0-0', 'libatspi2.0-0t64',
                'libnss3',
                'libnspr4',
                'libxss1',
                'libgtk-3-0', 'libgtk-3-0t64',
                'libx11-xcb1',
                'libxcb-dri3-0',
                'fonts-liberation'
            ];
            
            let ok = 0;
            for (const lib of libs) {
                if (await runAsync(`apt-get install -y ${lib} 2>/dev/null`, 30000)) ok++;
            }
            console.log(`[Payslip] Installed ${ok}/${libs.length} libraries.`);
            
            // Mark as installed so we don't keep running this unless a launch actually fails again
            depsInstalled = true;
        } catch (err) {
            console.error('[Payslip] Dependency install error:', err);
        } finally {
            isInstallingDeps = false;
        }
    })();

    throw new Error('Server is performing one-time setup (Installing System Libraries). This takes 1-2 minutes. Please try again shortly.');
};

// ──────────────────────────────────────────────────────────────────────────────
// Browser Singleton
// ──────────────────────────────────────────────────────────────────────────────
let browserInstance = null;
let isLaunching = false;

const getBrowser = async () => {
    if (browserInstance && browserInstance.connected) return browserInstance;

    if (isLaunching) {
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 250));
            if (browserInstance && browserInstance.connected) return browserInstance;
        }
    }

    isLaunching = true;
    try {
        const chromePath = await ensureChromeInstalled();
        const launchOptions = {
            headless: 'new',
            executablePath: chromePath,
            args: [
                '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                '--disable-gpu', '--no-first-run', '--no-zygote', '--single-process',
                '--disable-extensions', '--memory-pressure-off',
                '--disable-background-networking', '--disable-default-apps',
                '--disable-sync', '--disable-translate', '--hide-scrollbars',
                '--metrics-recording-only', '--mute-audio', '--no-default-browser-check'
            ]
        };

        try {
            browserInstance = await puppeteer.launch(launchOptions);
        } catch (firstErr) {
            console.warn(`[Payslip] First launch failed: ${firstErr.message.substring(0, 150)}`);
            await installSystemDependencies();
            // Since installSystemDependencies throws a friendly error to avoid 504,
            // this line won't execute if deps are missing (which is exactly what we want).
            
            try {
                browserInstance = await puppeteer.launch(launchOptions);
            } catch (secondErr) {
                // If it STILL fails after dependencies supposedly installed, reset the flag
                // so it can retry the installation next time (up to 3 times total).
                if (secondErr.message.includes('shared libraries') || secondErr.message.includes('shared object')) {
                    depsInstalled = false;
                }
                throw secondErr;
            }
        }

        browserInstance.on('disconnected', () => { browserInstance = null; });
        return browserInstance;
    } catch (error) {
        browserInstance = null;
        // Keep the friendly throw messages intact, otherwise generic error
        if (error.message.includes('one-time setup')) throw error;
        throw new Error(`Payslip generation failed: ${error.message}`);
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
