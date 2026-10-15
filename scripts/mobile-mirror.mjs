/**
 * Espelha o celular Android no PC (scrcpy).
 *
 *   npm run mobile
 *   npm run mobile -- wifi                 # com cabo: liga modo TCP e mostra o IP
 *   npm run mobile -- wifi 192.168.0.42    # sem cabo: conecta no IP e espelha
 *
 * USB: cabo + Depuração USB autorizada.
 * Wi‑Fi: mesma rede; na 1ª vez use o cabo pra liberar o modo sem fio.
 */
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

function findScrcpy() {
  if (process.env.SCRCPY_PATH && fs.existsSync(process.env.SCRCPY_PATH)) {
    return process.env.SCRCPY_PATH;
  }

  const home = os.homedir();
  const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const wingetPkgs = path.join(local, 'Microsoft', 'WinGet', 'Packages');

  const candidatos = [
    path.join(local, 'Microsoft', 'WinGet', 'Links', 'scrcpy.exe'),
    'C:\\Program Files\\scrcpy\\scrcpy.exe',
    path.join(home, 'scoop', 'apps', 'scrcpy', 'current', 'scrcpy.exe'),
  ];

  if (fs.existsSync(wingetPkgs)) {
    for (const dir of fs.readdirSync(wingetPkgs)) {
      if (!/scrcpy/i.test(dir)) continue;
      const base = path.join(wingetPkgs, dir);
      const stack = [base];
      while (stack.length) {
        const cur = stack.pop();
        let entries = [];
        try {
          entries = fs.readdirSync(cur, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const e of entries) {
          const full = path.join(cur, e.name);
          if (e.isFile() && e.name.toLowerCase() === 'scrcpy.exe') candidatos.push(full);
          else if (e.isDirectory()) stack.push(full);
        }
      }
    }
  }

  return candidatos.find((p) => fs.existsSync(p)) || null;
}

function runAdb(cwd, args) {
  const adb = path.join(cwd, process.platform === 'win32' ? 'adb.exe' : 'adb');
  const bin = fs.existsSync(adb) ? adb : 'adb';
  return spawnSync(bin, args, { cwd, encoding: 'utf8', shell: false });
}

const exe = findScrcpy();
if (!exe) {
  console.error('scrcpy não encontrado.');
  console.error('Instale: winget install --id Genymobile.scrcpy -e');
  process.exit(1);
}

const cwd = path.dirname(exe);
const argv = process.argv.slice(2);
const wifiIdx = argv.findIndex((a) => a.toLowerCase() === 'wifi' || a.toLowerCase() === '--wifi');

if (wifiIdx >= 0) {
  const ipArg = argv[wifiIdx + 1] && !argv[wifiIdx + 1].startsWith('-') ? argv[wifiIdx + 1] : null;
  const scrcpyArgs = argv.filter((_, i) => i !== wifiIdx && i !== wifiIdx + 1);

  if (!ipArg) {
    console.log('Modo Wi‑Fi (passo 1) — deixe o cabo conectado agora.');
    const tcp = runAdb(cwd, ['tcpip', '5555']);
    if (tcp.status !== 0) {
      console.error(tcp.stderr || tcp.stdout || 'Falha no adb tcpip. Celular autorizado?');
      process.exit(tcp.status || 1);
    }
    const ipOut = runAdb(cwd, ['shell', 'ip', '-f', 'inet', 'addr', 'show', 'wlan0']);
    const text = `${ipOut.stdout || ''}\n${ipOut.stderr || ''}`;
    const m = text.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
    console.log('TCP/IP 5555 liberado.');
    if (m) {
      console.log(`IP do celular: ${m[1]}`);
      console.log('Pode tirar o cabo e rodar:');
      console.log(`  npm run mobile -- wifi ${m[1]}`);
    } else {
      console.log('Não li o IP automaticamente. Veja em Configurações → Wi‑Fi → (i) da rede.');
      console.log('Depois: npm run mobile -- wifi SEU_IP');
    }
    process.exit(0);
  }

  const host = ipArg.includes(':') ? ipArg : `${ipArg}:5555`;
  console.log(`Conectando em ${host}…`);
  const conn = runAdb(cwd, ['connect', host]);
  process.stdout.write(conn.stdout || '');
  process.stderr.write(conn.stderr || '');
  if (conn.status !== 0) {
    console.error('Não conectou. Celular e PC na mesma Wi‑Fi? Já rodou npm run mobile -- wifi com o cabo?');
    process.exit(conn.status || 1);
  }

  console.log('Espelhando via Wi‑Fi…');
  const child = spawn(exe, scrcpyArgs, { cwd, stdio: 'inherit', shell: false });
  child.on('exit', (code) => process.exit(code ?? 0));
} else {
  console.log('Espelhando celular (USB)…');
  console.log('Wi‑Fi depois: npm run mobile -- wifi   (com cabo) → npm run mobile -- wifi IP');
  const child = spawn(exe, argv, { cwd, stdio: 'inherit', shell: false });
  child.on('exit', (code) => process.exit(code ?? 0));
}