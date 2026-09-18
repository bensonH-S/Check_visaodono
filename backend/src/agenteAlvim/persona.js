import { pool } from '../db.js';
import { logger } from '../logger.js';

const TOM_PADRAO = [
  'Colega de operação no Zap, não bot de alerta.',
  'Princípio: ENTENDER → CONFERIR → AGIR → ACOMPANHAR.',
  'Fala curto, natural, pelo primeiro nome. Sem CAIXA ALTA, sem “Prezado”, sem “Informamos que”.',
  'Se disseram “já finalizou” ou “todos subiram”, o sistema confere antes de comemorar.',
  'Ex.: Bárbara fala que Samambaia fechou e a contagem está aberta → “apareceu, mas falta finalizar no app.”',
  'Cobra com ação: o que falta, quem age, prazo se existir.',
  'Silêncio também é resposta: bom dia solto não responde.',
].join(' ');

const CONFIG_PADRAO = {
  id: 1,
  nome: 'Agente Alvim',
  ativo: true,
  mesa_operacao: true,
  mesa_financeiro: false,
  grupo_whatsapp: null,
  horario_inicio: '07:00',
  horario_fim: '22:00',
  hora_estoque: '08:00',
  hora_contagem: '11:00',
  hora_escala: '07:30',
  dias_ativos: [1, 2, 3, 4, 5, 6],
  tom: TOM_PADRAO,
  ai_model: null,
  grupos: { lideranca: null, gestores: null, regioes: [] },
};

let schemaOk = false;

function horaSql(valor) {
  if (!valor) return null;
  if (typeof valor === 'string') return valor.slice(0, 5);
  return String(valor).slice(0, 5);
}

function mapConfig(row) {
  if (!row) return { ...CONFIG_PADRAO };
  return {
    id: 1,
    nome: row.nome || CONFIG_PADRAO.nome,
    ativo: row.ativo !== false,
    mesa_operacao: row.mesa_operacao !== false,
    mesa_financeiro: row.mesa_financeiro === true,
    grupo_whatsapp: row.grupo_whatsapp ? String(row.grupo_whatsapp).trim() : null,
    horario_inicio: horaSql(row.horario_inicio) || CONFIG_PADRAO.horario_inicio,
    horario_fim: horaSql(row.horario_fim) || CONFIG_PADRAO.horario_fim,
    hora_estoque: horaSql(row.hora_estoque) || CONFIG_PADRAO.hora_estoque,
    hora_contagem: horaSql(row.hora_contagem) || CONFIG_PADRAO.hora_contagem,
    hora_escala: horaSql(row.hora_escala) || CONFIG_PADRAO.hora_escala,
    dias_ativos: Array.isArray(row.dias_ativos) && row.dias_ativos.length
      ? row.dias_ativos.map(Number)
      : CONFIG_PADRAO.dias_ativos,
    tom: row.tom || CONFIG_PADRAO.tom,
    ai_model: row.ai_model ? String(row.ai_model).trim() : null,
    grupos: normalizarGrupos(row.grupos),
  };
}

export async function garantirSchemaAlvim() {
  if (schemaOk) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agente_alvim_config (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      nome TEXT NOT NULL DEFAULT 'Agente Alvim',
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      mesa_operacao BOOLEAN NOT NULL DEFAULT TRUE,
      mesa_financeiro BOOLEAN NOT NULL DEFAULT FALSE,
      grupo_whatsapp TEXT,
      horario_inicio TIME NOT NULL DEFAULT '07:00',
      horario_fim TIME NOT NULL DEFAULT '22:00',
      hora_estoque TIME NOT NULL DEFAULT '08:00',
      hora_contagem TIME NOT NULL DEFAULT '11:00',
      hora_escala TIME NOT NULL DEFAULT '07:30',
      dias_ativos SMALLINT[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6],
      tom TEXT NOT NULL DEFAULT '${TOM_PADRAO.replace(/'/g, "''")}',
      ai_model TEXT,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE agente_alvim_config
      ADD COLUMN IF NOT EXISTS ai_model TEXT
  `);
  await pool.query(`
    ALTER TABLE agente_alvim_config
      ADD COLUMN IF NOT EXISTS grupos JSONB NOT NULL DEFAULT '{}'::jsonb
  `);
  await pool.query(`
    INSERT INTO agente_alvim_config (id)
    VALUES (1)
    ON CONFLICT (id) DO NOTHING
  `);
  await pool.query(`
    UPDATE agente_alvim_config
    SET tom = $1, atualizado_em = NOW()
    WHERE id = 1 AND (
      tom IS NULL
      OR tom = ''
      OR tom LIKE 'Direto, operacional, sem enrolação%'
      OR tom LIKE 'Fala como gente no grupo:%'
      OR tom LIKE 'Você é colega de operação no Zap%'
      OR tom LIKE 'Colega de operação no Zap%'
    )
  `, [TOM_PADRAO]);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agente_alvim_envios (
      id_envio BIGSERIAL PRIMARY KEY,
      chave TEXT NOT NULL,
      ferramenta TEXT NOT NULL,
      destino TEXT,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      enviado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_agente_alvim_envios_chave
      ON agente_alvim_envios (chave)
  `);
  const { garantirSchemaPendencias } = await import('./pendencia.js');
  await garantirSchemaPendencias();
  schemaOk = true;
}

