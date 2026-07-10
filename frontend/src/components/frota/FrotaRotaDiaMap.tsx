import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import type {
  FrotaExcessoMapaItem,
  FrotaRotaDiaSegmento,
  FrotaVeiculoHistoricoPonto,
  FrotaVeiculoPosicao,
  Loja,
} from '../../api/client';
import { colors } from '../../theme/tokens';
import type { LatLngPar } from '../../utils/osrmMapMatch';
import { formatDataHoraBalaoMapa, formatarDuracaoMs } from '../../utils/dateBr';
import { geocodificarReversa } from '../../utils/geocodificarReversa';
import { iconeMarcaLojaPorNome } from '../../utils/marcaLojaMapa';
import { elevarPanesPopupMapa } from './frotaMapaRotaDiaDesenho';
import {
  desenharMarcadorVeiculoAoVivo,
  desenharMarcadoresIgnicaoDia,
  rodapeAtualizadoBalaoHtml,
} from './frotaMapaVeiculo';
import './mapaMarcadores.css';

const CORES_ROTAS = ['#1b2a6b', '#0f766e', '#ca8a04', '#7c3aed', '#0891b2', '#0369a1'];
const VISTA_BRASILIA: L.LatLngExpression = [-15.7939, -47.8828];
const ZOOM_BRASILIA = 11;
const PANE_ROTA = 'paneRota';
const PANE_PARADO = 'paneParado';
const PANE_EXCESSO = 'paneExcesso';
const PANE_EXCESSO_LINHA = 'paneExcessoLinha';
const PANE_DESTAQUE = 'paneDestaque';
const PANE_LOJA = 'paneLoja';
const PANE_VEICULO = 'paneVeiculoHistorico';
const COR_INICIO_ROTA = '#16a34a';
const COR_FIM_ROTA = '#dc2626';
const COR_EXCESSO_VELOCIDADE = '#dc2626';
const COR_PARADO = '#475569';
const MIN_PARADO_MS = 2 * 60 * 1000;

