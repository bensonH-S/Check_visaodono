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
import type { FrotaRegiaoLoja, FrotaTecnicoPosicao } from '../../api/client';
import { colors } from '../../theme/tokens';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import { iconeMarcaLojaPorNome } from '../../utils/marcaLojaMapa';

/** Zoom fixo quando há só um ponto (~nível de bairro). */
const ZOOM_PONTO_UNICO = 13;
/** Limite máximo ao enquadrar vários pontos. */
const ZOOM_MAXIMO_ENQUADRE = 13;
const ZOOM_PADRAO_BRASIL = 4;
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

function htmlInfoLoja(loja: FrotaRegiaoLoja) {
  const endereco = formatarEnderecoLoja(loja);
  const textoCopiar = endereco || loja.name;
  const iconBtn = `<button type="button" class="btn-copiar-endereco-loja" data-copiar-endereco="${escapeHtml(textoCopiar)}" aria-label="Copiar endereço" title="Copiar endereço">${iconeCopiarSvg()}</button>`;
  const enderecoHtml = endereco
    ? `<div class="info-loja-mapa-endereco"><small>${escapeHtml(endereco)}</small>${iconBtn}</div>`
    : `<div class="info-loja-mapa-endereco info-loja-mapa-endereco--so-icone">${iconBtn}</div>`;
  return `<div class="info-loja-mapa"><strong>${escapeHtml(loja.name)}</strong>${enderecoHtml}</div>`;
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

function marcadorTecnico() {
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

function marcadorLoja(loja: Pick<FrotaRegiaoLoja, 'name' | 'bk_number'>) {
  const src = escapeHtml(iconeMarcaLojaPorNome(loja));
  const size = TAMANHO_ICONE_LOJA;
  const altura = size + 6;
  return L.divIcon({
    className: 'marcador-loja-marca',
    html: `<div style="display:flex;flex-direction:column;align-items:center;width:${size}px;line-height:0;">
      <div style="width:${size}px;height:${size}px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:3px;box-shadow:0 1px 2px rgba(0,0,0,.35);">
        <img src="${src}" alt="" style="width:${size}px;height:${size}px;max-width:${size}px;max-height:${size}px;object-fit:contain;display:block;" />
      </div>
      <div style="width:0;height:0;margin-top:-1px;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid #fff;filter:drop-shadow(0 1px 1px rgba(0,0,0,.25));"></div>
    </div>`,
    iconSize: [size, altura],
    iconAnchor: [size / 2, altura],
    popupAnchor: [0, -altura],
  });
}

function criarCamadaRua() {
  return L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
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
  carregando?: boolean;
  gpsAtivo?: boolean;
  onAtualizar: () => void;
  /** Preenche a altura disponível do painel pai (aba Localização). */
  preencherAltura?: boolean;
  /** Aba Localização visível — força recálculo do tamanho do Leaflet. */
  visivel?: boolean;
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
  carregando,
  gpsAtivo,
  onAtualizar,
  preencherAltura = false,
  visivel = true,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const tecnicosLayer = useRef<L.LayerGroup | null>(null);
  const lojasLayer = useRef<L.LayerGroup | null>(null);
  const baseLayer = useRef<L.TileLayer | null>(null);
  const [mapaPronto, setMapaPronto] = useState(false);
  const [tipoMapa, setTipoMapa] = useState<TipoMapa>('rua');
  const [trafegoAtivo, setTrafegoAtivo] = useState(false);

  const aplicarCamadas = useCallback((tipo: TipoMapa, trafego: boolean) => {
    const mapa = mapInstance.current;
    if (!mapa) return;

    if (baseLayer.current) {
      mapa.removeLayer(baseLayer.current);
      baseLayer.current = null;
    }

    if (tipo === 'rua') {
      baseLayer.current = (trafego ? criarCamadaRuaComTrafego() : criarCamadaRua()).addTo(mapa);
    } else {
      baseLayer.current = (trafego ? criarCamadaSateliteComTrafego() : criarCamadaSatelite()).addTo(mapa);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const mapa = L.map(mapRef.current, {
      center: [-15.78, -47.93],
      zoom: ZOOM_PADRAO_BRASIL,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topleft' }).addTo(mapa);

    tecnicosLayer.current = L.layerGroup().addTo(mapa);
    lojasLayer.current = L.layerGroup().addTo(mapa);
    mapInstance.current = mapa;
    aplicarCamadas('rua', false);
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
      lojasLayer.current = null;
      baseLayer.current = null;
      setMapaPronto(false);
    };
  }, [aplicarCamadas]);

  useEffect(() => {
    if (!mapaPronto) return;
    aplicarCamadas(tipoMapa, trafegoAtivo);
  }, [tipoMapa, trafegoAtivo, mapaPronto, aplicarCamadas]);

  useEffect(() => {
    if (!mapaPronto || !tecnicosLayer.current || !lojasLayer.current || !mapInstance.current) return;

    tecnicosLayer.current.clearLayers();
    lojasLayer.current.clearLayers();

    const comGps = posicoes.filter(temCoordenadaTecnico);
    const comLoja = lojas.filter(temCoordenadaLoja);
    const bounds: L.LatLngExpression[] = [];
    const lojasCoords = comLoja.map((l) => ({
      lat: Number(l.latitude),
      lng: Number(l.longitude),
    }));
    const ocupacaoTecnico = new Map<string, number>();

    for (const l of comLoja) {
      const lat = Number(l.latitude);
      const lng = Number(l.longitude);
      bounds.push([lat, lng]);
      const marker = L.marker([lat, lng], { icon: marcadorLoja(l), zIndexOffset: 200 });
      const conteudoLoja = htmlInfoLoja(l);
      marker.bindTooltip(conteudoLoja, {
        direction: 'top',
        offset: [0, -TAMANHO_ICONE_LOJA - 10],
        opacity: 1,
        className: 'tooltip-loja-mapa',
        sticky: true,
        interactive: true,
      });
      marker.bindPopup(conteudoLoja, { maxWidth: 360, className: 'popup-loja-mapa' });
      marker.addTo(lojasLayer.current);
    }

    for (const p of comGps) {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      const [latMarcador, lngMarcador] = posicaoMarcadorTecnico(lat, lng, lojasCoords, ocupacaoTecnico);
      bounds.push([latMarcador, lngMarcador]);
      const marker = L.marker([latMarcador, lngMarcador], { icon: marcadorTecnico(), zIndexOffset: 500 });
      marker.bindTooltip(escapeHtml(p.nome), {
        direction: 'top',
        offset: [0, -TAMANHO_ICONE_TECNICO - 8],
        opacity: 0.95,
        className: 'tooltip-tecnico-mapa',
      });
      marker.bindPopup(
        `<strong>${escapeHtml(p.nome)}</strong>${p.email ? `<br/>${escapeHtml(p.email)}` : ''}<br/><small>${formatarAtualizado(p.atualizado_em)}</small>`,
      );
      marker.addTo(tecnicosLayer.current);
    }

    if (!bounds.length) {
      mapInstance.current.setView([-15.78, -47.93], ZOOM_PADRAO_BRASIL);
      return;
    }

    if (bounds.length === 1) {
      mapInstance.current.setView(bounds[0], ZOOM_PONTO_UNICO);
    } else {
      mapInstance.current.fitBounds(bounds as L.LatLngBoundsExpression, {
        padding: [40, 40],
        maxZoom: ZOOM_MAXIMO_ENQUADRE,
      });
    }
  }, [posicoes, lojas, mapaPronto]);

  useEffect(() => {
    if (!mapaPronto || !mapInstance.current || !mapRef.current || !preencherAltura) return;
    const mapa = mapInstance.current;
    const el = mapRef.current;
    const atualizar = () => mapa.invalidateSize();
    atualizar();
    const observer = new ResizeObserver(() => atualizar());
    observer.observe(el);
    return () => observer.disconnect();
  }, [mapaPronto, preencherAltura]);

  useEffect(() => {
    if (!visivel || !mapaPronto || !mapInstance.current) return;
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
  }, [visivel, mapaPronto]);

  const lojasNoMapa = lojas.filter(temCoordenadaLoja).length;

  return (
    <Box
      sx={
        preencherAltura
          ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%' }
          : undefined
      }
    >
      {!gpsAtivo && (
        <Alert severity="info" sx={{ mb: 1.25, py: 0.5, fontSize: '0.8rem', flexShrink: 0 }}>
          Rastreamento desativado no servidor (<code>GPS_TECNICOS_ENABLED=false</code>).
        </Alert>
      )}

      {lojas.length > 0 && lojasNoMapa === 0 && (
        <Alert severity="warning" sx={{ mb: 1.25, py: 0.5, fontSize: '0.8rem', flexShrink: 0 }}>
          As lojas vinculadas ainda não têm coordenadas GPS cadastradas.
        </Alert>
      )}

      <Paper
        variant="outlined"
        sx={{
          borderColor: colors.border,
          borderRadius: 2,
          overflow: 'hidden',
          position: 'relative',
          ...(preencherAltura
            ? { flex: 1, minHeight: { xs: 240, md: 300 }, height: '100%' }
            : { height: { xs: 280, sm: 360 } }),
          '& .leaflet-container': {
            width: '100%',
            height: '100%',
            minHeight: preencherAltura ? { xs: 240, md: 300 } : undefined,
          },
          '& .leaflet-control-zoom': {
            border: 'none',
            boxShadow: '0 1px 4px rgba(0,0,0,.3)',
            borderRadius: 1,
            marginLeft: 1.25,
            marginTop: 1.25,
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
          '& .info-loja-mapa strong': {
            color: colors.navy,
            fontSize: '0.8rem',
            lineHeight: 1.35,
            display: 'block',
          },
          '& .info-loja-mapa-endereco': {
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            marginTop: '5px',
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

        <Box
          sx={{
            position: 'absolute',
            left: 10,
            bottom: 10,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.75,
            pointerEvents: 'none',
          }}
        >
          <Paper
            elevation={3}
            sx={{
              display: 'flex',
              pointerEvents: 'auto',
              borderRadius: 0.75,
              overflow: 'hidden',
            }}
          >
            <Box
              component="button"
              type="button"
              onClick={() => setTipoMapa('rua')}
              sx={{
                ...btnMapaSx,
                bgcolor: tipoMapa === 'rua' ? 'grey.200' : 'background.paper',
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
                bgcolor: tipoMapa === 'satelite' ? 'grey.200' : 'background.paper',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Satélite
            </Box>
          </Paper>

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
        </Box>

        {posicoes.length === 0 && lojas.length === 0 && !carregando && (
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
              Vincule lojas e técnicos à região para ver o mapa
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
