/**
 * Teste one-shot do portal DETRAN-DF (Playwright).
 *
 * Uso (na pasta backend ou raiz):
 *   node backend/scripts/test-detran-portal.js ABC1D23 12345678901
 *   DETRAN_PORTAL_HEADLESS=0 node backend/scripts/test-detran-portal.js ABC1D23 12345678901
 *
 * Carrega .env da raiz do projeto.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env'), override: false });
dotenv.config({ path: path.join(projectRoot, 'backend', '.env'), override: false });

const placa = process.argv[2];
const renavam = process.argv[3];

if (!placa || !renavam) {
  console.error('Uso: node backend/scripts/test-detran-portal.js <placa> <renavam>');
  console.error('Ex.:  node backend/scripts/test-detran-portal.js FRT8E83 01234567890');
  process.exit(1);
}

const {
  portalDetranConfigurado,
  aquecerSessaoPortalDetran,
  consultarPortalDetranDf,
  encerrarSessaoPortalDetran,
} = await import('../src/services/detranDfPortalPlaywright.js');
const { normalizarRespostaDetran } = await import('../src/services/detranDfMultas.js');

if (!portalDetranConfigurado()) {
  console.error(
    'Portal desabilitado. Defina DETRAN_PORTAL_ENABLED=true e DETRAN_PORTAL_CPF / DETRAN_PORTAL_SENHA no .env',
  );
  process.exit(1);
}

console.log('Aquecendo sessão (login + storageState)...');
try {
  await aquecerSessaoPortalDetran();
  console.log('Sessão OK');
} catch (e) {
  console.error('Warmup falhou:', e instanceof Error ? e.message : e);
  await encerrarSessaoPortalDetran().catch(() => {});
  process.exit(1);
}

console.log(`Consultando ${placa} / ${renavam}...`);
try {
  const bruto = await consultarPortalDetranDf({ placa, renavam });
  const normalizado = normalizarRespostaDetran(bruto, placa, renavam);
  console.log(JSON.stringify({
    fonte: 'detran-portal',
    placa: normalizado.placa,
    renavam: normalizado.renavam,
    qtd_multas: normalizado.multas.length,
    multas: normalizado.multas,
    ipva: bruto?.ipva ?? null,
    licenciamento: bruto?.licenciamento ?? null,
    amostra_dom: bruto?._dom_text_sample ? String(bruto._dom_text_sample).slice(0, 500) : null,
  }, null, 2));
} catch (e) {
  console.error('Consulta falhou:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await encerrarSessaoPortalDetran().catch(() => {});
}
