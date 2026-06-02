const sharp = require('sharp');
const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const svgPath = 'icon.svg';
const iconsDir = 'src-tauri/icons';

if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

const sizes = [16, 32, 48, 64, 128, 256, 512];

async function generateIcons() {
    const svgBuffer = fs.readFileSync(svgPath);
    
    for (const size of sizes) {
        const outputPath = path.join(iconsDir, `${size}x${size}.png`);
        await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toFile(outputPath);
        console.log(`Generated ${size}x${size}.png`);
    }

    await sharp(svgBuffer)
        .resize(256, 256)
        .png()
        .toFile(path.join(iconsDir, '128x128@2x.png'));
    console.log('Generated 128x128@2x.png');

    await sharp(svgBuffer)
        .resize(512, 512)
        .png()
        .toFile(path.join(iconsDir, 'icon.png'));
    console.log('Generated icon.png (512x512)');

    const icoSizes = [16, 32, 48, 64, 128, 256];
    const pngBuffers = [];
    
    for (const size of icoSizes) {
        const pngBuffer = await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toBuffer();
        pngBuffers.push(pngBuffer);
    }

    const pngToIcoModule = require('png-to-ico');
    const icoBuffer = await pngToIcoModule.default(pngBuffers);
    fs.writeFileSync(path.join(iconsDir, 'icon.ico'), icoBuffer);
    console.log('Generated icon.ico');

    console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);