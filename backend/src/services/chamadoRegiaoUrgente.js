import { pool } from '../db.js';
import {
  mensagemChamadoAtribuido,
  mensagemNovoChamadoRegiao,
  mensagemUrgenteRegiao,
} from '../textosNotificacaoChamado.js';
import { coletarDestinatariosDiretoriaLoja } from './destinatariosDiretoria.js';
import { coletarDestinatariosPorEvento } from './destinatariosNotificacao.js';
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

async function coletarDestinatariosAbertura(idLoja, idAutor) {
  const destinatarios = await coletarDestinatariosRegiaoLoja(idLoja);
  for (const id of await coletarDestinatariosDiretoriaLoja(idLoja)) {
    destinatarios.add(id);
  }
  const idAutorNum = Number(idAutor);
  if (Number.isFinite(idAutorNum)) destinatarios.delete(idAutorNum);
  return destinatarios;
}

async function coletarDestinatariosRegiao(idLoja, idAutor) {
  const destinatarios = await coletarDestinatariosRegiaoLoja(idLoja);
  const idAutorNum = Number(idAutor);
  if (Number.isFinite(idAutorNum)) destinatarios.delete(idAutorNum);
  return destinatarios;
}

/**
 * Abertura de chamado em loja com região cadastrada:
 * 1) notifica técnicos + regional (qualquer urgência)
 * 2) se alta/crítica: atribui ao técnico mais próximo (GPS) e notifica atribuição
 */
export async function processarAberturaChamadoRegiao({
  idChamado,
  idLoja,
  urgencia,
  idAutor,
  numero,
  nomeLoja,
  criarNotificacao,
  temColunaAssumidoEm,
}) {
  const regiao = await buscarRegiaoDaLoja(idLoja);
  const urgente = isUrgenciaAltaOuCritica(urgencia);
  const tipoAbertura = urgente ? 'chamado_urgente_regiao' : 'novo_chamado';
  const destinatarios = await coletarDestinatariosPorEvento(idChamado, tipoAbertura);
  const idAutorNum = Number(idAutor);
  if (Number.isFinite(idAutorNum)) destinatarios.delete(idAutorNum);

  if (!destinatarios.size) {
    return { processado: false, motivo: regiao ? 'sem_destinatarios' : 'sem_regiao' };
  }

  const msgAbertura = urgente
    ? await mensagemUrgenteRegiao(numero, nomeLoja)
    : await mensagemNovoChamadoRegiao(numero, nomeLoja);

  for (const idUsuario of destinatarios) {
    await criarNotificacao({
      idUsuario,
      idChamado,
      tipo: tipoAbertura,
      mensagem: msgAbertura,
      enviarPush: true,
    });
  }

  if (!urgente || !regiao) {
    return {
      processado: true,
      atribuido: false,
      urgente: !!urgente,
      motivo: !regiao && urgente ? 'sem_regiao_auto_atribuir' : undefined,
      notificacoes_abertura: destinatarios.size,
    };
  }

  const tecnicos = await buscarTecnicosRegiao(regiao.id_regiao);
  const lojaCoords = await obterCoordenadasLoja(idLoja);
  const posicoes = await buscarPosicoesTecnicos(tecnicos.map((t) => t.id_usuario));
  const tecnicoProximo = escolherTecnicoMaisProximo(tecnicos, posicoes, lojaCoords);

  if (!tecnicoProximo) {
    return {
      processado: true,
      atribuido: false,
      urgente: true,
      motivo: lojaCoords ? 'sem_gps_tecnico' : 'sem_coordenadas_loja',
      notificacoes_abertura: destinatarios.size,
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
    return {
      processado: true,
      atribuido: false,
      urgente: true,
      motivo: 'ja_atribuido',
      notificacoes_abertura: destinatarios.size,
    };
  }

  const msgAtribuido = await mensagemChamadoAtribuido(numero, tecnicoProximo.nome);
  const destinatariosAtribuicao = await coletarDestinatariosPorEvento(idChamado, 'assumido');
  destinatariosAtribuicao.add(Number(tecnicoProximo.id_usuario));
  if (Number.isFinite(idAutorNum)) destinatariosAtribuicao.delete(idAutorNum);

  for (const idUsuario of destinatariosAtribuicao) {
    const paraTecnico = idUsuario === Number(tecnicoProximo.id_usuario);
    await criarNotificacao({
      idUsuario,
      idChamado,
      tipo: 'assumido',
      mensagem: paraTecnico
        ? await mensagemChamadoAtribuido(numero, null, { paraVoce: true })
        : msgAtribuido,
      enviarPush: true,
    });
  }

  return {
    processado: true,
    atribuido: true,
    urgente: true,
    id_tecnico: tecnicoProximo.id_usuario,
    tecnico_nome: tecnicoProximo.nome,
    distancia_km: tecnicoProximo.distancia_km,
    notificacoes_abertura: destinatarios.size,
  };
}

/** @deprecated use processarAberturaChamadoRegiao */
export const processarChamadoUrgenteRegiao = processarAberturaChamadoRegiao;
