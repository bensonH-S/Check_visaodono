/**
 * Gera ícones PWA a partir de Logo_Icon.png, trocando o fundo preto por branco.
 * Uso: node scripts/generate-pwa-icons.mjs  (requer: npm i -D sharp)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const SRC = path.join(PUBLIC, 'Logo_Icon.png');
const BG = { r: 255, g: 255, b: 255, alpha: 1 };

function substituirFundoEscuro(px, corOuTransparente) {
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    if (r < 48 && g < 48 && b < 48) {
      if (corOuTransparente === 'transparent') {
        px[i + 3] = 0;
      } else {
        px[i] = 255;
        px[i + 1] = 255;
        px[i + 2] = 255;
        px[i + 3] = 255;
      }
    }
  }
}

async function logoProcessado(modoFundo) {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = new Uint8Array(data);
  substituirFundoEscuro(px, modoFundo);
  return sharp(px, { raw: { width: info.width, height: info.height, channels: 4 } }).png();
}

async function logoComFundoClaro() {
  return logoProcessado('white');
}

async function logoComFundoTransparente() {
  return logoProcessado('transparent');
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('Arquivo não encontrado:', SRC);
    process.exit(1);
  }

  const logo = await logoComFundoClaro();
  const logoBuf = await logo.toBuffer();

  await logo.toFile(path.join(PUBLIC, 'Logo_Icon-light.png'));

  const favicon = await logoComFundoTransparente();
  await favicon
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(PUBLIC, 'Logo_Icon-favicon.png'));

  await sharp(logoBuf)
    .resize(512, 512, { fit: 'contain', background: BG })
    .png()
    .toFile(path.join(PUBLIC, 'Logo_Icon-512.png'));

  await sharp(logoBuf)
    .resize(192, 192, { fit: 'contain', background: BG })
    .png()
    .toFile(path.join(PUBLIC, 'Logo_Icon-192.png'));

  const maskInner = await sharp(logoBuf)
    .resize(307, 307, { fit: 'contain', background: BG })
    .png()
    .toBuffer();

  await sharp(maskInner)
    .resize(512, 512, { fit: 'contain', background: BG })
    .png()
    .toFile(path.join(PUBLIC, 'Logo_Icon-maskable.png'));

  console.log('Ícones PWA gerados (favicon transparente + PWA com fundo branco).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
