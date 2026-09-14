import sharp from 'sharp';

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024; // 10 MB Cloudinary-safe target
const MAX_INPUT_PIXELS = 268402689; // ~16384 x 16384, guards decompression bombs

export const GLOBAL_SETTINGS_IMAGE_PRESETS = {
    favicon: { maxWidth: 512, maxHeight: 512 },
    logo: { maxWidth: 1600, maxHeight: 800 },
    banner: { maxWidth: 2560, maxHeight: 1440 },
};

export function getGlobalSettingsImagePreset(fieldName = '') {
    const normalized = String(fieldName).toLowerCase();
    if (normalized.includes('favicon')) return GLOBAL_SETTINGS_IMAGE_PRESETS.favicon;
    if (normalized.includes('banner')) return GLOBAL_SETTINGS_IMAGE_PRESETS.banner;
    return GLOBAL_SETTINGS_IMAGE_PRESETS.logo;
}

const fitInside = (width, height, maxWidth, maxHeight) => {
    if (!width || !height) {
        return { width: maxWidth, height: maxHeight };
    }
    if (width <= maxWidth && height <= maxHeight) {
        return { width, height };
    }
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    return {
        width: Math.max(1, Math.round(width * ratio)),
        height: Math.max(1, Math.round(height * ratio)),
    };
};

const encodeOptimizedImage = (sourcePath, width, height, quality) => (
    sharp(sourcePath, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize(width, height, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality, effort: 4, smartSubsample: true })
        .toBuffer()
);

/**
 * Optimize an on-disk image for Cloudinary upload.
 * Reads from file path (not full in-memory buffer) and returns a <=10MB webp buffer.
 */
export async function optimizeImageForUpload(sourcePath, preset = GLOBAL_SETTINGS_IMAGE_PRESETS.logo) {
    if (!sourcePath) {
        throw new Error('Image source path is required');
    }

    const metadata = await sharp(sourcePath, {
        failOn: 'error',
        limitInputPixels: MAX_INPUT_PIXELS,
    }).metadata();

    if (!metadata.format) {
        throw new Error('Unsupported or invalid image file');
    }

    let { width, height } = fitInside(
        metadata.width,
        metadata.height,
        preset.maxWidth,
        preset.maxHeight,
    );

    for (let dimAttempt = 0; dimAttempt < 6; dimAttempt += 1) {
        for (const quality of [90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40]) {
            const buffer = await encodeOptimizedImage(sourcePath, width, height, quality);
            if (buffer.length <= MAX_OUTPUT_BYTES) {
                return buffer;
            }
        }

        width = Math.max(1, Math.floor(width * 0.85));
        height = Math.max(1, Math.floor(height * 0.85));
    }

    throw new Error('Unable to optimize image below 10 MB. Please use a smaller source image.');
}
