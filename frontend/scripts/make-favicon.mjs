/**
 * Favicon a partir do símbolo oficial.
 * Preferir: npm run icons:pwa
 */
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const SRC = path.join(PUBLIC, 'Simbolo_Meridian_Oficial.png');

await sharp(SRC)
  .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(path.join(PUBLIC, 'favicon-32x32.png'));

await sharp(SRC)
  .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(path.join(PUBLIC, 'favicon.png'));

console.log('Favicons gerados a partir de Simbolo_Meridian_Oficial.png');