type Props = {
  rotas: FrotaRotaDiaSegmento[];
  pontos?: FrotaVeiculoHistoricoPonto[];
  excessosMapa?: FrotaExcessoMapaItem[];
  lojas?: Loja[];
  limiteKmh?: number;
  altura?: number | string;
  diaAtual?: boolean;
  veiculoAoVivo?: FrotaVeiculoPosicao | null;
  veiculoInfo?: Pick<FrotaVeiculoPosicao, 'id_veiculo' | 'placa' | 'marca' | 'modelo'>;
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

function coordenadaPonto(p: FrotaVeiculoHistoricoPonto): L.LatLngExpression | null {
  const lat = Number(p.latitude);
  const lng = Number(p.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
}

function coordsRota(pontos: FrotaVeiculoHistoricoPonto[]): LatLngPar[] {
  return pontos.map(coordenadaPonto).filter((c): c is LatLngPar => c != null);
}

function ordenarPontos(pontos: FrotaVeiculoHistoricoPonto[]) {
  return [...pontos].sort((a, b) => {
    const ta = a.atualizado_em ? new Date(a.atualizado_em).getTime() : 0;
    const tb = b.atualizado_em ? new Date(b.atualizado_em).getTime() : 0;
    return ta - tb;
  });
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

function estenderBounds(bounds: L.LatLngBounds, coord: L.LatLngExpression) {
  if (!bounds.isValid()) return L.latLngBounds(coord as LatLngPar, coord as LatLngPar);
  bounds.extend(coord);
  return bounds;
}

function escapeHtml(texto: string) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function temCoordenadaLoja(loja: Loja) {
  const lat = Number(loja.latitude);
  const lng = Number(loja.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function iconePinLocalizacaoSvg() {
  return `<svg class="tooltip-loja-nome-pin-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="#E8520A" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
}

function htmlTooltipLoja(loja: Pick<Loja, 'name' | 'bk_number' | 'corporate_name'>) {
  const nome = loja.bk_number ? `${loja.name} (BKN ${loja.bk_number})` : loja.name;
  return `<div class="tooltip-loja-nome-mapa"><span class="tooltip-loja-nome-pin" aria-hidden="true">${iconePinLocalizacaoSvg()}</span><span class="tooltip-loja-nome-texto">${escapeHtml(nome)}</span></div>`;
}

function marcadorLoja(loja: Pick<Loja, 'name' | 'bk_number' | 'corporate_name'>) {
  const src = escapeHtml(iconeMarcaLojaPorNome(loja));
  const size = 38;
  const altura = size + 8;
  return L.divIcon({
    className: 'marcador-loja-marca',
    html: `<div style="display:flex;flex-direction:column;align-items:center;width:${size}px;line-height:0;">
      <div style="width:${size}px;height:${size}px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,.35);">
        <img src="${src}" alt="" style="width:${size - 6}px;height:${size - 6}px;object-fit:contain;display:block;" />
      </div>
      <div style="width:0;height:0;margin-top:-1px;border-left:7px solid transparent;border-right:7px solid transparent;border-top:8px solid #fff;filter:drop-shadow(0 1px 1px rgba(0,0,0,.25));"></div>
    </div>`,
    iconSize: [size, altura],
    iconAnchor: [size / 2, altura],
    popupAnchor: [0, -altura],
  });
}

function agruparEventosExcesso(pontos: FrotaVeiculoHistoricoPonto[], limiteKmh: number): EventoExcesso[] {
  const eventos: EventoExcesso[] = [];
  let atual: EventoExcesso | null = null;

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
      if (!atual) {
        atual = { inicio: p, fim: p, pontos: [p], duracaoMs: 0 };
      } else {
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

function trazerGrupoParaFrente(grupo: L.LayerGroup, mapa: L.Map) {
  if (!mapa.hasLayer(grupo)) return;
  mapa.removeLayer(grupo);
  mapa.addLayer(grupo);
}

function boundsSomenteRota(coordsListas: LatLngPar[][]): L.LatLngBounds | null {
  const todas = coordsListas.flat();
  if (!todas.length) return null;
  let bounds = L.latLngBounds(todas[0], todas[0]);
  for (const c of todas.slice(1)) bounds.extend(c);
  return bounds.isValid() ? bounds : null;
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

function linhaTimelineRota(icone: string, texto: string, local = false) {
  const cls = local ? ' info-rota-linha--local' : '';
  return `<div class="info-rota-linha${cls}"><span class="info-rota-linha-icone">${icone}</span><span class="info-rota-linha-texto">${texto}</span></div>`;
}

function iconeTimelineRota(tipo: 'inicio' | 'fim' | 'hora' | 'local') {
  const base =
    'class="info-rota-icone" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"';
  if (tipo === 'inicio') {
    return `<span class="info-rota-marcador info-rota-marcador--inicio" aria-hidden="true"></span>`;
  }
  if (tipo === 'fim') {
    return `<span class="info-rota-marcador info-rota-marcador--fim" aria-hidden="true"></span>`;
  }
  if (tipo === 'hora') {
    return `<svg ${base} width="11" height="11"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`;
  }
  return `<svg ${base} width="11" height="11"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
}

type ExcessoSegmentoResumo = {
  qtd: number;
  vMax: number;
  eventos: {
    vMax: number;
    inicio: string | null;
    fim: string | null;
  }[];
};

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
          ${linhaTimelineRota(iconeTimelineRota('hora'), escapeHtml(inicioHora))}
          ${linhaTimelineRota(iconeTimelineRota('local'), escapeHtml(locInicio), true)}
        </div>
      </div>
      <div class="info-rota-ligacao" aria-hidden="true"></div>
      <div class="info-rota-etapa">
        ${iconeTimelineRota('fim')}
        <div class="info-rota-conteudo">
          <div class="info-rota-rotulo">Fim</div>
          ${linhaTimelineRota(iconeTimelineRota('hora'), escapeHtml(fimHora))}
          ${linhaTimelineRota(iconeTimelineRota('local'), escapeHtml(locFim), true)}
        </div>
      </div>
    </div>
    ${htmlBlocoExcessoSegmento(excessos, limiteKmh)}
    ${rodapeAtualizadoBalaoHtml(info.fim ?? info.inicio)}
  </div>`;
}

function marcadorPonteiroRota(tipo: 'inicio' | 'fim') {
  const cor = tipo === 'inicio' ? COR_INICIO_ROTA : COR_FIM_ROTA;
  const w = 28;
  const h = 36;
  return L.divIcon({
    className: 'marcador-rota-ponteiro',
    html: `<svg class="marker-rota-pin-svg" width="${w}" height="${h}" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z" fill="${cor}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="14" cy="14" r="5" fill="#ffffff"/>
    </svg>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
  });
}

function limparDestaqueTrechoRota(destaqueLayer: L.LayerGroup) {
  destaqueLayer.clearLayers();
}

function destacarTrechoRota(coords: LatLngPar[], destaqueLayer: L.LayerGroup) {
  if (!coords.length) return;
  destaqueLayer.clearLayers();
  const inicio = coords[0];
  const fim = coords[coords.length - 1];

  L.marker(inicio, {
    pane: PANE_DESTAQUE,
    icon: marcadorPonteiroRota('inicio'),
    zIndexOffset: 900,
  }).addTo(destaqueLayer);

  if (coords.length > 1) {
    L.marker(fim, {
      pane: PANE_DESTAQUE,
      icon: marcadorPonteiroRota('fim'),
      zIndexOffset: 900,
    }).addTo(destaqueLayer);
  }
}

function vincularCliqueRota(
  polyline: L.Polyline,
  coords: LatLngPar[],
  rota: FrotaRotaDiaSegmento,
  destaqueLayer: L.LayerGroup,
  mapa: L.Map,
  limiteKmh: number,
) {
  const info = calcularInfoSegmento(rota);
  const excessos = calcularExcessosSegmento(rota, limiteKmh);
  polyline.on('click', (e) => {
    L.DomEvent.stopPropagation(e);
    destacarTrechoRota(coords, destaqueLayer);

    const inicio = coords[0];
    const fim = coords[coords.length - 1];
    const popup = L.popup({ maxWidth: 220, minWidth: 180, className: 'popup-rota-mapa', closeButton: true })
      .setLatLng(e.latlng)
      .setContent(htmlPopupRotaTimeline(info, excessos, limiteKmh))
      .openOn(mapa);

    void Promise.all([
      geocodificarReversa(inicio[0], inicio[1]),
      geocodificarReversa(fim[0], fim[1]),
    ]).then(([enderecoInicio, enderecoFim]) => {
      if (popup.isOpen()) {
        popup.setContent(htmlPopupRotaTimeline(info, excessos, limiteKmh, enderecoInicio, enderecoFim));
      }
    });
  });
  polyline.bindTooltip('Clique para ver início, fim e quilometragem', {
    sticky: true,
    direction: 'top',
  });
}

function desenharPolylineRota(
  coords: LatLngPar[],
  cor: string,
  layer: L.LayerGroup,
  mapa: L.Map,
  rota?: FrotaRotaDiaSegmento,
  opacidade = 0.85,
  destaqueLayer?: L.LayerGroup | null,
  limiteKmh = 80,
) {
  if (coords.length < 2) return;
  const polyline = L.polyline(coords, {
    pane: PANE_ROTA,
    color: cor,
    weight: 5,
    opacity: opacidade,
    lineCap: 'round',
    lineJoin: 'round',
  }).addTo(layer);

  if (rota && destaqueLayer) {
    vincularCliqueRota(polyline, coords, rota, destaqueLayer, mapa, limiteKmh);
  }
}

function desenharMarcadoresRota(
  coords: LatLngPar[],
  rotaId: number,
  cor: string,
  layer: L.LayerGroup,
) {
  if (!coords.length) return;
  const inicio = coords[0];
  const fim = coords[coords.length - 1];

  L.circleMarker(inicio, {
    pane: PANE_ROTA,
    radius: 7,
    color: '#ffffff',
    weight: 2,
    fillColor: cor,
    fillOpacity: 1,
  })
    .bindTooltip(`Rota ${rotaId} — início`, { direction: 'top' })
    .addTo(layer);

  if (coords.length > 1) {
    L.circleMarker(fim, {
      pane: PANE_ROTA,
      radius: 6,
      color: '#ffffff',
      weight: 2,
      fillColor: colors.orange,
      fillOpacity: 1,
    })
      .bindTooltip(`Rota ${rotaId} — fim`, { direction: 'top' })
      .addTo(layer);
  }
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
        <circle cx="16" cy="16" r="14" fill="#ffffff" stroke="#dc2626" stroke-width="2.5"/>
        <text x="16" y="20" text-anchor="middle" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif" font-size="${fontSize}" font-weight="900" fill="#111111">${escapeHtml(texto)}</text>
      </svg>
    </div>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h / 2],
  });
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

