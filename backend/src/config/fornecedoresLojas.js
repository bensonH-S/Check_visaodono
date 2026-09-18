/**
 * Mapeamento loja (bk_number) ↔ portal Platlog/eSupri e resolução de credenciais.
 * Senhas: backend/config/credenciais-fornecedores.local.json (gitignored) ou .env.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..', '..');
const LOCAL_JSON = path.join(backendRoot, 'config', 'credenciais-fornecedores.local.json');

/** Código eSupri (CL_CODIGO) + fantasia (CL_FANTA) conferidos no login VERONICA. */
export const ESUPRI_LOJAS = [
  { esupri_codigo: '3364401', esupri_fantasia: 'BK AS NORT', bk_number: '19929' },
  { esupri_codigo: '1192301', esupri_fantasia: 'BK ASA 706', bk_number: '23531' },
  { esupri_codigo: '2405201', esupri_fantasia: 'BK ASA SUL', bk_number: '18915' },
  { esupri_codigo: '1192401', esupri_fantasia: 'BK C NOVAS', bk_number: '23194' },
  { esupri_codigo: '2350801', esupri_fantasia: 'BK CEILAND', bk_number: '24820' },
  { esupri_codigo: '3375101', esupri_fantasia: 'BK CENTUR', bk_number: '21583' },
  { esupri_codigo: '4592001', esupri_fantasia: 'BK D BRASI', bk_number: '31614' },
  { esupri_codigo: '4897501', esupri_fantasia: 'BK D ESTRU', bk_number: '32555' },
  { esupri_codigo: '4349401', esupri_fantasia: 'BK D NORTE', bk_number: '31608' },
  { esupri_codigo: '4600401', esupri_fantasia: 'BK D PONTE', bk_number: '31782' },
  { esupri_codigo: '5040301', esupri_fantasia: 'BK M AZUL', bk_number: '33104' },
  { esupri_codigo: '3364501', esupri_fantasia: 'BK PIER', bk_number: '30784' },
  { esupri_codigo: '3381901', esupri_fantasia: 'BK PLANALT', bk_number: '27984' },
  { esupri_codigo: '4348201', esupri_fantasia: 'BK R EMA', bk_number: '30769' },
  { esupri_codigo: '3375001', esupri_fantasia: 'BK S VENAN', bk_number: '25261' },
  { esupri_codigo: '2425301', esupri_fantasia: 'BK SALOMAO', bk_number: '20415' },
  { esupri_codigo: '1196601', esupri_fantasia: 'BK SUDOEST', bk_number: '23240' },
  { esupri_codigo: '4346601', esupri_fantasia: 'BK TERRA S', bk_number: '30797' },
  { esupri_codigo: '3364701', esupri_fantasia: 'BK UNAI', bk_number: '32338' },
  { esupri_codigo: '4600201', esupri_fantasia: 'PP VAL PAR', bk_number: '15022' },
  // Sem loja cadastrada no Visão do Dono (CL_EXTERNO do portal):
  { esupri_codigo: '3364601', esupri_fantasia: 'BK CAR BRA', bk_number: '20212' },
  { esupri_codigo: '2410001', esupri_fantasia: 'BK Q MALL', bk_number: '21106' },
];

const porBk = new Map(ESUPRI_LOJAS.map((l) => [String(l.bk_number), l]));
const porFantasia = new Map(
  ESUPRI_LOJAS.map((l) => [String(l.esupri_fantasia).trim().toUpperCase(), l]),
);

let cacheLocal = null;

function readLocalJson() {
  if (cacheLocal) return cacheLocal;
  if (!fs.existsSync(LOCAL_JSON)) {
    cacheLocal = { platlog: {}, lojas: {} };
    return cacheLocal;
  }
  try {
    cacheLocal = JSON.parse(fs.readFileSync(LOCAL_JSON, 'utf8'));
  } catch (e) {
    console.warn('[fornecedores] JSON de credenciais inválido:', e.message);
    cacheLocal = { platlog: {}, lojas: {} };
  }
  return cacheLocal;
}

export function findEsupriLojaByBk(bkNumber) {
  const bk = String(bkNumber || '').replace(/\D/g, '');
  return porBk.get(bk) || null;
}

export function findEsupriLojaByFantasia(fantasia) {
  const key = String(fantasia || '')
    .trim()
    .toUpperCase();
  return porFantasia.get(key) || null;
}

export function credencialPlatlog() {
  const local = readLocalJson();
  return {
    user: String(process.env.ESUPRI_USER || local.platlog?.user || '').trim(),
    pass: String(process.env.ESUPRI_PASS || local.platlog?.pass || '').trim(),
  };
}

function pickPortal(lojaCfg, portal) {
  const block = lojaCfg?.[portal];
  if (!block || typeof block !== 'object') return { user: '', pass: '' };
  return {
    user: String(block.user || '').trim(),
    pass: String(block.pass || '').trim(),
  };
}

export function credencialLoja(bkNumber, portal) {
  const local = readLocalJson();
  const lojaCfg = local.lojas?.[String(bkNumber || '').replace(/\D/g, '')] || {};
  return pickPortal(lojaCfg, portal);
}

export function credencialBrasal(bkNumber) {
  const perLoja = credencialLoja(bkNumber, 'brasal');
  if (perLoja.user && perLoja.pass) return perLoja;
  return { user: '', pass: '' };
}

export function credenciaisOk(fornecedor, bkNumber) {
  if (fornecedor === 'platlog') {
    const p = credencialPlatlog();
    return Boolean(p.user && p.pass && findEsupriLojaByBk(bkNumber));
  }
  if (fornecedor === 'coca') {
    const b = credencialBrasal(bkNumber);
    return Boolean(b.user && b.pass);
  }
  return false;
}
