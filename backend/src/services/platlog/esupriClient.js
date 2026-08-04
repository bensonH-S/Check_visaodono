/**
 * Cliente Playwright do portal eSupri (Platlog).
 * Fluxo: login → financeiro → linha → botão NF-e → ZIP com XML.
 */
import { chromium } from 'playwright';

const DEFAULT_BASE = 'https://www.esupri.com.br';

/**
 * @param {{ user: string, pass: string, baseUrl?: string, headless?: boolean, limit?: number, onLog?: Function }} opts
 * @returns {Promise<Array<{ notaLabel: string, lojaLabel: string, valorLabel: string, statusLabel: string, zipBuffer: Buffer, fileName: string }>>}
 */
export async function baixarNfesFinanceiroEsupri({
  user,
  pass,
  baseUrl = DEFAULT_BASE,
  headless = true,
  limit = 10,
  onLog = () => {},
} = {}) {
  if (!user || !pass) {
    throw Object.assign(new Error('Informe usuário e senha eSupri (ESUPRI_USER / ESUPRI_PASS)'), {
      status: 400,
    });
  }

  const base = String(baseUrl || DEFAULT_BASE).replace(/\/$/, '');
  // Preferir Chrome instalado no Windows (evita baixar Chromium do Playwright).
  const useChrome = process.env.ESUPRI_USE_CHROME !== '0';
  const launchOpts = {
    headless,
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
  };
  if (useChrome) {
    launchOpts.channel = 'chrome';
    if (headless) launchOpts.args.push('--headless=new');
  }

  let browser;
  try {
    browser = await chromium.launch(launchOpts);
  } catch (e) {
    if (useChrome) {
      onLog(`Chrome canal falhou (${e.message}) — tentando Chromium Playwright`);
      delete launchOpts.channel;
      launchOpts.args = launchOpts.args.filter((a) => a !== '--headless=new');
      browser = await chromium.launch(launchOpts);
    } else {
      throw e;
    }
  }

  const context = await browser.newContext({
    acceptDownloads: true,
    locale: 'pt-BR',
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();
  const resultados = [];

  try {
    onLog('login');
    await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.fill('input[name="login"]', user);
    await page.fill('input[name="senha"]', pass);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
      page.locator('button[type="submit"], input[type="submit"]').first().click(),
    ]);

    onLog('home');
    await page.goto(`${base}/esupri.php?Do=home`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    onLog('financeiro');
    await page.locator('#menu_financeiro > a').click();
    await page.locator('#tbFinanceiro tbody tr').first().waitFor({ state: 'visible', timeout: 30000 });

    const rows = page.locator('#tbFinanceiro tbody tr');
    await rows.first().waitFor({ state: 'visible', timeout: 30000 });
    const total = await rows.count();
    const alvo = Math.max(1, Number(limit) || 10);
    onLog(`linhas=${total} alvo=${alvo}`);

    for (let i = 0; i < total && resultados.length < alvo; i++) {
      // re-localiza a cada iteração (DOM do eSupri pode recriar a tabela)
      const row = page.locator('#tbFinanceiro tbody tr').nth(i);
      if (!(await row.count())) {
        onLog(`linha ${i + 1}: sumiu — parando`);
        break;
      }
      const cells = await row.locator('td').allTextContents().catch(() => []);
      const notaLabel = (cells[0] || '').trim();
      const lojaLabel = (cells[1] || '').trim();
      const valorLabel = (cells[4] || '').trim();
      const statusLabel = (cells[5] || '').trim();
      if (!notaLabel || !/NF/i.test(notaLabel)) {
        onLog(`linha ${i + 1}: vazia/sem NF — pulando`);
        continue;
      }
      onLog(`pedido ${resultados.length + 1}/${alvo}: ${notaLabel} ${valorLabel}`);

      try {
        await row.click({ timeout: 15000 });
        await page.waitForTimeout(1200);

        const nfeBtn = page.locator('aside button', { hasText: 'NF-e' }).first();
        await nfeBtn.waitFor({ state: 'visible', timeout: 15000 });

        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 45000 }),
          nfeBtn.click(),
        ]);

        const fileName = download.suggestedFilename() || `nfe-${resultados.length + 1}.zip`;
        const tmp = await download.path();
        let zipBuffer;
        if (tmp) {
          const fs = await import('fs');
          zipBuffer = fs.readFileSync(tmp);
        } else {
          zipBuffer = await streamToBuffer(download.createReadStream());
        }

        resultados.push({
          notaLabel,
          lojaLabel,
          valorLabel,
          statusLabel,
          zipBuffer,
          fileName,
        });
      } catch (e) {
        onLog(`falha ${notaLabel}: ${String(e.message || e).slice(0, 120)}`);
      }

      await page.waitForTimeout(600);
    }

    return resultados;
  } finally {
    await browser.close();
  }
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
