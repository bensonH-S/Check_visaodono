/**
 * Resolve executável Chromium/Chrome para Playwright (Windows / Docker / Linux).
 */
import fs from 'fs';

const CANDIDATES = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  process.env.BKOFFICE_CHROMIUM_PATH,
  process.env.ESUPRI_CHROMIUM_PATH,
  process.env.CHROMIUM_PATH,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
].filter(Boolean);

export function resolveChromiumExecutable() {
  for (const p of CANDIDATES) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Monta opções de launch do Playwright.
 * Em Linux/produção NÃO cai no cache vazio do Playwright se houver Chromium do sistema.
 */
export function buildChromiumLaunchOptions({
  headless = true,
  preferChromeChannel = false,
  downloadsPath = undefined,
  extraArgs = [],
} = {}) {
  const args = ['--disable-dev-shm-usage', '--no-sandbox', ...extraArgs];
  const opts = { headless, args };

  if (downloadsPath) opts.downloadsPath = downloadsPath;

  const execPath = resolveChromiumExecutable();
  if (execPath) {
    opts.executablePath = execPath;
    return opts;
  }

  // Canal Chrome só faz sentido no Windows com Chrome instalado
  if (preferChromeChannel && process.platform === 'win32') {
    opts.channel = 'chrome';
    if (headless) opts.args.push('--headless=new');
  }

  return opts;
}
