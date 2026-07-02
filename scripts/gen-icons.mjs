// One-off: renders public/icon.svg to the PWA PNG icons.
// Usage: node scripts/gen-icons.mjs
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const src = path.join(root, "public", "icon.svg");
const outDir = path.join(root, "public", "icons");

await mkdir(outDir, { recursive: true });

for (const size of [192, 512]) {
  await sharp(src, { density: 300 })
    .resize(size, size)
    // Full-bleed background so maskable crops never expose transparency.
    .flatten({ background: "#3d6b4f" })
    .png()
    .toFile(path.join(outDir, `icon-${size}.png`));
  console.log(`icon-${size}.png`);
}
