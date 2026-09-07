import L from 'leaflet';
import { setWorkerUrl, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import '@maplibre/maplibre-gl-leaflet';

/** Vite + MapLibre v6: sem worker, só o fundo do estilo aparece (sem ruas). */
setWorkerUrl(maplibreWorkerUrl);

/** Fundo claro Command Center (Positron). */
export const FROTA_MAPA_CLARO_FUNDO = '#F8FAFC';

/** Fundo neutro enquanto os tiles carregam. */
export const FROTA_MAPA_FUNDO = '#F8FAFC';

/** Fundo do mapa escuro Command Center (azul-noite). */
export const FROTA_MAPA_ESCURO_FUNDO = '#0F172A';

/** @deprecated Fiord customizado via MapLibre; filtro CSS não é mais usado. */
export const FROTA_MAPA_ESCURO_TILE_FILTER = 'none';

/** Estilos OpenFreeMap (vector, gratuito, sem API key, geometria OSM ≈ OSRM). */
export const OPENFREEMAP_FIORD = 'https://tiles.openfreemap.org/styles/fiord';
export const OPENFREEMAP_DARK = 'https://tiles.openfreemap.org/styles/dark';
export const OPENFREEMAP_POSITRON = 'https://tiles.openfreemap.org/styles/positron';

/** Cores do Command Center: fundo mais escuro + ruas branco-cinza. */
const CC_MAPA_FUNDO = '#0F172A';
const CC_MAPA_AGUA = '#0B1220';
const CC_MAPA_PARQUE = '#132033';
const CC_MAPA_RESIDENCIAL = '#15243A';
const CC_MAPA_WOOD = '#122033';
const CC_RUA_MENOR = '#5C6B7E';
const CC_RUA_MEDIA = '#6E7F94';
const CC_RUA_MAJOR = '#8494A8';
const CC_RUA_MOTORWAY = '#9AABC0';
const CC_RUA_CASING = '#1E293B';

type BasemapOpts = { mobile?: boolean; semRotulos?: boolean };

function optsTile(mobile: boolean) {
  return {
    updateWhenIdle: mobile,
    keepBuffer: mobile ? 4 : 2,
    updateWhenZooming: !mobile,
  } as const;
}

/**
 * Basemap padrão da frota (acompanhamento, regiões, etc.).
 * Google Streets — gratuito, sem watermark "API key required" (Carto quebrou).
 */
export function criarCamadaBasemapLimpo(opcoes?: BasemapOpts) {
  const mobile = opcoes?.mobile ?? false;
  return L.tileLayer('https://{s}.google.com/vt/lyrs=m&hl=pt-BR&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 21,
    ...optsTile(mobile),
  });
}

function forcarResizeMapLibre(layer: L.MaplibreGL) {
  const gl = layer.getMaplibreMap?.();
  if (!gl) return;
  const resize = () => {
    try {
      gl.resize();
    } catch {
      /* ignore */
    }
  };
  if (gl.loaded()) resize();
  else gl.once('load', resize);
  requestAnimationFrame(resize);
  window.setTimeout(resize, 120);
  window.setTimeout(resize, 400);
}

function setPaint(layer: Record<string, unknown>, key: string, value: unknown) {
  const paint = { ...((layer.paint as Record<string, unknown> | undefined) ?? {}) };
  paint[key] = value;
  layer.paint = paint;
}