function coordsDesenhoRota(rota: FrotaRotaDiaSegmento): LatLngPar[] {
  const ruas = rota.coords_rua;
  if (ruas && ruas.length >= 2) {
    return ruas
      .map(([lat, lng]) => [Number(lat), Number(lng)] as LatLngPar)
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  }
  return coordsRota(rota.pontos ?? []);
}

function desenharExcessoMapa(
  excesso: FrotaExcessoMapaItem,
  limiteKmh: number,
  marcadorLayer: L.LayerGroup,
  linhaLayer: L.LayerGroup,
  bounds: L.LatLngBounds,
) {
  const cInicio = excesso.inicio as LatLngPar;
  const cFim = excesso.fim as LatLngPar;
  const coordsLinhaBase =
    excesso.coords_linha?.length >= 2
      ? (excesso.coords_linha as LatLngPar[])
      : [cInicio, cFim];
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
    color: COR_EXCESSO_VELOCIDADE,
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
  bounds = estenderBounds(bounds, centro);

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

export default function FrotaRotaDiaMap({
  rotas,
  pontos = [],
  excessosMapa = [],
  lojas = [],
  limiteKmh = 80,
  altura = '100%',
  diaAtual = false,
  veiculoAoVivo = null,
  veiculoInfo,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const rotaLayerRef = useRef<L.LayerGroup | null>(null);
  const paradoLayerRef = useRef<L.LayerGroup | null>(null);
  const excessoLayerRef = useRef<L.LayerGroup | null>(null);
  const excessoLinhaLayerRef = useRef<L.LayerGroup | null>(null);
  const destaqueLayerRef = useRef<L.LayerGroup | null>(null);
  const veiculoLayerRef = useRef<L.LayerGroup | null>(null);
  const lojasLayerRef = useRef<L.LayerGroup | null>(null);
  const boundsRef = useRef<L.LatLngBounds | null>(null);
  const drawSeqRef = useRef(0);
  const [mapaPronto, setMapaPronto] = useState(false);
  const [ajustandoRota, setAjustandoRota] = useState(false);
  const [alinhandoRuas, setAlinhandoRuas] = useState(false);

  const ajustarVista = useCallback((mapa: L.Map, bounds: L.LatLngBounds | null) => {
    if (!bounds || !bounds.isValid()) {
      mapa.setView(VISTA_BRASILIA, ZOOM_BRASILIA);
      return;
    }
    if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
      mapa.setView(bounds.getCenter(), 15);
      return;
    }
    mapa.fitBounds(bounds, { padding: [56, 56], maxZoom: 16, animate: true });
  }, []);

  const desenharRotas = useCallback(() => {
    const mapa = mapRef.current;
    const rotaLayer = rotaLayerRef.current;
    const excessoLayer = excessoLayerRef.current;
    const excessoLinhaLayer = excessoLinhaLayerRef.current;
    const destaqueLayer = destaqueLayerRef.current;
    const paradoLayer = paradoLayerRef.current;
    const veiculoLayer = veiculoLayerRef.current;
    const lojasLayer = lojasLayerRef.current;
    if (!mapa || !rotaLayer || !excessoLayer || !excessoLinhaLayer || !destaqueLayer || !paradoLayer || !veiculoLayer || !lojasLayer) return;

    const seq = drawSeqRef.current + 1;
    drawSeqRef.current = seq;
    setAjustandoRota(true);
    setAlinhandoRuas(false);

    try {
      rotaLayer.clearLayers();
      excessoLayer.clearLayers();
      excessoLinhaLayer.clearLayers();
      destaqueLayer.clearLayers();
      paradoLayer.clearLayers();
      veiculoLayer.clearLayers();
      lojasLayer.clearLayers();

      for (const loja of lojas.filter(temCoordenadaLoja)) {
        const lat = Number(loja.latitude);
        const lng = Number(loja.longitude);
        const coord: LatLngPar = [lat, lng];
        const alturaMarcador = 46;
        L.marker(coord, { pane: PANE_LOJA, icon: marcadorLoja(loja), zIndexOffset: 600 })
          .bindTooltip(htmlTooltipLoja(loja), {
            direction: 'right',
            offset: [8, -Math.round(alturaMarcador / 2) + 2],
            opacity: 1,
            className: 'tooltip-loja-nome-lateral',
            sticky: true,
          })
          .addTo(lojasLayer);
      }

      const rotasDesenho = prepararRotasDesenho(rotas, pontos);
      const pontosTrajeto =
        pontos.length >= 2 ? ordenarPontos(pontos) : rotasDesenho.flatMap((r) => r.pontos ?? []);
      const eventosParado = agruparEventosParado(pontosTrajeto);
      const excessosDesenho =
        excessosMapa.length > 0 ? excessosMapa : [];

      let bounds = L.latLngBounds([]);

      for (const evento of eventosParado) {
        desenharEventoParado(evento, paradoLayer, bounds);
      }

      if (excessosDesenho.length > 0) {
        for (const excesso of excessosDesenho) {
          desenharExcessoMapa(excesso, limiteKmh, excessoLayer, excessoLinhaLayer, bounds);
        }
      } else {
        const eventosExcesso = agruparEventosExcesso(pontosTrajeto, limiteKmh);
        for (const evento of eventosExcesso) {
          const cInicio = coordenadaPonto(evento.inicio);
          const cFim = coordenadaPonto(evento.fim);
          if (!cInicio || !cFim) continue;
          const coordsEvento = coordsRota(evento.pontos);
          const coordsLinha = coordsEvento.length >= 2 ? coordsEvento : [cInicio as LatLngPar, cFim as LatLngPar];
          desenharExcessoMapa(
            {
              inicio: cInicio as LatLngPar,
              fim: cFim as LatLngPar,
              coords_linha: coordsLinha,
              v_max: evento.vMax,
              inicio_em: evento.inicio.atualizado_em,
              fim_em: evento.fim.atualizado_em,
              vel_inicio: Number(evento.inicio.velocidade) || 0,
              vel_fim: Number(evento.fim.velocidade) || 0,
              mesmo_ponto: distanciaCoordsMetros(cInicio as LatLngPar, cFim as LatLngPar) < 12,
            },
            limiteKmh,
            excessoLayer,
            excessoLinhaLayer,
            bounds,
          );
        }
      }

      const coordsPercurso: LatLngPar[] = [];

      for (const [idx, rota] of rotasDesenho.entries()) {
        const coords = coordsDesenhoRota(rota);
        if (coords.length < 2) continue;
        coordsPercurso.push(...coords);
        const cor = CORES_ROTAS[idx % CORES_ROTAS.length];
        desenharPolylineRota(coords, cor, rotaLayer, mapa, rota, 0.9, destaqueLayer, limiteKmh);
        desenharMarcadoresRota(coords, rota.id, cor, rotaLayer);
      }

      if (diaAtual && veiculoAoVivo) {
        desenharMarcadorVeiculoAoVivo(veiculoLayer, veiculoAoVivo, bounds, PANE_VEICULO);
      } else if (!diaAtual && veiculoInfo && pontosTrajeto.length > 0) {
        desenharMarcadoresIgnicaoDia(veiculoLayer, pontosTrajeto, veiculoInfo, bounds, PANE_VEICULO);
      }

      trazerGrupoParaFrente(rotaLayer, mapa);
      trazerGrupoParaFrente(excessoLinhaLayer, mapa);
      trazerGrupoParaFrente(excessoLayer, mapa);
      trazerGrupoParaFrente(destaqueLayer, mapa);

      boundsRef.current = boundsSomenteRota([coordsPercurso]);
      ajustarVista(mapa, boundsRef.current);
      window.requestAnimationFrame(() => {
        mapa.invalidateSize(false);
        ajustarVista(mapa, boundsRef.current);
      });
    } finally {
      if (drawSeqRef.current === seq) {
        setAjustandoRota(false);
        setAlinhandoRuas(false);
      }
    }
  }, [rotas, pontos, excessosMapa, lojas, limiteKmh, diaAtual, veiculoAoVivo, veiculoInfo, ajustarVista]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const mapa = L.map(container, { zoomControl: true, attributionControl: true }).setView(
      VISTA_BRASILIA,
      ZOOM_BRASILIA,
    );

    for (const [nome, z] of [
      [PANE_ROTA, '450'],
      [PANE_EXCESSO_LINHA, '480'],
      [PANE_LOJA, '630'],
      [PANE_PARADO, '640'],
      [PANE_EXCESSO, '680'],
      [PANE_DESTAQUE, '710'],
      [PANE_VEICULO, '720'],
    ] as const) {
      mapa.createPane(nome);
      const pane = mapa.getPane(nome);
      if (pane) pane.style.zIndex = z;
    }
    elevarPanesPopupMapa(mapa);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(mapa);
    rotaLayerRef.current = L.layerGroup().addTo(mapa);
    lojasLayerRef.current = L.layerGroup().addTo(mapa);
    paradoLayerRef.current = L.layerGroup().addTo(mapa);
    excessoLayerRef.current = L.layerGroup().addTo(mapa);
    excessoLinhaLayerRef.current = L.layerGroup().addTo(mapa);
    destaqueLayerRef.current = L.layerGroup().addTo(mapa);
    veiculoLayerRef.current = L.layerGroup().addTo(mapa);
    mapRef.current = mapa;

    const aoFecharPopupRota = (e: L.PopupEvent) => {
      const el = e.popup.getElement();
      if (el?.classList.contains('popup-rota-mapa')) {
        limparDestaqueTrechoRota(destaqueLayerRef.current!);
      }
    };
    mapa.on('popupclose', aoFecharPopupRota);

    const observer = new ResizeObserver(() => {
      mapa.invalidateSize(false);
      ajustarVista(mapa, boundsRef.current);
    });
    observer.observe(container);

    setMapaPronto(true);

    return () => {
      drawSeqRef.current += 1;
      mapa.off('popupclose', aoFecharPopupRota);
      observer.disconnect();
      mapa.remove();
      mapRef.current = null;
      rotaLayerRef.current = null;
      lojasLayerRef.current = null;
      excessoLayerRef.current = null;
      excessoLinhaLayerRef.current = null;
      destaqueLayerRef.current = null;
      paradoLayerRef.current = null;
      veiculoLayerRef.current = null;
      boundsRef.current = null;
      setMapaPronto(false);
    };
  }, [ajustarVista]);

  useEffect(() => {
    if (!mapaPronto) return;
    void desenharRotas();
  }, [mapaPronto, desenharRotas]);

  const pontosTrajeto = useMemo(() => {
    if (pontos.length >= 2) return ordenarPontos(pontos);
    return rotas.flatMap((r) => r.pontos ?? []);
  }, [pontos, rotas]);

  const qtdExcessosLegenda = excessosMapa.length || agruparEventosExcesso(pontosTrajeto, limiteKmh).length;
  const eventosParado = useMemo(() => agruparEventosParado(pontosTrajeto), [pontosTrajeto]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: altura, minHeight: 0, flex: 1, display: 'flex' }}>
      {ajustandoRota && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 1001,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            bgcolor: 'rgba(255,255,255,0.55)',
          }}
        >
          <CircularProgress size={28} />
        </Box>
      )}
      {alinhandoRuas && !ajustandoRota && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            px: 1.5,
            py: 0.75,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            boxShadow: 1,
          }}
        >
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">
            Alinhando trajeto às ruas…
          </Typography>
        </Box>
      )}
      {(qtdExcessosLegenda > 0 || eventosParado.length > 0 || lojas.filter(temCoordenadaLoja).length > 0) && (
        <Box
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 1000,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.5,
            px: 1.25,
            py: 0.75,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.75,
            boxShadow: 1,
            maxWidth: 220,
          }}
        >
          {qtdExcessosLegenda > 0 && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 24, height: 4, bgcolor: COR_EXCESSO_VELOCIDADE, borderRadius: 1, flexShrink: 0 }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  Linha vermelha (início → fim do excesso)
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    bgcolor: '#fff',
                    border: '2px solid',
                    borderColor: COR_EXCESSO_VELOCIDADE,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.5rem',
                    fontWeight: 900,
                    color: '#111',
                    flexShrink: 0,
                    lineHeight: 1,
                  }}
                >
                  {limiteKmh}
                </Box>
                <Typography variant="caption">Placa {limiteKmh} km/h (início e fim)</Typography>
              </Box>
            </>
          )}
          {lojas.filter(temCoordenadaLoja).length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#fff', border: '1px solid', borderColor: 'divider', flexShrink: 0 }} />
              <Typography variant="caption">Loja</Typography>
            </Box>
          )}
          {eventosParado.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: COR_PARADO, flexShrink: 0 }} />
              <Typography variant="caption">Parada (clique p/ tempo)</Typography>
            </Box>
          )}
        </Box>
      )}
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: '100%',
          flex: 1,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          bgcolor: '#f8fafc',
        }}
      />
    </Box>
  );
}