export async function carregarConfigAlvim() {
  try {
    await garantirSchemaAlvim();
    const { rows } = await pool.query('SELECT * FROM agente_alvim_config WHERE id = 1');
    return mapConfig(rows[0]);
  } catch (e) {
    logger.warn('agente-alvim', 'Config indisponível — uso o padrão', { error: e.message });
    return { ...CONFIG_PADRAO };
  }
}

export async function salvarConfigAlvim(patch = {}) {
  await garantirSchemaAlvim();
  const atual = await carregarConfigAlvim();
  const proximo = {
    nome: textoCurto(patch.nome, atual.nome, 80) || CONFIG_PADRAO.nome,
    ativo: patch.ativo == null ? atual.ativo : Boolean(patch.ativo),
    mesa_operacao: patch.mesa_operacao == null ? atual.mesa_operacao : Boolean(patch.mesa_operacao),
    mesa_financeiro: patch.mesa_financeiro == null ? atual.mesa_financeiro : Boolean(patch.mesa_financeiro),
    grupo_whatsapp: patch.grupo_whatsapp === undefined
      ? atual.grupo_whatsapp
      : (String(patch.grupo_whatsapp || '').trim() || null),
    horario_inicio: horaSql(patch.horario_inicio) || atual.horario_inicio,
    horario_fim: horaSql(patch.horario_fim) || atual.horario_fim,
    hora_estoque: horaSql(patch.hora_estoque) || atual.hora_estoque,
    hora_contagem: horaSql(patch.hora_contagem) || atual.hora_contagem,
    hora_escala: horaSql(patch.hora_escala) || atual.hora_escala,
    tom: textoCurto(patch.tom, atual.tom, 8000) || TOM_PADRAO,
    ai_model: modeloPermitido(patch.ai_model === undefined ? atual.ai_model : patch.ai_model),
    grupos: patch.grupos === undefined ? atual.grupos : normalizarGrupos(patch.grupos),
  };
  await pool.query(
    `
    UPDATE agente_alvim_config
    SET nome = $1,
        ativo = $2,
        mesa_operacao = $3,
        mesa_financeiro = $4,
        grupo_whatsapp = $5,
        horario_inicio = $6::time,
        horario_fim = $7::time,
        hora_estoque = $8::time,
        hora_contagem = $9::time,
        hora_escala = $10::time,
        tom = $11,
        ai_model = $12,
        grupos = $13::jsonb,
        atualizado_em = NOW()
    WHERE id = 1
    `,
    [
      proximo.nome,
      proximo.ativo,
      proximo.mesa_operacao,
      proximo.mesa_financeiro,
      proximo.grupo_whatsapp,
      proximo.horario_inicio,
      proximo.horario_fim,
      proximo.hora_estoque,
      proximo.hora_contagem,
      proximo.hora_escala,
      proximo.tom,
      proximo.ai_model,
      JSON.stringify(proximo.grupos || {}),
    ],
  );
  return carregarConfigAlvim();
}

function textoCurto(valor, fallback, max) {
  if (valor == null) return fallback;
  const s = String(valor).trim();
  if (!s) return fallback;
  return s.slice(0, max);
}

function modeloPermitido(valor) {
  const s = String(valor || '').trim();
  if (!s) return null;
  if (!/^[\w./-]{3,80}$/.test(s)) return null;
  return s;
}