/** Fiord customizado: azul-noite escuro + vias claras (branco-cinza). */
function customizarEstiloFiord(style: StyleSpecification): StyleSpecification {
  const layers = (style.layers ?? []).map((raw) => {
    const layer = { ...raw } as Record<string, unknown>;
    const id = String(layer.id ?? '');

    if (id === 'background') {
      setPaint(layer, 'background-color', CC_MAPA_FUNDO);
      return layer as StyleSpecification['layers'][number];
    }
    if (id === 'water') {
      setPaint(layer, 'fill-color', CC_MAPA_AGUA);
      return layer as StyleSpecification['layers'][number];
    }
    if (id === 'landuse_residential') {
      setPaint(layer, 'fill-color', CC_MAPA_RESIDENCIAL);
      setPaint(layer, 'fill-opacity', 1);
      return layer as StyleSpecification['layers'][number];
    }
    if (id === 'landcover_wood' || id === 'landcover_ice_shelf') {
      setPaint(layer, 'fill-color', CC_MAPA_WOOD);
      return layer as StyleSpecification['layers'][number];
    }
    if (id === 'park') {
      setPaint(layer, 'fill-color', CC_MAPA_PARQUE);
      return layer as StyleSpecification['layers'][number];
    }
    if (id === 'building') {
      setPaint(layer, 'fill-color', '#1A2740');
      return layer as StyleSpecification['layers'][number];
    }

    if (id.includes('highway_path') || id.includes('railway')) {
      setPaint(layer, 'line-color', CC_RUA_MENOR);
      return layer as StyleSpecification['layers'][number];
    }
    if (id.includes('highway_minor') || id.includes('aeroway-taxiway')) {
      setPaint(layer, 'line-color', CC_RUA_MEDIA);
      return layer as StyleSpecification['layers'][number];
    }
    if (id.includes('highway_major_inner') || id.includes('highway_major_subtle')) {
      setPaint(layer, 'line-color', CC_RUA_MAJOR);
      return layer as StyleSpecification['layers'][number];
    }
    if (id.includes('highway_major_casing') || id.includes('highway_motorway_casing') || id.includes('tunnel_motorway_casing')) {
      setPaint(layer, 'line-color', CC_RUA_CASING);
      return layer as StyleSpecification['layers'][number];
    }
    if (id.includes('highway_motorway_inner') || id.includes('tunnel_motorway_inner') || id.includes('aeroway-runway')) {
      setPaint(layer, 'line-color', CC_RUA_MOTORWAY);
      return layer as StyleSpecification['layers'][number];
    }
    if (id.includes('highway_motorway_subtle')) {
      setPaint(layer, 'line-color', CC_RUA_MEDIA);
      return layer as StyleSpecification['layers'][number];
    }
    if (id === 'road_pier' || id === 'road_area_pier') {
      if (layer.type === 'line') setPaint(layer, 'line-color', CC_RUA_MEDIA);
      if (layer.type === 'fill') setPaint(layer, 'fill-color', CC_MAPA_FUNDO);
      return layer as StyleSpecification['layers'][number];
    }

    return layer as StyleSpecification['layers'][number];
  });

  return { ...style, layers };
}

let estiloFiordEscuroPromise: Promise<StyleSpecification> | null = null;

function carregarEstiloFiordEscuro(): Promise<StyleSpecification> {
  if (!estiloFiordEscuroPromise) {
    estiloFiordEscuroPromise = fetch(OPENFREEMAP_FIORD)
      .then((res) => {
        if (!res.ok) throw new Error(`OpenFreeMap Fiord HTTP ${res.status}`);
        return res.json() as Promise<StyleSpecification>;
      })
      .then((style) => customizarEstiloFiord(style))
      .catch((err) => {
        estiloFiordEscuroPromise = null;
        throw err;
      });
  }
  return estiloFiordEscuroPromise;
}

/**
 * Basemap escuro Command Center: Fiord (OSM) escurecido + ruas branco-cinza.
 */
export function criarCamadaBasemapEscuro(_opcoes?: BasemapOpts) {
  const layer = L.maplibreGL({
    style: {
      version: 8,
      sources: {},
      layers: [{ id: 'background', type: 'background', paint: { 'background-color': CC_MAPA_FUNDO } }],
    },
    attributionControl: false,
  });

  layer.once('add', () => {
    forcarResizeMapLibre(layer);
    void carregarEstiloFiordEscuro()
      .then((style) => {
        const gl = layer.getMaplibreMap?.();
        if (!gl) return;
        gl.setStyle(style);
        gl.once('style.load', () => forcarResizeMapLibre(layer));
      })
      .catch(() => {
        const gl = layer.getMaplibreMap?.();
        gl?.setStyle(OPENFREEMAP_FIORD);
      });
  });

  return layer;
}

