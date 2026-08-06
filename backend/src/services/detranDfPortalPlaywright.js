/**
 * Consulta débitos/multas no portal DETRAN-DF via Playwright.
 * Login CPF/senha + storageState; caminho: Veículos → consulta outra UF → placa/RENAVAM.
 *
 * Env:
 *   DETRAN_PORTAL_ENABLED=true
 *   DETRAN_PORTAL_CPF / DETRAN_PORTAL_SENHA  (aliases: DETRAN_DF_LOGIN_*, INFOSIMPLES_LOGIN_*)
 *   DETRAN_PORTAL_URL=https://portal.detran.df.gov.br
 *   DETRAN_PORTAL_HEADLESS=1|0
 *   DETRAN_PORTAL_STORAGE=caminho do storageState.json
 *   DETRAN_PORTAL_CONSULTA_PATH=caminho relativo opcional (atalho pós-login)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { logger } from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const DEFAULT_STORAGE = path.join(DATA_DIR, 'detran-df-storage.json');

function envStr(...keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v == null) continue;
    let s = String(v).trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1).trim();
    }
    if (s) return s;
  }
  return '';
}

function envBool(key, defaultTrue = true) {
  const v = envStr(key);
  if (!v) return defaultTrue;
  return !/^(0|false|off|nao|não|no)$/i.test(v);
}

const PORTAL_URL = (envStr('DETRAN_PORTAL_URL') || 'https://portal.detran.df.gov.br').replace(
  /\/$/,
  '',
);
const CONSULTA_PATH = envStr('DETRAN_PORTAL_CONSULTA_PATH');
const HEADLESS = envBool('DETRAN_PORTAL_HEADLESS', true);
const STORAGE_PATH = envStr('DETRAN_PORTAL_STORAGE') || DEFAULT_STORAGE;
const TIMEOUT_MS = Number(envStr('DETRAN_PORTAL_TIMEOUT_MS') || 90000);

/** Seletores centralizados — ajustar se o layout do portal mudar. */
const SEL = {
  cpf: [
    'input[name*="cpf" i]',
    'input[id*="cpf" i]',
    'input[placeholder*="CPF" i]',
    'input[formcontrolname*="cpf" i]',
    'input[type="text"][autocomplete="username"]',
    'input[type="tel"]',
  ],
  senha: [
    'input[type="password"]',
    'input[name*="senha" i]',
    'input[id*="senha" i]',
    'input[formcontrolname*="senha" i]',
    'input[formcontrolname*="password" i]',
  ],
  btnEntrar: [
    'button:has-text("Entrar")',
    'button:has-text("Acessar")',
    'button:has-text("Login")',
    'button[type="submit"]',
    'input[type="submit"]',
  ],
  menuVeiculos: [
    'a:has-text("Veículos")',
    'button:has-text("Veículos")',
    '[role="button"]:has-text("Veículos")',
    'span:has-text("Veículos")',
  ],
  consultaOutraUf: [
    'a:has-text("outra UF")',
    'a:has-text("Outra UF")',
    'button:has-text("outra UF")',
    'a:has-text("Veículo de Outra")',
    'a:has-text("Consulta de Veículo de Outra")',
    'mat-list-item:has-text("Outra UF")',
    'button.mat-menu-item:has-text("Outra UF")',
  ],
  placa: [
    'input[name*="placa" i]',
    'input[id*="placa" i]',
    'input[placeholder*="Placa" i]',
    'input[formcontrolname*="placa" i]',
  ],
  renavam: [
    'input[name*="renavam" i]',
    'input[id*="renavam" i]',
    'input[placeholder*="RENAVAM" i]',
    'input[placeholder*="Renavam" i]',
    'input[formcontrolname*="renavam" i]',
  ],
  btnConsultar: [
    'button:has-text("Consultar")',
    'button:has-text("Pesquisar")',
    'button:has-text("Buscar")',
    'button[type="submit"]',
  ],
};

let chain = Promise.resolve();
/** @type {import('playwright').Browser | null} */
let browser = null;
/** @type {import('playwright').BrowserContext | null} */
let context = null;
/** @type {import('playwright').Page | null} */
let page = null;

