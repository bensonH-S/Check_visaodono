import { ajustarRotaAsRuas } from './routeMatching.js';

const CACHE_TTL_MS = 15_000;

let cachePosicoes = null;
let cacheExpiraEm = 0;

function limparCredencialEnv(raw) {
  if (raw == null) return '';
  let s = String(raw).trim().replace(/^\uFEFF/, '');
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function primeiraEnv(...keys) {
  for (const key of keys) {
    const v = limparCredencialEnv(process.env[key]);
    if (v) return v;
  }
  return '';
}

function credenciaisFulltrack() {
  const apiKey = primeiraEnv(
    'FULLTRACK_API_KEY',
    'APIKEY',
    'API_KEY',
    'VITE_API_KEY',
  );
  const secretKey = primeiraEnv(
    'FULLTRACK_SECRET_KEY',
    'SECRETKEY',
    'SECRET_KEY',
    'VITE_SECRET_KEY',
  );
  const baseUrl = resolverBaseUrlFulltrack();
  return { apiKey, secretKey, baseUrl };
}

function resolverBaseUrlFulltrack() {
  const raw =
    primeiraEnv('FULLTRACK_API_URL', 'API_URL') || 'http://ws.fulltrack2.com';
  const url = raw.replace(/\/$/, '');
  // A API Fulltrack (ws.fulltrack2.com) responde via HTTP — igual ao projeto Fleet/
  if (/ws\.fulltrack2\.com/i.test(url)) {
    return 'http://ws.fulltrack2.com';
  }
  return url.replace(/^https:/i, 'http:');
}

export function fulltrackStatus() {
  const enabledRaw = String(process.env.FULLTRACK_RASTREAMENTO_ENABLED ?? 'true')
    .trim()
    .toLowerCase();
  const habilitadoFlag = !['0', 'false', 'off', 'no'].includes(enabledRaw);
  const { apiKey, secretKey, baseUrl } = credenciaisFulltrack();
  const temApiKey = apiKey.length > 0;
  const temSecretKey = secretKey.length > 0;
  const ativo = habilitadoFlag && temApiKey && temSecretKey;
  let motivo = null;
  if (!habilitadoFlag) motivo = 'desabilitado_por_env';
  else if (!temApiKey && !temSecretKey) motivo = 'credenciais_ausentes';
  else if (!temApiKey) motivo = 'api_key_ausente';
  else if (!temSecretKey) motivo = 'secret_key_ausente';
  return {
    ativo,
    habilitado_flag: habilitadoFlag,
    tem_api_key: temApiKey,
    tem_secret_key: temSecretKey,
    base_url: baseUrl,
    motivo,
  };
}

export function fulltrackRastreamentoAtivo() {
  return fulltrackStatus().ativo;
}

function normalizarPlaca(placa) {
  return String(placa || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

async function fulltrackGet(path) {
  const { apiKey, secretKey, baseUrl } = credenciaisFulltrack();
  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      apikey: apiKey,
      secretkey: secretKey,
    },
  });
  if (!res.ok) {
    const texto = await res.text().catch(() => '');
    throw new Error(`Fulltrack HTTP ${res.status}${texto ? `: ${texto.slice(0, 120)}` : ''}`);
  }
  return res.json();
}

function normalizarOdometroKm(val) {
  const n = parseFloat(val);
  if (!Number.isFinite(n)) return null;
  if (n >= 10000) return Math.round(n / 1000);
  return Math.round(n);
}

