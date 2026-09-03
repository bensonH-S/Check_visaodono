import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import RefreshIcon from '@mui/icons-material/Refresh';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './mapaMarcadores.css';
import type {
  FrotaRegiaoLoja,
  FrotaTecnicoPosicao,
  FrotaVeiculoHistoricoPonto,
  FrotaVeiculoPosicao,
  FrotaVeiculoRotaDiaRelatorio,
} from '../../api/client';
import { useAppTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/tokens';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import { iconeMarcaLojaPorNome } from '../../utils/marcaLojaMapa';
import {
  configurarPanesMapaRotaDia,
  desenharRotaDiaNoMapa,
  limparCamadasRotaDia,
  limparDestaqueTrechoRota,
  trazerExcessosParaFrente,
  type CamadasRotaDiaMapa,
} from './frotaMapaRotaDiaDesenho';
import {
  criarCamadaBasemapLimpo,
  criarCamadaBasemapEscuro,
  criarCamadaBasemapClaro,
  FROTA_MAPA_ESCURO_FUNDO,
  CORES_TRAJETO_FROTA_ESCURO,
  FROTA_MAPA_FUNDO,
} from './frotaMapaBasemap';
import {
  marcadorVeiculo,
  vincularPopupVeiculo,
  desenharMarcadorVeiculoAoVivo,
  desenharMarcadoresIgnicaoDia,
} from './frotaMapaVeiculo';
import { iniciaisNomeMapa, mesmaRegiaoLojaTecnico, primeiroNomeMapa } from '../../utils/mapaGeo';

/** Zoom fixo quando há só um ponto (~nível de bairro). */
const ZOOM_PONTO_UNICO = 14;
const ZOOM_PONTO_UNICO_MOBILE = 15;
/** Limite máximo ao enquadrar várias lojas. */
const ZOOM_MAXIMO_ENQUADRE = 15;
const ZOOM_MAXIMO_ENQUADRE_MOBILE = 16;
const ZOOM_PADRAO_BRASIL = 4;
/** Centro de Brasília/DF — padrão enquanto lojas carregam. */
const CENTRO_DISTRITO_FEDERAL: L.LatLngExpression = [-15.7801, -47.9292];
const ZOOM_INICIAL_DF = 11;
const ZOOM_INICIAL_DF_MOBILE = 11;
const TAMANHO_ICONE_LOJA = 28;
const TAMANHO_ICONE_TECNICO = 20;
/** Deslocamento em metros quando técnico está na mesma coordenada (ou muito perto) de uma loja. */
const DESLOCAMENTO_TECNICO_METROS = 58;
/** Raio em metros para considerar técnico na mesma loja. */
const RAIO_TECNICO_NA_LOJA_METROS = 50;

type TipoMapa = 'rua' | 'satelite';

function escapeHtml(texto: string) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatarEnderecoLoja(loja: FrotaRegiaoLoja) {
  const partes = [loja.address, loja.neighborhood, loja.city, loja.state].filter(
    (p) => typeof p === 'string' && p.trim(),
  ) as string[];
  return partes.join(', ');
}

function iconeCopiarSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
}

function iconeLocalizacaoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="${colors.orange}" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
}

function htmlInfoLoja(loja: FrotaRegiaoLoja) {
  const endereco = formatarEnderecoLoja(loja);
  const textoCopiar = endereco || loja.name;
  const marcaSrc = escapeHtml(iconeMarcaLojaPorNome(loja));
  const iconBtn = `<button type="button" class="btn-copiar-endereco-loja" data-copiar-endereco="${escapeHtml(textoCopiar)}" aria-label="Copiar endereço" title="Copiar endereço">${iconeCopiarSvg()}</button>`;
  const tituloHtml = `<div class="info-loja-mapa-nome"><img src="${marcaSrc}" alt="" class="info-loja-mapa-marca" /><strong>${escapeHtml(loja.name)}</strong></div>`;
  const enderecoHtml = endereco
    ? `<div class="info-loja-mapa-endereco"><span class="info-loja-mapa-pin" aria-hidden="true">${iconeLocalizacaoSvg()}</span><small>${escapeHtml(endereco)}</small>${iconBtn}</div>`
    : `<div class="info-loja-mapa-endereco info-loja-mapa-endereco--so-icone">${iconBtn}</div>`;
  return `<div class="info-loja-mapa">${tituloHtml}${enderecoHtml}</div>`;
}

function anexarBotoesCopiar(container: HTMLElement | null | undefined) {
  if (!container) return;
  container.querySelectorAll<HTMLButtonElement>('[data-copiar-endereco]').forEach((btn) => {
    if (btn.dataset.copiarAnexado === '1') return;
    btn.dataset.copiarAnexado = '1';
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const texto = btn.getAttribute('data-copiar-endereco');
      if (texto) void navigator.clipboard?.writeText(texto);
    });
  });
}

function temCoordenadaVeiculo(v: FrotaVeiculoPosicao) {
  return temCoordenadaLatLng(v.latitude, v.longitude);
}

function pontosEnquadreInicial(
  lojas: FrotaRegiaoLoja[],
  posicoes: FrotaTecnicoPosicao[],
  veiculos: FrotaVeiculoPosicao[],
): L.LatLngExpression[] {
  const lojaPts = lojas
    .filter(temCoordenadaLoja)
    .map((l) => [Number(l.latitude), Number(l.longitude)] as L.LatLngExpression);
  if (lojaPts.length) return lojaPts;

  const outros: L.LatLngExpression[] = [];
  for (const p of posicoes) {
    if (temCoordenadaTecnico(p)) {
      outros.push([Number(p.latitude), Number(p.longitude)]);
    }
  }
  for (const v of veiculos) {
    if (temCoordenadaVeiculo(v)) {
      outros.push([Number(v.latitude), Number(v.longitude)]);
    }
  }
  return outros;
}

function aplicarVistaInicialMapa(
  mapa: L.Map,
  pontos: L.LatLngExpression[],
  mobile: boolean,
) {
  mapa.invalidateSize(false);
  if (!pontos.length) {
    mapa.setView(CENTRO_DISTRITO_FEDERAL, mobile ? ZOOM_INICIAL_DF_MOBILE : ZOOM_INICIAL_DF, {
      animate: false,
    });
    return;
  }
  if (pontos.length === 1) {
    mapa.setView(pontos[0], mobile ? ZOOM_PONTO_UNICO_MOBILE : ZOOM_PONTO_UNICO, { animate: false });
    return;
  }
  const bounds = L.latLngBounds(pontos as L.LatLngTuple[]);
  if (!bounds.isValid()) {
    mapa.setView(CENTRO_DISTRITO_FEDERAL, mobile ? ZOOM_INICIAL_DF_MOBILE : ZOOM_INICIAL_DF, {
      animate: false,
    });
    return;
  }
  mapa.fitBounds(bounds, {
    padding: mobile ? [56, 28] : [48, 48],
    maxZoom: mobile ? ZOOM_MAXIMO_ENQUADRE_MOBILE : ZOOM_MAXIMO_ENQUADRE,
    animate: false,
  });
}

function marcadorTecnico(mobile = false, nome = '', destacado = false, comGps = true) {
  if (mobile) {
    const iniciais = iniciaisNomeMapa(nome);
    const label = primeiroNomeMapa(nome);
    const w = destacado ? 58 : 50;
    const cls = [
      'marker-tech-pin',
      destacado ? 'is-destaque' : '',
      comGps ? 'is-live' : 'is-offline',
    ]
      .filter(Boolean)
      .join(' ');
    return L.divIcon({
      className: 'marcador-tecnico-pin',
      html: `<div class="${cls}" style="width:${w}px">
        <div class="marker-tech-halo">
          <span class="marker-tech-ring marker-tech-ring--1"></span>
          <span class="marker-tech-ring marker-tech-ring--2"></span>
        </div>
        <div class="marker-tech-core">
          <span class="marker-tech-iniciais">${escapeHtml(iniciais)}</span>
          <span class="marker-tech-status" aria-hidden="true"></span>
        </div>
        <div class="marker-tech-pointer"></div>
        <div class="marker-tech-label">${escapeHtml(label)}</div>
      </div>`,
      iconSize: [w, w + 32],
      iconAnchor: [w / 2, w + 24],
      popupAnchor: [0, -(w + 26)],
    });
  }
  const size = TAMANHO_ICONE_TECNICO;
  const altura = size + 6;
  const icone = size - 10;
  return L.divIcon({
    className: 'marcador-tecnico',
    html: `<div style="display:flex;flex-direction:column;align-items:center;width:${size}px;line-height:0;">
      <div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:${colors.navy};border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${icone}" height="${icone}" fill="#fff" aria-hidden="true">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      </div>
      <div style="width:0;height:0;margin-top:-2px;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${colors.navy};"></div>
    </div>`,
    iconSize: [size, altura],
    iconAnchor: [size / 2, altura],
    popupAnchor: [0, -altura],
  });
}

