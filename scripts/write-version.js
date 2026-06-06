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

function gitVersion() {
  try {
    return normalizeAppVersion(
      execSync('git describe --tags --abbrev=0', {
        encoding: 'utf8',
        cwd: root,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
    );
  } catch {
    return 'dev';
  }
}

const version = gitVersion();
fs.writeFileSync(path.join(root, 'VERSION'), `${version}\n`);
console.log(`[version] ${version}`);
