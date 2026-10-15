/**
 * Abre o Meridian como se fosse no celular (Chrome em modo app + UA mobile).
 * Sem moldura fake — a janela é o próprio aparelho.
 *
 *   npm run preview:phone
 *   npm run preview:phone -- chamados
 *   npm run preview:phone -- android estoque
 *   npm run preview:phone -- iphone frota
 *
 * Precisa do Vite no ar (`npm run pro` / `npm run dev`).
 *
 * Pra apresentação no projetor com aparelho físico (Android):
 *   winget install Genymobile.scrcpy
 *   scrcpy --max-size 1024
 */
import { spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = '127.0.0.1';
const PORT = 5173;

const DEVICES = {
  iphone: {
    label: 'iPhone 15',
    width: 393,
    height: 852,
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  },
  android: {
    label: 'Pixel 8',
    width: 412,
    height: 915,
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
  },
};

const ATALHOS = {
  login: '/auditoria/login/mobile',
  escalas: '/auditoria/escalas/visitas/mobile',
  estoque: '/auditoria/estoque/mobile',
  visitas: '/auditoria/visitas/mobile',
  chamados: '/auditoria/chamados/mobile',
  checklist: '/auditoria/checklist/mobile',
  frota: '/auditoria/frota/mobile',
  energia: '/auditoria/energia/mobile',
  metas: '/auditoria/metas/mobile',
};

const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
let deviceKey = 'iphone';
const rest = [];
for (const a of args) {
  const n = a.toLowerCase();
  if (n === 'iphone' || n === 'ios' || n === 'apple') deviceKey = 'iphone';
  else if (n === 'android' || n === 'pixel' || n === 'samsung') deviceKey = 'android';
  else rest.push(a);
}

const device = DEVICES[deviceKey];
const arg = rest[0] || 'login';
const rota = arg.startsWith('/')
  ? arg.startsWith('/auditoria')
    ? arg
    : `/auditoria${arg}`
  : ATALHOS[arg] || ATALHOS.login;
const url = `http://${HOST}:${PORT}${rota}`;

function waitPort(host, port, ms = 45000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const socket = net.connect({ host, port }, () => {
        socket.end();
        resolve();
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - start > ms) {
          reject(new Error(`Vite não subiu em ${host}:${port}. Rode npm run pro ou npm run dev.`));
          return;
        }
        setTimeout(tryOnce, 400);
      });
    };
    tryOnce();
  });
}

function chromeLike() {
  const candidatos = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    path.join(process.env.PROGRAMFILES || '', 'Google\\Chrome\\Application\\chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  return candidatos.find((p) => fs.existsSync(p)) || null;
}

const exe = chromeLike();
if (!exe) {
  console.error('Chrome ou Edge não encontrado.');
  process.exit(1);
}

const profile = path.join(ROOT, '.preview-phone-profile', deviceKey);
fs.mkdirSync(profile, { recursive: true });

await waitPort(HOST, PORT);

// Janela um pouco maior que o CSS viewport (barra de título do SO).
const winW = device.width;
const winH = device.height + 40;

console.log(`${device.label} ${device.width}×${device.height}`);
console.log(`→ ${url}`);
console.log('');
console.log('Dica apresentação: celular Android na USB → scrcpy (espelha o aparelho no projetor).');

const child = spawn(
  exe,
  [
    `--app=${url}`,
    `--user-agent=${device.ua}`,
    `--window-size=${winW},${winH}`,
    '--window-position=1400,40',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    // Força densidade “mobile” no Chromium (ajuda layout rem/px)
    '--force-device-scale-factor=1',
  ],
  { detached: true, stdio: 'ignore' },
);
child.unref();
