import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function normalizeAppVersion(raw) {
  const v = String(raw || '').trim();
  if (!v || v === 'dev') return 'dev';
  const match = v.match(/^(v\d+(?:\.\d+)*)/i);
  return match ? match[1] : v;
}

function runGit(cmd) {
  return execSync(cmd, {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function gitVersion() {
  const commands = [
    'git describe --tags --abbrev=0',
    'git describe --tags --always --abbrev=0',
  ];

  for (const cmd of commands) {
    try {
      const v = normalizeAppVersion(runGit(cmd));
      if (v !== 'dev') return v;
    } catch {
      // tenta próximo método
    }
  }

  try {
    const tag = runGit('git tag --sort=-v:refname').split(/\r?\n/).find(Boolean);
    return normalizeAppVersion(tag);
  } catch {
    return 'dev';
  }
}

/** Tag Git (build Docker/CI) — fallback quando o repositório não está disponível no build. */
function resolveVersion() {
  const fromTag = normalizeAppVersion(process.env.GIT_TAG);
  if (fromTag !== 'dev') return fromTag;
  return gitVersion();
}

const version = resolveVersion();
fs.writeFileSync(path.join(root, 'VERSION'), `${version}\n`);

const publicDir = path.join(root, 'frontend/public');
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(
  path.join(publicDir, 'app-version.json'),
  `${JSON.stringify({ version }, null, 2)}\n`
);

console.log(`[version] ${version}`);