/** Positron sem verde de parques/vegetação — fundo branco/cinza claro. */
function customizarEstiloPositron(style: StyleSpecification): StyleSpecification {
  const layers = (style.layers ?? []).map((raw) => {
    const layer = { ...raw } as Record<string, unknown>;
    const id = String(layer.id ?? '');
    if (id === 'background') {
      setPaint(layer, 'background-color', '#F8FAFC');
      return layer as StyleSpecification['layers'][number];
    }
    if (id.includes('park') || id.includes('landcover') || id.includes('landuse')) {
      if (layer.type === 'fill') {
        setPaint(layer, 'fill-color', '#EEF2F6');
        setPaint(layer, 'fill-opacity', 0.85);
      }
      if (layer.type === 'line') setPaint(layer, 'line-color', '#D8DEE6');
      return layer as StyleSpecification['layers'][number];
    }
    if (id === 'water') {
      setPaint(layer, 'fill-color', '#D9E4EF');
      return layer as StyleSpecification['layers'][number];
    }
    return layer as StyleSpecification['layers'][number];
  });
  return { ...style, layers };
}

let estiloPositronClaroPromise: Promise<StyleSpecification> | null = null;

function carregarEstiloPositronClaro(): Promise<StyleSpecification> {
  if (!estiloPositronClaroPromise) {
    estiloPositronClaroPromise = fetch(OPENFREEMAP_POSITRON)
      .then((res) => {
        if (!res.ok) throw new Error(`OpenFreeMap Positron HTTP ${res.status}`);
        return res.json() as Promise<StyleSpecification>;
      })
      .then((style) => customizarEstiloPositron(style))
      .catch((err) => {
        estiloPositronClaroPromise = null;
        throw err;
      });
  }
  return estiloPositronClaroPromise;
}

/**
 * Basemap claro Command Center: Positron (branco/cinza), sem verde.
 */
export function criarCamadaBasemapClaro(_opcoes?: BasemapOpts) {
  const layer = L.maplibreGL({
    style: {
      version: 8,
      sources: {},
      layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#F8FAFC' } }],
    },
    attributionControl: false,
  });

  layer.once('add', () => {
    forcarResizeMapLibre(layer);
    void carregarEstiloPositronClaro()
      .then((style) => {
        const gl = layer.getMaplibreMap?.();
        if (!gl) return;
        gl.setStyle(style);
        gl.once('style.load', () => forcarResizeMapLibre(layer));
      })
      .catch(() => {
        const gl = layer.getMaplibreMap?.();
        gl?.setStyle(OPENFREEMAP_POSITRON);
      });
  });

  return layer;
}

/** @deprecated Com Fiord os rótulos já vêm no estilo; não adicionar segunda camada. */
export function criarCamadaBasemapEscuroRotulos(_opcoes?: BasemapOpts) {
  return L.layerGroup();
}

/** @deprecated Preferir criarCamadaBasemapEscuro (Fiord). */
export function criarCamadaBasemapOsm(opcoes?: BasemapOpts) {
  return criarCamadaBasemapEscuro(opcoes);
}

/** Cores de trajeto legíveis em mapa escuro (Command Center). */
export const CORES_TRAJETO_FROTA_ESCURO = ['#3B82F6', '#60A5FA', '#2563EB', '#93C5FD'] as const;
export const COR_TRAJETO_ESCURO = '#3B82F6';
export const COR_EXCESSO_FROTA_ESCURO = '#EF4444';
export const COR_PARADO_FROTA_ESCURO = '#94A3B8';

/** Paleta de traçado: um tom navy por rota (sem arco-íris por tipo de via). */
export const CORES_TRAJETO_FROTA = ['#1B2A6B', '#3D52A8', '#152056', '#5B6DB0'] as const;

export const COR_TRAJETO = '#1B2A6B';
export const COR_EXCESSO_FROTA = '#E8520A';
export const COR_PARADO_FROTA = '#64748B';
export const COR_INICIO_TRAJETO = '#1B2A6B';
export const COR_FIM_TRAJETO = '#64748B';

/** Status de veículo no mapa (identidade do produto). */
export const COR_STATUS_EM_ROTA = '#1B2A6B';
export const COR_STATUS_DISPONIVEL = '#16A34A';
export const COR_STATUS_PARADO = '#64748B';
export const COR_STATUS_SEM_SINAL = '#94A3B8';
