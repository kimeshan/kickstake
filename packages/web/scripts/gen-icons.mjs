/**
 * Generates favicon + PWA raster assets from the KickStake "K" mark.
 *   node scripts/gen-icons.mjs
 *
 * Outputs:
 *   src/app/favicon.ico      (16/32/48, transparent rounded mark)
 *   src/app/apple-icon.png   (180, full-bleed lime — Apple masks corners)
 *   public/icon-192.png      (PWA, full-bleed)
 *   public/icon-512.png      (PWA, full-bleed)
 */
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIME = "#C6F135";
const INK = "#0A0E0A";
const K = `M132 120 H204 V224 L300 120 H380 L244 260 L380 400 H300 L204 296 V400 H132 Z`;

// rounded = transparent corners (favicon); full = lime to the edges (app icons)
const svg = (rounded) =>
  `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="512" rx="${rounded ? 116 : 0}" fill="${rounded ? LIME : LIME}"/>
    <path d="${K}" fill="${INK}"/>
  </svg>`;

const png = (rounded, size) =>
  sharp(Buffer.from(svg(rounded))).resize(size, size).png().toBuffer();

// --- ICO packer (embeds PNGs; supported by all modern browsers) ---
function packIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(images.length * 16);
  let offset = 6 + images.length * 16;
  images.forEach((img, i) => {
    const b = i * 16;
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, b);
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, b + 1);
    dir.writeUInt16LE(1, b + 4); // planes
    dir.writeUInt16LE(32, b + 6); // bpp
    dir.writeUInt32LE(img.buf.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += img.buf.length;
  });
  return Buffer.concat([header, dir, ...images.map((i) => i.buf)]);
}

mkdirSync(join(root, "public"), { recursive: true });

const icoSizes = [16, 32, 48];
const icoImgs = await Promise.all(
  icoSizes.map(async (size) => ({ size, buf: await png(true, size) })),
);
writeFileSync(join(root, "src/app/favicon.ico"), packIco(icoImgs));

writeFileSync(join(root, "src/app/apple-icon.png"), await png(false, 180));
writeFileSync(join(root, "public/icon-192.png"), await png(false, 192));
writeFileSync(join(root, "public/icon-512.png"), await png(false, 512));

console.log("Icons generated ✓");