function normalizarCombustivel(val) {
  const n = parseFloat(val);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

function parseDataHoraPonto(str) {
  if (str == null || str === '') return null;
  const s = String(str).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (br) {
    const d = new Date(
      `${br[3]}-${br[2]}-${br[1]}T${br[4]}:${br[5]}:${br[6] || '00'}-03:00`,
    );
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const d = new Date(s.includes(' ') ? s.replace(' ', 'T') : s);
  return Number.isFinite(d.getTime()) ? d : null;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function intervaloDiaBrasilia(dataStr) {
  const begin = Math.floor(new Date(`${dataStr}T00:00:00-03:00`).getTime() / 1000);
  const end = Math.floor(new Date(`${dataStr}T23:59:59-03:00`).getTime() / 1000);
  return { begin, end };
}

export function intervaloPeriodoBrasilia(dataInicio, dataFim) {
  const inicio = dataInicio || dataFim;
  const fim = dataFim || dataInicio;
  const begin = Math.floor(new Date(`${inicio}T00:00:00-03:00`).getTime() / 1000);
  const end = Math.floor(new Date(`${fim}T23:59:59-03:00`).getTime() / 1000);
  return { begin, end };
}

function ordenarPontos(pontos = []) {
  return [...pontos].sort((a, b) => {
    const ta = parseDataHoraPonto(a.atualizado_em)?.getTime() ?? 0;
    const tb = parseDataHoraPonto(b.atualizado_em)?.getTime() ?? 0;
    return ta - tb;
  });
}

export function limiteVelocidadeKmh() {
  const n = Number(process.env.FULLTRACK_LIMITE_VELOCIDADE_KMH || 80);
  return Number.isFinite(n) && n > 0 ? n : 80;
}

function statusVelocidadePonto(velocidade, limite) {
  const v = Number(velocidade) || 0;
  if (v > limite) return 'excesso';
  if (v > 0) return 'normal';
  return 'parado';
}

export function calcularTempoParadoMs(pontos = []) {
  const ordenados = ordenarPontos(pontos);
  let total = 0;
  for (let i = 0; i < ordenados.length - 1; i += 1) {
    const atual = ordenados[i];
    if ((Number(atual.velocidade) || 0) > 0) continue;
    total += intervaloEntrePontosMs(atual, ordenados[i + 1]);
  }
  return total;
}

function pontoLigadoOuMovimento(p) {
  if (p.ignicao === false) return false;
  return p.ignicao === true || (Number(p.velocidade) || 0) > 3;
}

function intervaloEntrePontosMs(atual, prox) {
  const ta = parseDataHoraPonto(atual.atualizado_em)?.getTime();
  const tb = parseDataHoraPonto(prox.atualizado_em)?.getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb) || tb <= ta) return 0;
  return Math.min(tb - ta, MAX_INTERVALO_PARADO_MS);
}

export function calcularTemposIgnicaoMs(pontos = []) {
  const ordenados = ordenarPontos(pontos);
  let tempo_ligado_ms = 0;
  let tempo_desligado_ms = 0;
  for (let i = 0; i < ordenados.length - 1; i += 1) {
    const atual = ordenados[i];
    const delta = intervaloEntrePontosMs(atual, ordenados[i + 1]);
    if (!delta) continue;
    if (atual.ignicao === false) tempo_desligado_ms += delta;
    else if (pontoLigadoOuMovimento(atual)) tempo_ligado_ms += delta;
  }
  return { tempo_ligado_ms, tempo_desligado_ms };
}

const MIN_PARADO_MS = 2 * 60 * 1000;
const MAX_INTERVALO_PARADO_MS = 30 * 60 * 1000;

export function contarParadas(pontos = [], minParadoMs = MIN_PARADO_MS) {
  const ordenados = ordenarPontos(pontos);
  let count = 0;
  let grupo = null;

  const fechar = () => {
    if (!grupo) return;
    const ta = parseDataHoraPonto(grupo.inicio.atualizado_em)?.getTime();
    const tb = parseDataHoraPonto(grupo.fim.atualizado_em)?.getTime();
    if (Number.isFinite(ta) && Number.isFinite(tb) && tb - ta >= minParadoMs) count += 1;
    grupo = null;
  };

  for (const p of ordenados) {
    if ((Number(p.velocidade) || 0) <= 0) {
      if (!grupo) grupo = { inicio: p, fim: p };
      else {
        const gap =
          (parseDataHoraPonto(p.atualizado_em)?.getTime() ?? 0) -
          (parseDataHoraPonto(grupo.fim.atualizado_em)?.getTime() ?? 0);
        if (gap > MAX_INTERVALO_PARADO_MS) {
          fechar();
          grupo = { inicio: p, fim: p };
        } else {
          grupo.fim = p;
        }
      }
    } else {
      fechar();
    }
  }
  fechar();
  return count;
}

export function velocidadeMediaPontos(pontos = []) {
  let soma = 0;
  let count = 0;
  for (const p of pontos) {
    const v = Number(p.velocidade) || 0;
    if (v > 0) {
      soma += v;
      count += 1;
    }
  }
  return count ? Math.round((soma / count) * 10) / 10 : 0;
}

export function calcularKmPercorridoGps(pontos = []) {
  let total = 0;
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1];
    const b = pontos[i];
    const dist = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
    const ta = parseDataHoraPonto(a.atualizado_em);
    const tb = parseDataHoraPonto(b.atualizado_em);
    const dtMin = ta && tb ? (tb.getTime() - ta.getTime()) / 60000 : 0;
    if (dtMin > 0 && dtMin < 1 && dist > 3) continue;
    if (dist < 0.01) continue;
    total += dist;
  }
  return Math.round(total * 10) / 10;
}

