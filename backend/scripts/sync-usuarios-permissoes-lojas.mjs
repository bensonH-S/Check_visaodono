import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const SRC = {
  host: process.env.HR_DB_HOST || '54.38.98.195',
  user: process.env.HR_DB_USER || 'alvim',
  password: process.env.HR_DB_PASS || 'burgerking_2050',
  database: process.env.HR_DB_NAME || 'hr_payroll',
  port: Number(process.env.HR_DB_PORT || 5432),
};

const dryRun = process.argv.includes('--dry-run');
const REF_EMAIL = 'raquel.707@gmail.com';

// E-mails migrados na rodada anterior (HR → Meridian)
const EMAILS_MIGRADOS = [
  'andressadessa6831@gmail.com',
  'arthurmiguelsz93@gmail.com',
  'benson.henriquesilva@gmail.com',
  'bk.lagosul@gmail.com',
  'bk.sudoeste@gmail.com',
  'bkasasul@grupoalvim.com.br',
  'bkceilandia@grupoalvim.com.br',
  'bkplaza@grupoalvim.com.br',
  'bksamambaia@grupoalvim.com.br',
  'bkss@grupoalvim.com.br',
  'bkvenancio@grupoalvim.com.br',
  'crislanedf1002@gmail.com',
  'deni.dani.mendes@outlook.com',
  'dp@grupoalvim.com',
  'elizabete30784@gmail.com',
  'gabriella.davi.sophia0607@gmail.com',
  'hauriovieira@gmail.com',
  'josytoparaujo@gmail.com',
  'marcielsouza2m@gmail.com',
  'nadlamary.andrade@gmail.com',
  'plkvalparaiso@grupoalvim.com.br',
  'raquel.707@gmail.com',
  'rh@grupoalvim.com.br',
  'scarletsotero24@gmail.com',
  'valentinnavictoria@icloud.com.br',
];

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function normEmail(e) {
  return String(e || '').trim().toLowerCase();
}

async function connectTarget() {
  return new pg.Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 5432),
    ssl:
      process.env.DB_SSL === 'true' || process.env.DB_SSL === '1'
        ? { rejectUnauthorized: false }
        : undefined,
    connectionTimeoutMillis: 15000,
  });
}

const src = new pg.Pool({ ...SRC, connectionTimeoutMillis: 20000 });
const tgt = await connectTarget();

