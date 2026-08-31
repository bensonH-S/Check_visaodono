/**
 * Cofre de credenciais do kit BK Office (AES-256-GCM).
 * Uso build:  node vault_tools.mjs seal --out=DIR --from-env=path/.env
 * Uso runtime: import { loadVault } from './vault_tools.mjs'
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VAULT_NAME = 'vault.dat';
const ALGO = 'aes-256-gcm';

export function readDotEnv(filePath) {
  const map = {};
  if (!fs.existsSync(filePath)) return map;
  for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 1) continue;
    map[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return map;
}

export function sealPayload(obj, keyBuf) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, keyBuf, iv);
  const plain = Buffer.from(JSON.stringify(obj), 'utf8');
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  // formato: magic(4) + iv(12) + tag(16) + ciphertext
  return Buffer.concat([Buffer.from('MBK1'), iv, tag, enc]);
}

export function unsealPayload(buf, keyBuf) {
  if (buf.length < 4 + 12 + 16 + 1 || buf.slice(0, 4).toString() !== 'MBK1') {
    throw new Error('vault inválido');
  }
  const iv = buf.subarray(4, 16);
  const tag = buf.subarray(16, 32);
  const data = buf.subarray(32);
  const decipher = crypto.createDecipheriv(ALGO, keyBuf, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}

/** Embaralha a chave em N pedaços XOR com máscaras — não é plaintext no disco. */
export function splitKey(keyBuf) {
  const masks = [
    crypto.randomBytes(32),
    crypto.randomBytes(32),
    crypto.randomBytes(32),
  ];
  const parts = masks.map((m, i) => {
    const out = Buffer.alloc(32);
    for (let j = 0; j < 32; j++) out[j] = keyBuf[j] ^ m[j] ^ ((i * 17 + j) & 0xff);
    return { p: out.toString('base64'), m: m.toString('base64') };
  });
  return parts;
}

export function joinKey(parts) {
  const key = Buffer.alloc(32);
  const { p, m } = parts[0];
  const pb = Buffer.from(p, 'base64');
  const mb = Buffer.from(m, 'base64');
  for (let j = 0; j < 32; j++) key[j] = pb[j] ^ mb[j] ^ ((0 * 17 + j) & 0xff);
  // verifica consistência com demais pedaços
  for (let i = 1; i < parts.length; i++) {
    const pi = Buffer.from(parts[i].p, 'base64');
    const mi = Buffer.from(parts[i].m, 'base64');
    for (let j = 0; j < 32; j++) {
      const v = pi[j] ^ mi[j] ^ ((i * 17 + j) & 0xff);
      if (v !== key[j]) throw new Error('chave corrompida');
    }
  }
  return key;
}

function buildSecretsFromEnv(envMap) {
  const apiBase =
    envMap.API_BASE ||
    envMap.MERIDIAN_API_BASE ||
    'https://grupoalvim.com.br/auditoria/api';
  const kitToken = envMap.BKOFFICE_KIT_TOKEN || '';
  if (!kitToken || kitToken.length < 16) {
    throw new Error(
      'BKOFFICE_KIT_TOKEN ausente ou curto no backend/.env (gere um hex de 32+ bytes)',
    );
  }
  return {
    // Modo HTTPS — sem DB na loja; Chrome/Chromium local no PC BR (sem Bright Data)
    API_BASE: apiBase.replace(/\/$/, ''),
    BKOFFICE_KIT_TOKEN: kitToken,
    BKOFFICE_USER: envMap.BKOFFICE_USER || '',
    BKOFFICE_PASS: envMap.BKOFFICE_PASS || '',
    BKOFFICE_URL: envMap.BKOFFICE_URL || 'https://bkoffice-franquia.burgerking.com.br',
    BKOFFICE_USE_CHROME: envMap.BKOFFICE_USE_CHROME || '1',
    BKOFFICE_HEADLESS: envMap.BKOFFICE_HEADLESS || '1',
    BKOFFICE_TIMEOUT_MS: envMap.BKOFFICE_TIMEOUT_MS || '180000',
    BKOFFICE_DOWNLOAD_TIMEOUT_MS: envMap.BKOFFICE_DOWNLOAD_TIMEOUT_MS || '180000',
    BKOFFICE_SYNC_ID_LOJA: envMap.BKOFFICE_SYNC_ID_LOJA || '21',
    BKOFFICE_SYNC_ID_LOJAS: envMap.BKOFFICE_SYNC_ID_LOJAS || 'all',
    BKOFFICE_BK_NUMBER: envMap.BKOFFICE_BK_NUMBER || '30797',
    BKOFFICE_SERVER_SYNC: '0',
    BKOFFICE_SYNC_CRON_MS: '0',
    BKOFFICE_BRIGHTDATA: '0',
    BKOFFICE_KIT_ENABLED: '0',
    SYNC_INTERVAL_MS: envMap.SYNC_INTERVAL_MS || '300000',
    SYNC_LIVE_INTERVAL_MS: envMap.SYNC_LIVE_INTERVAL_MS || '120000',
    NODE_ENV: 'production',
  };
}

export function loadVault(kitRoot, keyParts) {
  const vaultPath = path.join(kitRoot, 'data', VAULT_NAME);
  if (!fs.existsSync(vaultPath)) throw new Error(`cofre ausente: ${vaultPath}`);
  const key = joinKey(keyParts);
  return unsealPayload(fs.readFileSync(vaultPath), key);
}

// CLI seal
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const mode = args[0] || 'seal';
  const get = (k, d) => {
    const hit = args.find((a) => a.startsWith(`${k}=`));
    return hit ? hit.slice(k.length + 1) : d;
  };

  if (mode === 'seal') {
    const outDir = path.resolve(get('--out', '.'));
    const envFile = path.resolve(get('--from-env', path.join(__dirname, '../../../backend/.env')));
    const dataDir = path.join(outDir, 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    const envMap = readDotEnv(envFile);
    if (!envMap.BKOFFICE_USER || !envMap.BKOFFICE_PASS) {
      console.error('ERRO: backend/.env sem BKOFFICE_USER/PASS');
      process.exit(1);
    }
    let secrets;
    try {
      secrets = buildSecretsFromEnv(envMap);
    } catch (e) {
      console.error('ERRO:', e.message);
      process.exit(1);
    }
    const key = crypto.randomBytes(32);
    const blob = sealPayload(secrets, key);
    fs.writeFileSync(path.join(dataDir, VAULT_NAME), blob);

    const parts = splitKey(key);
    const genPath = path.join(outDir, 'key_parts.generated.json');
    // arquivo temporário só no build — NÃO vai pro zip final se removido depois
    fs.writeFileSync(genPath, JSON.stringify(parts), { mode: 0o600 });

    // gera módulo com partes embaralhadas (vai dentro do exe)
    const js = `/** gerado no build — nao editar */\nexport const KEY_PARTS = ${JSON.stringify(parts)};\n`;
    fs.writeFileSync(path.join(outDir, 'key_parts.generated.mjs'), js, { mode: 0o600 });

    console.log('OK cofre:', path.join(dataDir, VAULT_NAME));
    console.log('OK key parts:', path.join(outDir, 'key_parts.generated.mjs'));
    console.log('Segredos NÃO gravados em texto claro.');
    process.exit(0);
  }

  console.error('Uso: node vault_tools.mjs seal --out=DIR --from-env=backend/.env');
  process.exit(1);
}
