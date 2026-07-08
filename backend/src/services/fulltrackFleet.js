const CACHE_TTL_MS = 45_000;

let cachePosicoes = null;
let cacheExpiraEm = 0;

function credenciaisFulltrack() {
  const apiKey =
    process.env.FULLTRACK_API_KEY ||
    process.env.APIKEY ||
    process.env.VITE_API_KEY ||
    '';
  const secretKey =
    process.env.FULLTRACK_SECRET_KEY ||
    process.env.SECRETKEY ||
    process.env.VITE_SECRET_KEY ||
    '';
  const baseUrl = resolverBaseUrlFulltrack();
  return { apiKey: apiKey.trim(), secretKey: secretKey.trim(), baseUrl };
}

function resolverBaseUrlFulltrack() {
  const raw = process.env.FULLTRACK_API_URL || process.env.API_URL || 'http://ws.fulltrack2.com';
  const url = String(raw).trim().replace(/\/$/, '');
  // A API Fulltrack (ws.fulltrack2.com) responde via HTTP — igual ao projeto Fleet/
  if (/ws\.fulltrack2\.com/i.test(url)) {
    return 'http://ws.fulltrack2.com';
  }
  return url.replace(/^https:/i, 'http:');
}

export function fulltrackRastreamentoAtivo() {
  const v = String(process.env.FULLTRACK_RASTREAMENTO_ENABLED ?? 'true').trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  const { apiKey, secretKey } = credenciaisFulltrack();
  return !!(apiKey && secretKey);
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

function limiteVelocidadeKmh() {
  const n = Number(process.env.FULLTRACK_LIMITE_VELOCIDADE_KMH || 80);
  return Number.isFinite(n) && n > 0 ? n : 80;
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

function mapearPontoHistorico(h, index) {
  const lat = parseFloat(h.ras_eve_latitude || h.ras_tel_latitude || h.latitude);
  const lng = parseFloat(h.ras_eve_longitude || h.ras_tel_longitude || h.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: index,
    latitude: lat,
    longitude: lng,
    velocidade: parseInt(h.ras_eve_velocidade, 10) || 0,
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

export async function relatorioRotaVeiculoPeriodo(idRastreamento, dataInicio, dataFim) {
  const { begin, end } = intervaloPeriodoBrasilia(dataInicio, dataFim);
  const pontos = ordenarPontos(await historicoVeiculoFulltrack(idRastreamento, begin, end));
  const segmentos = segmentarRotasPorIntervalo(pontos);
  const rotasBase =
    segmentos.length > 0
      ? segmentos
      : pontos.length > 0
        ? [pontos]
        : [];

  return {
    data_inicio: dataInicio,
    data_fim: dataFim,
    pontos,
    rotas: rotasBase.map((seg, idx) => ({
      id: idx + 1,
      pontos: seg,
      km: calcularKmPercorridoGps(seg),
      inicio: seg[0]?.atualizado_em ?? null,
      fim: seg[seg.length - 1]?.atualizado_em ?? null,
    })),
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

  for (const p of pontos) {
    const v = Number(p.velocidade) || 0;
    if (v > 0) {
      soma += v;
      count += 1;
    }
    if (v > velocidadeMaxima) velocidadeMaxima = v;
    if (v > limite) {
      excessos.push({
        velocidade: v,
        limite,
        latitude: p.latitude,
        longitude: p.longitude,
        atualizado_em: p.atualizado_em ?? null,
      });
    }
  }

  return {
    data_inicio: dataInicio,
    data_fim: dataFim,
    limite_kmh: limite,
    velocidade_media: count ? Math.round((soma / count) * 10) / 10 : 0,
    velocidade_maxima: velocidadeMaxima,
    total_pontos: pontos.length,
    qtd_excessos: excessos.length,
    excessos,
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
