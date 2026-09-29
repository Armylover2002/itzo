const sharp = require('sharp');
const path = require('path');

async function removeWhiteBg(inputPath, outputPath, threshold = 220) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];

  const isBg = (x, y) => {
    const idx = (y * width + x) * channels;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    // Pure or near white, light gray background
    // Check if high brightness and low saturation (gray/white)
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    const avg = (r + g + b) / 3;

    // Background is near white/light grey (low saturation, high brightness)
    if (avg >= threshold && diff < 30) return true;
    // Ground shadow removal near bottom (y > height * 0.85)
    if (y > height * 0.82 && avg >= 180 && diff < 25) return true;
    return false;
  };

  for (let x = 0; x < width; x++) {
    if (isBg(x, 0)) { queue.push([x, 0]); visited[0 * width + x] = 1; }
    if (isBg(x, height - 1)) { queue.push([x, height - 1]); visited[(height - 1) * width + x] = 1; }
  }
  for (let y = 0; y < height; y++) {
    if (isBg(0, y)) { queue.push([0, y]); visited[y * width + 0] = 1; }
    if (isBg(width - 1, y)) { queue.push([width - 1, y]); visited[y * width + (width - 1)] = 1; }
  }

  let head = 0;
  while (head < queue.length) {
    const [x, y] = queue[head++];
    const idx = (y * width + x) * channels;
    data[idx + 3] = 0;

    const neighbors = [
      [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
    ];
    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const npos = ny * width + nx;
        if (!visited[npos]) {
          visited[npos] = 1;
          if (isBg(nx, ny)) {
            queue.push([nx, ny]);
          }
        }
      }
    }
  }

  // Smooth edge pixels
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * channels;
      if (data[idx + 3] > 0) {
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        const brightness = (r + g + b) / 3;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min;
        if (brightness > 200 && diff < 25) {
          const hasTransNeighbor = 
            data[((y-1)*width + x)*channels + 3] === 0 ||
            data[((y+1)*width + x)*channels + 3] === 0 ||
            data[(y*width + x - 1)*channels + 3] === 0 ||
            data[(y*width + x + 1)*channels + 3] === 0;
          if (hasTransNeighbor) {
            data[idx + 3] = Math.max(0, Math.round(255 * (255 - brightness) / 55));
          }
        }
      }
    }
  }

  await sharp(data, { raw: { width, height, channels } })
    .png()
    .toFile(outputPath);
  console.log(`Saved transparent image to ${outputPath}`);
}

async function run() {
  const dir = 'c:/Users/admin/Desktop/itzo-new/frontend/public/food/promise';
  await removeWhiteBg(path.join(dir, 'offline_prices.jpg'), path.join(dir, 'offline_prices.png'), 220);
  await removeWhiteBg(path.join(dir, 'lowest_prices.jpg'), path.join(dir, 'lowest_prices.png'), 195);
  await removeWhiteBg(path.join(dir, 'superfast_delivery.jpg'), path.join(dir, 'superfast_delivery.png'), 220);
}

run().catch(console.error);
