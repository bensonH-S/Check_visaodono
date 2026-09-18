/**
 * Memória operacional do Alvim.
 * O GPT conversa. O sistema controla o estado. A ferramenta comprova o fato.
 */
import { pool } from '../db.js';
import { dataHojeSp } from './horario.js';
import { mesmoNomeLoja, statusLojaNoSnapshot } from './operacao.js';
import { nomeLojaCurto, primeiroNome } from './texto.js';

export const ESTADOS = {
  DETECTADA: 'DETECTADA',
  COBRADA: 'COBRADA',
  AGUARDANDO: 'AGUARDANDO',
  CONFERINDO: 'CONFERINDO',
  ATRASADA: 'ATRASADA',
  RESOLVIDA: 'RESOLVIDA',
  CANCELADA: 'CANCELADA',
};

const TRANSICOES = {
  DETECTADA: ['COBRADA', 'CONFERINDO', 'RESOLVIDA', 'CANCELADA', 'ATRASADA'],
  COBRADA: ['AGUARDANDO', 'CONFERINDO', 'ATRASADA', 'RESOLVIDA', 'CANCELADA'],
  AGUARDANDO: ['CONFERINDO', 'ATRASADA', 'RESOLVIDA', 'CANCELADA', 'COBRADA'],
  CONFERINDO: ['AGUARDANDO', 'RESOLVIDA', 'ATRASADA', 'CANCELADA'],
  ATRASADA: ['COBRADA', 'CONFERINDO', 'RESOLVIDA', 'CANCELADA', 'AGUARDANDO'],
  RESOLVIDA: ['AGUARDANDO', 'CONFERINDO', 'DETECTADA'],
  CANCELADA: [],
};

const ABERTOS = new Set([
  ESTADOS.DETECTADA,
  ESTADOS.COBRADA,
  ESTADOS.AGUARDANDO,
  ESTADOS.CONFERINDO,
  ESTADOS.ATRASADA,
]);

let schemaOk = false;

export function podeTransitar(de, para) {
  return (TRANSICOES[de] || []).includes(para);
}

export function chavePendencia(tipo, partes, dia) {
  return [tipo, ...partes.map((p) => String(p ?? '').trim()), dia].filter((x) => x !== '').join(':');
}

export function pareceAfirmacaoResolucao(texto) {
  const t = String(texto || '').toLowerCase();
  if (!t.trim()) return false;
  return (
    /j[aá]\s*(fiz|fez|subiu|finaliz|resolv|contei|contou|fechei|fechou)/i.test(t)
    || /\bfiz\b.*contagem|\bcontei\b|\bcontou\b|\bfinalizei\b|\bfinalizada\b/i.test(t)
    || /todos\s*(subiram|fecharam|finalizaram|contaram)/i.test(t)
    || /est[aá]\s*(finalizad|resolvid|pront|fechad)/i.test(t)
    || /as duas\s*(j[aá]\s*)?(finaliz|fechar)/i.test(t)
  );
}

export function statusSistemaContagem(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'contou' || s === 'finalizada' || s === 'ok') return 'ok';
  if (s === 'aberta') return 'aberta';
  return 'pendente';
}

export function decidirAposConferir({ sistemaStatus, passouPrazo = false }) {
  const st = statusSistemaContagem(sistemaStatus);
  if (st === 'ok') return ESTADOS.RESOLVIDA;
  if (passouPrazo) return ESTADOS.ATRASADA;
  return ESTADOS.AGUARDANDO;
}

export function deveFalarDeNovo({
  estado,
  passouPrazo = false,
  afirmacao = false,
  primeiraVez = false,
  mudou = false,
} = {}) {
  if (afirmacao) return Boolean(mudou || primeiraVez);
  if (primeiraVez || estado === ESTADOS.DETECTADA) return true;
  if (passouPrazo && estado !== ESTADOS.ATRASADA) return true;
  if (estado === ESTADOS.ATRASADA) return true;
  if (estado === ESTADOS.COBRADA || estado === ESTADOS.AGUARDANDO) return false;
  return false;
}

