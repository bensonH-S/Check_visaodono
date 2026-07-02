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

function iniciais(nome) {
  const parts = String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function mapCargoHrParaMeridian(u) {
  const role = String(u.role || '').toLowerCase();
  const cargo = String(u.cargo || '').toLowerCase();

  if (role.includes('admin') || role.includes('ti')) {
    return { codigo: 'administrador', perfil: 'administrador', nome: 'Administrador' };
  }
  if (cargo.includes('técnico') || cargo.includes('tecnico')) {
    return { codigo: 'tecnico', perfil: 'tecnico', nome: 'Técnico' };
  }
  if (cargo.includes('coordenador') || role.includes('coordenador')) {
    return { codigo: 'coordenador', perfil: 'coordenador', nome: 'Coordenador' };
  }
  if (cargo.includes('supervisor') || role.includes('supervisor')) {
    return { codigo: 'supervisor_regional', perfil: 'gerente', nome: 'Supervisor' };
  }
  if (cargo.includes('regional') || role.includes('regional')) {
    return { codigo: 'regional', perfil: 'gerente', nome: 'Regional' };
  }
  if (cargo.includes('diretor') || role.includes('diretor')) {
    return { codigo: 'diretor', perfil: 'gerente', nome: 'Diretor' };
  }
  if (cargo.includes('financeiro') || role.includes('financeiro')) {
    return { codigo: 'financeiro', perfil: 'gerente', nome: 'Financeiro' };
  }
  // Gestor / Gerente de Unidade (padrão hr_payroll)
  return { codigo: 'gerente', perfil: 'gerente', nome: 'Gerente' };
}

async function connectTarget() {
  const configs = [];

  if (process.env.DB_HOST && process.env.DB_NAME) {
    configs.push({
      label: 'Meridian (.env)',
      pool: new pg.Pool({
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
      }),
    });
  }

  // fallback: vision_check no mesmo host do HR
  configs.push({
    label: 'vision_check (mesmo host HR)',
    pool: new pg.Pool({
      ...SRC,
      database: 'vision_check',
      connectionTimeoutMillis: 15000,
    }),
  });

  for (const c of configs) {
    try {
      await c.pool.query('SELECT 1');
      return c;
    } catch {
      await c.pool.end().catch(() => {});
    }
  }
  throw new Error('Não foi possível conectar ao banco Meridian (vision_check)');
}

const dryRun = process.argv.includes('--dry-run');

const src = new pg.Pool({ ...SRC, connectionTimeoutMillis: 20000 });

try {
  const targetConn = await connectTarget();
  const tgt = targetConn.pool;
  console.log(`Conectado Meridian: ${targetConn.label}`);

  const { rows: srcUsers } = await src.query(`
    SELECT id, email, password_hash, name, role, cargo, is_active
    FROM users
    WHERE email IS NOT NULL AND TRIM(email) <> ''
    ORDER BY LOWER(email)
  `);

  const { rows: tgtUsers } = await tgt.query(`
    SELECT id_usuario, LOWER(email) AS email, nome, ativo
    FROM usuarios
    WHERE email IS NOT NULL
  `);

  const existentes = new Map(tgtUsers.map((u) => [u.email, u]));
  const jaExistiam = [];
  const cadastrados = [];
  const ignorados = [];
  const erros = [];

  for (const u of srcUsers) {
    const email = String(u.email).trim().toLowerCase();
    const nome = String(u.name || '').trim();

    if (!u.is_active) {
      ignorados.push({ email, nome, motivo: 'inativo no HR' });
      continue;
    }
    if (!u.password_hash) {
      ignorados.push({ email, nome, motivo: 'sem senha no HR' });
      continue;
    }
    if (!nome) {
      ignorados.push({ email, motivo: 'sem nome no HR' });
      continue;
    }

    if (existentes.has(email)) {
      jaExistiam.push({ email, nome, id_meridian: existentes.get(email).id_usuario });
      continue;
    }

    const cargo = mapCargoHrParaMeridian(u);

    if (dryRun) {
      cadastrados.push({ email, nome, cargo: cargo.codigo, dry: true });
      continue;
    }

    try {
      const { rows } = await tgt.query(
        `INSERT INTO usuarios (nome, email, cargo, cargo_aprovacao, avatar_inicial, senha_hash, perfil, ativo)
         VALUES ($1, $2, $3, $4, $5, $6, $7::perfil_usuario, TRUE)
         RETURNING id_usuario`,
        [nome, email, cargo.nome, cargo.codigo, iniciais(nome), u.password_hash, cargo.perfil],
      );
      cadastrados.push({ email, nome, cargo: cargo.codigo, id_meridian: rows[0].id_usuario });
      existentes.set(email, { email, id_usuario: rows[0].id_usuario });
    } catch (e) {
      erros.push({ email, nome, erro: e.message });
    }
  }

  console.log('\n=== RESUMO ===');
  console.log(`HR payroll (ativos c/ email): ${srcUsers.filter((x) => x.is_active).length}`);
  console.log(`Já no Meridian: ${jaExistiam.length}`);
  console.log(`${dryRun ? 'Seriam cadastrados' : 'Cadastrados agora'}: ${cadastrados.length}`);
  console.log(`Ignorados: ${ignorados.length}`);
  console.log(`Erros: ${erros.length}`);

  console.log('\n=== JÁ EXISTIAM NO MERIDIAN ===');
  for (const u of jaExistiam) console.log(`- ${u.nome} <${u.email}>`);

  console.log(`\n=== ${dryRun ? 'SERIAM CADASTRADOS' : 'CADASTRADOS AGORA'} ===`);
  for (const u of cadastrados) console.log(`- ${u.nome} <${u.email}> [${u.cargo}]`);

  if (ignorados.length) {
    console.log('\n=== IGNORADOS ===');
    for (const u of ignorados) console.log(`- ${u.nome || u.email}: ${u.motivo}`);
  }

  if (erros.length) {
    console.log('\n=== ERROS ===');
    for (const u of erros) console.log(`- ${u.email}: ${u.erro}`);
  }

  // JSON para WhatsApp
  const zap = {
    total_hr: srcUsers.length,
    ja_existiam: jaExistiam.map((u) => `${u.nome} (${u.email})`),
    novos: cadastrados.map((u) => `${u.nome} (${u.email})`),
    ignorados: ignorados.map((u) => `${u.nome || u.email} — ${u.motivo}`),
    erros: erros.map((u) => `${u.email} — ${u.erro}`),
  };
  console.log('\n=== TEXTO ZAP ===');
  const linhas = [
    `*Migração usuários HR → Meridian*`,
    dryRun ? '_(simulação — nada gravado)_' : '',
    '',
    `✅ Já existiam: ${jaExistiam.length}`,
    ...jaExistiam.map((u) => `• ${u.nome}`),
    '',
    `${dryRun ? '📝 Seriam cadastrados' : '🆕 Cadastrados'}: ${cadastrados.length}`,
    ...cadastrados.map((u) => `• ${u.nome} — ${u.email}`),
  ];
  if (ignorados.length) {
    linhas.push('', `⚠️ Ignorados: ${ignorados.length}`, ...ignorados.map((u) => `• ${u.nome || u.email}`));
  }
  if (erros.length) {
    linhas.push('', `❌ Erros: ${erros.length}`, ...erros.map((u) => `• ${u.email}`));
  }
  console.log(linhas.filter(Boolean).join('\n'));

  await tgt.end();
} catch (e) {
  console.error('Falha:', e.message);
  process.exit(1);
} finally {
  await src.end();
}
