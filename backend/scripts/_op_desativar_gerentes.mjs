/**
 * Liga/desliga os 25 logins gerente das lojas (produção).
 *
 * Rodar sempre de dentro da pasta backend:
 *   cd backend
 *
 * --- ver estado (não muda nada) ---
 *   node scripts/_op_desativar_gerentes.mjs
 *
 * --- desativar todos ---
 *   node scripts/_op_desativar_gerentes.mjs --apply
 *
 * --- reativar todos ---
 *   node scripts/_op_desativar_gerentes.mjs --ativar --apply
 *
 * --- um e-mail só ---
 *   node scripts/_op_desativar_gerentes.mjs --email=bkss@grupoalvim.com.br --apply
 *   node scripts/_op_desativar_gerentes.mjs --ativar --email=bkss@grupoalvim.com.br --apply
 *
 * Sem --apply o script só lista. Sem --ativar ele desativa.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(__dirname, '../.env'), override: true });
process.env.NODE_ENV = 'production';
process.env.DB_NAME = 'vision_check';
if (!process.argv.includes('--production')) process.argv.push('--production');

const { pool } = await import('../src/db.js');

const EMAILS = [
  'bklagosul@grupoalvim.com.br',
  'andressadessa6831@gmail.com',
  'arthurmiguelsz93@gmail.com',
  'clemersonnobre@gmail.com',
  'crislanedf1002@gmail.com',
  'deni.dani.mendes@outlook.com',
  'bknoroeste@grupoalvim.com.br',
  'josytoparaujo@gmail.com',
  'bkestrutural@grupoalvim.com.br',
  'gerente@grupoalvim.com.br',
  'rh@grupoalvim.com.br',
  'bkpontealta@grupoalvim.com.br',
  'marcielsouza2m@gmail.com',
  'bkvenancio@grupoalvim.com.br',
  'plkvalparaiso@grupoalvim.com.br',
  'bk.sudoeste@gmail.com',
  'dp@grupoalvim.com',
  'bksobradinho@grupoalvim.com.br',
  'bkasasul@grupoalvim.com.br',
  'bkasanorte7@grupoalvim.com.br',
  'bkceilandia@grupoalvim.com.br',
  'scarletsotero24@gmail.com',
  'bksamambaia@grupoalvim.com.br',
  'bkplaza@grupoalvim.com.br',
  'bkss@grupoalvim.com.br',
].map((e) => e.toLowerCase());

const apply = process.argv.includes('--apply');
const ativar = process.argv.includes('--ativar');
const emailArg = process.argv.find((a) => a.startsWith('--email='));
const emailFiltro = emailArg ? String(emailArg.slice('--email='.length)).trim().toLowerCase() : '';
const emailsAlvo = emailFiltro ? [emailFiltro] : EMAILS;

if (emailFiltro && !EMAILS.includes(emailFiltro)) {
  console.error(`E-mail fora da lista dos 25 gerentes: ${emailFiltro}`);
  await pool.end();
  process.exit(1);
}

const { rows: alvo } = await pool.query(
  `SELECT u.id_usuario, u.nome, u.email, u.perfil::text AS perfil,
          u.cargo, u.cargo_aprovacao, u.ativo
   FROM usuarios u
   WHERE LOWER(u.email) = ANY($1::text[])
   ORDER BY u.nome`,
  [emailsAlvo],
);

const encontrados = new Set(alvo.map((r) => String(r.email).toLowerCase()));
const naoEncontrados = emailsAlvo.filter((e) => !encontrados.has(e));
const ativos = alvo.filter((r) => r.ativo);
const inativos = alvo.filter((r) => !r.ativo);

console.log(JSON.stringify({
  acao: ativar ? 'ativar' : 'desativar',
  apply,
  db: process.env.DB_NAME,
  lista: emailsAlvo.length,
  encontrados: alvo.length,
  ativos: ativos.map((r) => ({ id: r.id_usuario, nome: r.nome, email: r.email })),
  inativos: inativos.map((r) => ({ id: r.id_usuario, nome: r.nome, email: r.email })),
  nao_encontrados: naoEncontrados,
}, null, 2));

if (apply) {
  const ids = (ativar ? inativos : ativos).map((r) => r.id_usuario);
  if (ids.length === 0) {
    console.log(ativar ? 'Nenhum usuário inativo para ativar.' : 'Nenhum usuário ativo para desativar.');
  } else {
    const { rowCount } = await pool.query(
      `UPDATE usuarios SET ativo = $1 WHERE id_usuario = ANY($2::int[]) AND ativo = $3`,
      [ativar, ids, !ativar],
    );
    const { rows: depois } = await pool.query(
      `SELECT id_usuario, nome, email, ativo
       FROM usuarios WHERE LOWER(email) = ANY($1::text[])
       ORDER BY nome`,
      [emailsAlvo],
    );
    console.log(JSON.stringify({
      alterados: rowCount,
      depois,
    }, null, 2));
  }
}

await pool.end();
