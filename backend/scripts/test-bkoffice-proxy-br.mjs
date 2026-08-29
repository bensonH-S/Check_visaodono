/**
 * Diagnóstico: Bright Data BR → geo → BK Office (sem login ainda).
 *
 *   # no .env:
 *   BRIGHTDATA_PROXY_PASSWORD=...
 *   BKOFFICE_BRIGHTDATA=1
 *
 *   # janela visível (padrão deste script):
 *   node backend/scripts/test-bkoffice-proxy-br.mjs
 *
 *   # headless:
 *   BKOFFICE_HEADLESS=1 node backend/scripts/test-bkoffice-proxy-br.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, 'backend', '.env') });

process.env.BKOFFICE_BRIGHTDATA = process.env.BKOFFICE_BRIGHTDATA || '1';

const { resolveBkOfficePlaywrightProxy, logProxyBkOffice } = await import(
  '../src/services/bkoffice/bkofficeProxy.js'
);
const { buildChromiumLaunchOptions } = await import('../src/services/playwrightBrowser.js');

const BK_URL = process.env.BKOFFICE_URL || 'https://bkoffice-franquia.burgerking.com.br/';
const GEO_URL = 'https://geo.brdtest.com/mygeo.json';
// Diagnóstico: headful por padrão (ignora BKOFFICE_HEADLESS do .env).
const headless = process.env.TEST_PROXY_HEADLESS === '1';
const useChrome =
  process.env.BKOFFICE_USE_CHROME === '1' || process.platform === 'win32';

let proxy;
try {
  proxy = resolveBkOfficePlaywrightProxy();
} catch (e) {
  console.error('ERRO:', e.message);
  process.exit(1);
}
if (!proxy || proxy.provider !== 'brightdata') {
  console.error(
    'ERRO: Bright Data não configurado. Defina BRIGHTDATA_PROXY_PASSWORD (e BKOFFICE_BRIGHTDATA=1).',
  );
  process.exit(1);
}

const playwright = await import('playwright');
const launchOpts = buildChromiumLaunchOptions({
  headless,
  preferChromeChannel: useChrome,
  extraArgs: ['--disable-blink-features=AutomationControlled'],
});
launchOpts.proxy = {
  server: proxy.server,
  username: proxy.username,
  password: proxy.password,
};

console.log('Iniciando Chromium com proxy BR');
logProxyBkOffice(proxy);
console.log(`headless=${headless}`);

const browser = await playwright.chromium.launch(launchOpts);
const context = await browser.newContext({
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
  viewport: { width: 1280, height: 800 },
});
const page = await context.newPage();
page.setDefaultTimeout(90000);

try {
  console.log('Consultando geo.brdtest.com …');
  const geoResp = await page.goto(GEO_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const geoStatus = geoResp?.status();
  const geoText = await page.locator('body').innerText();
  let geoJson;
  try {
    geoJson = JSON.parse(geoText);
  } catch {
    geoJson = { raw: geoText.slice(0, 500) };
  }
  console.log('Geo HTTP status:', geoStatus);
  console.log('Geo JSON:', JSON.stringify(geoJson));
  const country = String(geoJson?.country || geoJson?.country_code || '').toUpperCase();
  if (country !== 'BR') {
    console.error(`FALHA: country=${country || '?'} (esperado BR). Pare e revise a zona Bright Data.`);
    process.exit(1);
  }
  console.log('OK country=BR');

  console.log('Abrindo BK Office');
  const bkResp = await page.goto(BK_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const httpStatus = bkResp?.status();
  const finalUrl = page.url();
  const title = await page.title();
  console.log('HTTP status recebido:', httpStatus);
  console.log('URL final carregada:', finalUrl);
  console.log('Título da página:', title);

  if (httpStatus === 403) {
    console.error('FALHA: BK Office ainda retornou 403 via proxy.');
    process.exit(1);
  }

  const temLogin = await page.locator('#user').isVisible().catch(() => false);
  console.log('Campo #user (login) visível:', temLogin);

  console.log('Mantendo navegador aberto 8s para inspeção…');
  await page.waitForTimeout(8000);
  console.log('TESTE PROXY OK — pode integrar login/download no fluxo normal.');
  process.exit(0);
} catch (e) {
  console.error('ERRO no teste:', e.message || e);
  process.exit(1);
} finally {
  await browser.close().catch(() => {});
}
