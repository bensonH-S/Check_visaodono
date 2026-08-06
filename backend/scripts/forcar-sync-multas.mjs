import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: true });

const { executarSyncMultasDetran, listarMultasDetranCache } = await import(
  '../src/services/schedulerMultasDetran.js'
);

console.log('Forcando sync Infosimples (para emitir erro no portal)...');
const result = await executarSyncMultasDetran({ forcar: true });
console.log('sync:', {
  ok: result.ok,
  status: result.status,
  motivo: result.motivo,
  qtd_multas: result.qtd_multas,
  avisos: result.avisos?.slice?.(0, 5) || result.avisos,
});
const cache = await listarMultasDetranCache({});
console.log('cache:', {
  status_sync: cache.status_sync,
  consultado_em: cache.consultado_em,
  avisos: cache.avisos,
  multas: cache.multas.length,
});
