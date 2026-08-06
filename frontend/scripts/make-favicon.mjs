/**
 * Favicon apertado: corta padding, troca fundo preto por transparente.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const SRC = path.join(PUBLIC, 'Logo_Alvim_Icone.png');

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const px = new Uint8Array(data);
const { width: w, height: h } = info;
let minX = w;
let minY = h;
let maxX = 0;
let maxY = 0;

for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const a = px[i + 3];
    if (a < 20) continue;
    if (r < 40 && g < 40 && b < 40) {
      px[i + 3] = 0; // transparente
      continue;
    }
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
}

const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.02);
minX = Math.max(0, minX - pad);
minY = Math.max(0, minY - pad);
maxX = Math.min(w - 1, maxX + pad);
maxY = Math.min(h - 1, maxY + pad);
const cw = maxX - minX + 1;
const ch = maxY - minY + 1;

const croppedRaw = Buffer.alloc(cw * ch * 4);
for (let y = 0; y < ch; y++) {
  for (let x = 0; x < cw; x++) {
    const si = ((minY + y) * w + (minX + x)) * 4;
    const di = (y * cw + x) * 4;
    croppedRaw[di] = px[si];
    croppedRaw[di + 1] = px[si + 1];
    croppedRaw[di + 2] = px[si + 2];
    croppedRaw[di + 3] = px[si + 3];
  }
}

const out = await sharp(croppedRaw, { raw: { width: cw, height: ch, channels: 4 } })
  .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

fs.writeFileSync(path.join(PUBLIC, 'favicon.png'), out);
fs.writeFileSync(path.join(PUBLIC, 'Logo_Icon-favicon.png'), out);
console.log('ok', { crop: `${cw}x${ch}`, bytes: out.length });