function normalizarGrupos(raw) {
  const g = raw && typeof raw === 'object' ? raw : {};
  const lideranca = g.lideranca && g.lideranca.id
    ? { id: String(g.lideranca.id), nome: String(g.lideranca.nome || 'Liderança') }
    : null;
  const gestores = g.gestores && g.gestores.id
    ? { id: String(g.gestores.id), nome: String(g.gestores.nome || 'Gestores') }
    : null;
  const regioes = Array.isArray(g.regioes)
    ? g.regioes
      .filter((r) => r && r.id)
      .map((r) => ({
        id: String(r.id),
        nome: String(r.nome || ''),
        regional: r.regional ? String(r.regional) : null,
        id_regiao: r.id_regiao != null ? Number(r.id_regiao) : null,
        id_usuario: r.id_usuario != null ? Number(r.id_usuario) : null,
        nome_regional: r.nome_regional ? String(r.nome_regional) : null,
      }))
    : [];
  return { lideranca, gestores, regioes };
}

export function promptSistemaAlvim(config) {
  const tom = config?.tom || TOM_PADRAO;
  return [
    'Você é o Agente Alvim, um colega de operação do Grupo Alvim no WhatsApp.',
    'Você não é um bot de alertas. Acompanha a operação com gestores, regionais e liderança: observa, consulta as ferramentas, responde o contexto, cobra, orienta e acompanha a pendência até a conclusão.',
    'Princípio: ENTENDER → CONFERIR → AGIR → ACOMPANHAR.',
    tom,
    'Antes de responder, identifique: quem fala, qual loja/regional, o que foi afirmado, se precisa conferir, qual o próximo passo útil.',
    'Não trate a mensagem isolada quando houver contexto ou pendência.',
    'Se alguém disser “já fiz”, “fiz a contagem”, “já subiu”, “finalizei” ou “está resolvido”, o SISTEMA já conferiu. Os fatos trazem o estado da pendência. Nunca comemore o que o sistema não confirmou. Quando citar loja, use BK + nome (BK Samambaia, BK 201 Norte).',
    'Exemplo: Bárbara diz que Samambaia finalizou e o sistema está aberto → “Bárbara, apareceu aqui 👍 mas a contagem ainda está aberta. Falta finalizar no app.”',
    'Fale curto, natural, pelo primeiro nome. Profissional sem ser engessado. Emoji só se combinar. Sem CAIXA ALTA, sem textão, sem “Prezado”, “Informamos que”, “Alerta do sistema”.',
    'Prefira: “Plínio, conferi aqui.” / “Boa, Fagno. As duas fecharam 👍” / “Renato, consigo sim. Vou acompanhar esses itens.”',
    'Não repita a cobrança inteira. Responda só o que mudou.',
    'Cobrança gera ação: o que está pendente, quem age, próximo passo, prazo se existir.',
    'Pedido de monitoramento: confirme objetivo e trate como regra enquanto estiver ativo.',
    'Público: lideranca = resumo e exceções; gestores = ação da loja; regiao = pendências daquela regional. Não exponha uma regional em outro grupo sem necessidade.',
    'Silêncio é resposta. Ignore bom dia solto, obrigado sem continuidade, brincadeira e assunto já resolvido. Se não houver informação nova ou ação, {"agir":false,"msgs":[]}.',
    'O GPT conversa. O sistema controla o estado (DETECTADA, COBRADA, AGUARDANDO, CONFERINDO, ATRASADA, RESOLVIDA). As ferramentas comprovam os fatos. Não invente loja, saldo, status, prazo ou colaborador.',
    'Se não conseguiu consultar: “Não consegui confirmar isso no sistema agora.”',
    'Responda SOMENTE JSON: {"agir":true,"msgs":["bolha1"]}',
    'Loja com prefixo BK e nome curto: BK Samambaia, BK 201 Norte, BK Ponte Alta. Item em título curto (Pão Supremo).',
    'Se missao=avisar_contagem_faltou: cobra o regional, lista lojas, prazo se veio nos fatos.',
    'Se missao=avisar_item_zerado_na_loja: uma loja por bolha, “BK Ponte Alta — pão Supremo”.',
    'Se missao=responder_whatsapp: use consulta[] (status real do banco). Se orientacao=ainda_nao_me_avisa, uma bolha nova: ainda não está no sistema e peça para te avisarem quando fizerem — texto sempre diferente. Se nada_mudou, {"agir":false,"msgs":[]}. Se resolvida/contou, comemora curto.',
  ].join('\n');
}

export { CONFIG_PADRAO, TOM_PADRAO };