function withLock(fn) {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function portalDetranConfigurado() {
  if (!envBool('DETRAN_PORTAL_ENABLED', false)) return false;
  const cpf = envStr('DETRAN_PORTAL_CPF', 'DETRAN_DF_LOGIN_CPF', 'INFOSIMPLES_LOGIN_CPF');
  const senha = envStr('DETRAN_PORTAL_SENHA', 'DETRAN_DF_LOGIN_SENHA', 'INFOSIMPLES_LOGIN_SENHA');
  return Boolean(cpf && senha);
}

function credenciais() {
  const cpf = envStr('DETRAN_PORTAL_CPF', 'DETRAN_DF_LOGIN_CPF', 'INFOSIMPLES_LOGIN_CPF').replace(
    /\D/g,
    '',
  );
  const senha = envStr('DETRAN_PORTAL_SENHA', 'DETRAN_DF_LOGIN_SENHA', 'INFOSIMPLES_LOGIN_SENHA');
  if (!cpf || !senha) {
    throw Object.assign(new Error('DETRAN_PORTAL_CPF / DETRAN_PORTAL_SENHA não configurados'), {
      code: 'DETRAN_PORTAL_NO_CREDS',
    });
  }
  return { cpf, senha };
}

async function primeiroVisivel(pageOrFrame, selectors, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const sel of selectors) {
      try {
        const loc = pageOrFrame.locator(sel).first();
        if (await loc.isVisible({ timeout: 400 }).catch(() => false)) {
          return loc;
        }
      } catch {
        /* next */
      }
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

async function clicarPrimeiro(pageOrFrame, selectors, timeout = 8000) {
  const loc = await primeiroVisivel(pageOrFrame, selectors, timeout);
  if (!loc) return false;
  await fecharOverlays(pageOrFrame);
  try {
    await loc.click({ timeout: 8000 });
  } catch {
    await loc.click({ force: true, timeout: 5000 });
  }
  return true;
}

/** Fecha menus/tooltips Angular Material que bloqueiam o clique. */
async function fecharOverlays(p) {
  try {
    await p.keyboard.press('Escape');
  } catch {
    /* ok */
  }
  await p
    .evaluate(() => {
      document.querySelectorAll('.cdk-overlay-backdrop').forEach((el) => {
        try {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        } catch {
          /* ok */
        }
      });
    })
    .catch(() => {});
  await new Promise((r) => setTimeout(r, 250));
  try {
    await p.keyboard.press('Escape');
  } catch {
    /* ok */
  }
}

function textoPaginaSuspeitoMfa(texto) {
  return /gov\.br|autentica[cç][aã]o\s+em\s+dois|c[oó]digo\s+(sms|otp)|qr\s*code|token\s+de\s+seguran[cç]a|verifique\s+sua\s+identidade/i.test(
    texto,
  );
}

async function paginaTemRecaptcha(p) {
  const iframe = p.locator('iframe[src*="recaptcha"], iframe[title*="reCAPTCHA" i]').first();
  if (await iframe.isVisible({ timeout: 800 }).catch(() => false)) return true;
  const texto = ((await p.innerText('body').catch(() => '')) || '').slice(0, 4000);
  if (/recaptcha|n[aã]o\s+sou\s+um\s+rob[oô]/i.test(texto)) return true;
  const hasGrecaptcha = await p.evaluate(() => Boolean(window.grecaptcha)).catch(() => false);
  return hasGrecaptcha;
}

/**
 * Portal DETRAN usa reCAPTCHA v2 (sitekey 6LcyD8EZ...). Automação não resolve sozinha.
 * Em modo com janela (HEADLESS=0), espera o usuário resolver; senão falha com erro claro.
 */
async function aguardarRecaptchaSeNecessario(p) {
  if (!(await paginaTemRecaptcha(p))) return;

  const waitMs = Number(envStr('DETRAN_PORTAL_CAPTCHA_WAIT_MS') || 180000);
  if (HEADLESS) {
    throw Object.assign(
      new Error(
        'DETRAN_PORTAL_CAPTCHA: portal exige reCAPTCHA. Rode com DETRAN_PORTAL_HEADLESS=0, ' +
          'resolva o captcha manualmente uma vez (sessão fica em backend/data/detran-df-storage.json).',
      ),
      { code: 'DETRAN_PORTAL_CAPTCHA' },
    );
  }

  logger.warn(
    'detran-portal',
    `reCAPTCHA detectado — VOCÊ precisa marcar "Não sou um robô" na janela do Chrome (até ${Math.round(waitMs / 1000)}s). A IA não resolve captcha.`,
  );

  const inicio = Date.now();
  while (Date.now() - inicio < waitMs) {
    const url = p.url();
    if (!/#\/login/i.test(url) && !(await primeiroVisivel(p, SEL.senha, 600))) {
      return;
    }

    const tokenOk = await p
      .evaluate(() => {
        const el = document.querySelector('#g-recaptcha-response, textarea[name="g-recaptcha-response"]');
        return Boolean(el && String(el.value || '').trim().length > 20);
      })
      .catch(() => false);

    if (tokenOk) {
      await fecharOverlays(p);
      await clicarPrimeiro(p, SEL.btnEntrar, 2000).catch(() => {});
      await p.waitForTimeout(1500);
      if (!/#\/login/i.test(p.url()) && !(await primeiroVisivel(p, SEL.senha, 600))) return;
    }
    await p.waitForTimeout(1500);
  }

  throw Object.assign(
    new Error(
      'DETRAN_PORTAL_CAPTCHA: tempo esgotado. Rode: node backend/scripts/login-detran-portal.mjs e resolva o captcha manualmente.',
    ),
    { code: 'DETRAN_PORTAL_CAPTCHA' },
  );
}

function pareceTelaLogin(texto) {
  return (
    (/cpf/i.test(texto) && /senha/i.test(texto) && /entrar|acessar|login/i.test(texto)) ||
    /entrar\s+com\s+gov\.br/i.test(texto)
  );
}

async function detectarEstadoAuth(p) {
  const url = p.url();
  if (/#\/login/i.test(url)) return 'login';

  const texto = ((await p.innerText('body').catch(() => '')) || '').slice(0, 8000);
  if (textoPaginaSuspeitoMfa(texto) && !/d[eé]bitos|multas|ve[ií]culo/i.test(texto.slice(0, 500))) {
    return 'mfa';
  }
  if (/entrar\s+com\s+gov\.br/i.test(texto) && !(await primeiroVisivel(p, SEL.cpf, 1200))) {
    return 'govbr';
  }
  if (await primeiroVisivel(p, SEL.senha, 1200)) return 'login';
  if (pareceTelaLogin(texto) && (await primeiroVisivel(p, SEL.cpf, 1200))) return 'login';

  // Botão Entrar visível no header = visitante
  const btnEntrarHeader = await p
    .locator('a:has-text("Entrar"), button:has-text("Entrar")')
    .first()
    .isVisible({ timeout: 600 })
    .catch(() => false);
  if (btnEntrarHeader) return 'login';

  // Evidência POSITIVA de sessão (não assume ok só por estar fora do #/login)
  const logado = await p
    .evaluate(() => {
      const t = (document.body?.innerText || '').slice(0, 12000);
      if (/\bSair\b/i.test(t) || /\bLogout\b/i.test(t)) return true;
      if (/minha\s+conta/i.test(t)) return true;
      // Tooltip típico do portal quando NÃO logado
      if (/necess[aá]rio estar logado/i.test(t)) return false;
      const userEl = document.querySelector(
        '[class*="user-name"], [class*="usuario"], .header-user, .mat-toolbar .user',
      );
      if (userEl && (userEl.textContent || '').trim().length > 1) return true;
      return null;
    })
    .catch(() => null);

  if (logado === true) return 'ok';
  if (logado === false) return 'login';

  // Sem evidência clara → trata como não logado (força login / script manual)
  return 'login';
}

function erroNaoLogado() {
  return Object.assign(
    new Error(
      'DETRAN_PORTAL_NAO_LOGADO: sessão inválida. Rode no terminal: node backend/scripts/login-detran-portal.mjs — resolva o reCAPTCHA na janela e só depois use Atualizar consulta.',
    ),
    { code: 'DETRAN_PORTAL_NAO_LOGADO' },
  );
}

async function assertLogado(p) {
  const estado = await detectarEstadoAuth(p);
  if (estado === 'ok') return;
  throw erroNaoLogado();
}

async function launchBrowser() {
  const useChrome = process.env.DETRAN_PORTAL_USE_CHROME !== '0';
  const launchOpts = {
    headless: HEADLESS,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  };
  if (useChrome) {
    launchOpts.channel = 'chrome';
    if (HEADLESS) launchOpts.args.push('--headless=new');
  }
  try {
    return await chromium.launch(launchOpts);
  } catch (e) {
    if (useChrome) {
      logger.warn('detran-portal', `Chrome falhou (${e.message}) — tentando Chromium`);
      delete launchOpts.channel;
      launchOpts.args = launchOpts.args.filter((a) => a !== '--headless=new');
      return chromium.launch(launchOpts);
    }
    throw e;
  }
}

async function garantirBrowser() {
  if (browser && context && page && !page.isClosed()) return;
  await encerrarSessaoPortalDetranInterno();

  fs.mkdirSync(path.dirname(STORAGE_PATH), { recursive: true });
  browser = await launchBrowser();

  const opts = {
    locale: 'pt-BR',
    viewport: { width: 1400, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  };
  if (fs.existsSync(STORAGE_PATH)) {
    opts.storageState = STORAGE_PATH;
  }
  context = await browser.newContext(opts);
  page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
}

async function salvarStorage() {
  if (!context) return;
  fs.mkdirSync(path.dirname(STORAGE_PATH), { recursive: true });
  await context.storageState({ path: STORAGE_PATH });
}

async function limparStorage() {
  try {
    if (fs.existsSync(STORAGE_PATH)) fs.unlinkSync(STORAGE_PATH);
  } catch {
    /* ok */
  }
}

async function fazerLogin(p, { forcar = false } = {}) {
  const { cpf, senha } = credenciais();
  if (forcar) await limparStorage();

  const loginUrl = `${PORTAL_URL}/#/login`;
  await p.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
  await p.waitForTimeout(1000);

  let estado = await detectarEstadoAuth(p);
  if (estado === 'mfa' || estado === 'govbr') {
    throw Object.assign(
      new Error(
        estado === 'mfa'
          ? 'DETRAN_PORTAL_MFA_REQUIRED: portal pediu MFA/verificação adicional'
          : 'DETRAN_PORTAL_MFA_REQUIRED: portal exige Entrar com gov.br (sem formulário CPF/senha)',
      ),
      { code: 'DETRAN_PORTAL_MFA_REQUIRED' },
    );
  }

  // Já autenticado (storageState válido) — fora de #/login
  if (estado === 'ok' && !/#\/login/i.test(p.url())) {
    return;
  }

  // Se storage redirecionou para home, ok
  await p.goto(PORTAL_URL + '/', { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS }).catch(() => {});
  await p.waitForTimeout(600);
  estado = await detectarEstadoAuth(p);
  if (estado === 'ok' && !/#\/login/i.test(p.url()) && !(await primeiroVisivel(p, SEL.senha, 800))) {
    return;
  }

  await p.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
  await p.waitForTimeout(800);

  const cpfLoc = await primeiroVisivel(p, SEL.cpf, 15000);
  const senhaLoc = await primeiroVisivel(p, SEL.senha, 5000);
  if (!cpfLoc || !senhaLoc) {
    throw new Error(
      'Portal DETRAN-DF: formulário CPF/senha não encontrado em #/login. Use node backend/scripts/login-detran-portal.mjs',
    );
  }

  await cpfLoc.fill('');
  await cpfLoc.fill(cpf);
  await senhaLoc.fill('');
  await senhaLoc.fill(senha);

  logger.warn(
    'detran-portal',
    'Preenchai CPF/senha. Se aparecer reCAPTCHA, resolva VOCÊ na janela (a IA não consegue).',
  );
  await aguardarRecaptchaSeNecessario(p);

  await fecharOverlays(p);
  const submeteu = await clicarPrimeiro(p, SEL.btnEntrar, 5000);
  if (!submeteu) {
    await senhaLoc.press('Enter').catch(() => {});
  }

  await p.waitForLoadState('domcontentloaded', { timeout: TIMEOUT_MS }).catch(() => {});
  await p.waitForTimeout(1500);
  await aguardarRecaptchaSeNecessario(p);

  // Espera sair de #/login
  const waitMs = Number(envStr('DETRAN_PORTAL_CAPTCHA_WAIT_MS') || 180000);
  const inicio = Date.now();
  while (Date.now() - inicio < waitMs) {
    if (!/#\/login/i.test(p.url()) && !(await primeiroVisivel(p, SEL.senha, 600))) break;
    if (await paginaTemRecaptcha(p)) {
      await aguardarRecaptchaSeNecessario(p);
    }
    await p.waitForTimeout(1000);
  }

  estado = await detectarEstadoAuth(p);
  if (estado === 'login' || /#\/login/i.test(p.url())) {
    throw new Error(
      'Portal DETRAN-DF: login não concluído (reCAPTCHA ou senha). Rode: node backend/scripts/login-detran-portal.mjs',
    );
  }

  await assertLogado(p);
  await salvarStorage();
  logger.info('detran-portal', 'Login OK — storageState salvo');
}

const ROTAS_CONSULTA_CANDIDATAS = [
  '/#/veiculos/consulta-debitos',
  '/#/veiculos/consulta/debitos',
  '/#/veiculos/debitos',
  '/#/servicos/veiculos/consulta-debitos',
  '/#/veiculo/consulta-debitos',
];

async function irParaConsulta(p) {
  await assertLogado(p);
  await fecharOverlays(p);

  if (CONSULTA_PATH) {
    const url = CONSULTA_PATH.startsWith('http')
      ? CONSULTA_PATH
      : `${PORTAL_URL}${CONSULTA_PATH.startsWith('/') || CONSULTA_PATH.startsWith('#') ? '' : '/'}${CONSULTA_PATH}`;
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    await p.waitForTimeout(800);
    await assertLogado(p);
    if (await primeiroVisivel(p, SEL.placa, 5000)) return;
  }

  // Tenta rotas hash conhecidas (evita menu com overlay)
  for (const rota of ROTAS_CONSULTA_CANDIDATAS) {
    await p.goto(`${PORTAL_URL}${rota}`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS }).catch(() => {});
    await p.waitForTimeout(700);
    const body = (await p.innerText('body').catch(() => '')) || '';
    if (/necess[aá]rio estar logado|possuir permiss[aã]o/i.test(body)) {
      throw erroNaoLogado();
    }
    if (await primeiroVisivel(p, SEL.placa, 2500)) return;
  }

  await fecharOverlays(p);
  const abriuMenu = await clicarPrimeiro(p, SEL.menuVeiculos, 8000);
  if (!abriuMenu) {
    throw new Error(
      'Portal DETRAN-DF: menu Veículos não encontrado. Defina DETRAN_PORTAL_CONSULTA_PATH com a URL da consulta.',
    );
  }
  await p.waitForTimeout(500);
  await fecharOverlays(p);

  // Só seletores de link/botão concretos (nunca text=/.../ no app-root)
  const candidatos = [
    ...SEL.consultaOutraUf,
    'a:has-text("Consulta de débitos")',
    'a:has-text("Consulta de Debitos")',
    'a:has-text("Consultar débitos")',
    'button:has-text("Débitos")',
    'a:has-text("Débitos")',
    'mat-list-item:has-text("Débitos")',
    'button.mat-menu-item:has-text("Débitos")',
  ];

  const ok = await clicarPrimeiro(p, candidatos, 10000);
  if (!ok) {
    throw new Error(
      'Portal DETRAN-DF: não achou consulta de débitos. Logado no Chrome, abra a tela de consulta, copie a URL (#/...) e coloque em DETRAN_PORTAL_CONSULTA_PATH no .env',
    );
  }
  await p.waitForTimeout(800);

  const body = (await p.innerText('body').catch(() => '')) || '';
  if (/necess[aá]rio estar logado|possuir permiss[aã]o/i.test(body)) {
    throw erroNaoLogado();
  }
  if (!(await primeiroVisivel(p, SEL.placa, 8000))) {
    throw new Error(
      'Portal DETRAN-DF: tela abriu sem campo placa. Defina DETRAN_PORTAL_CONSULTA_PATH com a URL correta.',
    );
  }
}

function parseValorBr(txt) {
  if (txt == null || txt === '') return null;
  const s = String(txt)
    .replace(/R\$\s*/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseDataBr(s) {
  if (!s) return null;
  const t = String(s).trim();
  const m = t.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return null;
}

/**
 * Extrai multas de tabelas / cards no DOM.
 */
async function extrairDoDom(p, placa, renavam) {
  const snapshot = await p.evaluate(() => {
    const bodyText = document.body?.innerText || '';
    const tables = [...document.querySelectorAll('table')].map((tb) => {
      const headers = [...tb.querySelectorAll('thead th, tr:first-child th, tr:first-child td')].map(
        (c) => (c.innerText || '').trim(),
      );
      const rows = [...tb.querySelectorAll('tbody tr, tr')]
        .slice(headers.length ? 0 : 1)
        .map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').trim()))
        .filter((r) => r.some(Boolean));
      return { headers, rows };
    });
    return { bodyText: bodyText.slice(0, 50000), tables };
  });

  const infracoes = [];
  for (const tb of snapshot.tables) {
    const headersLower = tb.headers.map((h) => h.toLowerCase());
    const pareceMulta =
      headersLower.some((h) => /multa|infra[cç]|ait|auto|enquadr|valor|venci/i.test(h)) ||
      tb.rows.some((r) => r.some((c) => /R\$\s*\d/i.test(c)));
    if (!pareceMulta && tb.rows.length === 0) continue;

    for (let i = 0; i < tb.rows.length; i++) {
      const row = tb.rows[i];
      if (!row.length) continue;
      // Pular linha de cabeçalho se veio no tbody
      if (row.every((c, idx) => c === tb.headers[idx])) continue;

      const joined = row.join(' | ');
      if (/^total|ipva|licenciamento$/i.test(row[0] || '') && row.length <= 3) continue;

      const valorCell = row.find((c) => /R\$|\d+,\d{2}/.test(c));
      const dataCell = row.find((c) => /\d{2}\/\d{2}\/\d{4}/.test(c));
      const auto =
        row.find((c, idx) => {
          const h = headersLower[idx] || '';
          return /ait|auto|n[ºo°]|processo/i.test(h);
        }) ||
        row.find((c) => /^[A-Z0-9-]{5,}$/i.test(c) && !/^\d{2}\/\d{2}/.test(c)) ||
        String(i + 1);

      const descIdx = headersLower.findIndex((h) => /desc|infra|enquadr|natureza/i.test(h));
      const descricao =
        (descIdx >= 0 ? row[descIdx] : null) ||
        row.find((c) => c.length > 20 && !/R\$/.test(c)) ||
        joined;

      infracoes.push({
        ait: auto,
        descricao,
        valor: valorCell || null,
        data: dataCell || null,
        vencimento:
          row.find((c, idx) => /venci/i.test(headersLower[idx] || '') && /\d{2}\/\d{2}/.test(c)) ||
          null,
        orgao:
          row.find((c, idx) => /[oó]rg[aã]o|autuador/i.test(headersLower[idx] || '')) || null,
        local: row.find((c, idx) => /local/i.test(headersLower[idx] || '')) || null,
        situacao:
          row.find((c, idx) => /situa[cç]|status/i.test(headersLower[idx] || '')) || null,
      });
    }
  }

  // Fallback: blocos de texto com "Multa"
  if (!infracoes.length) {
    const blocos = snapshot.bodyText.split(/\n{2,}/);
    for (const bloco of blocos) {
      if (!/multa|infra[cç][aã]o/i.test(bloco)) continue;
      if (!/R\$|\d+,\d{2}/.test(bloco)) continue;
      const valorM = bloco.match(/R\$\s*([\d.]+,\d{2})/);
      const dataM = bloco.match(/(\d{2}\/\d{2}\/\d{4})/);
      infracoes.push({
        ait: String(infracoes.length + 1),
        descricao: bloco.replace(/\s+/g, ' ').trim().slice(0, 400),
        valor: valorM ? valorM[0] : null,
        data: dataM ? dataM[1] : null,
      });
    }
  }

  const ipvaM = snapshot.bodyText.match(/IPVA[^\n]{0,40}?R\$\s*([\d.]+,\d{2})/i);
  const licM = snapshot.bodyText.match(/Licenciamento[^\n]{0,40}?R\$\s*([\d.]+,\d{2})/i);

  return {
    placa,
    renavam,
    veiculo: { placa, renavam },
    infracoes: infracoes.map((item) => ({
      ...item,
      valor: typeof item.valor === 'string' ? parseValorBr(item.valor) : item.valor,
      valorCorrigido: typeof item.valor === 'string' ? parseValorBr(item.valor) : item.valor,
      dataInfracao: parseDataBr(item.data) || item.data,
      dataVencimento: parseDataBr(item.vencimento) || item.vencimento,
    })),
    ipva: ipvaM ? parseValorBr(ipvaM[1]) : null,
    licenciamento: licM ? parseValorBr(licM[1]) : null,
    _dom_text_sample: snapshot.bodyText.slice(0, 1500),
  };
}

/**
 * Tenta capturar JSON de respostas de rede durante a consulta.
 */
function anexarCapturaJson(p, bucket) {
  const handler = async (res) => {
    try {
      const ct = (res.headers()['content-type'] || '').toLowerCase();
      if (!ct.includes('json')) return;
      const url = res.url();
      if (!/veiculo|debito|multa|infrac|renavam|consulta|placa/i.test(url)) return;
      const data = await res.json().catch(() => null);
      if (data && typeof data === 'object') bucket.push({ url, data });
    } catch {
      /* ignore */
    }
  };
  p.on('response', handler);
  return () => p.off('response', handler);
}

function payloadDeRede(capturas, placa, renavam) {
  for (const { data } of capturas) {
    if (!data || typeof data !== 'object') continue;
    if (
      Array.isArray(data.infracoes) ||
      Array.isArray(data.multas) ||
      Array.isArray(data.debitos?.infracoes_veiculo) ||
      Array.isArray(data.data?.[0]?.infracoes) ||
      Array.isArray(data.data?.[0]?.multas)
    ) {
      return data;
    }
    // Envelope genérico
    if (data.veiculo || data.placa) return data;
  }
  return null;
}

async function consultarNaPagina(p, placa, renavam) {
  await irParaConsulta(p);

  const capturas = [];
  const detach = anexarCapturaJson(p, capturas);

  try {
    const placaLoc = await primeiroVisivel(p, SEL.placa, 20000);
    const renavamLoc = await primeiroVisivel(p, SEL.renavam, 10000);
    if (!placaLoc || !renavamLoc) {
      throw new Error('Portal DETRAN-DF: campos placa/RENAVAM não encontrados na consulta');
    }

    await placaLoc.fill('');
    await placaLoc.fill(placa);
    await renavamLoc.fill('');
    await renavamLoc.fill(renavam);

    const ok = await clicarPrimeiro(p, SEL.btnConsultar, 8000);
    if (!ok) await renavamLoc.press('Enter').catch(() => {});

    await p.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
    await p.waitForTimeout(1200);

    const estado = await detectarEstadoAuth(p);
    if (estado === 'login') {
      const err = new Error('SESSION_EXPIRED');
      err.code = 'SESSION_EXPIRED';
      throw err;
    }
    if (estado === 'mfa' || estado === 'govbr') {
      throw Object.assign(new Error('DETRAN_PORTAL_MFA_REQUIRED durante consulta'), {
        code: 'DETRAN_PORTAL_MFA_REQUIRED',
      });
    }

    const daRede = payloadDeRede(capturas, placa, renavam);
    if (daRede) {
      return { ...daRede, placa: daRede.placa || placa, renavam: daRede.renavam || renavam };
    }

    const doDom = await extrairDoDom(p, placa, renavam);
    // Sem multas não é erro — veículo pode estar limpo
    return doDom;
  } finally {
    detach();
  }
}

async function fluxoConsulta(placa, renavam, { relogou = false } = {}) {
  await garantirBrowser();
  const p = page;

  await p.goto(PORTAL_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
  await p.waitForTimeout(500);

  let estado = await detectarEstadoAuth(p);
  if (estado !== 'ok') {
    if (estado === 'mfa' || estado === 'govbr') {
      throw Object.assign(
        new Error(
          estado === 'mfa'
            ? 'DETRAN_PORTAL_MFA_REQUIRED'
            : 'DETRAN_PORTAL_MFA_REQUIRED: exige gov.br',
        ),
        { code: 'DETRAN_PORTAL_MFA_REQUIRED' },
      );
    }
    // Em headless o reCAPTCHA impede login automático
    if (HEADLESS) throw erroNaoLogado();
    await fazerLogin(p, { forcar: true });
  }

  await assertLogado(p);

  try {
    return await consultarNaPagina(p, placa, renavam);
  } catch (e) {
    if (
      e?.code === 'SESSION_EXPIRED' ||
      e?.code === 'DETRAN_PORTAL_NAO_LOGADO' ||
      /SESSION_EXPIRED|NAO_LOGADO/i.test(e?.message || '')
    ) {
      if (relogou || HEADLESS) throw erroNaoLogado();
      logger.warn('detran-portal', 'Sessão inválida — tentando login com janela');
      await fazerLogin(p, { forcar: true });
      return fluxoConsulta(placa, renavam, { relogou: true });
    }
    throw e;
  }
}

/**
 * Login interativo (janela Chrome): você resolve o reCAPTCHA; a sessão é salva.
 * Use antes do sync headless.
 */
export async function loginInterativoPortalDetran() {
  if (!portalDetranConfigurado()) {
    throw new Error('Configure DETRAN_PORTAL_ENABLED + CPF/SENHA no .env');
  }
  // Força janela visível nesta chamada
  process.env.DETRAN_PORTAL_HEADLESS = '0';
  return withLock(async () => {
    await limparStorage();
    await encerrarSessaoPortalDetranInterno();
    await garantirBrowser();
    await fazerLogin(page, { forcar: true });
    await salvarStorage();
    const url = page.url();
    return { ok: true, url, storage: STORAGE_PATH };
  });
}

/**
 * Garante browser + login (útil no início do sync diário).
 */
export async function aquecerSessaoPortalDetran() {
  if (!portalDetranConfigurado()) return { ok: false, motivo: 'desabilitado' };
  return withLock(async () => {
    await garantirBrowser();
    await page.goto(PORTAL_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    await page.waitForTimeout(500);
    if ((await detectarEstadoAuth(page)) !== 'ok') {
      if (HEADLESS) throw erroNaoLogado();
      await fazerLogin(page, { forcar: true });
    }
    await assertLogado(page);
    return { ok: true };
  });
}

/**
 * Consulta um veículo no portal. Retorna payload bruto compatível com normalizarRespostaDetran.
 */
export async function consultarPortalDetranDf({ placa, renavam }) {
  if (!portalDetranConfigurado()) {
    throw new Error('Portal DETRAN-DF desabilitado ou sem CPF/senha');
  }
  const placaN = String(placa || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  const renavamN = String(renavam || '').replace(/\D/g, '');

  return withLock(async () => {
    const inicio = Date.now();
    const bruto = await fluxoConsulta(placaN, renavamN);
    logger.info(
      'detran-portal',
      `${placaN} consultado em ${Date.now() - inicio}ms (${Array.isArray(bruto?.infracoes) ? bruto.infracoes.length : Array.isArray(bruto?.multas) ? bruto.multas.length : '?'} multa(s))`,
    );
    await salvarStorage().catch(() => {});
    return bruto;
  });
}

async function encerrarSessaoPortalDetranInterno() {
  try {
    if (page && !page.isClosed()) await page.close().catch(() => {});
  } catch {
    /* ok */
  }
  try {
    if (context) await context.close().catch(() => {});
  } catch {
    /* ok */
  }
  try {
    if (browser) await browser.close().catch(() => {});
  } catch {
    /* ok */
  }
  page = null;
  context = null;
  browser = null;
}

/** Fecha browser (fim do sync). Mantém storageState em disco. */
export async function encerrarSessaoPortalDetran() {
  return withLock(() => encerrarSessaoPortalDetranInterno());
}
