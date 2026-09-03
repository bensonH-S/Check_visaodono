import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { colors } from '../../theme/tokens';
import { useAppTheme } from '../../context/ThemeContext';
import {
  FROTA_MAPA_ESCURO_FUNDO,
  FROTA_MAPA_FUNDO,
  criarCamadaBasemapClaro,
  criarCamadaBasemapEscuro,
} from '../frota/frotaMapaBasemap';

const PIN_ICON = L.divIcon({
  className: '',
  html: `<div style="
    width:24px;height:24px;border-radius:50% 50% 50% 0;
    background:${colors.navy};transform:rotate(-45deg);
    border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

type TipoMapa = 'rua' | 'satelite';

const btnMapaSx = {
  px: 1.25,
  py: 0.5,
  fontSize: '0.75rem',
  fontWeight: 500,
  color: 'text.primary',
  fontFamily: 'inherit',
};

function criarCamadaSatelite() {
  return L.tileLayer('https://{s}.google.com/vt/lyrs=y&hl=pt-BR&x={x}&y={y}&z={z}', {
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google',
    maxZoom: 21,
  });
}

type Props = {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: number;
};

function coordenadaValida(lat: number | null, lng: number | null) {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export default function LojaMiniMap({ latitude, longitude, onChange, height = 220 }: Props) {
  const { mode } = useAppTheme();
  const mapaEscuro = mode === 'dark';
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const camadaRef = useRef<L.Layer | null>(null);
  const onChangeRef = useRef(onChange);
  const [tipoMapa, setTipoMapa] = useState<TipoMapa>('rua');

  onChangeRef.current = onChange;

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const temPos = coordenadaValida(latitude, longitude);
    const center: L.LatLngExpression = temPos ? [latitude!, longitude!] : [-15.7801, -47.9292];
    const zoom = temPos ? 16 : 11;

    const mapa = L.map(mapRef.current, {
      center,
      zoom,
      zoomControl: true,
    });

    if (temPos) {
      const marker = L.marker([latitude!, longitude!], { icon: PIN_ICON, draggable: true });
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onChangeRef.current(pos.lat, pos.lng);
      });
      marker.addTo(mapa);
      markerRef.current = marker;
    }

    mapa.on('click', (e) => {
      const { lat, lng } = e.latlng;
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const marker = L.marker([lat, lng], { icon: PIN_ICON, draggable: true });
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onChangeRef.current(pos.lat, pos.lng);
        });
        marker.addTo(mapa);
        markerRef.current = marker;
      }
      onChangeRef.current(lat, lng);
    });

    mapInstance.current = mapa;

    return () => {
      mapa.remove();
      mapInstance.current = null;
      markerRef.current = null;
      camadaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init único
  }, []);

  useEffect(() => {
    const mapa = mapInstance.current;
    if (!mapa) return;

    if (camadaRef.current) {
      mapa.removeLayer(camadaRef.current);
    }

    if (tipoMapa === 'satelite') {
      camadaRef.current = criarCamadaSatelite();
      mapa.getContainer().style.background = FROTA_MAPA_FUNDO;
    } else {
      camadaRef.current = mapaEscuro ? criarCamadaBasemapEscuro() : criarCamadaBasemapClaro();
      mapa.getContainer().style.background = mapaEscuro ? FROTA_MAPA_ESCURO_FUNDO : FROTA_MAPA_FUNDO;
    }
    camadaRef.current.addTo(mapa);
  }, [tipoMapa, mapaEscuro]);

  useEffect(() => {
    const mapa = mapInstance.current;
    if (!mapa) return;

    if (!coordenadaValida(latitude, longitude)) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([latitude!, longitude!]);
    } else {
      const marker = L.marker([latitude!, longitude!], { icon: PIN_ICON, draggable: true });
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onChangeRef.current(pos.lat, pos.lng);
      });
      marker.addTo(mapa);
      markerRef.current = marker;
    }

    mapa.setView([latitude!, longitude!], Math.max(mapa.getZoom(), 15), { animate: true });
  }, [latitude, longitude]);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: 1,
        overflow: 'hidden',
        border: `1px solid ${colors.border}`,
        bgcolor: mapaEscuro ? FROTA_MAPA_ESCURO_FUNDO : FROTA_MAPA_FUNDO,
        '& .leaflet-control-zoom': { border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,.2)' },
        '& .leaflet-gl-layer, & .maplibregl-map': { zIndex: 0 },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 1000,
          display: 'flex',
          gap: 0,
          bgcolor: 'background.paper',
          borderRadius: 1,
          boxShadow: 1,
          overflow: 'hidden',
        }}
        component={Paper}
        elevation={2}
      >
        <Box
          component="button"
          type="button"
          onClick={() => setTipoMapa('rua')}
          sx={{
            ...btnMapaSx,
            border: 'none',
            bgcolor: tipoMapa === 'rua' ? 'action.selected' : 'transparent',
            cursor: 'pointer',
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
            border: 'none',
            bgcolor: tipoMapa === 'satelite' ? 'action.selected' : 'transparent',
            cursor: 'pointer',
          }}
        >
          Satélite
        </Box>
      </Box>
      <Box ref={mapRef} sx={{ width: '100%', height: '100%' }} />
    </Box>
  );
}