function marcarCliqueMarcadorMobile(ev: L.LeafletMouseEvent, ignorarRef: { current: boolean }) {
  L.DomEvent.stopPropagation(ev);
  ignorarRef.current = true;
}

function iconePinLocalizacaoLojaSvg() {
  return `<svg class="marker-loja-nome-pin-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="${colors.orange}" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
}

function alturaLabelLojaMobile(qtdCaracteres: number, larguraLabel: number): number {
  const larguraTexto = Math.max(40, larguraLabel - 34);
  const charsPorLinha = Math.max(10, Math.floor(larguraTexto / 5.4));
  const linhas = Math.max(1, Math.ceil(qtdCaracteres / charsPorLinha));
  return 10 + linhas * 13 + 6;
}

function nomeLojaCurtoMapa(loja: Pick<FrotaRegiaoLoja, 'name' | 'bk_number'>) {
  const nome = String(loja.name || '')
    .replace(/^BURGER KING\s*[·\-–]?\s*/i, '')
    .trim();
  if (loja.bk_number) return `${loja.bk_number} · ${nome || loja.name}`;
  return nome || loja.name;
}

function marcadorLoja(loja: Pick<FrotaRegiaoLoja, 'name' | 'bk_number'>, mobile = false, destacada = false) {
  const src = escapeHtml(iconeMarcaLojaPorNome(loja));
  const size = mobile ? (destacada ? 36 : 32) : TAMANHO_ICONE_LOJA;
  const pinAltura = size + (mobile ? 8 : 6);
  const ring = destacada
    ? `box-shadow:0 0 0 3px ${colors.orange}, 0 4px 14px rgba(0,0,0,.35);`
    : mobile
      ? 'box-shadow:0 2px 10px rgba(0,0,0,.28);'
      : 'box-shadow:0 1px 2px rgba(0,0,0,.35);';
  const rotulo = escapeHtml(nomeLojaCurtoMapa(loja));
  const maxLabelW = 240;
  const labelLargura =
    mobile && destacada
      ? Math.min(maxLabelW, Math.max(size + 16, nomeLojaCurtoMapa(loja).length * 5.6 + 34))
      : size;
  const labelAltura =
    mobile && destacada ? alturaLabelLojaMobile(nomeLojaCurtoMapa(loja).length, labelLargura) : 0;
  const labelHtml =
    mobile && destacada
      ? `<div class="marker-loja-nome-mobile" style="max-width:${maxLabelW}px">
          <span class="marker-loja-nome-pin" aria-hidden="true">${iconePinLocalizacaoLojaSvg()}</span>
          <span class="marker-loja-nome-texto">${rotulo}</span>
        </div>`
      : '';
  const alturaTotal = pinAltura + labelAltura;
  return L.divIcon({
    className: destacada ? 'marcador-loja-marca is-destaque' : 'marcador-loja-marca',
    html: `<div class="marker-loja-wrap-mobile" style="width:${labelLargura}px">
      ${labelHtml}
      <div style="display:flex;flex-direction:column;align-items:center;width:${size}px;line-height:0;">
        <div style="width:${size}px;height:${size}px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:${mobile ? 10 : 3}px;${ring}">
          <img src="${src}" alt="" style="width:${size - 4}px;height:${size - 4}px;object-fit:contain;display:block;" />
        </div>
        <div style="width:0;height:0;margin-top:-1px;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid #fff;filter:drop-shadow(0 1px 1px rgba(0,0,0,.25));"></div>
      </div>
    </div>`,
    iconSize: [labelLargura, alturaTotal],
    iconAnchor: [labelLargura / 2, alturaTotal],
    popupAnchor: [0, -alturaTotal],
  });
}

function criarCamadaRua(mobile = false) {
  return criarCamadaBasemapLimpo({ mobile });
}

function criarCamadaRuaGoogle() {
  return L.tileLayer('https://{s}.google.com/vt/lyrs=m&hl=pt-BR&x={x}&y={y}&z={z}', {
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google',
    maxZoom: 21,
  });
}

function criarCamadaRuaComTrafego() {
  return L.tileLayer('https://{s}.google.com/vt/lyrs=m,traffic&hl=pt-BR&x={x}&y={y}&z={z}', {
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google',
    maxZoom: 21,
  });
}

function criarCamadaSatelite() {
  return L.tileLayer('https://{s}.google.com/vt/lyrs=y&hl=pt-BR&x={x}&y={y}&z={z}', {
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google',
    maxZoom: 21,
  });
}

function criarCamadaSateliteComTrafego() {
  return L.tileLayer('https://{s}.google.com/vt/lyrs=y,traffic&hl=pt-BR&x={x}&y={y}&z={z}', {
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google',
    maxZoom: 21,
  });
}

function formatarAtualizado(iso: string | null | undefined) {
  if (!iso) return 'Sem localização registrada';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Atualizado recentemente';
  const diffMin = Math.round((Date.now() - d.getTime()) / 60_000);
  if (diffMin < 1) return 'Atualizado agora';
  if (diffMin < 60) return `Atualizado há ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `Atualizado há ${diffH} h`;
  return `Atualizado em ${formatDataHoraBrasilia(iso)}`;
}

function temCoordenadaLatLng(latitude: unknown, longitude: unknown) {
  return (
    latitude != null &&
    longitude != null &&
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude))
  );
}

function temCoordenadaTecnico(p: FrotaTecnicoPosicao) {
  return temCoordenadaLatLng(p.latitude, p.longitude);
}

function temCoordenadaLoja(l: FrotaRegiaoLoja) {
  return temCoordenadaLatLng(l.latitude, l.longitude);
}

