/**
 * npm run pro
 *   0 ou Enter → vision_check (produção)
 *   1          → vision_check_dev (teste)
 *   npm run pro -- 0|1 pula a pergunta
 */
import readline from 'node:readline';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const concurrently = require('concurrently');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function escolhaDoArgv() {
  const arg = process.argv.slice(2).find((a) => a === '0' || a === '1');
  return arg || '';
}

function perguntar() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('');
    console.log('Banco');
    console.log('  0  produção   vision_check');
    console.log('  1  teste      vision_check_dev');
    rl.question('Escolha [0]: ', (resposta) => {
      rl.close();
      resolve(String(resposta || '').trim());
    });
  });
}

let escolha = escolhaDoArgv();
if (!escolha) {
  if (!process.stdin.isTTY) {
    escolha = '0';
    console.log('Sem pergunta no terminal: banco de produção (vision_check).');
  } else {
    escolha = await perguntar();
  }
}
if (escolha !== '0' && escolha !== '1') {
  console.log(`"${escolha}" não é 0 nem 1. Seguindo com produção.`);
  escolha = '0';
}

const producao = escolha === '0';
process.env.DB_PRO_ESCOLHA = escolha;
if (producao) process.env.DB_USE_PROD = '1';
else delete process.env.DB_USE_PROD;

console.log(
  producao
    ? 'Subindo com banco de produção (vision_check).'
    : 'Subindo com banco de teste (vision_check_dev).',
);
console.log('');

const api = producao ? 'node server.js --db-prod' : 'node server.js';
const web = 'npx --yes wait-on tcp:127.0.0.1:5000 -t 90000 && npm run dev --prefix frontend';

const { result } = concurrently(
  [
    { command: api, name: 'api', cwd: root },
    { command: web, name: 'web', cwd: root },
  ],
  {
    cwd: root,
    prefix: 'name',
    prefixColors: ['cyan', 'magenta'],
    handleInput: false,
  },
);

try {
  await result;
} catch {
  process.exitCode = 1;
}
