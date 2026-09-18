/**
 * Lista e mapeia grupos do Zap. Não imprime token.
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
process.env.DB_USE_PROD = '1';
const backendEnv = path.join(root, 'backend', '.env');
if (fs.existsSync(backendEnv)) {
  const local = dotenv.parse(fs.readFileSync(backendEnv));
  for (const [key, value] of Object.entries(local)) {
    if (value !== undefined && String(value).trim() !== '') process.env[key] = value;
  }
}
process.env.DB_USE_PROD = '1';
process.env.WPP_HOST = 'http://localhost';
process.env.WPP_ENABLED = 'true';

const { pool } = await import('../src/db.js');
const { sincronizarGruposAlvim, classificarNomeGrupo } = await import('../src/agenteAlvim/grupos.js');
const { listarGruposWpp } = await import('../src/services/wppClient.js');
const { carregarCredenciaisWpp } = await import('../src/services/wppSession.js');

try {
  const cred = await carregarCredenciaisWpp();
  const brutos = cred?.token ? await listarGruposWpp(cred.token) : [];
  console.log(JSON.stringify({
    total: brutos.length,
    nomes: brutos.map((g) => ({ nome: g.nome, tipo: classificarNomeGrupo(g.nome).tipo })),
  }));
  const r = await sincronizarGruposAlvim();
  console.log(JSON.stringify({
    ok: r.ok,
    motivo: r.motivo || null,
    lideranca: r.grupos?.lideranca?.nome || null,
    gestores: r.grupos?.gestores?.nome || null,
    regioes: (r.grupos?.regioes || []).map((g) => g.nome_regional || g.regional || g.nome),
  }));
} finally {
  await pool.end().catch(() => {});
}
