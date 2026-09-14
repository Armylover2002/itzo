import multer from 'multer';

const storage = multer.memoryStorage();

// Cap in-memory uploads to avoid DoS from unbounded multipart payloads.
// Product create allows up to 5 variants × 3 photos (+ optional cover/gallery).
export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 30,
  },
});