export function segmentarRotasPorIntervalo(pontos = [], gapMinutos = 20) {
  if (!pontos.length) return [];
  const rotas = [];
  let atual = [pontos[0]];
  for (let i = 1; i < pontos.length; i++) {
    const prev = pontos[i - 1];
    const cur = pontos[i];
    const tp = parseDataHoraPonto(prev.atualizado_em);
    const tc = parseDataHoraPonto(cur.atualizado_em);
    const gap = tp && tc ? (tc.getTime() - tp.getTime()) / 60000 : 0;
    if (gap > gapMinutos) {
      if (atual.length >= 1) rotas.push(atual);
      atual = [cur];
    } else {
      atual.push(cur);
    }
  }
  if (atual.length) rotas.push(atual);
  return rotas;
}

export function calcularKmOdometro(pontos = []) {
  const comOdo = pontos.filter((p) => p.odometro_km != null);
  if (comOdo.length < 2) return null;
  const diff = comOdo[comOdo.length - 1].odometro_km - comOdo[0].odometro_km;
  return diff > 0 ? Math.round(diff * 10) / 10 : null;
}

function mapPosicaoFulltrack(v, position) {
  const lat = position ? parseFloat(position.ras_eve_latitude) : null;
  const lng = position ? parseFloat(position.ras_eve_longitude) : null;
  const combustivelRaw = position?.total_combustivel || position?.sensor_combustivel || null;
  const odometroRaw = position?.ras_eve_hodometro ?? v.ras_vei_odometro ?? null;
  return {
    id_rastreamento: v.ras_vei_id,
    placa: v.ras_vei_placa,
    placa_normalizada: normalizarPlaca(v.ras_vei_placa),
    modelo_rastreador: `${v.ras_vei_veiculo?.trim() || ''} ${v.ras_vei_modelo?.trim() || ''}`.trim() || null,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    velocidade: position ? parseInt(position.ras_eve_velocidade, 10) || 0 : null,
    ignicao: position ? position.ras_eve_ignicao === '1' : null,
    direcao: position?.ras_eve_direcao ?? null,
    atualizado_em: position?.ras_eve_data_gps ?? v.ras_vei_data_ult_alt ?? null,
    motorista:
      position?.ras_mot_nome && position.ras_mot_nome !== 'PADRAO' ? position.ras_mot_nome : null,
    odometro_km: normalizarOdometroKm(odometroRaw),
    combustivel_litros: normalizarCombustivel(combustivelRaw),
  };
}

async function carregarPosicoesFulltrack() {
  const agora = Date.now();
  if (cachePosicoes && agora < cacheExpiraEm) {
    return cachePosicoes;
  }

  const vehiclesResp = await fulltrackGet('/vehicles/all');
  if (!vehiclesResp?.status) {
    throw new Error(vehiclesResp?.message || 'Erro ao buscar veículos na Fulltrack');
  }

  const vehicles = Array.isArray(vehiclesResp.data) ? vehiclesResp.data : [];
  let positions = [];
  try {
    const eventsResp = await fulltrackGet('/events/all');
    positions = Array.isArray(eventsResp?.data) ? eventsResp.data : [];
  } catch {
    positions = [];
  }

  const porPlaca = new Map();
  const porId = new Map();
  for (const v of vehicles) {
    const pos = positions.find((p) => p.ras_vei_id === v.ras_vei_id);
    const mapped = mapPosicaoFulltrack(v, pos);
    if (mapped.placa_normalizada) {
      porPlaca.set(mapped.placa_normalizada, mapped);
    }
    if (mapped.id_rastreamento != null) {
      porId.set(mapped.id_rastreamento, mapped);
    }
  }

  cachePosicoes = { porPlaca, porId };
  cacheExpiraEm = agora + CACHE_TTL_MS;
  return cachePosicoes;
}

