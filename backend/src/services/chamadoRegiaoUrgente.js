import { pool } from '../db.js';
import { mensagemChamadoAtribuido, mensagemUrgenteRegiao } from '../textosNotificacaoChamado.js';
import { distanciaKm } from '../utils/geo.js';
import { obterCoordenadasLoja } from './geocodificarLoja.js';

const URGENCIAS_AUTO = new Set(['alta', 'critica']);

export function isUrgenciaAltaOuCritica(urgencia) {
  return URGENCIAS_AUTO.has(String(urgencia || '').toLowerCase());
}

async function buscarRegiaoDaLoja(idLoja) {
  const { rows } = await pool.query(
    `SELECT r.id_regiao, r.nome, r.id_regional
     FROM frota_regiao_lojas rl
     JOIN frota_regioes r ON r.id_regiao = rl.id_regiao AND r.ativo = TRUE
     WHERE rl.id_loja = $1
     ORDER BY r.id_regiao
     LIMIT 1`,
    [idLoja],
  );
  return rows[0] || null;
}

async function buscarTecnicosRegiao(idRegiao) {
  const { rows } = await pool.query(
    `SELECT rt.id_usuario, u.nome
     FROM frota_regiao_tecnicos rt
     JOIN usuarios u ON u.id_usuario = rt.id_usuario AND u.ativo = TRUE
     WHERE rt.id_regiao = $1`,
    [idRegiao],
  );
  return rows;
}

/** Gerente/coordenador vinculados à loja (escopo loja, não região). */
async function buscarGestoresLoja(idLoja) {
  const { rows } = await pool.query(
    `SELECT DISTINCT u.id_usuario
     FROM usuarios u
     JOIN usuario_lojas ul ON ul.id_usuario = u.id_usuario AND ul.id_loja = $1
     JOIN usuario_permissoes up ON up.id_usuario = u.id_usuario
     WHERE u.ativo = TRUE
       AND up.codigo IN ('chamados.abrir', 'chamados.ver')
       AND NOT EXISTS (
         SELECT 1 FROM usuario_permissoes upR
         WHERE upR.id_usuario = u.id_usuario
           AND upR.codigo IN ('chamados.assumir', 'frota.regioes')
       )`,
    [idLoja],
  );
  return rows.map((r) => Number(r.id_usuario));
}

async function buscarPosicoesTecnicos(ids) {
  if (!ids.length) return new Map();
  const { rows } = await pool.query(
    `SELECT id_usuario, latitude, longitude
     FROM frota_tecnico_posicao
     WHERE id_usuario = ANY($1::int[])`,
    [ids],
  );
  const map = new Map();
  for (const r of rows) {
    const lat = Number(r.latitude);
    const lng = Number(r.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      map.set(Number(r.id_usuario), { lat, lng });
    }
  }
  return map;
}

function escolherTecnicoMaisProximo(tecnicos, posicoes, lojaCoords) {
  if (!lojaCoords) return null;

  let melhor = null;
  let menorDist = Infinity;

  for (const t of tecnicos) {
    const pos = posicoes.get(Number(t.id_usuario));
    if (!pos) continue;
    const d = distanciaKm(lojaCoords.lat, lojaCoords.lng, pos.lat, pos.lng);
    if (d < menorDist) {
      menorDist = d;
      melhor = { ...t, distancia_km: d };
    }
  }

  return melhor;
}

/** Técnicos da região + regional (supervisor) da loja do chamado. */
export async function coletarDestinatariosRegiaoLoja(idLoja) {
  const regiao = await buscarRegiaoDaLoja(idLoja);
  const destinatarios = new Set();
  if (!regiao) return destinatarios;

  const tecnicos = await buscarTecnicosRegiao(regiao.id_regiao);
  for (const t of tecnicos) destinatarios.add(Number(t.id_usuario));
  if (regiao.id_regional) destinatarios.add(Number(regiao.id_regional));

  return destinatarios;
}

/**
 * Chamado alta/crítica em loja de região cadastrada:
 * 1) notifica técnicos + regional (WhatsApp + push)
 * 2) atribui ao técnico mais próximo (GPS)
 * 3) notifica todos sobre a atribuição
 */
export async function processarChamadoUrgenteRegiao({
  idChamado,
  idLoja,
  urgencia,
  idAutor,
  numero,
  nomeLoja,
  criarNotificacao,
  temColunaAssumidoEm,
}) {
  if (!isUrgenciaAltaOuCritica(urgencia)) {
    return { processado: false, motivo: 'urgencia' };
  }

  const regiao = await buscarRegiaoDaLoja(idLoja);
  if (!regiao) return { processado: false, motivo: 'sem_regiao' };

  const tecnicos = await buscarTecnicosRegiao(regiao.id_regiao);
  const destinatarios = new Set(tecnicos.map((t) => Number(t.id_usuario)));
  if (regiao.id_regional) destinatarios.add(Number(regiao.id_regional));

  const idAutorNum = Number(idAutor);
  destinatarios.delete(idAutorNum);

  if (!destinatarios.size) {
    return { processado: false, motivo: 'sem_destinatarios' };
  }

  const msgUrgente = mensagemUrgenteRegiao(numero, nomeLoja);

  for (const idUsuario of destinatarios) {
    await criarNotificacao({
      idUsuario,
      idChamado,
      tipo: 'chamado_urgente_regiao',
      mensagem: msgUrgente,
      enviarPush: true,
    });
  }

  const lojaCoords = await obterCoordenadasLoja(idLoja);
  const posicoes = await buscarPosicoesTecnicos(tecnicos.map((t) => t.id_usuario));
  const tecnicoProximo = escolherTecnicoMaisProximo(tecnicos, posicoes, lojaCoords);

  if (!tecnicoProximo) {
    return {
      processado: true,
      atribuido: false,
      motivo: lojaCoords ? 'sem_gps_tecnico' : 'sem_coordenadas_loja',
      notificacoes_urgente: destinatarios.size,
    };
  }

  const colAssumido = await temColunaAssumidoEm();
  const setAssumido = colAssumido ? 'assumido_em = NOW(),' : '';

  const { rowCount } = await pool.query(
    `UPDATE manut_chamados
     SET id_tecnico = $1, status = 'em_atendimento', ${setAssumido} updated_at = NOW()
     WHERE id_chamado = $2 AND id_tecnico IS NULL`,
    [tecnicoProximo.id_usuario, idChamado],
  );

  if (!rowCount) {
    return { processado: true, atribuido: false, motivo: 'ja_atribuido' };
  }

  const msgAtribuido = mensagemChamadoAtribuido(numero, tecnicoProximo.nome);

  const destinatariosAtribuicao = new Set(destinatarios);
  destinatariosAtribuicao.add(Number(tecnicoProximo.id_usuario));
  if (Number.isFinite(idAutorNum)) destinatariosAtribuicao.add(idAutorNum);

  for (const idUsuario of await buscarGestoresLoja(idLoja)) {
    destinatariosAtribuicao.add(idUsuario);
  }

  for (const idUsuario of destinatariosAtribuicao) {
    await criarNotificacao({
      idUsuario,
      idChamado,
      tipo: 'assumido',
      mensagem: msgAtribuido,
      enviarPush: true,
    });
  }

  return {
    processado: true,
    atribuido: true,
    id_tecnico: tecnicoProximo.id_usuario,
    tecnico_nome: tecnicoProximo.nome,
    distancia_km: tecnicoProximo.distancia_km,
    notificacoes_urgente: destinatarios.size,
  };
}