export async function garantirSchemaPendencias() {
  if (schemaOk) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agente_alvim_pendencias (
      id BIGSERIAL PRIMARY KEY,
      chave TEXT NOT NULL,
      tipo TEXT NOT NULL,
      estado TEXT NOT NULL,
      loja TEXT,
      id_loja INT,
      regional TEXT,
      id_usuario INT,
      id_regiao INT,
      assunto TEXT,
      prazo TEXT,
      dia DATE NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolvido_em TIMESTAMPTZ
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_agente_alvim_pendencias_chave
      ON agente_alvim_pendencias (chave)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_agente_alvim_pendencias_abertas
      ON agente_alvim_pendencias (dia, estado)
  `);
  schemaOk = true;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    chave: row.chave,
    tipo: row.tipo,
    estado: row.estado,
    loja: row.loja,
    id_loja: row.id_loja != null ? Number(row.id_loja) : null,
    regional: row.regional,
    id_usuario: row.id_usuario != null ? Number(row.id_usuario) : null,
    id_regiao: row.id_regiao != null ? Number(row.id_regiao) : null,
    assunto: row.assunto,
    prazo: row.prazo,
    dia: row.dia,
    payload: row.payload || {},
    atualizado_em: row.atualizado_em,
  };
}

export async function registrarDeteccao(dados) {
  const p = await upsertPendencia({ ...dados, estado: ESTADOS.DETECTADA });
  if (passouPrazoPendencia(p)) {
    return (await transicionarPendencia(p.chave, ESTADOS.ATRASADA)) || p;
  }
  return p;
}

export async function upsertPendencia(dados) {
  await garantirSchemaPendencias();
  const dia = dados.dia || dataHojeSp();
  const { rows } = await pool.query(
    `
    INSERT INTO agente_alvim_pendencias (
      chave, tipo, estado, loja, id_loja, regional, id_usuario, id_regiao,
      assunto, prazo, dia, payload, atualizado_em
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::date, $12::jsonb, NOW())
    ON CONFLICT (chave) DO UPDATE
    SET loja = COALESCE(EXCLUDED.loja, agente_alvim_pendencias.loja),
        regional = COALESCE(EXCLUDED.regional, agente_alvim_pendencias.regional),
        id_usuario = COALESCE(EXCLUDED.id_usuario, agente_alvim_pendencias.id_usuario),
        id_regiao = COALESCE(EXCLUDED.id_regiao, agente_alvim_pendencias.id_regiao),
        assunto = COALESCE(EXCLUDED.assunto, agente_alvim_pendencias.assunto),
        prazo = COALESCE(EXCLUDED.prazo, agente_alvim_pendencias.prazo),
        payload = agente_alvim_pendencias.payload || EXCLUDED.payload,
        atualizado_em = NOW()
    RETURNING *
    `,
    [
      dados.chave,
      dados.tipo,
      dados.estado || ESTADOS.DETECTADA,
      dados.loja || null,
      dados.id_loja || null,
      dados.regional || null,
      dados.id_usuario || null,
      dados.id_regiao || null,
      dados.assunto || null,
      dados.prazo || null,
      dia,
      JSON.stringify(dados.payload || {}),
    ],
  );
  return mapRow(rows[0]);
}

export async function transicionarPendencia(chave, proximo, extra = {}) {
  await garantirSchemaPendencias();
  const { rows } = await pool.query(
    'SELECT * FROM agente_alvim_pendencias WHERE chave = $1',
    [chave],
  );
  const atual = rows[0];
  if (!atual) return null;
  if (atual.estado === proximo) return mapRow(atual);
  if (!podeTransitar(atual.estado, proximo)) return mapRow(atual);

  const resolvido = proximo === ESTADOS.RESOLVIDA || proximo === ESTADOS.CANCELADA;
  const { rows: upd } = await pool.query(
    `
    UPDATE agente_alvim_pendencias
    SET estado = $2,
        payload = payload || $3::jsonb,
        atualizado_em = NOW(),
        resolvido_em = CASE WHEN $4 THEN NOW() ELSE resolvido_em END
    WHERE chave = $1
    RETURNING *
    `,
    [chave, proximo, JSON.stringify(extra), resolvido],
  );
  return mapRow(upd[0]);
}

export async function pendenciasAbertas({ dia = null, regional = null, tipo = null } = {}) {
  await garantirSchemaPendencias();
  const hoje = dia || dataHojeSp();
  const params = [hoje];
  let sql = `
    SELECT * FROM agente_alvim_pendencias
    WHERE dia = $1::date
      AND estado = ANY($2::text[])
  `;
  params.push([...ABERTOS]);
  if (regional) {
    params.push(primeiroNome(regional));
    sql += ` AND (regional ILIKE $3 OR regional ILIKE $3 || '%')`;
  }
  if (tipo) {
    params.push(tipo);
    sql += ` AND tipo = $${params.length}`;
  }
  sql += ' ORDER BY atualizado_em DESC';
  const { rows } = await pool.query(sql, params);
  return rows.map(mapRow);
}

export async function marcarCobradas(chaves) {
  const list = (chaves || []).filter(Boolean);
  for (const chave of list) {
    const atual = await transicionarPendencia(chave, ESTADOS.COBRADA);
    if (atual?.estado === ESTADOS.COBRADA) {
      await transicionarPendencia(chave, ESTADOS.AGUARDANDO);
    }
  }
}

function lojaNoSnapshot(snapshot, nomeLoja, idLoja = null) {
  const hit = statusLojaNoSnapshot(snapshot, { id_loja: idLoja, loja: nomeLoja });
  if (hit) return hit.status;
  const zeradas = (snapshot?.estoque_zero || []).flatMap((g) => g.lojas || []);
  if (zeradas.some((l) => mesmoNomeLoja(l.loja, nomeLoja))) return 'zerado';
  return 'ok';
}

function passouPrazoPendencia(p, agora = new Date()) {
  if (!p?.prazo) return false;
  const [h, m] = String(p.prazo).split(':').map(Number);
  if (!Number.isFinite(h)) return false;
  const sp = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return sp.getHours() * 60 + sp.getMinutes() >= h * 60 + (m || 0);
}

function filtrarPendenciasPeloTexto(pendencias, texto) {
  const t = String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  return (pendencias || []).filter((p) => {
    const loja = nomeLojaCurto(p.loja).replace(/^BK\s+/i, '');
    return loja && mesmoNomeLoja(loja, t);
  });
}

export async function conferirAfirmacao({
  texto,
  snapshot,
  regional = null,
  nomePessoa = null,
  lojasContexto = [],
} = {}) {
  const afirmacao = pareceAfirmacaoResolucao(texto);
  const todas = await pendenciasAbertas({});
  let abertas = regional || nomePessoa
    ? await pendenciasAbertas({ regional: regional || nomePessoa })
    : todas;
  let citadas = filtrarPendenciasPeloTexto(abertas, texto);
  if (!citadas.length) citadas = filtrarPendenciasPeloTexto(todas, texto);
  if (!citadas.length && lojasContexto.length) {
    citadas = todas.filter((p) => lojasContexto.some((n) => mesmoNomeLoja(p.loja, n)));
  }
  if (citadas.length) abertas = citadas;
  else if (afirmacao && todas.length && !(regional || nomePessoa)) abertas = todas;

  if (!afirmacao) {
    return {
      afirmacao: false,
      pendencias: abertas,
      deve_falar: false,
      nada_mudou: false,
    };
  }

  const resultado = [];
  for (const p of abertas) {
    const sistemaAnterior = p.payload?.sistema || null;
    const jaPediuAviso = p.payload?.ja_pediu_aviso === true || Boolean(p.payload?.afirmacao);
    const primeiraConferencia = sistemaAnterior == null;
    await transicionarPendencia(p.chave, ESTADOS.CONFERINDO, { afirmacao: texto });
    const sistema = lojaNoSnapshot(snapshot, p.loja, p.id_loja);
    const proximo = decidirAposConferir({
      sistemaStatus: sistema === 'zerado' ? 'pendente' : sistema,
      passouPrazo: passouPrazoPendencia(p),
    });
    const mudou = primeiraConferencia || sistemaAnterior !== sistema || proximo === ESTADOS.RESOLVIDA;
    const depois = await transicionarPendencia(p.chave, proximo, { sistema, afirmacao: texto });
    resultado.push({
      ...depois,
      sistema,
      sistema_anterior: sistemaAnterior,
      ja_pediu_aviso: jaPediuAviso,
      mudou,
      resolvida: proximo === ESTADOS.RESOLVIDA,
    });
  }

  const algumaMudou = resultado.some((p) => p.mudou);
  const aindaPendente = resultado.some((p) => !p.resolvida);
  const jaPediuAviso = resultado.some((p) => p.ja_pediu_aviso);
  const resolvidas = resultado.some((p) => p.resolvida);
  const pediuAvisoAgora = aindaPendente && !jaPediuAviso && !resolvidas;
  return {
    afirmacao: true,
    pendencias: resultado,
    deve_falar: resolvidas || pediuAvisoAgora,
    nada_mudou: !resolvidas && (jaPediuAviso || !algumaMudou),
    todas_resolvidas: resultado.length > 0 && resultado.every((p) => p.resolvida),
    ainda_abertas: resultado.filter((p) => !p.resolvida),
    orientacao: resolvidas ? 'comemorou' : (pediuAvisoAgora ? 'ainda_nao_me_avisa' : 'silencio'),
  };
}

export async function pendenciasDoDia({ dia = null, tipo = null } = {}) {
  await garantirSchemaPendencias();
  const hoje = dia || dataHojeSp();
  const params = [hoje];
  let sql = 'SELECT * FROM agente_alvim_pendencias WHERE dia = $1::date';
  if (tipo) {
    params.push(tipo);
    sql += ` AND tipo = $${params.length}`;
  }
  sql += ' ORDER BY atualizado_em DESC';
  const { rows } = await pool.query(sql, params);
  return rows.map(mapRow);
}

export async function reservarComemoracao(chave, idContagem = null) {
  if (!chave) return false;
  const { rows } = await pool.query(
    `
    UPDATE agente_alvim_pendencias
    SET payload = payload
          || jsonb_build_object(
            'ja_comemorou', true,
            'id_contagem_visto', to_jsonb($2::text)
          ),
        estado = 'RESOLVIDA',
        resolvido_em = COALESCE(resolvido_em, NOW()),
        atualizado_em = NOW()
    WHERE chave = $1
      AND (
        COALESCE((payload->>'ja_comemorou')::boolean, false) IS NOT TRUE
        OR COALESCE(payload->>'id_contagem_visto', '') IS DISTINCT FROM COALESCE($2::text, '')
      )
    RETURNING *
    `,
    [chave, idContagem != null ? String(idContagem) : ''],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function reabrirPendencia(chave, extra = {}) {
  if (!chave) return null;
  const { rows } = await pool.query(
    `
    UPDATE agente_alvim_pendencias
    SET estado = 'AGUARDANDO',
        resolvido_em = NULL,
        payload = (payload - 'ja_comemorou') || $2::jsonb,
        atualizado_em = NOW()
    WHERE chave = $1
    RETURNING *
    `,
    [chave, JSON.stringify(extra)],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function colherResolvidasNoSistema(snapshot) {
  const doDia = (await pendenciasDoDia({ tipo: 'contagem' }));
  const resolvidas = [];
  for (const p of doDia) {
    const live = statusLojaNoSnapshot(snapshot, { id_loja: p.id_loja, loja: p.loja });
    const sistema = live?.status || lojaNoSnapshot(snapshot, p.loja, p.id_loja);
    const idContagem = live?.id_contagem || null;
    const visto = p.payload?.id_contagem_visto || null;

    if (sistema === 'aberta' || sistema === 'faltou' || sistema === 'pendente') {
      if (p.estado === ESTADOS.RESOLVIDA) {
        await reabrirPendencia(p.chave, { sistema, id_contagem_visto: null });
      }
      continue;
    }
    if (sistema !== 'contou' && sistema !== 'ok') continue;
    if (visto && idContagem && String(visto) === String(idContagem) && p.payload?.ja_comemorou) {
      continue;
    }
    const depois = await reservarComemoracao(p.chave, idContagem);
    if (!depois) continue;
    resolvidas.push({
      ...depois,
      sistema: 'contou',
      resolvida: true,
    });
  }
  return resolvidas;
}

export async function reservarPedidoAviso(chaves) {
  const list = (chaves || []).filter(Boolean);
  if (!list.length) return false;
  const { rows } = await pool.query(
    `
    UPDATE agente_alvim_pendencias
    SET payload = payload || '{"ja_pediu_aviso":true}'::jsonb,
        atualizado_em = NOW()
    WHERE chave = ANY($1::text[])
      AND COALESCE((payload->>'ja_pediu_aviso')::boolean, false) IS NOT TRUE
    RETURNING chave
    `,
    [list],
  );
  return rows.length > 0;
}

export function resumoPendenciasParaFatos(lista) {
  return (lista || []).map((p) => ({
    loja: nomeLojaCurto(p.loja),
    tipo: p.tipo,
    estado: p.estado,
    sistema: p.sistema || null,
    regional: primeiroNome(p.regional),
    assunto: p.assunto,
    resolvida: p.resolvida === true || p.estado === ESTADOS.RESOLVIDA,
  }));
}
