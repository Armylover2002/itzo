import fs from 'fs/promises';

export async function cleanupUploadedFiles(files) {
    if (!files || typeof files !== 'object') return;

    const cleanupTasks = Object.values(files)
        .flat()
        .filter((file) => file?.path)
        .map((file) => fs.unlink(file.path).catch(() => {}));

    await Promise.all(cleanupTasks);
}
