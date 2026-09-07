import L from 'leaflet';
import type {
  FrotaExcessoMapaItem,
  FrotaRotaDiaSegmento,
  FrotaVeiculoHistoricoPonto,
} from '../../api/client';
import { formatDataHoraBalaoMapa, formatarDuracaoMs } from '../../utils/dateBr';
import { geocodificarReversa } from '../../utils/geocodificarReversa';
import type { LatLngPar } from '../../utils/osrmMapMatch';
import { rodapeAtualizadoBalaoHtml } from './frotaMapaVeiculo';
import {
  CORES_TRAJETO_FROTA,
  COR_EXCESSO_FROTA,
  COR_FIM_TRAJETO,
  COR_INICIO_TRAJETO,
  COR_PARADO_FROTA,
} from './frotaMapaBasemap';

const CORES_ROTAS = [...CORES_TRAJETO_FROTA];
const PANE_ROTA = 'paneRotaLocalizacao';
const PANE_PARADO = 'paneParadoLocalizacao';
const PANE_EXCESSO = 'paneExcessoLocalizacao';
const PANE_EXCESSO_LINHA = 'paneExcessoLinhaLocalizacao';
const PANE_DESTAQUE = 'paneDestaqueLocalizacao';
const COR_EXCESSO = COR_EXCESSO_FROTA;
const COR_PARADO = COR_PARADO_FROTA;
const COR_INICIO_ROTA = COR_INICIO_TRAJETO;
const COR_FIM_ROTA = COR_FIM_TRAJETO;
const MIN_PARADO_MS = 2 * 60 * 1000;

export type CamadasRotaDiaMapa = {
  rota: L.LayerGroup;
  excessoLinha: L.LayerGroup;
  excessoMarcador: L.LayerGroup;
  destaque: L.LayerGroup;
  parado: L.LayerGroup;
};

type EventoExcesso = {
  inicio: FrotaVeiculoHistoricoPonto;
  fim: FrotaVeiculoHistoricoPonto;
  pontos: FrotaVeiculoHistoricoPonto[];
  vMax: number;
};

type EventoParado = {
  inicio: FrotaVeiculoHistoricoPonto;
  fim: FrotaVeiculoHistoricoPonto;
  pontos: FrotaVeiculoHistoricoPonto[];
  duracaoMs: number;
};

type ExcessoSegmentoResumo = {
  qtd: number;
  vMax: number;
  eventos: { vMax: number; inicio: string | null; fim: string | null }[];
};

function ordenarPontos(pontos: FrotaVeiculoHistoricoPonto[]) {
  return [...pontos].sort((a, b) => {
    const ta = a.atualizado_em ? new Date(a.atualizado_em).getTime() : 0;
    const tb = b.atualizado_em ? new Date(b.atualizado_em).getTime() : 0;
    return ta - tb;
  });
}

function coordsRota(pontos: FrotaVeiculoHistoricoPonto[]): LatLngPar[] {
  return pontos
    .map((p) => {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return [lat, lng] as LatLngPar;
    })
    .filter((c): c is LatLngPar => c != null);
}

function prepararRotasDesenho(rotas: FrotaRotaDiaSegmento[], pontos: FrotaVeiculoHistoricoPonto[]) {
  const rotasComPontos = rotas.filter((r) => (r.pontos?.length ?? 0) > 0);
  if (rotasComPontos.length > 0) return rotasComPontos;
  if (pontos.length >= 2) {
    const ordenados = ordenarPontos(pontos);
    return [
      {
        id: 0,
        pontos: ordenados,
        km: 0,
        inicio: ordenados[0]?.atualizado_em,
        fim: ordenados[ordenados.length - 1]?.atualizado_em,
      },
    ];
  }
  return [];
}

