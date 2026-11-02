import { pool } from './db.js';
import { carregarRegioesAtuacaoTecnico } from './lojasUsuario.js';
import { temPermissao } from './permissoes.js';
import { findBrandAsset } from './projectPaths.js';
import { sendMail } from './services/mailer.js';
import { montarEmailsRelatorio } from './services/emailRelatorioConfig.js';
import {
  segundaFeiraDaSemana,
  podeVerEscalaGestores,
  podeGerenciarEscalaVisitas,
  podeEditarEscalaRegiao,
} from './escalaVisitas.js';

const TIPOS = new Set(['folga', 'ferias', 'falta', 'ausencia']);
const ROTULO_TIPO = { folga: 'Folga', ferias: 'Férias', falta: 'Falta', ausencia: 'Atestado' };
const DIAS_EMAIL = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const DIA_FOLGA_NOME = [
  ['segunda', 0],
  ['terca', 1],
  ['terça', 1],
  ['quarta', 2],
  ['quinta', 3],
  ['sexta', 4],
  ['sabado', 5],
  ['sábado', 5],
  ['domingo', 6],
];

function normFolga(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Dias da semana (0=seg) implícitos no texto. "ou" e "combinado" não forçam dia. */
export function diasDaFolgaPadrao(texto) {
  const n = normFolga(texto);
  if (!n || n.includes('combinado') || n.includes(' ou ')) return [];
  const dias = [];
  for (const [nome, idx] of DIA_FOLGA_NOME) {
    if (n.includes(normFolga(nome))) dias.push(idx);
  }
  return [...new Set(dias)];
}

let schemaOk = false;

export async function garantirSchemaGestores(client = pool) {
  if (schemaOk) return;
  await client.query(`
    CREATE TABLE IF NOT EXISTS escala_gestores (
      id_gestor SERIAL PRIMARY KEY,
      id_loja INTEGER REFERENCES lojas(id_loja) ON DELETE SET NULL,
      bk_number TEXT,
      nome TEXT NOT NULL,
      grupo TEXT NOT NULL DEFAULT 'loja'
        CHECK (grupo IN ('loja', 'campo')),
      folga_padrao TEXT,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      ordem INTEGER NOT NULL DEFAULT 0
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS escala_gestores_celula (
      id_celula SERIAL PRIMARY KEY,
      id_gestor INTEGER NOT NULL REFERENCES escala_gestores(id_gestor) ON DELETE CASCADE,
      data DATE NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('folga', 'ferias', 'falta', 'ausencia')),
      UNIQUE (id_gestor, data)
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS escala_gestores_horario (
      id_gestor INTEGER NOT NULL REFERENCES escala_gestores(id_gestor) ON DELETE CASCADE,
      data DATE NOT NULL,
      hora_inicio TIME,
      hora_fim TIME,
      PRIMARY KEY (id_gestor, data)
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS escala_gestores_envio (
      id_gestor INTEGER NOT NULL REFERENCES escala_gestores(id_gestor) ON DELETE CASCADE,
      semana_inicio DATE NOT NULL,
      enviado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      id_usuario INTEGER,
      aberta BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (id_gestor, semana_inicio)
    )
  `);
  await client.query(
    `ALTER TABLE escala_gestores_envio ADD COLUMN IF NOT EXISTS aberta BOOLEAN NOT NULL DEFAULT FALSE`,
  );
  schemaOk = true;
}

function addDaysIso(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function tipoOk(v) {
  const t = String(v || '').trim().toLowerCase();
  return TIPOS.has(t) ? t : null;
}

function horaSql(v) {
  if (v == null || v === '') return null;
  const m = String(v).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
}

function horaApi(v) {
  if (v == null || v === '') return null;
  return String(v).slice(0, 5);
}

function primeiroNome(s) {
  return String(s || '')
    .trim()
    .split(/\s+/)[0]
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

async function dadosUsuario(user) {
  const id = Number(user?.sub || user?.id_usuario);
  if (!id) return null;
  const { rows } = await pool.query(
    `SELECT u.nome, u.email, u.perfil::text AS perfil, u.cargo_aprovacao,
            COALESCE(array_agg(ul.id_loja) FILTER (WHERE ul.id_loja IS NOT NULL), '{}') AS lojas
     FROM usuarios u
     LEFT JOIN usuario_lojas ul ON ul.id_usuario = u.id_usuario
     WHERE u.id_usuario = $1
     GROUP BY u.id_usuario, u.nome, u.email, u.perfil, u.cargo_aprovacao`,
    [id],
  );
  return rows[0] || null;
}

/** Gestor de loja monta só a própria escala. Regional fica na região dele. */
function ehGestorSomentePropria(user, dados) {
  if (!user || !dados) return false;
  if (podeGerenciarEscalaVisitas(user) || podeEditarEscalaRegiao(user)) return false;
  if (temPermissao(user, 'lojas.todas') || temPermissao(user, 'frota.regioes')) return false;
  const cargo = String(dados.cargo_aprovacao || dados.perfil || user.perfil || '').toLowerCase();
  if (['diretor', 'ceo', 'administrador', 'dono', 'ti', 'supervisor_regional', 'regional', 'supervisor'].includes(cargo)) {
    return false;
  }
  return cargo === 'gerente' || cargo === 'coordenador';
}

const EMAILS_LIDERANCA_ESCALA = new Set([
  'felipe@grupoalvim.com.br',
  'frotadf@gmail.com',
  'benson@grupoalvim.com.br',
  'benson.henrique@grupoalvim.com.br',
]);

/** Regional, Renato, Felipe e TI reabrem ou apagam a escala enviada. */
function podeReabrirEscalaGestor(user, dados) {
  if (!user || !dados) return false;
  if (podeGerenciarEscalaVisitas(user) || podeEditarEscalaRegiao(user)) return true;
  const cargo = String(dados.cargo_aprovacao || dados.perfil || user.perfil || '').toLowerCase();
  if (['diretor', 'ceo', 'administrador', 'dono', 'ti', 'supervisor_regional', 'regional', 'supervisor'].includes(cargo)) {
    return true;
  }
  return EMAILS_LIDERANCA_ESCALA.has(String(dados.email || user.email || '').trim().toLowerCase());
}

/** Diretoria, TI e Igor veem a rede. Regional não, mesmo com acesso a todas as lojas. */
function veRedeTodaGestores(user, dados) {
  if (podeGerenciarEscalaVisitas(user)) return true;
  const cargo = String(dados?.cargo_aprovacao || dados?.perfil || user?.perfil || '').toLowerCase();
  if (['diretor', 'ceo', 'administrador', 'dono', 'ti', 'supervisor_geral'].includes(cargo)) return true;
  const email = String(dados?.email || user?.email || '').trim().toLowerCase();
  if (EMAILS_LIDERANCA_ESCALA.has(email) || email === 'igor@grupoalvim.com.br') return true;
  return primeiroNome(dados?.nome || user?.nome) === 'igor';
}

async function idsLojasRegiaoUsuario(user) {
  const id = Number(user?.sub || user?.id_usuario);
  if (!id) return new Set();
  const regioes = await carregarRegioesAtuacaoTecnico(id);
  const idsRegiao = regioes.map((r) => Number(r.id_regiao)).filter(Boolean);
  if (!idsRegiao.length) return new Set();
  const { rows } = await pool.query(
    `SELECT DISTINCT id_loja FROM frota_regiao_lojas WHERE id_regiao = ANY($1::int[])`,
    [idsRegiao],
  );
  return new Set(rows.map((r) => Number(r.id_loja)));
}

function linhasDoUsuario(linhas, dados) {
  const ids = new Set((dados?.lojas || []).map((id) => Number(id)));
  const meu = primeiroNome(dados?.nome);
  const porLoja = linhas.filter((l) => l.id_loja != null && ids.has(Number(l.id_loja)));
  if (porLoja.length > 1 && meu) {
    const porNome = porLoja.filter((l) => primeiroNome(l.nome) === meu);
    if (porNome.length) return porNome;
  }
  if (porLoja.length) return porLoja;
  if (meu) return linhas.filter((l) => primeiroNome(l.nome) === meu);
  return [];
}

export async function carregarGradeGestores(user, { semana_inicio, mostrarGravado = false } = {}) {
  const dados = await dadosUsuario(user);
  const somentePropria = ehGestorSomentePropria(user, dados);
  if (!podeVerEscalaGestores(user) && !somentePropria) {
    throw new Error('Sem permissão para ver a escala de gestores');
  }
  await garantirSchemaGestores();
  const inicio = segundaFeiraDaSemana(semana_inicio || new Date());
  const fim = addDaysIso(inicio, 6);

  const { rows: gestores } = await pool.query(
    `SELECT g.id_gestor, g.id_loja, g.bk_number, g.nome, g.grupo, g.folga_padrao, g.ordem,
            l.name AS nome_loja, l.bk_number AS loja_bk
     FROM escala_gestores g
     LEFT JOIN lojas l ON l.id_loja = g.id_loja
     WHERE g.ativo = TRUE
     ORDER BY CASE WHEN g.grupo = 'loja' THEN 0 ELSE 1 END, g.ordem, g.nome`,
  );

  const { rows: celulas } = await pool.query(
    `SELECT id_gestor, data::text AS data, tipo
     FROM escala_gestores_celula
     WHERE data >= $1::date AND data <= $2::date`,
    [inicio, fim],
  );
  const porGestor = new Map();
  for (const c of celulas) {
    const key = Number(c.id_gestor);
    if (!porGestor.has(key)) porGestor.set(key, new Map());
    porGestor.get(key).set(String(c.data).slice(0, 10), c.tipo);
  }

  const { rows: horarios } = await pool.query(
    `SELECT id_gestor, data::text AS data, hora_inicio::text AS hora_inicio, hora_fim::text AS hora_fim
     FROM escala_gestores_horario
     WHERE data >= $1::date AND data <= $2::date`,
    [inicio, fim],
  );
  const horasPorGestor = new Map();
  for (const h of horarios) {
    const key = Number(h.id_gestor);
    if (!horasPorGestor.has(key)) horasPorGestor.set(key, new Map());
    horasPorGestor.get(key).set(String(h.data).slice(0, 10), {
      hora_inicio: horaApi(h.hora_inicio),
      hora_fim: horaApi(h.hora_fim),
    });
  }

  const { rows: envios } = await pool.query(
    `SELECT id_gestor, aberta FROM escala_gestores_envio WHERE semana_inicio = $1::date`,
    [inicio],
  );
  const enviados = new Map(envios.map((r) => [Number(r.id_gestor), r.aberta === true]));

  const exigeEnvioApp = inicio >= '2026-11-02';
  const linhas = gestores.map((g) => {
    const id = Number(g.id_gestor);
    const temEnvio = enviados.has(id);
    const enviadaLinha = temEnvio && enviados.get(id) !== true;
    const mostrar = mostrarGravado || !exigeEnvioApp || temEnvio;
    const mapa = porGestor.get(id) || new Map();
    const horas = horasPorGestor.get(id) || new Map();
    const dias = [];
    for (let i = 0; i < 7; i += 1) {
      const data = addDaysIso(inicio, i);
      const hr = horas.get(data) || {};
      dias.push({
        dia: i,
        data,
        tipo: mostrar ? mapa.get(data) || null : null,
        hora_inicio: mostrar ? hr.hora_inicio || null : null,
        hora_fim: mostrar ? hr.hora_fim || null : null,
      });
    }
    return {
      id_gestor: id,
      id_loja: g.id_loja != null ? Number(g.id_loja) : null,
      bk_number: g.loja_bk || g.bk_number || null,
      nome_loja: g.nome_loja || null,
      nome: g.nome,
      grupo: g.grupo,
      folga_padrao: mostrar ? g.folga_padrao || null : null,
      enviada: enviadaLinha,
      dias,
    };
  });

  let linhasVisiveis = somentePropria ? linhasDoUsuario(linhas, dados) : linhas;
  if (!somentePropria && !veRedeTodaGestores(user, dados)) {
    const idsLoja = await idsLojasRegiaoUsuario(user);
    linhasVisiveis = linhas.filter((l) => l.id_loja != null && idsLoja.has(Number(l.id_loja)));
  }
  const enviada = somentePropria && linhasVisiveis.some((l) => l.enviada);

  return {
    semana_inicio: inicio,
    semana_fim: fim,
    pode_editar: somentePropria
      ? linhasVisiveis.length > 0 && !enviada
      : podeGerenciarEscalaVisitas(user),
    pode_reabrir: podeReabrirEscalaGestor(user, dados),
    somente_propria: somentePropria,
    enviada,
    linhas: linhasVisiveis,
  };
}

export async function salvarGradeGestores(user, body) {
  const dados = await dadosUsuario(user);
  const somentePropria = ehGestorSomentePropria(user, dados);
  if (!podeGerenciarEscalaVisitas(user) && !somentePropria) {
    throw new Error('Sem permissão para editar a escala de gestores');
  }
  await garantirSchemaGestores();
  let idsProprios = null;
  if (somentePropria) {
    const { rows } = await pool.query(
      `SELECT id_gestor, id_loja, nome FROM escala_gestores WHERE ativo = TRUE`,
    );
    idsProprios = new Set(linhasDoUsuario(rows, dados).map((l) => Number(l.id_gestor)));
    if (!idsProprios.size) {
      throw new Error('Sem permissão para editar a escala de gestores');
    }
  }
  const inicio = segundaFeiraDaSemana(body?.semana_inicio || new Date());
  if (idsProprios) {
    const { rows: ja } = await pool.query(
      `SELECT id_gestor FROM escala_gestores_envio
       WHERE semana_inicio = $1::date AND id_gestor = ANY($2::int[]) AND aberta = FALSE`,
      [inicio, [...idsProprios]],
    );
    if (ja.length) throw new Error('Escala já enviada');
  }
  const lista = Array.isArray(body?.celulas) ? body.celulas : [];
  const gestoresFolga = Array.isArray(body?.gestores) ? body.gestores : [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const g of gestoresFolga) {
      const idGestor = Number(g.id_gestor);
      if (!idGestor || !Object.prototype.hasOwnProperty.call(g, 'folga_padrao')) continue;
      if (idsProprios && !idsProprios.has(idGestor)) {
        throw new Error('Sem permissão para editar a escala de outro gestor');
      }
      const folgaPadrao = String(g.folga_padrao || '').trim() || null;
      await client.query(`UPDATE escala_gestores SET folga_padrao = $2 WHERE id_gestor = $1`, [
        idGestor,
        folgaPadrao,
      ]);
      const diasFolga = diasDaFolgaPadrao(folgaPadrao);
      if (!diasFolga.length && !folgaPadrao) {
        for (let dia = 0; dia < 7; dia += 1) {
          const data = addDaysIso(inicio, dia);
          await client.query(
            `DELETE FROM escala_gestores_celula
             WHERE id_gestor = $1 AND data = $2::date AND tipo = 'folga'`,
            [idGestor, data],
          );
        }
          } else if (diasFolga.length) {
        for (const dia of diasFolga) {
          const data = addDaysIso(inicio, dia);
          await client.query(
            `INSERT INTO escala_gestores_celula (id_gestor, data, tipo)
             VALUES ($1, $2::date, 'folga')
             ON CONFLICT (id_gestor, data) DO UPDATE SET tipo = 'folga'`,
            [idGestor, data],
          );
          await client.query(
            `DELETE FROM escala_gestores_horario WHERE id_gestor = $1 AND data = $2::date`,
            [idGestor, data],
          );
        }
      }
    }
    for (const item of lista) {
      const idGestor = Number(item.id_gestor);
      const dia = Number(item.dia);
      if (!idGestor || dia < 0 || dia > 6) continue;
      if (idsProprios && !idsProprios.has(idGestor)) {
        throw new Error('Sem permissão para editar a escala de outro gestor');
      }
      const data = addDaysIso(inicio, dia);
      if (Object.prototype.hasOwnProperty.call(item, 'tipo')) {
        const tipo = tipoOk(item.tipo);
        await client.query(
          `DELETE FROM escala_gestores_celula WHERE id_gestor = $1 AND data = $2::date`,
          [idGestor, data],
        );
        if (tipo) {
          await client.query(
            `INSERT INTO escala_gestores_celula (id_gestor, data, tipo) VALUES ($1, $2::date, $3)`,
            [idGestor, data, tipo],
          );
          await client.query(
            `DELETE FROM escala_gestores_horario WHERE id_gestor = $1 AND data = $2::date`,
            [idGestor, data],
          );
        }
      }
      if (
        Object.prototype.hasOwnProperty.call(item, 'hora_inicio') ||
        Object.prototype.hasOwnProperty.call(item, 'hora_fim')
      ) {
        const horaInicio = horaSql(item.hora_inicio);
        const horaFim = horaSql(item.hora_fim);
        if (!horaInicio && !horaFim) {
          await client.query(
            `DELETE FROM escala_gestores_horario WHERE id_gestor = $1 AND data = $2::date`,
            [idGestor, data],
          );
        } else {
          await client.query(
            `INSERT INTO escala_gestores_horario (id_gestor, data, hora_inicio, hora_fim)
             VALUES ($1, $2::date, $3::time, $4::time)
             ON CONFLICT (id_gestor, data) DO UPDATE
               SET hora_inicio = EXCLUDED.hora_inicio, hora_fim = EXCLUDED.hora_fim`,
            [idGestor, data, horaInicio, horaFim],
          );
        }
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return carregarGradeGestores(user, { semana_inicio: inicio });
}

function dataBr(iso) {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function anexoCentralGa() {
  const logoPath = findBrandAsset('Logo_CentralGA.png');
  if (!logoPath) return [];
  return [{
    filename: 'Logo_CentralGA.png',
    path: logoPath,
    cid: 'centralga-logo',
    contentDisposition: 'inline',
    contentType: 'image/png',
  }];
}

/** Quem recebe a escala fica em Configurações → Quem recebe e-mail. */
async function destinatariosEscalaGestor(linhas) {
  const lojas = [...new Set(linhas.map((l) => Number(l.id_loja)).filter((id) => id > 0))];
  const { emails } = await montarEmailsRelatorio('escala', lojas);
  return emails;
}

function htmlRelatorio(linhas, inicio, fim, quem) {
  const blocos = linhas.map((linha) => {
    const loja = [linha.bk_number, linha.nome_loja].filter(Boolean).join(' · ');
    const dias = linha.dias
      .map((d) => {
        const folga = Boolean(d.tipo);
        const quando = folga
          ? ROTULO_TIPO[d.tipo] || d.tipo
          : d.hora_inicio && d.hora_fim
            ? `${d.hora_inicio} – ${d.hora_fim}`
            : 'Não definido';
        const pillBg = folga ? '#FFF4EC' : '#E8EEFB';
        const pillFg = folga ? '#C2410C' : '#0548D1';
        return `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #EEF2F6;width:36px">
            <div style="width:36px;height:36px;border-radius:10px;background:#0B1721;color:#fff;text-align:center;line-height:36px;font-size:11px;font-weight:700">${escHtml((DIAS_EMAIL[d.dia] || '').slice(0, 3))}</div>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #EEF2F6;font-size:14px;color:#0B1721">
            <div style="font-weight:700">${escHtml(DIAS_EMAIL[d.dia] || '')}</div>
            <div style="color:#64748B;font-size:12px">${escHtml(dataBr(d.data))}</div>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #EEF2F6;text-align:right">
            <span style="display:inline-block;background:${pillBg};color:${pillFg};border-radius:999px;padding:6px 12px;font-size:13px;font-weight:700">${escHtml(quando)}</span>
          </td>
        </tr>`;
      })
      .join('');
    return `<p style="margin:18px 0 4px;font-size:18px;font-weight:800;color:#0B1721">${escHtml(linha.nome)}</p>
      <p style="margin:0 0 8px;color:#64748B;font-size:13px">${escHtml(loja || 'Sem loja')}${linha.folga_padrao ? ` · Folga ${escHtml(linha.folga_padrao)}` : ''}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${dias}</table>`;
  });
  return `<div style="margin:0;padding:24px 12px;background:#F4F7FB">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E6EDF5">
      <div style="background:#0B1721;padding:22px 24px">
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
          <tr>
            <td style="vertical-align:middle;padding-right:16px">
              <img src="cid:centralga-logo" alt="Central GA" width="168" style="display:block;border:0;width:168px;height:auto" />
            </td>
            <td style="vertical-align:middle">
              <p style="margin:0;color:#E8520A;font-size:11px;font-weight:700;letter-spacing:.08em">MERIDIAN</p>
              <h1 style="margin:4px 0 0;color:#fff;font-size:22px;line-height:1.25;font-weight:800">Escala de ${escHtml(quem)}</h1>
              <p style="margin:6px 0 0;color:#94A3B8;font-size:14px">${escHtml(dataBr(inicio))} a ${escHtml(dataBr(fim))}</p>
            </td>
          </tr>
        </table>
      </div>
      <div style="padding:8px 24px 24px">${blocos.join('')}</div>
    </div>
  </div>`;
}

function diaDaEscalaMontado(dia) {
  if (tipoOk(dia?.tipo)) return true;
  return Boolean(horaSql(dia?.hora_inicio) && horaSql(dia?.hora_fim));
}

/** Cada dia precisa de horário ou de folga, férias, atestado ou falta. */
function exigirEscalaMontada(body) {
  const lista = Array.isArray(body?.celulas) ? body.celulas : [];
  const porGestor = new Map();
  for (const item of lista) {
    const id = Number(item?.id_gestor);
    const dia = Number(item?.dia);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(dia) || dia < 0 || dia > 6) continue;
    if (!porGestor.has(id)) porGestor.set(id, new Set());
    if (diaDaEscalaMontado(item)) porGestor.get(id).add(dia);
  }
  if (!porGestor.size) {
    throw new Error('Monte a escala da semana inteira antes de enviar');
  }
  for (const dias of porGestor.values()) {
    if (dias.size < 7) {
      throw new Error('Monte a escala da semana inteira antes de enviar');
    }
  }
}

/** Gestor confirma a semana: trava a edição e manda o relatório. */
export async function enviarEscalaGestor(user, body) {
  const dados = await dadosUsuario(user);
  if (!ehGestorSomentePropria(user, dados)) {
    throw new Error('Sem permissão para enviar a escala');
  }
  exigirEscalaMontada(body);
  if (body?.celulas || body?.gestores) {
    await salvarGradeGestores(user, body);
  }
  const grade = await carregarGradeGestores(user, {
    semana_inicio: body?.semana_inicio,
    mostrarGravado: true,
  });
  if (!grade.linhas.length) throw new Error('Sem permissão para enviar a escala');
  if (grade.enviada || !grade.pode_editar) throw new Error('Escala já enviada');
  const semanaCompleta = grade.linhas.every((linha) =>
    linha.dias.length === 7 && linha.dias.every((d) => diaDaEscalaMontado(d)),
  );
  if (!semanaCompleta) {
    throw new Error('Monte a escala da semana inteira antes de enviar');
  }

  const quem = dados?.nome || 'Gestor';
  const destinatarios = await destinatariosEscalaGestor(grade.linhas);
  if (!destinatarios.length) throw new Error('Nenhum destinatário para a escala');
  await sendMail({
    to: destinatarios,
    subject: `Escala ${quem} · ${dataBr(grade.semana_inicio)} a ${dataBr(grade.semana_fim)}`,
    html: htmlRelatorio(grade.linhas, grade.semana_inicio, grade.semana_fim, quem),
    attachments: anexoCentralGa(),
  });

  const idUsuario = Number(user?.sub || user?.id_usuario) || null;
  await pool.query(
    `INSERT INTO escala_gestores_envio (id_gestor, semana_inicio, id_usuario, aberta)
     SELECT x.id_gestor, $2::date, $3, FALSE
     FROM unnest($1::int[]) AS x(id_gestor)
     ON CONFLICT (id_gestor, semana_inicio) DO UPDATE
       SET aberta = FALSE, enviado_em = NOW(), id_usuario = EXCLUDED.id_usuario`,
    [grade.linhas.map((l) => l.id_gestor), grade.semana_inicio, idUsuario],
  );
  return carregarGradeGestores(user, { semana_inicio: grade.semana_inicio });
}

async function exigirReabertura(user, idGestor, semanaInicio) {
  const dados = await dadosUsuario(user);
  if (!podeReabrirEscalaGestor(user, dados)) {
    throw new Error('Sem permissão para reabrir a escala');
  }
  const id = Number(idGestor);
  if (!id) throw new Error('Gestor inválido');
  if (!veRedeTodaGestores(user, dados)) {
    const idsLoja = await idsLojasRegiaoUsuario(user);
    const { rows } = await pool.query(
      `SELECT id_loja FROM escala_gestores WHERE id_gestor = $1`,
      [id],
    );
    const idLoja = rows[0]?.id_loja != null ? Number(rows[0].id_loja) : null;
    if (!idLoja || !idsLoja.has(idLoja)) {
      throw new Error('Sem permissão para reabrir a escala');
    }
  }
  await garantirSchemaGestores();
  const inicio = segundaFeiraDaSemana(semanaInicio || new Date());
  return { id, inicio };
}

/** Tira o travamento. O gestor volta a editar a semana. */
export async function reabrirEscalaGestor(user, body) {
  const { id, inicio } = await exigirReabertura(user, body?.id_gestor, body?.semana_inicio);
  await pool.query(
    `UPDATE escala_gestores_envio SET aberta = TRUE WHERE id_gestor = $1 AND semana_inicio = $2::date`,
    [id, inicio],
  );
  return carregarGradeGestores(user, { semana_inicio: inicio });
}

/** Apaga os dias da semana e o envio. A pessoa continua cadastrada. */
export async function excluirEscalaGestor(user, body) {
  const { id, inicio } = await exigirReabertura(user, body?.id_gestor, body?.semana_inicio);
  const fim = addDaysIso(inicio, 6);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM escala_gestores_celula WHERE id_gestor = $1 AND data >= $2::date AND data <= $3::date`,
      [id, inicio, fim],
    );
    await client.query(
      `DELETE FROM escala_gestores_horario WHERE id_gestor = $1 AND data >= $2::date AND data <= $3::date`,
      [id, inicio, fim],
    );
    await client.query(
      `DELETE FROM escala_gestores_envio WHERE id_gestor = $1 AND semana_inicio = $2::date`,
      [id, inicio],
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return carregarGradeGestores(user, { semana_inicio: inicio });
}

export async function upsertGestorCadastro(user, body, { semana_inicio } = {}) {
  if (!podeGerenciarEscalaVisitas(user)) {
    throw Object.assign(new Error('Sem permissão para editar gestores'), { status: 403 });
  }
  await garantirSchemaGestores();
  const idGestor = body?.id_gestor != null ? Number(body.id_gestor) : null;
  const nome = String(body?.nome || '').trim().slice(0, 120);
  const idLoja = body?.id_loja != null && body.id_loja !== '' ? Number(body.id_loja) : null;
  const folgaPadrao =
    body?.folga_padrao !== undefined
      ? String(body.folga_padrao || '').trim() || null
      : undefined;
  const grupo = body?.grupo === 'campo' ? 'campo' : 'loja';
  if (!nome) {
    throw Object.assign(new Error('Informe o nome do gestor'), { status: 400 });
  }

  let bkNumber = body?.bk_number != null ? String(body.bk_number).trim() || null : null;
  if (idLoja) {
    const { rows } = await pool.query(
      `SELECT id_loja, bk_number FROM lojas WHERE id_loja = $1 AND is_active = TRUE`,
      [idLoja],
    );
    if (!rows[0]) {
      throw Object.assign(new Error('Loja não encontrada'), { status: 404 });
    }
    bkNumber = rows[0].bk_number || bkNumber;
  }

  if (idGestor) {
    const sets = ['nome = $2', 'id_loja = $3', 'bk_number = $4', 'grupo = $5'];
    const params = [idGestor, nome, idLoja, bkNumber, grupo];
    if (folgaPadrao !== undefined) {
      params.push(folgaPadrao);
      sets.push(`folga_padrao = $${params.length}`);
    }
    params.push(true);
    sets.push(`ativo = $${params.length}`);
    const { rowCount } = await pool.query(
      `UPDATE escala_gestores SET ${sets.join(', ')} WHERE id_gestor = $1`,
      params,
    );
    if (!rowCount) {
      throw Object.assign(new Error('Gestor não encontrado'), { status: 404 });
    }
  } else {
    const { rows: ord } = await pool.query(
      `SELECT COALESCE(MAX(ordem), 0) + 1 AS prox FROM escala_gestores WHERE grupo = $1`,
      [grupo],
    );
    await pool.query(
      `INSERT INTO escala_gestores (id_loja, bk_number, nome, grupo, folga_padrao, ordem, ativo)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
      [idLoja, bkNumber, nome, grupo, folgaPadrao ?? null, Number(ord[0]?.prox) || 1],
    );
  }

  return carregarGradeGestores(user, { semana_inicio: semana_inicio || new Date() });
}

export async function desativarGestorCadastro(user, idGestor, { semana_inicio } = {}) {
  if (!podeGerenciarEscalaVisitas(user)) {
    throw Object.assign(new Error('Sem permissão para editar gestores'), { status: 403 });
  }
  await garantirSchemaGestores();
  const id = Number(idGestor);
  if (!id) {
    throw Object.assign(new Error('Gestor inválido'), { status: 400 });
  }
  const { rowCount } = await pool.query(
    `UPDATE escala_gestores SET ativo = FALSE WHERE id_gestor = $1`,
    [id],
  );
  if (!rowCount) {
    throw Object.assign(new Error('Gestor não encontrado'), { status: 404 });
  }
  return carregarGradeGestores(user, { semana_inicio: semana_inicio || new Date() });
}