function chaveCoordenada(lat: number, lng: number) {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function deslocarCoordenada(lat: number, lng: number, indice: number): [number, number] {
  const angulo = ((indice * 72 + 38) * Math.PI) / 180;
  const north = DESLOCAMENTO_TECNICO_METROS * Math.sin(angulo);
  const east = DESLOCAMENTO_TECNICO_METROS * Math.cos(angulo);
  const dLat = north / 111_320;
  const dLng = east / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [lat + dLat, lng + dLng];
}

function lojaProxima(
  lat: number,
  lng: number,
  lojasCoords: { lat: number; lng: number }[],
): { lat: number; lng: number } | null {
  for (const l of lojasCoords) {
    if (distanciaMetros(lat, lng, l.lat, l.lng) <= RAIO_TECNICO_NA_LOJA_METROS) {
      return l;
    }
  }
  return null;
}

function posicaoMarcadorTecnico(
  lat: number,
  lng: number,
  lojasCoords: { lat: number; lng: number }[],
  ocupacao: Map<string, number>,
): [number, number] {
  const loja = lojaProxima(lat, lng, lojasCoords);
  if (!loja) return [lat, lng];
  const chave = chaveCoordenada(loja.lat, loja.lng);
  const indice = ocupacao.get(chave) ?? 0;
  ocupacao.set(chave, indice + 1);
  return deslocarCoordenada(loja.lat, loja.lng, indice + 1);
}

type Props = {
  posicoes: FrotaTecnicoPosicao[];
  lojas?: FrotaRegiaoLoja[];
  veiculos?: FrotaVeiculoPosicao[];
  historicoVeiculo?: FrotaVeiculoHistoricoPonto[];
  /** Trajeto completo do dia (rotas nas ruas + excessos), igual ao relatório de rotas. */
  rotaDiaVeiculo?: FrotaVeiculoRotaDiaRelatorio | null;
  carregando?: boolean;
  gpsAtivo?: boolean;
  rastreamentoAtivo?: boolean;
  onAtualizar: () => void;
  /** Preenche a altura disponível do painel pai (aba Localização). */
  preencherAltura?: boolean;
  /** Aba Localização visível — força recálculo do tamanho do Leaflet. */
  visivel?: boolean;
  /** Atualização automática (ms). Ex.: alinhado ao intervalo de GPS dos técnicos. */
  autoRefreshIntervalMs?: number;
  /** Visual e interação otimizados para o app mobile. */
  modo?: 'gestao' | 'mobile';
  /** Exibe botão manual de atualizar (portal). */
  mostrarBotaoAtualizar?: boolean;
  /** Mapa / Satélite (portal). No mobile fica só o mapa de ruas. */
  mostrarAlternarTipoMapa?: boolean;
  tecnicoDestaqueId?: number | null;
  veiculoDestaqueId?: number | null;
  lojaDestaqueId?: number | null;
  onLojaClick?: (loja: FrotaRegiaoLoja) => void;
  /** Toque no mapa vazio (mobile) — ex.: limpar loja selecionada. */
  onMapaClick?: () => void;
  onTecnicoClick?: (tecnico: FrotaTecnicoPosicao) => void;
  onVeiculoClick?: (veiculo: FrotaVeiculoPosicao) => void;
  /** No mobile, padrão sem balão ao tocar no veículo (só trajeto). */
  mostrarPopupVeiculo?: boolean;
  /** Filtro de região — no mobile, reenquadra lojas ao mudar. */
  regiaoFiltro?: number | '';
  /** Trajeto do dia atual (ao vivo) vs histórico — define marcadores verde/vermelho na rota. */
  trajetoDiaAtual?: boolean;
  /** Posição ao vivo do veículo com trajeto carregado (dia atual). */
  veiculoAoVivoTrajeto?: FrotaVeiculoPosicao | null;
  /** Esconde o aviso de mapa vazio (histórico de trajeto). */
  ocultarPlaceholder?: boolean;
  /** Histórico: sem ícones de ignição; lojas visitadas com nome. */
  consultaHistorico?: boolean;
  /** Esconde alertas de GPS/Fulltrack (ex.: embed no Command Center). */
  esconderAvisos?: boolean;
  /** Tiles Google (evita watermark "API key required" do Carto). */
  tilesGoogle?: boolean;
  /** Command Center claro: OpenFreeMap Positron (branco/cinza, sem verde de satélite/parques). */
  basemapClaroVector?: boolean;
  /**
   * Segue o tema claro/escuro do app (Fiord / Positron).
   * Default true — mesmos estilos do Command Center nos mapas de frota.
   */
  seguirTemaApp?: boolean;
  /** Mapa escuro estilo Command Center (basemap dark + rotas claras). */
  temaEscuro?: boolean;
  /** Posição dos botões de zoom. */
  posicaoZoom?: 'topleft' | 'bottomright';
  /** Oculta os controles +/- (ex.: Command Center). */
  ocultarZoom?: boolean;
};

const btnMapaSx = {
  px: 1.25,
  py: 0.6,
  minWidth: 0,
  fontSize: '0.7rem',
  fontWeight: 600,
  lineHeight: 1.2,
  textTransform: 'none' as const,
  borderRadius: 0,
  color: 'text.primary',
  '&:hover': { bgcolor: 'grey.100' },
};

export default function FrotaLocalizacaoMap({
  posicoes,
  lojas = [],
  veiculos = [],
  historicoVeiculo = [],
  rotaDiaVeiculo = null,
  carregando,
  gpsAtivo,
  rastreamentoAtivo = true,
  onAtualizar,
  preencherAltura = false,
  visivel = true,
  autoRefreshIntervalMs,
  modo = 'gestao',
  mostrarBotaoAtualizar,
  mostrarAlternarTipoMapa,
  tecnicoDestaqueId = null,
  veiculoDestaqueId = null,
  lojaDestaqueId = null,
  onLojaClick,
  onMapaClick,
  onTecnicoClick,
  onVeiculoClick,
  mostrarPopupVeiculo,
  regiaoFiltro = '',
  trajetoDiaAtual = false,
  veiculoAoVivoTrajeto = null,
  ocultarPlaceholder = false,
  consultaHistorico = false,
  esconderAvisos = false,
  tilesGoogle = false,
  basemapClaroVector = false,
  seguirTemaApp = true,
  temaEscuro = false,
  posicaoZoom,
  ocultarZoom = false,
}: Props) {
  const mobile = modo === 'mobile';
  const { mode: temaApp } = useAppTheme();
  const mapaEscuroEfetivo = temaEscuro || (seguirTemaApp && temaApp === 'dark');
  const mapaClaroVectorEfetivo =
    basemapClaroVector || (seguirTemaApp && temaApp === 'light' && !tilesGoogle);
  const exibirPopupVeiculo = mostrarPopupVeiculo ?? !mobile;
  const exibirAtualizar = mostrarBotaoAtualizar ?? !mobile;
  const exibirAlternarMapa = mostrarAlternarTipoMapa ?? !mobile;
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const tecnicosLayer = useRef<L.LayerGroup | null>(null);
  const veiculosLayer = useRef<L.LayerGroup | null>(null);
  const lojasLayer = useRef<L.LayerGroup | null>(null);
  const linhaLayer = useRef<L.LayerGroup | null>(null);
  const trajetoriaLayer = useRef<L.LayerGroup | null>(null);
  const veiculoTrajetoLayer = useRef<L.LayerGroup | null>(null);
  const rotaDiaCamadas = useRef<CamadasRotaDiaMapa | null>(null);
  const veiculoRotaAnterior = useRef<number | null>(null);
  const veiculoFocoAnterior = useRef<number | null>(null);
  const baseLayer = useRef<L.Layer | null>(null);
  const labelsLayer = useRef<L.Layer | null>(null);
  const regiaoEnquadreAnterior = useRef<number | '' | null>(null);
  const vistaInicialAplicada = useRef(false);
  const usuarioMoveuMapa = useRef(false);
  const onLojaClickRef = useRef(onLojaClick);
  const onMapaClickRef = useRef(onMapaClick);
  const ignorarProximoClickMapaRef = useRef(false);
  const onTecnicoClickRef = useRef(onTecnicoClick);
  const onVeiculoClickRef = useRef(onVeiculoClick);
  const onAtualizarRef = useRef(onAtualizar);
  const marcadoresMobileRef = useRef<{ lojas: Map<number, L.Marker>; tecnicos: Map<number, L.Marker>; veiculos: Map<number, L.Marker> }>({
    lojas: new Map(),
    tecnicos: new Map(),
    veiculos: new Map(),
  });
  const lojaFocoAnterior = useRef<number | null>(null);
  const lojaDestaqueIdRef = useRef(lojaDestaqueId);
  const visivelAnterior = useRef(false);
  const lojasComCoordAnterior = useRef(0);
  const [mapaPronto, setMapaPronto] = useState(false);
  const [tipoMapa, setTipoMapa] = useState<TipoMapa>('rua');
  const [trafegoAtivo, setTrafegoAtivo] = useState(false);

  useEffect(() => {
    onLojaClickRef.current = onLojaClick;
  }, [onLojaClick]);

  useEffect(() => {
    onMapaClickRef.current = onMapaClick;
  }, [onMapaClick]);

  useEffect(() => {
    onTecnicoClickRef.current = onTecnicoClick;
  }, [onTecnicoClick]);

  useEffect(() => {
    onVeiculoClickRef.current = onVeiculoClick;
  }, [onVeiculoClick]);

  useEffect(() => {
    lojaDestaqueIdRef.current = lojaDestaqueId;
  }, [lojaDestaqueId]);

  useEffect(() => {
    onAtualizarRef.current = onAtualizar;
  }, [onAtualizar]);

  const aplicarCamadas = useCallback((tipo: TipoMapa, trafego: boolean, isMobile: boolean) => {
    const mapa = mapInstance.current;
    if (!mapa) return;

    if (baseLayer.current) {
      mapa.removeLayer(baseLayer.current);
      baseLayer.current = null;
    }
    if (labelsLayer.current) {
      mapa.removeLayer(labelsLayer.current);
      labelsLayer.current = null;
    }

    const container = mapa.getContainer();
    if (mapaEscuroEfetivo && tipo === 'rua') {
      // OpenFreeMap Fiord customizado — azul-noite + ruas cinza.
      baseLayer.current = criarCamadaBasemapEscuro({ mobile: isMobile }).addTo(mapa);
      container.style.background = FROTA_MAPA_ESCURO_FUNDO;
      container.classList.add('frota-mapa--escuro');
      container.classList.remove('frota-mapa--claro');
      return;
    }

    container.classList.remove('frota-mapa--escuro');
    if (mapaClaroVectorEfetivo && tipo === 'rua') {
      // OpenFreeMap Positron — fundo claro/branco, sem satélite verde.
      baseLayer.current = criarCamadaBasemapClaro({ mobile: isMobile }).addTo(mapa);
      container.style.background = '#F8FAFC';
      container.classList.add('frota-mapa--claro');
      return;
    }

    container.classList.remove('frota-mapa--claro');
    if (tipo === 'rua') {
      if (tilesGoogle) {
        baseLayer.current = (trafego && !isMobile ? criarCamadaRuaComTrafego() : criarCamadaRuaGoogle()).addTo(mapa);
      } else {
        baseLayer.current = (trafego && !isMobile ? criarCamadaRuaComTrafego() : criarCamadaRua(isMobile)).addTo(mapa);
      }
    } else {
      baseLayer.current = (trafego && !isMobile ? criarCamadaSateliteComTrafego() : criarCamadaSatelite()).addTo(mapa);
    }
    container.style.background = FROTA_MAPA_FUNDO;
  }, [tilesGoogle, mapaEscuroEfetivo, mapaClaroVectorEfetivo]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const mapa = L.map(mapRef.current, {
      center: mobile ? CENTRO_DISTRITO_FEDERAL : [-15.78, -47.93],
      zoom: mobile ? ZOOM_INICIAL_DF_MOBILE : ZOOM_INICIAL_DF,
      minZoom: mobile ? 4 : 3,
      maxZoom: mobile ? 19 : 20,
      zoomControl: false,
      fadeAnimation: !mobile,
      zoomAnimation: true,
      markerZoomAnimation: !mobile,
      touchZoom: true,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: !mobile,
      keyboard: !mobile,
      zoomSnap: mobile ? 0.5 : 1,
      zoomDelta: mobile ? 0.5 : 1,
      wheelDebounceTime: mobile ? 30 : 40,
      wheelPxPerZoomLevel: mobile ? 80 : 60,
      bounceAtZoomLimits: true,
    });
    mapa.getContainer().style.background = mapaEscuroEfetivo ? FROTA_MAPA_ESCURO_FUNDO : FROTA_MAPA_FUNDO;

    if (!ocultarZoom) {
      L.control.zoom({ position: posicaoZoom ?? (mobile ? 'bottomright' : 'topleft') }).addTo(mapa);
    }
    mapa.on('movestart', () => {
      usuarioMoveuMapa.current = true;
    });
    mapa.on('zoomstart', () => {
      usuarioMoveuMapa.current = true;
    });
    if (mobile || onMapaClickRef.current) {
      mapa.on('click', () => {
        if (ignorarProximoClickMapaRef.current) {
          ignorarProximoClickMapaRef.current = false;
          return;
        }
        onMapaClickRef.current?.();
      });
    }

    tecnicosLayer.current = L.layerGroup().addTo(mapa);
    veiculosLayer.current = L.layerGroup().addTo(mapa);
    lojasLayer.current = L.layerGroup().addTo(mapa);
    linhaLayer.current = L.layerGroup().addTo(mapa);
    trajetoriaLayer.current = L.layerGroup().addTo(mapa);
    configurarPanesMapaRotaDia(mapa);
    if (!mapa.getPane('paneVeiculoTrajetoMobile')) {
      mapa.createPane('paneVeiculoTrajetoMobile');
      const pane = mapa.getPane('paneVeiculoTrajetoMobile');
      if (pane) pane.style.zIndex = '720';
    }
    veiculoTrajetoLayer.current = L.layerGroup().addTo(mapa);
    rotaDiaCamadas.current = {
      rota: L.layerGroup().addTo(mapa),
      excessoLinha: L.layerGroup().addTo(mapa),
      excessoMarcador: L.layerGroup().addTo(mapa),
      destaque: L.layerGroup().addTo(mapa),
      parado: L.layerGroup().addTo(mapa),
    };
    mapa.on('popupclose', () => {
      if (rotaDiaCamadas.current) limparDestaqueTrechoRota(rotaDiaCamadas.current.destaque);
    });
    mapInstance.current = mapa;
    aplicarCamadas('rua', false, mobile);
    setMapaPronto(true);

    const onClickCopiar = (ev: MouseEvent) => {
      const alvo = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-copiar-endereco]');
      if (!alvo || !mapa.getContainer().contains(alvo)) return;
      ev.preventDefault();
      ev.stopPropagation();
      const texto = alvo.getAttribute('data-copiar-endereco');
      if (texto) void navigator.clipboard?.writeText(texto);
    };
    mapa.on('popupopen', (e) => anexarBotoesCopiar(e.popup.getElement() ?? undefined));
    mapa.getContainer().addEventListener('click', onClickCopiar);

    const invalidar = () => mapa.invalidateSize();
    invalidar();
    const t1 = window.setTimeout(invalidar, 50);
    const t2 = window.setTimeout(invalidar, 250);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      mapa.getContainer().removeEventListener('click', onClickCopiar);
      mapa.remove();
      mapInstance.current = null;
      tecnicosLayer.current = null;
      veiculosLayer.current = null;
      lojasLayer.current = null;
      linhaLayer.current = null;
      trajetoriaLayer.current = null;
      veiculoTrajetoLayer.current = null;
      rotaDiaCamadas.current = null;
      baseLayer.current = null;
      labelsLayer.current = null;
      marcadoresMobileRef.current.lojas.clear();
      marcadoresMobileRef.current.tecnicos.clear();
      marcadoresMobileRef.current.veiculos.clear();
      setMapaPronto(false);
    };
  }, [aplicarCamadas, mobile]);

  useEffect(() => {
    if (!mapaPronto || !mapInstance.current || !mobile) return;
    const mapa = mapInstance.current;
    const centralizarDf = () => {
      if (usuarioMoveuMapa.current || lojaDestaqueIdRef.current) return;
      if (lojas.some(temCoordenadaLoja)) return;
      mapa.setView(CENTRO_DISTRITO_FEDERAL, ZOOM_INICIAL_DF_MOBILE, { animate: false });
    };
    centralizarDf();
    const t1 = window.setTimeout(centralizarDf, 120);
    const t2 = window.setTimeout(centralizarDf, 450);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [mapaPronto, mobile, lojas]);

  useEffect(() => {
    if (!mapaPronto) return;
    aplicarCamadas(tipoMapa, trafegoAtivo, mobile);
  }, [tipoMapa, trafegoAtivo, mapaPronto, aplicarCamadas, mobile]);

  useEffect(() => {
    if (!mapaPronto || !tecnicosLayer.current || !veiculosLayer.current || !lojasLayer.current || !linhaLayer.current || !trajetoriaLayer.current || !mapInstance.current) return;

    const mapa = mapInstance.current;
    mapa.closePopup();

    const comGps = posicoes.filter(temCoordenadaTecnico);
    const comVeiculos = veiculos.filter(temCoordenadaVeiculo);
    const comLoja = lojas.filter(temCoordenadaLoja);
    const bounds: L.LatLngExpression[] = [];
    const lojasCoords = comLoja.map((l) => ({
      lat: Number(l.latitude),
      lng: Number(l.longitude),
    }));
    const ocupacaoTecnico = new Map<string, number>();

    const tecnicoSel = posicoes.find((p) => p.id_usuario === tecnicoDestaqueId);
    const lojaSel = lojas.find((l) => l.id_loja === lojaDestaqueId);

    if (mobile) {
      const cache = marcadoresMobileRef.current;
      const idsLoja = new Set(comLoja.map((l) => l.id_loja));

      for (const [id, marker] of cache.lojas) {
        if (!idsLoja.has(id)) {
          lojasLayer.current.removeLayer(marker);
          cache.lojas.delete(id);
        }
      }

      for (const l of comLoja) {
        const lat = Number(l.latitude);
        const lng = Number(l.longitude);
        bounds.push([lat, lng]);
        const destacada = consultaHistorico || lojaDestaqueId === l.id_loja;
        let marker = cache.lojas.get(l.id_loja);
        if (!marker) {
          marker = L.marker([lat, lng], {
            icon: marcadorLoja(l, true, destacada),
            zIndexOffset: destacada ? 900 : 200,
          });
          marker.on('click', (ev) => {
            marcarCliqueMarcadorMobile(ev, ignorarProximoClickMapaRef);
            onLojaClickRef.current?.(l);
          });
          marker.addTo(lojasLayer.current);
          cache.lojas.set(l.id_loja, marker);
        } else {
          marker.setLatLng([lat, lng]);
          marker.setIcon(marcadorLoja(l, true, destacada));
          marker.setZIndexOffset(destacada ? 900 : 200);
        }
      }

      const idsTecnicos = new Set(comGps.map((p) => p.id_usuario));
      for (const [id, marker] of cache.tecnicos) {
        if (!idsTecnicos.has(id)) {
          tecnicosLayer.current.removeLayer(marker);
          cache.tecnicos.delete(id);
        }
      }

      for (const p of comGps) {
        const lat = Number(p.latitude);
        const lng = Number(p.longitude);
        const destacado = tecnicoDestaqueId === p.id_usuario;
        const [latMarcador, lngMarcador] = posicaoMarcadorTecnico(lat, lng, lojasCoords, ocupacaoTecnico);
        bounds.push([latMarcador, lngMarcador]);
        let marker = cache.tecnicos.get(p.id_usuario);
        if (!marker) {
          marker = L.marker([latMarcador, lngMarcador], {
            icon: marcadorTecnico(true, p.nome, destacado, true),
            zIndexOffset: destacado ? 800 : 500,
          });
          marker.on('click', (ev) => {
            marcarCliqueMarcadorMobile(ev, ignorarProximoClickMapaRef);
            onTecnicoClickRef.current?.(p);
          });
          marker.addTo(tecnicosLayer.current);
          cache.tecnicos.set(p.id_usuario, marker);
        } else {
          marker.setLatLng([latMarcador, lngMarcador]);
          marker.setIcon(marcadorTecnico(true, p.nome, destacado, true));
          marker.setZIndexOffset(destacado ? 800 : 500);
        }
      }

      const idsVeiculos = new Set(
        comVeiculos
          .filter((v) => !(trajetoDiaAtual && veiculoDestaqueId === v.id_veiculo))
          .map((v) => v.id_veiculo),
      );
      for (const [id, marker] of cache.veiculos) {
        if (!idsVeiculos.has(id)) {
          veiculosLayer.current.removeLayer(marker);
          cache.veiculos.delete(id);
        }
      }

      for (const v of comVeiculos) {
        if (trajetoDiaAtual && veiculoDestaqueId === v.id_veiculo) continue;
        const lat = Number(v.latitude);
        const lng = Number(v.longitude);
        const destacado = veiculoDestaqueId === v.id_veiculo;
        bounds.push([lat, lng]);
        let marker = cache.veiculos.get(v.id_veiculo);
        if (!marker) {
          marker = L.marker([lat, lng], {
            icon: marcadorVeiculo(v, true, destacado, v.rastreamento_disponivel !== false),
            zIndexOffset: destacado ? 900 : 600,
          });
          vincularPopupVeiculo(
            marker,
            v,
            (veiculo) => onVeiculoClickRef.current?.(veiculo),
            v.rastreamento_disponivel !== false,
            !exibirPopupVeiculo,
          );
          marker.addTo(veiculosLayer.current);
          cache.veiculos.set(v.id_veiculo, marker);
        } else {
          marker.setLatLng([lat, lng]);
          marker.setIcon(marcadorVeiculo(v, true, destacado, v.rastreamento_disponivel !== false));
          marker.setZIndexOffset(destacado ? 900 : 600);
          vincularPopupVeiculo(
            marker,
            v,
            (veiculo) => onVeiculoClickRef.current?.(veiculo),
            v.rastreamento_disponivel !== false,
            !exibirPopupVeiculo,
          );
        }
      }

      linhaLayer.current.clearLayers();
      if (
        gpsAtivo !== false &&
        tecnicoSel &&
        lojaSel &&
        temCoordenadaTecnico(tecnicoSel) &&
        temCoordenadaLoja(lojaSel) &&
        mesmaRegiaoLojaTecnico(lojaSel, tecnicoSel)
      ) {
        L.polyline(
          [
            [Number(tecnicoSel.latitude), Number(tecnicoSel.longitude)],
            [Number(lojaSel.latitude), Number(lojaSel.longitude)],
          ],
          {
            color: colors.orange,
            weight: 3,
            opacity: 0.85,
            dashArray: '8 8',
            lineCap: 'round',
          },
        ).addTo(linhaLayer.current);
      }

      const pontosEnquadre = pontosEnquadreInicial(comLoja, comGps, comVeiculos);
      if (!pontosEnquadre.length) {
        if (!vistaInicialAplicada.current) {
          mapInstance.current.setView(CENTRO_DISTRITO_FEDERAL, ZOOM_INICIAL_DF_MOBILE, { animate: false });
        }
        return;
      }

      if (!vistaInicialAplicada.current && !usuarioMoveuMapa.current) {
        aplicarVistaInicialMapa(mapInstance.current, pontosEnquadre, true);
        vistaInicialAplicada.current = true;
      }
      return;
    }

    tecnicosLayer.current.clearLayers();
    veiculosLayer.current.clearLayers();
    lojasLayer.current.clearLayers();
    linhaLayer.current.clearLayers();

    for (const l of comLoja) {
      const lat = Number(l.latitude);
      const lng = Number(l.longitude);
      bounds.push([lat, lng]);
      const destacada = mobile && lojaDestaqueId === l.id_loja;
      const marker = L.marker([lat, lng], {
        icon: marcadorLoja(l, mobile, destacada),
        zIndexOffset: destacada ? 400 : 200,
      });
      const conteudoLoja = htmlInfoLoja(l);
      if (mobile && onLojaClickRef.current) {
        marker.on('click', (ev) => {
          L.DomEvent.stopPropagation(ev);
          onLojaClickRef.current?.(l);
        });
      } else {
        marker.bindTooltip(conteudoLoja, {
          direction: 'top',
          offset: [0, -TAMANHO_ICONE_LOJA - 10],
          opacity: 1,
          className: 'tooltip-loja-mapa',
          sticky: true,
          interactive: true,
        });
        marker.bindPopup(conteudoLoja, { maxWidth: 360, className: 'popup-loja-mapa' });
      }
      marker.addTo(lojasLayer.current);
    }

    for (const p of posicoes) {
      const temGps = temCoordenadaTecnico(p);
      const lat = temGps ? Number(p.latitude) : null;
      const lng = temGps ? Number(p.longitude) : null;
      const destacado = tecnicoDestaqueId === p.id_usuario;
      if (!temGps) continue;
      const [latMarcador, lngMarcador] = posicaoMarcadorTecnico(lat!, lng!, lojasCoords, ocupacaoTecnico);
      bounds.push([latMarcador, lngMarcador]);
      const marker = L.marker([latMarcador, lngMarcador], {
        icon: marcadorTecnico(mobile, p.nome, destacado, temGps),
        zIndexOffset: destacado ? 800 : 500,
      });
      if (mobile) {
        marker.bindPopup(
          `<strong>${escapeHtml(p.nome)}</strong>${p.nome_regiao ? `<br/><small>${escapeHtml(p.nome_regiao)}</small>` : ''}<br/><small>${formatarAtualizado(p.atualizado_em)}</small>`,
        );
      } else {
        marker.bindTooltip(escapeHtml(p.nome), {
          direction: 'top',
          offset: [0, -TAMANHO_ICONE_TECNICO - 8],
          opacity: 0.95,
          className: 'tooltip-tecnico-mapa',
        });
        marker.bindPopup(
          `<strong>${escapeHtml(p.nome)}</strong>${p.nome_regiao ? `<br/><small>${escapeHtml(p.nome_regiao)}</small>` : ''}${p.email ? `<br/>${escapeHtml(p.email)}` : ''}<br/><small>${formatarAtualizado(p.atualizado_em)}</small>`,
        );
      }
      marker.addTo(tecnicosLayer.current);
    }

    for (const v of comVeiculos) {
      // Trajeto ao vivo já desenha o veículo selecionado — evita marcador/nome duplicados.
      if (trajetoDiaAtual && veiculoDestaqueId === v.id_veiculo) continue;
      const lat = Number(v.latitude);
      const lng = Number(v.longitude);
      const destacado = veiculoDestaqueId === v.id_veiculo;
      bounds.push([lat, lng]);
      const marker = L.marker([lat, lng], {
        icon: marcadorVeiculo(v, mobile, destacado, v.rastreamento_disponivel !== false),
        zIndexOffset: destacado ? 900 : 600,
      });
      vincularPopupVeiculo(
        marker,
        v,
        (veiculo) => onVeiculoClickRef.current?.(veiculo),
        v.rastreamento_disponivel !== false,
        !exibirPopupVeiculo,
      );
      marker.addTo(veiculosLayer.current);
    }

    if (
      mobile &&
      tecnicoSel &&
      lojaSel &&
      temCoordenadaTecnico(tecnicoSel) &&
      temCoordenadaLoja(lojaSel) &&
      mesmaRegiaoLojaTecnico(lojaSel, tecnicoSel)
    ) {
      const pts: L.LatLngExpression[] = [
        [Number(tecnicoSel.latitude), Number(tecnicoSel.longitude)],
        [Number(lojaSel.latitude), Number(lojaSel.longitude)],
      ];
      L.polyline(pts, {
        color: colors.orange,
        weight: 3,
        opacity: 0.85,
        dashArray: '8 8',
        lineCap: 'round',
      }).addTo(linhaLayer.current);
    }

    const pontosEnquadre = pontosEnquadreInicial(comLoja, posicoes, comVeiculos);

    if (!pontosEnquadre.length) {
      if (!vistaInicialAplicada.current) {
        mapInstance.current.setView(CENTRO_DISTRITO_FEDERAL, mobile ? ZOOM_INICIAL_DF_MOBILE : ZOOM_INICIAL_DF, {
          animate: false,
        });
      }
      return;
    }

    if (!vistaInicialAplicada.current && !usuarioMoveuMapa.current) {
      aplicarVistaInicialMapa(mapInstance.current, pontosEnquadre, mobile);
      vistaInicialAplicada.current = true;
    }
  }, [posicoes, lojas, veiculos, mapaPronto, mobile, exibirPopupVeiculo, tecnicoDestaqueId, veiculoDestaqueId, lojaDestaqueId, visivel, consultaHistorico, trajetoDiaAtual]);

  useEffect(() => {
    if (!mapaPronto || !trajetoriaLayer.current) return;
    trajetoriaLayer.current.clearLayers();

    const camadas = rotaDiaCamadas.current;
    const mapa = mapInstance.current;
    const veiculoTrajeto = veiculoTrajetoLayer.current;
    if (camadas) limparCamadasRotaDia(camadas);
    veiculoTrajeto?.clearLayers();

    const temRotaDia =
      rotaDiaVeiculo &&
      ((rotaDiaVeiculo.rotas?.length ?? 0) > 0 || (rotaDiaVeiculo.pontos?.length ?? 0) >= 2);

    let bounds: L.LatLngBounds | null = null;

    if (temRotaDia && camadas && mapa) {
      bounds = desenharRotaDiaNoMapa(
        mapa,
        camadas,
        rotaDiaVeiculo.rotas ?? [],
        rotaDiaVeiculo.pontos ?? [],
        rotaDiaVeiculo.excessos_mapa ?? [],
        rotaDiaVeiculo.limite_kmh ?? 80,
        mapaEscuroEfetivo ? { coresRota: CORES_TRAJETO_FROTA_ESCURO, corExcesso: '#EF4444' } : undefined,
      );
      trazerExcessosParaFrente(camadas);
    }

    if (veiculoTrajeto) {
      const boundsVeiculo = bounds ?? L.latLngBounds([]);
      if (trajetoDiaAtual && veiculoAoVivoTrajeto) {
        desenharMarcadorVeiculoAoVivo(
          veiculoTrajeto,
          veiculoAoVivoTrajeto,
          boundsVeiculo,
          'paneVeiculoTrajetoMobile',
        );
        if (!bounds?.isValid()) {
          const lat = Number(veiculoAoVivoTrajeto.latitude);
          const lng = Number(veiculoAoVivoTrajeto.longitude);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            bounds = L.latLngBounds([lat, lng], [lat, lng]);
          }
        }
      } else if (temRotaDia && rotaDiaVeiculo && !trajetoDiaAtual && !consultaHistorico) {
        desenharMarcadoresIgnicaoDia(
          veiculoTrajeto,
          rotaDiaVeiculo.pontos ?? [],
          {
            id_veiculo: rotaDiaVeiculo.veiculo.id_veiculo,
            placa: rotaDiaVeiculo.veiculo.placa,
            marca: rotaDiaVeiculo.veiculo.marca,
            modelo: rotaDiaVeiculo.veiculo.modelo,
          },
          boundsVeiculo,
          'paneVeiculoTrajetoMobile',
        );
      }
    }

    if (bounds && mapa) {
      const idVeiculo = veiculoDestaqueId ?? rotaDiaVeiculo?.veiculo.id_veiculo;
      if (idVeiculo != null && veiculoRotaAnterior.current !== idVeiculo) {
        veiculoRotaAnterior.current = idVeiculo;
        if (trajetoDiaAtual) {
          return;
        }
        if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
          mapa.flyTo(bounds.getCenter(), Math.max(mapa.getZoom(), 14), { duration: 0.5 });
        } else {
          mapa.flyToBounds(bounds, { padding: [72, 40], maxZoom: 16, duration: 0.5 });
        }
      }
      return;
    }

    if (!veiculoDestaqueId) veiculoRotaAnterior.current = null;

    const pontos = historicoVeiculo
      .filter((p) => temCoordenadaLatLng(p.latitude, p.longitude))
      .map((p) => [Number(p.latitude), Number(p.longitude)] as L.LatLngExpression);
    if (pontos.length < 2) return;
    L.polyline(pontos, {
      color: colors.orange,
      weight: 4,
      opacity: 0.75,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(trajetoriaLayer.current);

    if (mapa && veiculoDestaqueId != null && veiculoRotaAnterior.current !== veiculoDestaqueId) {
      veiculoRotaAnterior.current = veiculoDestaqueId;
      const bounds = L.latLngBounds(pontos as L.LatLngTuple[]);
      if (bounds.isValid()) {
        mapa.flyToBounds(bounds, { padding: [72, 40], maxZoom: 16, duration: 0.5 });
      }
    }
  }, [historicoVeiculo, rotaDiaVeiculo, mapaPronto, veiculoDestaqueId, trajetoDiaAtual, veiculoAoVivoTrajeto, consultaHistorico, mapaEscuroEfetivo]);

  useEffect(() => {
    if (!mobile || !mapaPronto || !mapInstance.current) return;
    if (veiculoDestaqueId == null) {
      veiculoFocoAnterior.current = null;
      return;
    }
    if (veiculoFocoAnterior.current === veiculoDestaqueId) return;
    const v =
      veiculoAoVivoTrajeto?.id_veiculo === veiculoDestaqueId
        ? veiculoAoVivoTrajeto
        : veiculos.find((item) => item.id_veiculo === veiculoDestaqueId);
    const lat = Number(v?.latitude);
    const lng = Number(v?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    veiculoFocoAnterior.current = veiculoDestaqueId;
    mapInstance.current.flyTo([lat, lng], 16, { duration: 0.45 });
  }, [veiculoDestaqueId, veiculos, veiculoAoVivoTrajeto, mapaPronto, mobile]);

  useEffect(() => {
    if (!mobile || !mapaPronto || !mapInstance.current) return;
    if (veiculoDestaqueId != null || rotaDiaVeiculo) return;
    if (regiaoEnquadreAnterior.current === regiaoFiltro) return;
    regiaoEnquadreAnterior.current = regiaoFiltro;

    const mapa = mapInstance.current;
    const pontos = pontosEnquadreInicial(lojas, posicoes, veiculos);
    if (!pontos.length) return;

    if (pontos.length === 1) {
      mapa.flyTo(pontos[0], Math.max(mapa.getZoom(), 13), { duration: 0.55 });
      return;
    }
    mapa.flyToBounds(pontos as L.LatLngBoundsExpression, {
      padding: [56, 28],
      maxZoom: 16,
      duration: 0.55,
    });
  }, [regiaoFiltro, lojas, posicoes, veiculos, mapaPronto, mobile, veiculoDestaqueId, rotaDiaVeiculo]);

  useEffect(() => {
    if (!veiculoDestaqueId) veiculoRotaAnterior.current = null;
  }, [veiculoDestaqueId]);

  useEffect(() => {
    if (!mapaPronto || !mapInstance.current || !mobile || !lojaDestaqueId) return;
    if (lojaFocoAnterior.current === lojaDestaqueId) return;
    lojaFocoAnterior.current = lojaDestaqueId;

    const loja = lojas.find((l) => l.id_loja === lojaDestaqueId);
    if (!loja || !temCoordenadaLoja(loja)) return;
    const mapa = mapInstance.current;
    const pontos: L.LatLngExpression[] = [[Number(loja.latitude), Number(loja.longitude)]];
    const tecnico =
      gpsAtivo !== false &&
      tecnicoDestaqueId != null
        ? posicoes.find(
            (p) =>
              p.id_usuario === tecnicoDestaqueId &&
              temCoordenadaTecnico(p) &&
              mesmaRegiaoLojaTecnico(loja, p),
          )
        : undefined;
    if (tecnico) {
      pontos.push([Number(tecnico.latitude), Number(tecnico.longitude)]);
    }
    if (pontos.length === 1) {
      mapa.flyTo(pontos[0], Math.max(mapa.getZoom(), 13), { duration: 0.55 });
      return;
    }
    mapa.flyToBounds(pontos as L.LatLngBoundsExpression, {
      padding: [120, 48],
      maxZoom: 14,
      duration: 0.55,
    });
  }, [lojaDestaqueId, tecnicoDestaqueId, mapaPronto, mobile, lojas, posicoes, gpsAtivo]);

  useEffect(() => {
    if (!lojaDestaqueId) {
      lojaFocoAnterior.current = null;
    }
  }, [lojaDestaqueId]);

  useEffect(() => {
    if (!mapaPronto || !mapInstance.current || !mapRef.current || !preencherAltura) return;
    const mapa = mapInstance.current;
    const el = mapRef.current;
    const atualizar = () => {
      mapa.invalidateSize();
      const glLayer = baseLayer.current as L.MaplibreGL | null;
      const gl = glLayer && 'getMaplibreMap' in glLayer ? glLayer.getMaplibreMap() : null;
      if (gl) {
        try {
          gl.resize();
        } catch {
          /* ignore */
        }
      }
    };
    atualizar();
    const observer = new ResizeObserver(() => atualizar());
    observer.observe(el);
    return () => observer.disconnect();
  }, [mapaPronto, preencherAltura, mapaEscuroEfetivo]);

  useEffect(() => {
    if (visivel && !visivelAnterior.current) {
      vistaInicialAplicada.current = false;
      usuarioMoveuMapa.current = false;
    }
    visivelAnterior.current = !!visivel;
  }, [visivel]);

  useEffect(() => {
    const qtd = lojas.filter(temCoordenadaLoja).length;
    if (visivel && lojasComCoordAnterior.current === 0 && qtd > 0) {
      vistaInicialAplicada.current = false;
    }
    lojasComCoordAnterior.current = qtd;
  }, [lojas, visivel]);

  useEffect(() => {
    if (!visivel || !mapaPronto || !mapInstance.current) return;
    const mapa = mapInstance.current;
    const enquadrar = () => {
      mapa.invalidateSize();
      if (usuarioMoveuMapa.current) return;
      const pontos = pontosEnquadreInicial(lojas, posicoes, veiculos);
      if (!pontos.length) return;
      aplicarVistaInicialMapa(mapa, pontos, mobile);
      vistaInicialAplicada.current = true;
    };
    enquadrar();
    const t1 = window.setTimeout(enquadrar, 120);
    const t2 = window.setTimeout(enquadrar, 450);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [visivel, mapaPronto, lojas, posicoes, veiculos, mobile]);

  useEffect(() => {
    if (!visivel || !mapaPronto || !mapInstance.current || mobile) return;
    const mapa = mapInstance.current;
    const invalidar = () => mapa.invalidateSize();
    invalidar();
    const t1 = window.setTimeout(invalidar, 0);
    const t2 = window.setTimeout(invalidar, 150);
    const t3 = window.setTimeout(invalidar, 400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [visivel, mapaPronto, mobile]);

  useEffect(() => {
    if (!autoRefreshIntervalMs || autoRefreshIntervalMs < 5000 || mobile) return;
    const id = window.setInterval(() => onAtualizarRef.current(), autoRefreshIntervalMs);
    return () => window.clearInterval(id);
  }, [autoRefreshIntervalMs, mobile]);

  const lojasNoMapa = lojas.filter(temCoordenadaLoja).length;

  return (
    <Box
      sx={
        preencherAltura
          ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%' }
          : undefined
      }
    >
      {!esconderAvisos && !gpsAtivo && !mobile && (
        <Alert severity="info" sx={{ mb: 1.25, py: 0.5, fontSize: '0.8rem', flexShrink: 0 }}>
          Rastreamento de técnicos desativado no servidor (<code>GPS_TECNICOS_ENABLED=false</code>).
        </Alert>
      )}

      {!esconderAvisos && !rastreamentoAtivo && !mobile && veiculos.length > 0 && (
        <Alert severity="warning" sx={{ mb: 1.25, py: 0.5, fontSize: '0.8rem', flexShrink: 0 }}>
          Rastreamento de veículos indisponível. Configure as credenciais Fulltrack no servidor (
          <code>FULLTRACK_API_KEY</code>/<code>FULLTRACK_SECRET_KEY</code> ou <code>APIKEY</code>/
          <code>SECRETKEY</code>).
        </Alert>
      )}

      {!esconderAvisos && rastreamentoAtivo && !mobile && veiculos.length > 0 && veiculos.every((v) => !v.rastreamento_disponivel) && (
        <Alert severity="info" sx={{ mb: 1.25, py: 0.5, fontSize: '0.8rem', flexShrink: 0 }}>
          Nenhum veículo da região com posição GPS no momento. Confira se a placa cadastrada coincide com a da
          Fulltrack.
        </Alert>
      )}

      {!esconderAvisos && lojas.length > 0 && lojasNoMapa === 0 && !mobile && (
        <Alert severity="warning" sx={{ mb: 1.25, py: 0.5, fontSize: '0.8rem', flexShrink: 0 }}>
          As lojas vinculadas ainda não têm coordenadas GPS cadastradas.
        </Alert>
      )}

      <Paper
        variant="outlined"
        elevation={mobile ? 0 : undefined}
        sx={{
          borderColor: mobile ? 'transparent' : mapaEscuroEfetivo ? 'transparent' : colors.border,
          borderRadius: mobile ? 3 : 2,
          overflow: 'hidden',
          position: 'relative',
          bgcolor: mobile ? 'transparent' : mapaEscuroEfetivo ? FROTA_MAPA_ESCURO_FUNDO : FROTA_MAPA_FUNDO,
          ...(preencherAltura
            ? { flex: 1, minHeight: { xs: 240, md: 300 }, height: '100%' }
            : { height: { xs: 280, sm: 360 } }),
          '& .leaflet-container': {
            width: '100%',
            height: '100%',
            minHeight: preencherAltura ? { xs: 240, md: 300 } : undefined,
            touchAction: 'none',
            fontFamily: 'inherit',
            ...(mapaEscuroEfetivo
              ? { background: `${FROTA_MAPA_ESCURO_FUNDO} !important` }
              : { background: `${FROTA_MAPA_FUNDO} !important` }),
          },
          /* MapLibre GL canvas fica atrás dos marcadores Leaflet */
          '& .leaflet-gl-layer, & .maplibregl-map': {
            zIndex: 0,
          },
          '& .leaflet-control-zoom': {
            border: 'none',
            boxShadow: mobile ? '0 4px 16px rgba(0,0,0,.18)' : '0 1px 4px rgba(0,0,0,.3)',
            borderRadius: mobile ? 2 : 1,
            marginRight: mobile ? 1.25 : undefined,
            marginBottom: mobile ? 1.25 : undefined,
            marginLeft: mobile ? undefined : 1.25,
            marginTop: mobile ? undefined : 1.25,
            overflow: 'hidden',
          },
          '& .leaflet-control-zoom a': {
            width: mobile ? 36 : 30,
            height: mobile ? 36 : 30,
            lineHeight: mobile ? '36px' : '30px',
            fontSize: mobile ? '1.1rem' : undefined,
          },
          '@keyframes markerTechRing': {
            '0%': { transform: 'scale(0.55)', opacity: 0.75 },
            '100%': { transform: 'scale(1.45)', opacity: 0 },
          },
          '& .marcador-tecnico-pin': {
            background: 'transparent !important',
            border: 'none !important',
          },
          '& .marker-tech-pin': {
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pointerEvents: 'auto',
          },
          '& .marker-tech-halo': {
            position: 'absolute',
            top: 2,
            width: 44,
            height: 44,
            pointerEvents: 'none',
          },
          '& .marker-tech-ring': {
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `2px solid rgba(27, 42, 107, 0.45)`,
          },
          '& .marker-tech-ring--1': {
            animation: 'markerTechRing 2.4s ease-out infinite',
          },
          '& .marker-tech-ring--2': {
            animation: 'markerTechRing 2.4s ease-out infinite 1.2s',
          },
          '& .marker-tech-pin.is-offline .marker-tech-halo': {
            display: 'none',
          },
          '& .marker-tech-core': {
            position: 'relative',
            zIndex: 2,
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: `linear-gradient(155deg, ${colors.navy} 0%, #3d52a8 55%, ${colors.navy} 100%)`,
            border: '3px solid #fff',
            boxShadow: '0 6px 18px rgba(0,0,0,.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
          '& .marker-tech-iniciais': {
            color: '#fff',
            fontSize: '0.72rem',
            fontWeight: 800,
            letterSpacing: '0.03em',
          },
          '& .marker-tech-status': {
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#22c55e',
            border: '2px solid #fff',
            boxShadow: '0 1px 4px rgba(0,0,0,.25)',
          },
          '& .marker-tech-pin.is-offline .marker-tech-core': {
            background: 'linear-gradient(155deg, #9e9e9e 0%, #bdbdbd 100%)',
          },
          '& .marker-tech-pin.is-offline .marker-tech-status': {
            background: '#bdbdbd',
          },
          '& .marker-tech-pin.is-destaque .marker-tech-core': {
            width: 46,
            height: 46,
            boxShadow: `0 0 0 4px rgba(27, 42, 107, 0.2), 0 8px 22px rgba(0,0,0,.4)`,
          },
          '& .marker-tech-pin.is-destaque .marker-tech-ring': {
            borderColor: 'rgba(232, 82, 10, 0.55)',
          },
          '& .marker-tech-pointer': {
            width: 0,
            height: 0,
            marginTop: -2,
            borderLeft: '7px solid transparent',
            borderRight: '7px solid transparent',
            borderTop: `9px solid ${colors.navy}`,
            filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.25))',
            zIndex: 1,
          },
          '& .marker-tech-pin.is-destaque .marker-tech-pointer': {
            borderTopColor: colors.orange,
          },
          '& .marker-tech-label': {
            marginTop: 2,
            padding: '2px 8px',
            borderRadius: 999,
            background: 'rgba(255,255,255,.96)',
            color: colors.navy,
            fontSize: '0.62rem',
            fontWeight: 700,
            boxShadow: '0 1px 6px rgba(0,0,0,.2)',
            whiteSpace: 'nowrap',
            maxWidth: 76,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          },
          '& .marcador-loja-marca': {
            background: 'transparent !important',
            border: 'none !important',
          },
          '& .marcador-loja-marca img': {
            width: `${TAMANHO_ICONE_LOJA}px !important`,
            height: `${TAMANHO_ICONE_LOJA}px !important`,
            maxWidth: `${TAMANHO_ICONE_LOJA}px !important`,
            maxHeight: `${TAMANHO_ICONE_LOJA}px !important`,
          },
          '& .marcador-tecnico': {
            background: 'transparent !important',
            border: 'none !important',
          },
          '& .marcador-veiculo': {
            background: 'transparent !important',
            border: 'none !important',
          },
          '& .leaflet-tooltip.tooltip-tecnico-mapa': {
            backgroundColor: colors.navy,
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '0.75rem',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(0,0,0,.25)',
          },
          '& .leaflet-tooltip.tooltip-tecnico-mapa.leaflet-tooltip-top:before': {
            borderTopColor: colors.navy,
          },
          '& .leaflet-tooltip.tooltip-loja-mapa': {
            backgroundColor: '#fff',
            color: colors.navy,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '0.75rem',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(0,0,0,.2)',
            minWidth: 280,
            maxWidth: 360,
            whiteSpace: 'normal',
          },
          '& .leaflet-tooltip.tooltip-loja-mapa.leaflet-tooltip-top:before': {
            borderTopColor: '#fff',
          },
          '& .leaflet-popup.popup-loja-mapa .leaflet-popup-content': {
            margin: '10px 14px',
            minWidth: 260,
          },
          '& .info-loja-mapa': {
            minWidth: 252,
          },
          '& .info-loja-mapa-nome': {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          },
          '& .info-loja-mapa-marca': {
            width: 18,
            height: 18,
            objectFit: 'contain',
            flexShrink: 0,
          },
          '& .info-loja-mapa strong': {
            color: colors.navy,
            fontSize: '0.8rem',
            lineHeight: 1.35,
            flex: 1,
            minWidth: 0,
          },
          '& .info-loja-mapa-endereco': {
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            marginTop: '5px',
          },
          '& .info-loja-mapa-pin': {
            flexShrink: 0,
            marginTop: '1px',
            lineHeight: 0,
            display: 'inline-flex',
          },
          '& .info-loja-mapa-endereco--so-icone': {
            justifyContent: 'flex-end',
            marginTop: '4px',
          },
          '& .info-loja-mapa-endereco small': {
            flex: 1,
            lineHeight: 1.4,
            fontSize: '0.7rem',
            fontWeight: 400,
            color: '#666',
          },
          '& .btn-copiar-endereco-loja': {
            flexShrink: 0,
            marginTop: '1px',
            padding: '2px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: '#bdbdbd',
            opacity: 0.45,
            lineHeight: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '3px',
            transition: 'opacity 0.15s, color 0.15s',
            '&:hover': {
              opacity: 0.9,
              color: '#757575',
            },
          },
        }}
      >
        <Box ref={mapRef} sx={{ width: '100%', height: '100%' }} />

        {exibirAtualizar && (
          <Box sx={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}>
            <Tooltip title="Atualizar localizações">
              <span>
                <IconButton
                  size="small"
                  onClick={onAtualizar}
                  disabled={carregando}
                  aria-label="Atualizar mapa"
                  sx={{
                    bgcolor: 'background.paper',
                    boxShadow: '0 1px 4px rgba(0,0,0,.3)',
                    '&:hover': { bgcolor: 'grey.100' },
                  }}
                >
                  {carregando ? <CircularProgress size={18} /> : <RefreshIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        )}

        {exibirAlternarMapa && (
        <Box
          sx={{
            position: 'absolute',
            left: mobile ? 'auto' : 10,
            right: mobile ? 10 : 'auto',
            bottom: mobile ? 72 : 10,
            zIndex: 1000,
            display: 'flex',
            flexDirection: mobile ? 'row' : 'column',
            gap: 0.75,
            pointerEvents: 'none',
          }}
        >
          <Paper
            elevation={mobile ? 4 : 3}
            sx={{
              display: 'flex',
              pointerEvents: 'auto',
              borderRadius: mobile ? 999 : 0.75,
              overflow: 'hidden',
            }}
          >
            <Box
              component="button"
              type="button"
              onClick={() => setTipoMapa('rua')}
              sx={{
                ...btnMapaSx,
                px: mobile ? 1.5 : 1.25,
                py: mobile ? 0.85 : 0.6,
                fontSize: mobile ? '0.75rem' : '0.7rem',
                bgcolor: tipoMapa === 'rua' ? (mobile ? colors.navy : 'grey.200') : 'background.paper',
                color: tipoMapa === 'rua' && mobile ? '#fff' : 'text.primary',
                border: 'none',
                cursor: 'pointer',
                borderRight: '1px solid',
                borderColor: 'divider',
              }}
            >
              Mapa
            </Box>
            <Box
              component="button"
              type="button"
              onClick={() => setTipoMapa('satelite')}
              sx={{
                ...btnMapaSx,
                px: mobile ? 1.5 : 1.25,
                py: mobile ? 0.85 : 0.6,
                fontSize: mobile ? '0.75rem' : '0.7rem',
                bgcolor: tipoMapa === 'satelite' ? (mobile ? colors.navy : 'grey.200') : 'background.paper',
                color: tipoMapa === 'satelite' && mobile ? '#fff' : 'text.primary',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Satélite
            </Box>
          </Paper>

          {!mobile && (
          <Paper
            elevation={3}
            sx={{
              pointerEvents: 'auto',
              borderRadius: 0.75,
              overflow: 'hidden',
              alignSelf: 'flex-start',
            }}
          >
            <Box
              component="button"
              type="button"
              onClick={() => setTrafegoAtivo((v) => !v)}
              aria-pressed={trafegoAtivo}
              sx={{
                ...btnMapaSx,
                bgcolor: trafegoAtivo ? 'grey.200' : 'background.paper',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
              }}
            >
              <Box
                sx={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  bgcolor: trafegoAtivo ? '#34a853' : 'grey.400',
                }}
              />
              Tráfego
            </Box>
          </Paper>
          )}
        </Box>
        )}

        {!ocultarPlaceholder &&
          posicoes.length === 0 &&
          lojas.length === 0 &&
          veiculos.length === 0 &&
          historicoVeiculo.length === 0 &&
          !rotaDiaVeiculo &&
          !carregando && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(255,255,255,0.85)',
              pointerEvents: 'none',
              zIndex: 500,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Vincule lojas, técnicos e veículos à região para ver o mapa
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
