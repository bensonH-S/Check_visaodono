/**
 * Abre o Meridian num recorte de iPhone ao lado do IDE.
 *
 *   npm run preview:phone
 *   npm run preview:phone -- estoque
 *   npm run preview:phone -- escalas
 *
 * Precisa do Vite no ar (`npm run dev`). A janela recarrega sozinha.
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
const WIDTH = 390;
const HEIGHT = 844;

const ATALHOS = {
  login: '/auditoria/login/mobile',
  escalas: '/auditoria/escalas/visitas/mobile',
  estoque: '/auditoria/estoque/mobile',
  visitas: '/auditoria/visitas/mobile',
  chamados: '/auditoria/chamados/mobile',
  checklist: '/auditoria/checklist/mobile',
  frota: '/auditoria/frota/mobile',
};

const arg = process.argv.slice(2).find((a) => !a.startsWith('-')) || 'login';
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
          reject(new Error(`Vite não subiu em ${host}:${port}. Rode npm run dev.`));
          return;
        }
        setTimeout(tryOnce, 400);
      });
    };
    tryOnce();
  });
}

function chromeLike() {
  const home = os.homedir();
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
  console.error('Chrome ou Edge não encontrado. Instala um dos dois para o preview de celular.');
  process.exit(1);
}

const profile = path.join(ROOT, '.preview-phone-profile');
fs.mkdirSync(profile, { recursive: true });

await waitPort(HOST, PORT);
console.log(`Celular ${WIDTH}×${HEIGHT} → ${url}`);

const child = spawn(
  exe,
  [
    `--app=${url}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    '--window-position=1420,48',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
  ],
  { detached: true, stdio: 'ignore' },
);
child.unref();
