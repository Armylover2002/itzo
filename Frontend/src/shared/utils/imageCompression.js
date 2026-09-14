import imageCompression from 'browser-image-compression';

/**
 * Compresses an image file before upload.
 * @param {File} imageFile - The original image file.
 * @param {Object} options - Compression options.
 * @returns {Promise<File>} - The compressed image file.
 */
export const compressImage = async (imageFile, options = {}) => {
  const defaultOptions = {
    maxSizeMB: 0.5, // 500KB
    maxWidthOrHeight: 1200,
    useWebWorker: true,
    fileType: 'image/webp', // Convert to webp on upload if possible
    initialQuality: 0.8,
  };

  const finalOptions = { ...defaultOptions, ...options };

  try {
    const compressedFile = await imageCompression(imageFile, finalOptions);
    console.log(`Compressed from ${imageFile.size / 1024 / 1024}MB to ${compressedFile.size / 1024 / 1024}MB`);
    return compressedFile;
  } catch (error) {
    console.error('Image compression failed:', error);
    return imageFile; // Return original if compression fails
  }
};
