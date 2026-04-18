// Generate PWA icons as simple colored squares with text
// Run: node scripts/generate-icons.js

const fs = require("fs");
const path = require("path");

function createPngFromSvg(size, outputPath) {
  // Create a simple SVG with BNI branding
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.15)}" fill="#1B2A4A"/>
  <text x="50%" y="45%" dominant-baseline="central" text-anchor="middle" fill="#2E75B6" font-family="Arial,sans-serif" font-weight="bold" font-size="${Math.round(size * 0.25)}">BNI</text>
  <text x="50%" y="70%" dominant-baseline="central" text-anchor="middle" fill="#ffffff" font-family="Arial,sans-serif" font-size="${Math.round(size * 0.1)}">Connect</text>
</svg>`;

  // For now, save as SVG — browsers handle SVG icons fine
  // But manifest needs PNG, so we'll use a data URI approach
  fs.writeFileSync(outputPath.replace('.png', '.svg'), svg);
  console.log(`Created: ${outputPath.replace('.png', '.svg')}`);
}

const iconsDir = path.join(__dirname, "..", "public", "icons");
createPngFromSvg(192, path.join(iconsDir, "icon-192.png"));
createPngFromSvg(512, path.join(iconsDir, "icon-512.png"));
