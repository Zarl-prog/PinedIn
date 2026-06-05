const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const svgPath = path.resolve(__dirname, '..', 'icon.svg');
const iconsDir = path.resolve(__dirname, '..', 'src-tauri', 'icons');

fs.mkdirSync(iconsDir, { recursive: true });

/**
 * Write a 32-bit BGRA BMP file from raw RGBA pixel data.
 * BMP stores pixels bottom-up, BGR order (alpha channel ignored for BI_BITFIELDS).
 * We use BI_RGB with 32-bit where each row is padded to 4-byte boundary.
 */
function writeBmp(filePath, width, height, rgbaBuffer) {
  const rowSize = width * 4; // 4 bytes per pixel (BGRA)
  const rowPadding = (4 - (rowSize % 4)) % 4;
  const stride = rowSize + rowPadding;
  const pixelDataSize = stride * height;
  const fileSize = 14 + 40 + pixelDataSize; // header + DIB + pixels
  const buffer = Buffer.alloc(fileSize);
  let offset = 0;

  // --- BMP file header (14 bytes) ---
  // 'BM' signature
  buffer.write('BM', offset, 2, 'ascii'); offset += 2;
  // file size
  buffer.writeUInt32LE(fileSize, offset); offset += 4;
  // reserved (2x 0)
  buffer.writeUInt16LE(0, offset); offset += 2;
  buffer.writeUInt16LE(0, offset); offset += 2;
  // pixel data offset = 14 + 40 = 54
  buffer.writeUInt32LE(54, offset); offset += 4;

  // --- DIB header (BITMAPINFOHEADER, 40 bytes) ---
  // header size
  buffer.writeUInt32LE(40, offset); offset += 4;
  // width
  buffer.writeInt32LE(width, offset); offset += 4;
  // height (negative = top-down, but we'll write bottom-up like standard BMP)
  buffer.writeInt32LE(height, offset); offset += 4;
  // planes
  buffer.writeUInt16LE(1, offset); offset += 2;
  // bits per pixel
  buffer.writeUInt16LE(32, offset); offset += 2;
  // compression (BI_RGB = 0)
  buffer.writeUInt32LE(0, offset); offset += 4;
  // image size (can be 0 for BI_RGB)
  buffer.writeUInt32LE(pixelDataSize, offset); offset += 4;
  // x pixels per meter (72 DPI ≈ 2835)
  buffer.writeInt32LE(2835, offset); offset += 4;
  // y pixels per meter
  buffer.writeInt32LE(2835, offset); offset += 4;
  // colors in palette (0 = none)
  buffer.writeUInt32LE(0, offset); offset += 4;
  // important colors (0 = all)
  buffer.writeUInt32LE(0, offset); offset += 4;

  // --- Pixel data (bottom-up rows, BGRA) ---
  // BMP stores pixels bottom-up, so row 0 in file = last row of image
  for (let y = height - 1; y >= 0; y--) {
    const rowStart = y * width * 4;
    for (let x = 0; x < width; x++) {
      const srcIdx = rowStart + x * 4;
      const r = rgbaBuffer[srcIdx];
      const g = rgbaBuffer[srcIdx + 1];
      const b = rgbaBuffer[srcIdx + 2];
      const a = rgbaBuffer[srcIdx + 3];
      // BGRA order
      buffer.writeUInt8(b, offset++);
      buffer.writeUInt8(g, offset++);
      buffer.writeUInt8(r, offset++);
      buffer.writeUInt8(a, offset++);
    }
    // row padding
    for (let p = 0; p < rowPadding; p++) {
      buffer.writeUInt8(0, offset++);
    }
  }

  fs.writeFileSync(filePath, buffer);
}

async function generate() {
  const svgBuffer = fs.readFileSync(svgPath);

  // ─── Sidebar image — 164x314px, white background, icon centered ───
  const iconPngBuffer = await sharp(svgBuffer)
    .resize(100, 100)
    .png()
    .toBuffer();

  const sidebarRaw = await sharp({
    create: {
      width: 164,
      height: 314,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite([{ input: iconPngBuffer, top: 107, left: 32 }])
    .ensureAlpha()
    .raw()
    .toBuffer();

  writeBmp(
    path.join(iconsDir, 'installer-sidebar.bmp'),
    164, 314, sidebarRaw
  );
  console.log('Generated installer-sidebar.bmp (164x314)');

  // ─── Header image — 150x57px, white background, icon left-aligned ───
  const iconSmallBuffer = await sharp(svgBuffer)
    .resize(40, 40)
    .png()
    .toBuffer();

  const headerRaw = await sharp({
    create: {
      width: 150,
      height: 57,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite([{ input: iconSmallBuffer, top: 8, left: 8 }])
    .ensureAlpha()
    .raw()
    .toBuffer();

  writeBmp(
    path.join(iconsDir, 'installer-header.bmp'),
    150, 57, headerRaw
  );
  console.log('Generated installer-header.bmp (150x57)');

  console.log('Done!');
}

generate().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