function coordsDesenhoRota(rota: FrotaRotaDiaSegmento): LatLngPar[] {
  const gps = coordsRota(rota.pontos ?? []);
  const ruas = (rota.coords_rua ?? [])
    .map(([lat, lng]) => [Number(lat), Number(lng)] as LatLngPar)
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  // Só usa coords_rua se parecer geometria densificada pelo map-match (não cópia do GPS).
  if (
    ruas.length >= 2 &&
    (gps.length < 2 || ruas.length >= Math.max(gps.length + 5, Math.ceil(gps.length * 1.4)))
  ) {
    return ruas;
  }
  return gps;
}

function distanciaCoordsMetros(a: LatLngPar, b: LatLngPar): number {
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function escapeHtml(texto: string) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function calcularDuracaoMs(inicio: FrotaVeiculoHistoricoPonto, fim: FrotaVeiculoHistoricoPonto): number {
  const ta = inicio.atualizado_em ? new Date(inicio.atualizado_em).getTime() : NaN;
  const tb = fim.atualizado_em ? new Date(fim.atualizado_em).getTime() : NaN;
  if (!Number.isFinite(ta) || !Number.isFinite(tb) || tb <= ta) return 0;
  return tb - ta;
}

function agruparEventosParado(pontos: FrotaVeiculoHistoricoPonto[]): EventoParado[] {
  const eventos: EventoParado[] = [];
  let atual: EventoParado | null = null;
  for (const p of ordenarPontos(pontos)) {
    const v = Number(p.velocidade) || 0;
    if (v <= 0) {
      if (!atual) atual = { inicio: p, fim: p, pontos: [p], duracaoMs: 0 };
      else {
        atual.fim = p;
        atual.pontos.push(p);
      }
    } else if (atual) {
      atual.duracaoMs = calcularDuracaoMs(atual.inicio, atual.fim);
      if (atual.duracaoMs >= MIN_PARADO_MS) eventos.push(atual);
      atual = null;
    }
  }
  if (atual) {
    atual.duracaoMs = calcularDuracaoMs(atual.inicio, atual.fim);
    if (atual.duracaoMs >= MIN_PARADO_MS) eventos.push(atual);
  }
  return eventos;
}

function centroEvento(pontos: FrotaVeiculoHistoricoPonto[]): L.LatLngExpression | null {
  const coords = coordsRota(pontos);
  if (!coords.length) return null;
  if (coords.length === 1) return coords[0];
  const lat = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lng = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return [lat, lng];
}

function agruparEventosExcesso(pontos: FrotaVeiculoHistoricoPonto[], limiteKmh: number): EventoExcesso[] {
  const eventos: EventoExcesso[] = [];
  let atual: EventoExcesso | null = null;
  for (const p of ordenarPontos(pontos)) {
    const v = Number(p.velocidade) || 0;
    if (v > limiteKmh) {
      if (!atual) atual = { inicio: p, fim: p, pontos: [p], vMax: v };
      else {
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

function calcularInfoSegmento(rota: FrotaRotaDiaSegmento) {
  const pts = ordenarPontos(rota.pontos ?? []);
  let soma = 0;
  let count = 0;
  for (const p of pts) {
    const v = Number(p.velocidade) || 0;
    if (v > 0) {
      soma += v;
      count += 1;
    }
  }
  const velMedia = count ? Math.round((soma / count) * 10) / 10 : 0;
  const inicio = rota.inicio ?? pts[0]?.atualizado_em ?? null;
  const fim = rota.fim ?? pts[pts.length - 1]?.atualizado_em ?? null;
  let duracaoMs = 0;
  const ta = inicio ? new Date(inicio).getTime() : NaN;
  const tb = fim ? new Date(fim).getTime() : NaN;
  if (Number.isFinite(ta) && Number.isFinite(tb) && tb > ta) duracaoMs = tb - ta;
  return { velMedia, duracaoMs, km: rota.km ?? 0, inicio, fim };
}

function calcularExcessosSegmento(rota: FrotaRotaDiaSegmento, limiteKmh: number): ExcessoSegmentoResumo {
  const eventos = agruparEventosExcesso(ordenarPontos(rota.pontos ?? []), limiteKmh);
  return {
    qtd: eventos.length,
    vMax: eventos.reduce((max, e) => Math.max(max, e.vMax), 0),
    eventos: eventos.map((e) => ({
      vMax: e.vMax,
      inicio: e.inicio.atualizado_em ?? null,
      fim: e.fim.atualizado_em ?? null,
    })),
  };
}

function iconeTimelineRota(tipo: 'inicio' | 'fim' | 'hora' | 'local') {
  const base =
    'class="info-rota-icone" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"';
  if (tipo === 'inicio') return `<span class="info-rota-marcador info-rota-marcador--inicio" aria-hidden="true"></span>`;
  if (tipo === 'fim') return `<span class="info-rota-marcador info-rota-marcador--fim" aria-hidden="true"></span>`;
  if (tipo === 'hora') {
    return `<svg ${base} width="11" height="11"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`;
  }
  return `<svg ${base} width="11" height="11"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
}

function htmlBlocoExcessoSegmento(excessos: ExcessoSegmentoResumo, limiteKmh: number) {
  if (excessos.qtd <= 0) return '';
  const lista = `<div class="info-rota-excesso-lista">${excessos.eventos
    .map((e) => {
      const ini = e.inicio ? formatDataHoraBalaoMapa(e.inicio) : '—';
      const fim = e.fim ? formatDataHoraBalaoMapa(e.fim) : '—';
      return `<div class="info-rota-excesso-item">${escapeHtml(ini)} → ${escapeHtml(fim)} · máx. ${e.vMax} km/h</div>`;
    })
    .join('')}</div>`;
  return `<div class="info-rota-excesso">
    <div class="info-rota-excesso-titulo">Excesso de velocidade</div>
    <div class="info-rota-excesso-valor">Até <strong>${excessos.vMax} km/h</strong> · limite ${limiteKmh} km/h</div>
    <div class="info-rota-excesso-qtd">${excessos.qtd} ocorrência${excessos.qtd !== 1 ? 's' : ''} neste trecho</div>
    ${lista}
  </div>`;
}

function htmlPopupRotaTimeline(
  info: ReturnType<typeof calcularInfoSegmento>,
  excessos: ExcessoSegmentoResumo,
  limiteKmh: number,
  enderecoInicio?: string | null,
  enderecoFim?: string | null,
) {
  const kmTxt = info.km > 0 ? `${info.km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km` : '—';
  const inicioHora = info.inicio ? formatDataHoraBalaoMapa(info.inicio) : '—';
  const fimHora = info.fim ? formatDataHoraBalaoMapa(info.fim) : '—';
  const locInicio = enderecoInicio ?? 'Buscando endereço…';
  const locFim = enderecoFim ?? 'Buscando endereço…';
  const duracaoTxt = info.duracaoMs > 0 ? formatarDuracaoMs(info.duracaoMs) : null;

  return `<div class="info-rota-mapa">
    <div class="info-rota-resumo">
      <strong class="info-rota-km">${escapeHtml(kmTxt)}</strong>
      ${duracaoTxt ? `<span class="info-rota-duracao">${escapeHtml(duracaoTxt)} · ${info.velMedia} km/h méd.</span>` : `<span class="info-rota-duracao">${info.velMedia} km/h méd.</span>`}
    </div>
    <div class="info-rota-timeline">
      <div class="info-rota-etapa">
        ${iconeTimelineRota('inicio')}
        <div class="info-rota-conteudo">
          <div class="info-rota-rotulo">Início</div>
          <div class="info-rota-linha">${iconeTimelineRota('hora')}<span>${escapeHtml(inicioHora)}</span></div>
          <div class="info-rota-linha info-rota-linha--local">${iconeTimelineRota('local')}<span>${escapeHtml(locInicio)}</span></div>
        </div>
      </div>
      <div class="info-rota-ligacao" aria-hidden="true"></div>
      <div class="info-rota-etapa">
        ${iconeTimelineRota('fim')}
        <div class="info-rota-conteudo">
          <div class="info-rota-rotulo">Fim</div>
          <div class="info-rota-linha">${iconeTimelineRota('hora')}<span>${escapeHtml(fimHora)}</span></div>
          <div class="info-rota-linha info-rota-linha--local">${iconeTimelineRota('local')}<span>${escapeHtml(locFim)}</span></div>
        </div>
      </div>
    </div>
    ${htmlBlocoExcessoSegmento(excessos, limiteKmh)}
    ${rodapeAtualizadoBalaoHtml(info.fim ?? info.inicio)}
  </div>`;
}

function marcadorPlacaLimite(kmh: number) {
  const texto = String(kmh);
  const fontSize = texto.length > 2 ? 8 : 10;
  const w = 32;
  const h = 32;
  return L.divIcon({
    className: 'marcador-placa-limite',
    html: `<div class="marker-placa-limite" aria-hidden="true">
      <svg width="${w}" height="${h}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" fill="#ffffff" stroke="${COR_EXCESSO}" stroke-width="2.5"/>
        <text x="16" y="20" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="900" fill="#111111">${escapeHtml(texto)}</text>
      </svg>
    </div>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h / 2],
  });
}

function marcadorPonteiroRota(tipo: 'inicio' | 'fim') {
  const cor = tipo === 'inicio' ? COR_INICIO_ROTA : COR_FIM_ROTA;
  const size = 16;
  return L.divIcon({
    className: 'marcador-rota-ponto',
    html: `<span class="marker-rota-ponto" style="background:${cor};width:${size}px;height:${size}px;border:2.5px solid #fff;border-radius:50%;display:block;box-shadow:0 2px 8px rgba(27,42,107,.28)" aria-hidden="true"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function limparDestaqueTrechoRota(destaque: L.LayerGroup) {
  destaque.clearLayers();
}

function destacarTrechoRota(coords: LatLngPar[], destaque: L.LayerGroup) {
  if (!coords.length) return;
  destaque.clearLayers();
  const inicio = coords[0];
  const fim = coords[coords.length - 1];
  L.marker(inicio, { pane: PANE_DESTAQUE, icon: marcadorPonteiroRota('inicio'), zIndexOffset: 900 }).addTo(destaque);
  if (coords.length > 1) {
    L.marker(fim, { pane: PANE_DESTAQUE, icon: marcadorPonteiroRota('fim'), zIndexOffset: 900 }).addTo(destaque);
  }
}

function vincularCliqueRota(
  polyline: L.Polyline,
  coords: LatLngPar[],
  rota: FrotaRotaDiaSegmento,
  destaque: L.LayerGroup,
  mapa: L.Map,
  limiteKmh: number,
) {
  const info = calcularInfoSegmento(rota);
  const excessos = calcularExcessosSegmento(rota, limiteKmh);
  polyline.on('click', (e) => {
    L.DomEvent.stopPropagation(e);
    destacarTrechoRota(coords, destaque);
    const inicio = coords[0];
    const fim = coords[coords.length - 1];
    const popup = L.popup({ maxWidth: 220, minWidth: 180, className: 'popup-rota-mapa', closeButton: true })
      .setLatLng(e.latlng)
      .setContent(htmlPopupRotaTimeline(info, excessos, limiteKmh))
      .openOn(mapa);
    void Promise.all([geocodificarReversa(inicio[0], inicio[1]), geocodificarReversa(fim[0], fim[1])]).then(
      ([enderecoInicio, enderecoFim]) => {
        if (popup.isOpen()) {
          popup.setContent(htmlPopupRotaTimeline(info, excessos, limiteKmh, enderecoInicio, enderecoFim));
        }
      },
    );
  });
  polyline.bindTooltip('Toque para ver início, fim e quilometragem', { sticky: true, direction: 'top' });
}

function adicionarMarcadorExcesso(
  coord: LatLngPar,
  limiteKmh: number,
  tooltip: string,
  layer: L.LayerGroup,
  bounds: L.LatLngBounds,
) {
  bounds.extend(coord);
  L.marker(coord, {
    pane: PANE_EXCESSO,
    icon: marcadorPlacaLimite(limiteKmh),
    zIndexOffset: 700,
  })
    .bindTooltip(tooltip, { direction: 'top', sticky: true })
    .addTo(layer);
}

function desenharExcesso(
  excesso: FrotaExcessoMapaItem,
  limiteKmh: number,
  marcadorLayer: L.LayerGroup,
  linhaLayer: L.LayerGroup,
  bounds: L.LatLngBounds,
  corExcesso = COR_EXCESSO,
) {
  const cInicio = excesso.inicio as LatLngPar;
  const cFim = excesso.fim as LatLngPar;
  const coordsLinhaBase =
    excesso.coords_linha?.length >= 2 ? (excesso.coords_linha as LatLngPar[]) : [cInicio, cFim];
  const coordsLinha = [...coordsLinhaBase];
  if (coordsLinha.length >= 2) {
    coordsLinha[0] = cInicio;
    coordsLinha[coordsLinha.length - 1] = cFim;
  }
  const desenharLinha =
    coordsLinha.length >= 2 &&
    distanciaCoordsMetros(coordsLinha[0], coordsLinha[coordsLinha.length - 1]) >= 8;

  if (!desenharLinha && excesso.mesmo_ponto) {
    adicionarMarcadorExcesso(
      cInicio,
      limiteKmh,
      `${excesso.inicio_em ? formatDataHoraBalaoMapa(excesso.inicio_em) : '—'}<br/><strong>${excesso.v_max} km/h</strong> (limite ${limiteKmh} km/h)`,
      marcadorLayer,
      bounds,
    );
    return;
  }

  adicionarMarcadorExcesso(
    cInicio,
    limiteKmh,
    `Início do excesso<br/>${excesso.inicio_em ? formatDataHoraBalaoMapa(excesso.inicio_em) : '—'}<br/>${excesso.vel_inicio} km/h`,
    marcadorLayer,
    bounds,
  );
  adicionarMarcadorExcesso(
    cFim,
    limiteKmh,
    `Fim do excesso<br/>${excesso.fim_em ? formatDataHoraBalaoMapa(excesso.fim_em) : '—'}<br/>${excesso.vel_fim} km/h`,
    marcadorLayer,
    bounds,
  );
  L.polyline(coordsLinha, {
    pane: PANE_EXCESSO_LINHA,
    color: corExcesso,
    weight: 4,
    opacity: 1,
    lineCap: 'butt',
    lineJoin: 'round',
    interactive: false,
  }).addTo(linhaLayer);
  coordsLinha.forEach((c) => bounds.extend(c));
}

function desenharEventoParado(evento: EventoParado, layer: L.LayerGroup, bounds: L.LatLngBounds) {
  const centro = centroEvento(evento.pontos);
  if (!centro) return;
  bounds.extend(centro);
  const inicioTxt = evento.inicio.atualizado_em ? formatDataHoraBalaoMapa(evento.inicio.atualizado_em) : '—';
  const fimTxt = evento.fim.atualizado_em ? formatDataHoraBalaoMapa(evento.fim.atualizado_em) : '—';
  const duracaoTxt = formatarDuracaoMs(evento.duracaoMs);
  L.circleMarker(centro, {
    pane: PANE_PARADO,
    radius: 8,
    color: '#ffffff',
    weight: 2,
    fillColor: COR_PARADO,
    fillOpacity: 0.95,
  })
    .bindPopup(
      `<strong>Parada</strong><br/>Tempo parado: <strong>${duracaoTxt}</strong><br/>Início: ${inicioTxt}<br/>Fim: ${fimTxt}`,
      { maxWidth: 280 },
    )
    .bindTooltip(`Parado ${duracaoTxt}`, { direction: 'top' })
    .addTo(layer);
}

export function configurarPanesMapaRotaDia(mapa: L.Map) {
  for (const [nome, z] of [
    [PANE_ROTA, '450'],
    [PANE_EXCESSO_LINHA, '480'],
    [PANE_PARADO, '640'],
    [PANE_EXCESSO, '680'],
    [PANE_DESTAQUE, '710'],
  ] as const) {
    if (!mapa.getPane(nome)) {
      mapa.createPane(nome);
      const pane = mapa.getPane(nome);
      if (pane) pane.style.zIndex = z;
    }
  }
  elevarPanesPopupMapa(mapa);
}

/** Popups e tooltips acima dos marcadores de veículo (pane 720). */
export function elevarPanesPopupMapa(mapa: L.Map) {
  const popupPane = mapa.getPane('popupPane');
  if (popupPane) popupPane.style.zIndex = '850';
  const tooltipPane = mapa.getPane('tooltipPane');
  if (tooltipPane) tooltipPane.style.zIndex = '760';
}

export function limparCamadasRotaDia(camadas: CamadasRotaDiaMapa) {
  camadas.rota.clearLayers();
  camadas.excessoLinha.clearLayers();
  camadas.excessoMarcador.clearLayers();
  camadas.destaque.clearLayers();
  camadas.parado.clearLayers();
}

export function desenharRotaDiaNoMapa(
  mapa: L.Map,
  camadas: CamadasRotaDiaMapa,
  rotas: FrotaRotaDiaSegmento[],
  pontos: FrotaVeiculoHistoricoPonto[],
  excessosMapa: FrotaExcessoMapaItem[],
  limiteKmh: number,
  opcoes?: { coresRota?: readonly string[]; corExcesso?: string },
): L.LatLngBounds | null {
  limparCamadasRotaDia(camadas);

  const rotasDesenho = prepararRotasDesenho(rotas, pontos);
  const pontosTrajeto = rotasDesenho.flatMap((r) => r.pontos ?? []);
  const coordsPercurso: LatLngPar[] = [];
  let bounds = L.latLngBounds([]);
  const cores = opcoes?.coresRota?.length ? opcoes.coresRota : CORES_ROTAS;
  const corExcesso = opcoes?.corExcesso ?? COR_EXCESSO;
  const pesoRota = opcoes?.coresRota?.length ? 6 : 5;

  for (const excesso of excessosMapa) {
    desenharExcesso(excesso, limiteKmh, camadas.excessoMarcador, camadas.excessoLinha, bounds, corExcesso);
  }

  for (const evento of agruparEventosParado(pontosTrajeto.length ? pontosTrajeto : pontos)) {
    desenharEventoParado(evento, camadas.parado, bounds);
  }

  for (const [idx, rota] of rotasDesenho.entries()) {
    const coords = coordsDesenhoRota(rota);
    if (coords.length < 2) continue;
    coordsPercurso.push(...coords);
    const cor = cores[idx % cores.length];
    const polyline = L.polyline(coords, {
      pane: PANE_ROTA,
      color: cor,
      weight: pesoRota,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(camadas.rota);
    vincularCliqueRota(polyline, coords, rota, camadas.destaque, mapa, limiteKmh);
    coords.forEach((c) => bounds.extend(c));
  }

  if (!coordsPercurso.length && excessosMapa.length === 0) return null;
  if (!bounds.isValid()) return null;
  return bounds;
}

export function trazerExcessosParaFrente(camadas: CamadasRotaDiaMapa) {
  const elevar = (layer: L.Layer) => {
    if ('bringToFront' in layer && typeof layer.bringToFront === 'function') layer.bringToFront();
  };
  camadas.rota.eachLayer(elevar);
  camadas.excessoLinha.eachLayer(elevar);
  camadas.excessoMarcador.eachLayer(elevar);
  camadas.parado.eachLayer(elevar);
}