try {
  const { rows: refUser } = await tgt.query(
    `SELECT id_usuario, nome, email, cargo, cargo_aprovacao, perfil::text AS perfil
     FROM usuarios WHERE LOWER(email) = $1`,
    [REF_EMAIL],
  );
  if (!refUser[0]) throw new Error(`Referência ${REF_EMAIL} não encontrada`);
  const refId = refUser[0].id_usuario;

  const { rows: refPerms } = await tgt.query(
    `SELECT codigo FROM usuario_permissoes WHERE id_usuario = $1 ORDER BY codigo`,
    [refId],
  );
  const permissoes = refPerms.map((p) => p.codigo);
  if (!permissoes.length) throw new Error('Raquel sem permissões configuradas');

  const { rows: lojasMeridian } = await tgt.query(
    `SELECT id_loja, name, bk_number FROM lojas WHERE bk_number IS NOT NULL AND TRIM(bk_number) <> ''`,
  );
  const lojaPorBk = new Map(lojasMeridian.map((l) => [String(l.bk_number).trim(), l]));

  const { rows: hrStores } = await src.query(
    `SELECT id, bk_number, name, manager FROM store WHERE is_active = TRUE`,
  );
  const hrStoreById = new Map(hrStores.map((s) => [String(s.id), s]));
  const hrStoreByManagerEmail = new Map();

  const { rows: hrUsers } = await src.query(`
    SELECT u.id, LOWER(TRIM(u.email)) AS email, u.name, u.store_id, u.cargo, u.role,
           array_agg(DISTINCT us.store_id) FILTER (WHERE us.store_id IS NOT NULL) AS store_ids_extra
    FROM users u
    LEFT JOIN user_stores us ON us.user_id = u.id
    WHERE u.is_active = TRUE AND u.email IS NOT NULL
    GROUP BY u.id, u.email, u.name, u.store_id, u.cargo, u.role
  `);
  const hrUserByEmail = new Map(hrUsers.map((u) => [u.email, u]));

  for (const s of hrStores) {
    if (!s.manager) continue;
    const mgr = hrUsers.find((u) => norm(u.name) === norm(s.manager));
    if (mgr) hrStoreByManagerEmail.set(mgr.email, String(s.id));
  }

  function isGestorUnidade(hrUser) {
    if (!hrUser) return false;
    const cargo = norm(hrUser.cargo);
    return cargo.includes('gerente de unidade') || cargo === 'gestor';
  }

  function resolverLojaMeridian(email, hrUser) {
    let hrStoreId = hrUser?.store_id ? String(hrUser.store_id) : null;

    if (!hrStoreId && hrStoreByManagerEmail.has(email)) {
      hrStoreId = hrStoreByManagerEmail.get(email);
    }

    if (!hrStoreId && hrUser?.store_ids_extra?.length === 1) {
      hrStoreId = String(hrUser.store_ids_extra[0]);
    }

    if (!hrStoreId) {
      const mgrUser = hrUsers.find((u) => u.email === email);
      if (mgrUser) {
        const byManager = hrStores.find((s) => norm(s.manager) === norm(mgrUser.name));
        if (byManager) hrStoreId = String(byManager.id);
      }
    }

    if (!hrStoreId) return null;

    const hrStore = hrStoreById.get(hrStoreId);
    if (!hrStore?.bk_number) return { hrStoreId, hrStore, meridian: null };

    const bk = String(hrStore.bk_number).trim();
    const meridian = lojaPorBk.get(bk) || null;
    return { hrStoreId, hrStore, meridian, bk };
  }

  const atualizados = [];
  const semLoja = [];
  const naoEncontrados = [];

  const client = await tgt.connect();
  try {
    if (!dryRun) await client.query('BEGIN');

    for (const email of EMAILS_MIGRADOS) {
      const emailNorm = normEmail(email);
      const { rows: merUsers } = await client.query(
        `SELECT id_usuario, nome, email FROM usuarios WHERE LOWER(email) = $1`,
        [emailNorm],
      );
      if (!merUsers[0]) {
        naoEncontrados.push(emailNorm);
        continue;
      }
      const idUsuario = merUsers[0].id_usuario;
      const hrUser = hrUserByEmail.get(emailNorm);
      const isGestor = isGestorUnidade(hrUser);
      const lojaInfo = isGestor ? resolverLojaMeridian(emailNorm, hrUser) : null;

      if (!dryRun) {
        if (isGestor) {
          await client.query(
            `UPDATE usuarios SET
               cargo = $2,
               cargo_aprovacao = $3,
               perfil = $4::perfil_usuario,
               ativo = TRUE
             WHERE id_usuario = $1`,
            [idUsuario, refUser[0].cargo, refUser[0].cargo_aprovacao, refUser[0].perfil],
          );
        } else {
          await client.query(`UPDATE usuarios SET ativo = TRUE WHERE id_usuario = $1`, [idUsuario]);
        }

        await client.query('DELETE FROM usuario_permissoes WHERE id_usuario = $1', [idUsuario]);
        for (const codigo of permissoes) {
          await client.query(
            `INSERT INTO usuario_permissoes (id_usuario, codigo) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [idUsuario, codigo],
          );
        }

        if (isGestor) {
          await client.query('DELETE FROM usuario_lojas WHERE id_usuario = $1', [idUsuario]);
          if (lojaInfo?.meridian) {
            await client.query(
              `INSERT INTO usuario_lojas (id_usuario, id_loja) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [idUsuario, lojaInfo.meridian.id_loja],
            );
          }
        }
      }

      const entry = {
        nome: merUsers[0].nome,
        email: emailNorm,
        cargo_hr: hrUser?.cargo || '—',
        is_gestor: isGestor,
        loja_hr: lojaInfo?.hrStore?.name || '—',
        loja_meridian: lojaInfo?.meridian?.name || null,
        id_loja: lojaInfo?.meridian?.id_loja || null,
      };

      if (isGestor && !lojaInfo?.meridian) semLoja.push(entry);
      else if (isGestor) atualizados.push(entry);
      else atualizados.push({ ...entry, loja_meridian: '(só permissões — não é gestor de loja)' });
    }

    if (!dryRun) await client.query('COMMIT');
  } catch (e) {
    if (!dryRun) await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  console.log(`Referência: ${refUser[0].nome} — permissões: ${permissoes.join(', ')}`);
  console.log(dryRun ? '\n=== SIMULAÇÃO ===' : '\n=== APLICADO ===');
  console.log(`Usuários processados: ${EMAILS_MIGRADOS.length}`);
  console.log(`Com loja atribuída: ${atualizados.length}`);
  console.log(`Sem loja (bk não encontrado): ${semLoja.length}`);
  if (naoEncontrados.length) console.log(`Não encontrados: ${naoEncontrados.join(', ')}`);

  console.log('\n=== GESTOR → LOJA ===');
  for (const u of [...atualizados, ...semLoja].sort((a, b) => a.nome.localeCompare(b.nome))) {
    const loja = u.loja_meridian ? `→ ${u.loja_meridian}` : '⚠️ loja não mapeada';
    console.log(`• ${u.nome} (${u.email}) ${loja}`);
  }

  console.log('\n=== TEXTO ZAP ===');
  const linhas = [
    `*Permissões e lojas — igual Raquel*`,
    dryRun ? '_(simulação)_' : '',
    `Permissões: ${permissoes.join(', ')}`,
    '',
    '*Gestores com loja:*',
    ...atualizados.map((u) => `• ${u.nome} → ${u.loja_meridian}`),
  ];
  if (semLoja.length) {
    linhas.push('', '*Sem loja mapeada (revisar):*', ...semLoja.map((u) => `• ${u.nome}`));
  }
  console.log(linhas.filter(Boolean).join('\n'));
} catch (e) {
  console.error('Falha:', e.message);
  process.exit(1);
} finally {
  await src.end();
  await tgt.end();
}
