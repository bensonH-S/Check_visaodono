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
import type { FrotaTecnicoPosicao } from '../../api/client';
import { colors } from '../../theme/tokens';
import { formatDataHoraBrasilia } from '../../utils/dateBr';

/** Zoom fixo quando há só um técnico (~nível de rua/bairro no Leaflet). */
const ZOOM_TECNICO_UNICO = 15;
/** Limite máximo ao enquadrar vários técnicos. */
const ZOOM_MAXIMO_ENQUADRE = 15;
const ZOOM_PADRAO_BRASIL = 4;

type TipoMapa = 'rua' | 'satelite';

function escapeHtml(texto: string) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function marcadorComNome(nome: string) {
  const label = escapeHtml(nome);
  const largura = Math.min(Math.max(nome.length * 6.5 + 20, 56), 220);
  const altura = 38;

  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;width:${largura}px;">
      <div style="
        max-width:100%;padding:3px 8px;border-radius:6px;
        background:${colors.navy};color:#fff;font-size:11px;font-weight:600;
        border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;
      ">${label}</div>
      <div style="
        width:0;height:0;margin-top:-1px;
        border-left:7px solid transparent;border-right:7px solid transparent;
        border-top:9px solid ${colors.navy};
      "></div>
    </div>`,
    iconSize: [largura, altura],
    iconAnchor: [largura / 2, altura],
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

function temCoordenada(p: FrotaTecnicoPosicao) {
  return (
    p.latitude != null &&
    p.longitude != null &&
    Number.isFinite(Number(p.latitude)) &&
    Number.isFinite(Number(p.longitude))
  );
}

type Props = {
  posicoes: FrotaTecnicoPosicao[];
  carregando?: boolean;
  gpsAtivo?: boolean;
  onAtualizar: () => void;
};

const btnMapaSx = {
  px: 1.5,
  py: 0.75,
  minWidth: 0,
  fontSize: '0.75rem',
  fontWeight: 600,
  lineHeight: 1.2,
  textTransform: 'none' as const,
  borderRadius: 0,
  color: 'text.primary',
  '&:hover': { bgcolor: 'grey.100' },
};

export default function FrotaLocalizacaoMap({ posicoes, carregando, gpsAtivo, onAtualizar }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);
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

    markersLayer.current = L.layerGroup().addTo(mapa);
    mapInstance.current = mapa;
    aplicarCamadas('rua', false);
    setMapaPronto(true);

    return () => {
      mapa.remove();
      mapInstance.current = null;
      markersLayer.current = null;
      baseLayer.current = null;
      setMapaPronto(false);
    };
  }, [aplicarCamadas]);

  useEffect(() => {
    if (!mapaPronto) return;
    aplicarCamadas(tipoMapa, trafegoAtivo);
  }, [tipoMapa, trafegoAtivo, mapaPronto, aplicarCamadas]);

  useEffect(() => {
    if (!mapaPronto || !markersLayer.current || !mapInstance.current) return;

    markersLayer.current.clearLayers();
    const comGps = posicoes.filter(temCoordenada);

    if (!comGps.length) {
      mapInstance.current.setView([-15.78, -47.93], ZOOM_PADRAO_BRASIL);
      return;
    }

    const bounds: L.LatLngExpression[] = [];

    for (const p of comGps) {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      bounds.push([lat, lng]);
      const marker = L.marker([lat, lng], { icon: marcadorComNome(p.nome) });
      marker.bindPopup(
        `<strong>${escapeHtml(p.nome)}</strong>${p.email ? `<br/>${escapeHtml(p.email)}` : ''}<br/><small>${formatarAtualizado(p.atualizado_em)}</small>`,
      );
      marker.addTo(markersLayer.current);
    }

    if (bounds.length === 1) {
      mapInstance.current.setView(bounds[0], ZOOM_TECNICO_UNICO);
    } else {
      mapInstance.current.fitBounds(bounds as L.LatLngBoundsExpression, {
        padding: [48, 48],
        maxZoom: ZOOM_MAXIMO_ENQUADRE,
      });
    }
  }, [posicoes, mapaPronto]);

  const comLocal = posicoes.filter(temCoordenada).length;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {comLocal} de {posicoes.length} técnico{posicoes.length !== 1 ? 's' : ''} com localização no mapa
          {!gpsAtivo ? ' (rastreamento desativado)' : ''}
        </Typography>
        <Tooltip title="Atualizar localizações">
          <span>
            <IconButton size="small" onClick={onAtualizar} disabled={carregando} aria-label="Atualizar mapa">
              {carregando ? <CircularProgress size={20} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {!gpsAtivo && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Rastreamento desativado no servidor (<code>GPS_TECNICOS_ENABLED=false</code>).
        </Alert>
      )}

      <Paper
        variant="outlined"
        sx={{
          borderColor: colors.border,
          borderRadius: 2,
          overflow: 'hidden',
          position: 'relative',
          height: { xs: 320, sm: 420 },
          '& .leaflet-control-zoom': {
            border: 'none',
            boxShadow: '0 1px 4px rgba(0,0,0,.3)',
            borderRadius: 1,
            marginLeft: 1.5,
            marginTop: 1.5,
          },
        }}
      >
        <Box ref={mapRef} sx={{ width: '100%', height: '100%' }} />

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
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: trafegoAtivo ? '#34a853' : 'grey.400',
                }}
              />
              Tráfego
            </Box>
          </Paper>
        </Box>

        {posicoes.length === 0 && !carregando && (
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
            <Typography color="text.secondary">Vincule técnicos à região para ver o mapa</Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
