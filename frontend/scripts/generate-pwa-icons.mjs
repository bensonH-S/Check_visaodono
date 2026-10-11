/**
 * Gera favicons e ícones PWA a partir de Simbolo_Meridian_Oficial.png.
 * Uso: npm run icons:pwa
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const SRC = path.join(PUBLIC, 'Simbolo_Meridian_Oficial.png');

async function resizeContain(size, outName, background = { r: 0, g: 0, b: 0, alpha: 0 }) {
  await sharp(SRC)
    .resize(size, size, { fit: 'contain', background })
    .png()
    .toFile(path.join(PUBLIC, outName));
  console.log('ok', outName, `${size}x${size}`);
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('Arquivo não encontrado:', SRC);
    process.exit(1);
  }

  await resizeContain(32, 'favicon-32x32.png');
  await resizeContain(64, 'favicon.png');
  await resizeContain(192, 'meridian-icon-192.png');
  await resizeContain(512, 'meridian-icon-512.png');

  // maskable: símbolo com margem segura em fundo escuro da marca
  const inner = await sharp(SRC)
    .resize(360, 360, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 5, g: 16, b: 23, alpha: 1 } },
  })
    .composite([{ input: inner, gravity: 'centre' }])
    .png()
    .toFile(path.join(PUBLIC, 'meridian-icon-maskable-512.png'));
  console.log('ok meridian-icon-maskable-512.png 512x512');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
