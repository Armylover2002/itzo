import { GlobalSettings } from '../models/settings.model.js';

const BRANDING_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_BRAND = {
    companyName: 'Appzeto',
    image: 'https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png'
};

let cachedBranding = null;
let cachedAt = 0;

export async function getGlobalBranding() {
    const now = Date.now();
    if (cachedBranding && (now - cachedAt) < BRANDING_CACHE_TTL_MS) {
        return cachedBranding;
    }

    const settings = await GlobalSettings.findOne()
        .select('companyName userLogo adminLogo')
        .lean();

    const companyName = String(settings?.companyName || DEFAULT_BRAND.companyName).trim() || DEFAULT_BRAND.companyName;
    const image = settings?.userLogo?.url || settings?.adminLogo?.url || DEFAULT_BRAND.image;

    cachedBranding = { companyName, image };
    cachedAt = now;
    return cachedBranding;
}

export function clearGlobalBrandingCache() {
    cachedBranding = null;
    cachedAt = 0;
}
