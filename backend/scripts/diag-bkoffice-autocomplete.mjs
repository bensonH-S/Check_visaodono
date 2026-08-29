/**
 * Lista opções do autocomplete de restaurante no BK Office.
 *   node backend/scripts/diag-bkoffice-autocomplete.mjs --q=30784
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, 'backend', '.env') });

const q = (process.argv.find((a) => a.startsWith('--q=')) || '--q=307').slice(4);
process.env.BKOFFICE_BRIGHTDATA = process.env.BKOFFICE_BRIGHTDATA || '1';

const { resolveBkOfficePlaywrightProxy, logProxyBkOffice } = await import(
  '../src/services/bkoffice/bkofficeProxy.js'
);
const { buildChromiumLaunchOptions } = await import('../src/services/playwrightBrowser.js');

const proxy = resolveBkOfficePlaywrightProxy();
logProxyBkOffice(proxy);
const playwright = await import('playwright');
const launchOpts = buildChromiumLaunchOptions({
  headless: true,
  preferChromeChannel: process.env.BKOFFICE_USE_CHROME === '1' || process.platform === 'win32',
});
if (proxy) {
  launchOpts.proxy = {
    server: proxy.server,
    username: proxy.username,
    password: proxy.password,
  };
}

const browser = await playwright.chromium.launch(launchOpts);
const page = await browser.newPage({
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
});
page.setDefaultTimeout(60000);

const user = process.env.BKOFFICE_USER;
const pass = process.env.BKOFFICE_PASS;
const base = process.env.BKOFFICE_URL || 'https://bkoffice-franquia.burgerking.com.br';

await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await page.locator('#user').fill(user);
await page.locator('#pass').fill(pass);
await page.locator('#button').click();
await page.waitForURL(/\/home/, { timeout: 45000 }).catch(() => {});
await page.locator('#btnBKoffice').click();
await page.waitForTimeout(300);
await page.locator('#btnreport').click();
await page.waitForTimeout(300);
await page.locator('#gRel h5 label').first().click().catch(async () => {
  await page.locator('#gRel').click();
});
await page.locator('#reportSales h5').click();
await page.waitForSelector('#initialDate', { timeout: 25000 });

await page.locator('#comboSectorGroup-autocomplete').click({ force: true });
await page.locator('#comboSectorGroup-autocomplete').fill('');
await page.locator('#comboSectorGroup-autocomplete').type('1005196', { delay: 15 });
await page.locator('ul.ui-autocomplete:visible').last().waitFor({ state: 'visible', timeout: 10000 });
await page.locator('ul.ui-autocomplete:visible').last().locator('li').first().click({ force: true });
await page.waitForTimeout(500);

const combo = page.locator('#comboRestauranteGroup-autocomplete');
await combo.click({ force: true });
await combo.fill('');
await combo.type(q, { delay: 30 });
await page.waitForTimeout(2500);
const texts = await page.evaluate(() =>
  [...document.querySelectorAll('ul.ui-autocomplete:visible li')].map((li) => li.textContent?.trim()),
);
console.log('query=', q);
console.log('opcoes=', texts);
await browser.close();