export function limparCacheFulltrack() {
  cachePosicoes = null;
  cacheExpiraEm = 0;
}

export async function posicoesVeiculosPorPlacas(placas = []) {
  if (!fulltrackRastreamentoAtivo()) return new Map();
  const lista = [...new Set(placas.map(normalizarPlaca).filter(Boolean))];
  if (!lista.length) return new Map();

  const { porPlaca } = await carregarPosicoesFulltrack();
  const resultado = new Map();
  for (const placa of lista) {
    const pos = porPlaca.get(placa);
    if (pos) resultado.set(placa, pos);
  }
  return resultado;
}

function velocidadePontoHistorico(h) {
  for (const key of ['ras_eve_velocidade', 'ras_tel_velocidade', 'velocidade', 'speed']) {
    const n = parseInt(h?.[key], 10);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function mapearPontoHistorico(h, index) {
  const lat = parseFloat(h.ras_eve_latitude || h.ras_tel_latitude || h.latitude);
  const lng = parseFloat(h.ras_eve_longitude || h.ras_tel_longitude || h.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: index,
    latitude: lat,
    longitude: lng,
    velocidade: velocidadePontoHistorico(h),
    ignicao: h.ras_eve_ignicao === '1' || h.ras_eve_ignicao === 1,
    atualizado_em: h.ras_eve_data_gps || h.ras_tel_data || h.data_gps || null,
    odometro_km: normalizarOdometroKm(h.ras_eve_hodometro),
    combustivel_litros: normalizarCombustivel(h.total_combustivel || h.sensor_combustivel),
  };
}

function extrairListaHistorico(response) {
  if (!response?.status) return [];
  const { data } = response;
  if (Array.isArray(data)) return data;
  if (data?.evento && typeof data.evento === 'object') return [data.evento];
  return [];
}

async function buscarHistoricoInterval(id, begin, end) {
  const response = await fulltrackGet(`/events/interval/id/${id}/begin/${begin}/end/${end}`);
  return extrairListaHistorico(response);
}

async function buscarHistoricoTelemetry(id, begin, end) {
  const response = await fulltrackGet(`/events/telemetry/id/${id}/begin/${begin}/end/${end}`);
  return extrairListaHistorico(response);
}

export async function historicoVeiculoFulltrack(idRastreamento, startUnix = null, endUnix = null) {
  if (!fulltrackRastreamentoAtivo()) return [];
  const id = Number(idRastreamento);
  if (!Number.isFinite(id) || id <= 0) return [];

  const now = Math.floor(Date.now() / 1000);
  const end = endUnix || now;
  const begin = startUnix || now - 24 * 60 * 60;

  try {
    let lista = await buscarHistoricoInterval(id, begin, end);
    if (!lista.length) {
      lista = await buscarHistoricoTelemetry(id, begin, end);
    }
    return lista.map(mapearPontoHistorico).filter(Boolean);
  } catch {
    return [];
  }
}

function coordsDePontos(pontos = []) {
  return pontos
    .map((p) => [Number(p.latitude), Number(p.longitude)])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
}

function agruparExcessosMapa(pontos = [], limiteKmh) {
  const eventos = [];
  let atual = null;
  for (const p of ordenarPontos(pontos)) {
    const v = Number(p.velocidade) || 0;
    if (v > limiteKmh) {
      if (!atual) {
        atual = { inicio: p, fim: p, pontos: [p], vMax: v };
      } else {
        atual.fim = p;
        atual.pontos.push(p);
        atual.vMax = Math.max(atual.vMax, v);
      }
    } else if (atual) {
      eventos.push(atual);
      atual = null;
    }
  }
  if (atual) eventos.push(atual);
  return eventos;
}

function distanciaCoordsMetros(a, b) {
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return 0;
  const toRad = (n) => (n * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function montarExcessosMapa(pontos = [], limiteKmh) {
  const ordenados = ordenarPontos(pontos);
  const grupos = agruparExcessosMapa(ordenados, limiteKmh);
  const resultados = await Promise.all(
    grupos.map(async (evento) => {
      const coordsGps = coordsDePontos(evento.pontos ?? [evento.inicio, evento.fim]);
      if (!coordsGps.length) return null;

      const cInicio = coordsGps[0];
      const cFim = coordsGps[coordsGps.length - 1];
      const mesmoPonto = distanciaCoordsMetros(cInicio, cFim) < 12;

      let coordsLinha = [cInicio, cFim];
      if (!mesmoPonto) {
        try {
          const roteada = await ajustarRotaAsRuas([cInicio, cFim]);
          if (roteada.length >= 2) {
            coordsLinha = roteada;
            coordsLinha[0] = cInicio;
            coordsLinha[coordsLinha.length - 1] = cFim;
          }
        } catch {
          /* mantém linha direta entre início e fim do excesso */
        }
      }

      return {
        inicio: cInicio,
        fim: cFim,
        coords_linha: coordsLinha,
        v_max: evento.vMax,
        inicio_em: evento.inicio.atualizado_em ?? null,
        fim_em: evento.fim.atualizado_em ?? null,
        vel_inicio: Number(evento.inicio.velocidade) || 0,
        vel_fim: Number(evento.fim.velocidade) || 0,
        mesmo_ponto: mesmoPonto,
      };
    }),
  );
  return resultados.filter(Boolean);
}

export async function relatorioRotaVeiculoPeriodo(idRastreamento, dataInicio, dataFim) {
  const { begin, end } = intervaloPeriodoBrasilia(dataInicio, dataFim);
  const pontos = ordenarPontos(await historicoVeiculoFulltrack(idRastreamento, begin, end));
  const limite = limiteVelocidadeKmh();
  const segmentos = segmentarRotasPorIntervalo(pontos);
  const rotasBase =
    segmentos.length > 0
      ? segmentos
      : pontos.length > 0
        ? [pontos]
        : [];

  let qtdExcessos = 0;
  for (const p of pontos) {
    if ((Number(p.velocidade) || 0) > limite) qtdExcessos += 1;
  }

  const [rotas, excessos_mapa] = await Promise.all([
    Promise.all(
      rotasBase.map(async (seg, idx) => {
        const coordsGps = coordsDePontos(seg);
        let coords_rua = coordsGps;
        if (coordsGps.length >= 2) {
          try {
            coords_rua = await ajustarRotaAsRuas(coordsGps);
          } catch {
            coords_rua = coordsGps;
          }
        }
        const qtdExcessosRota = seg.filter((p) => (Number(p.velocidade) || 0) > limite).length;
        return {
          id: idx + 1,
          pontos: seg,
          coords_rua,
          km: calcularKmPercorridoGps(seg),
          inicio: seg[0]?.atualizado_em ?? null,
          fim: seg[seg.length - 1]?.atualizado_em ?? null,
          qtd_excessos: qtdExcessosRota,
        };
      }),
    ),
    montarExcessosMapa(pontos, limite),
  ]);

  return {
    data_inicio: dataInicio,
    data_fim: dataFim,
    limite_kmh: limite,
    qtd_excessos: qtdExcessos,
    qtd_paradas: contarParadas(pontos),
    tempo_parado_ms: calcularTempoParadoMs(pontos),
    ...calcularTemposIgnicaoMs(pontos),
    velocidade_media: velocidadeMediaPontos(pontos),
    pontos,
    rotas,
    excessos_mapa,
    km_gps: calcularKmPercorridoGps(pontos),
    km_odometro: calcularKmOdometro(pontos),
    combustivel_litros: pontos[pontos.length - 1]?.combustivel_litros ?? null,
    total_pontos: pontos.length,
  };
}

export async function relatorioRotaVeiculoDia(idRastreamento, dataStr) {
  return relatorioRotaVeiculoPeriodo(idRastreamento, dataStr, dataStr);
}

export async function relatorioVelocidadeVeiculoPeriodo(idRastreamento, dataInicio, dataFim) {
  const { begin, end } = intervaloPeriodoBrasilia(dataInicio, dataFim);
  const pontos = ordenarPontos(await historicoVeiculoFulltrack(idRastreamento, begin, end));
  const limite = limiteVelocidadeKmh();
  let soma = 0;
  let count = 0;
  let velocidadeMaxima = 0;
  const excessos = [];
  const registros = [];

  for (const p of pontos) {
    const v = Number(p.velocidade) || 0;
    const status = statusVelocidadePonto(v, limite);
    if (v > 0) {
      soma += v;
      count += 1;
    }
    if (v > velocidadeMaxima) velocidadeMaxima = v;
    registros.push({
      velocidade: v,
      limite,
      latitude: p.latitude,
      longitude: p.longitude,
      atualizado_em: p.atualizado_em ?? null,
      status,
    });
    if (status === 'excesso') {
      excessos.push({
        velocidade: v,
        limite,
        latitude: p.latitude,
        longitude: p.longitude,
        atualizado_em: p.atualizado_em ?? null,
      });
    }
  }

  const qtdNormais = registros.filter((r) => r.status === 'normal').length;
  const qtdParados = registros.filter((r) => r.status === 'parado').length;
  const tempoParadoMs = calcularTempoParadoMs(pontos);

  return {
    data_inicio: dataInicio,
    data_fim: dataFim,
    limite_kmh: limite,
    velocidade_media: count ? Math.round((soma / count) * 10) / 10 : 0,
    velocidade_maxima: velocidadeMaxima,
    total_pontos: pontos.length,
    qtd_excessos: excessos.length,
    qtd_normais: qtdNormais,
    qtd_parados: qtdParados,
    tempo_parado_ms: tempoParadoMs,
    excessos,
    registros,
    km_gps: calcularKmPercorridoGps(pontos),
  };
}

export async function kmRastreadorVeiculoPeriodo(idRastreamento, dataInicio, dataFim) {
  const { begin, end } = intervaloPeriodoBrasilia(dataInicio, dataFim);
  const pontos = ordenarPontos(await historicoVeiculoFulltrack(idRastreamento, begin, end));
  return {
    km_gps: calcularKmPercorridoGps(pontos),
    km_odometro: calcularKmOdometro(pontos),
    total_pontos: pontos.length,
  };
}

export async function combinarVeiculosComRastreamento(veiculosDb = []) {
  if (!veiculosDb.length) return [];

  const semRastreamento = () =>
    veiculosDb.map((v) => ({
      id_veiculo: v.id_veiculo,
      placa: v.placa,
      marca: v.marca ?? null,
      modelo: v.modelo ?? null,
      id_regiao: v.id_regiao ?? null,
      nome_regiao: v.nome_regiao ?? null,
      id_usuario_responsavel: v.id_usuario_responsavel ?? null,
      nome_responsavel: v.nome_responsavel ?? null,
      id_rastreamento: null,
      latitude: null,
      longitude: null,
      velocidade: null,
      ignicao: null,
      direcao: null,
      atualizado_em: null,
      motorista: null,
      odometro_km: null,
      combustivel_litros: null,
      rastreamento_disponivel: false,
    }));

  if (!fulltrackRastreamentoAtivo()) {
    return semRastreamento();
  }

  try {
    const placas = veiculosDb.map((v) => v.placa);
    const posicoes = await posicoesVeiculosPorPlacas(placas);

    return veiculosDb.map((v) => {
      const pos = posicoes.get(normalizarPlaca(v.placa));
      return {
        id_veiculo: v.id_veiculo,
        placa: v.placa,
        marca: v.marca ?? null,
        modelo: v.modelo ?? null,
        id_regiao: v.id_regiao ?? null,
        nome_regiao: v.nome_regiao ?? null,
        id_usuario_responsavel: v.id_usuario_responsavel ?? null,
        nome_responsavel: v.nome_responsavel ?? null,
        id_rastreamento: pos?.id_rastreamento ?? null,
        latitude: pos?.latitude ?? null,
        longitude: pos?.longitude ?? null,
        velocidade: pos?.velocidade ?? null,
        ignicao: pos?.ignicao ?? null,
        direcao: pos?.direcao ?? null,
        atualizado_em: pos?.atualizado_em ?? null,
        motorista: pos?.motorista ?? null,
        odometro_km: pos?.odometro_km ?? null,
        combustivel_litros: pos?.combustivel_litros ?? null,
        rastreamento_disponivel: !!(pos?.latitude != null && pos?.longitude != null),
      };
    });
  } catch {
    return semRastreamento();
  }
}
