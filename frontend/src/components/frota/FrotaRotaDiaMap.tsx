import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Box from '@mui/material/Box';
import type { FrotaRotaDiaSegmento, FrotaVeiculoHistoricoPonto } from '../../api/client';
import { colors } from '../../theme/tokens';

const CORES_ROTAS = ['#1b2a6b', '#0f766e', '#ca8a04', '#dc2626', '#7c3aed', '#0891b2'];

type Props = {
  rotas: FrotaRotaDiaSegmento[];
  pontos?: FrotaVeiculoHistoricoPonto[];
  altura?: number | string;
};

function coordenadaPonto(p: FrotaVeiculoHistoricoPonto): L.LatLngExpression | null {
  const lat = Number(p.latitude);
  const lng = Number(p.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
}

function coordsRota(pontos: FrotaVeiculoHistoricoPonto[]) {
  return pontos.map(coordenadaPonto).filter((c): c is L.LatLngExpression => c != null);
}

function prepararRotasDesenho(rotas: FrotaRotaDiaSegmento[], pontos: FrotaVeiculoHistoricoPonto[]) {
  if (pontos.length >= 2) {
    return [
      {
        id: 0,
        pontos,
        km: 0,
        inicio: pontos[0]?.atualizado_em,
        fim: pontos[pontos.length - 1]?.atualizado_em,
      },
    ];
  }

  return rotas.filter((r) => (r.pontos?.length ?? 0) > 0);
}

export default function FrotaRotaDiaMap({ rotas, pontos = [], altura = '100%' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const boundsRef = useRef<L.LatLngBounds | null>(null);
  const [mapaPronto, setMapaPronto] = useState(false);

  const ajustarVista = useCallback((mapa: L.Map, bounds: L.LatLngBounds | null) => {
    if (!bounds || !bounds.isValid()) {
      mapa.setView([-15.78, -47.93], 5);
      return;
    }
    if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
      mapa.setView(bounds.getCenter(), 14);
      return;
    }
    mapa.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, []);

  const desenharRotas = useCallback(() => {
    const mapa = mapRef.current;
    const layer = layerRef.current;
    if (!mapa || !layer) return;

    layer.clearLayers();
    boundsRef.current = null;

    const rotasDesenho = prepararRotasDesenho(rotas, pontos);
    const bounds = L.latLngBounds([]);

    rotasDesenho.forEach((rota, idx) => {
      const coords = coordsRota(rota.pontos ?? []);
      if (!coords.length) return;

      const cor = CORES_ROTAS[idx % CORES_ROTAS.length];
      coords.forEach((c) => bounds.extend(c));

      if (coords.length >= 2) {
        L.polyline(coords, {
          color: cor,
          weight: 5,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(layer);
      } else {
        L.circleMarker(coords[0], {
          radius: 8,
          color: '#ffffff',
          weight: 2,
          fillColor: cor,
          fillOpacity: 1,
        }).addTo(layer);
      }

      const inicio = coords[0];
      const fim = coords[coords.length - 1];

      L.circleMarker(inicio, {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: cor,
        fillOpacity: 1,
      })
        .bindTooltip(`Rota ${rota.id} — início`, { direction: 'top' })
        .addTo(layer);

      if (coords.length > 1) {
        L.circleMarker(fim, {
          radius: 6,
          color: '#ffffff',
          weight: 2,
          fillColor: colors.orange,
          fillOpacity: 1,
        })
          .bindTooltip(`Rota ${rota.id} — fim`, { direction: 'top' })
          .addTo(layer);
      }
    });

    boundsRef.current = bounds.isValid() ? bounds : null;
    ajustarVista(mapa, boundsRef.current);
    window.requestAnimationFrame(() => {
      mapa.invalidateSize(false);
      ajustarVista(mapa, boundsRef.current);
    });
  }, [rotas, pontos, ajustarVista]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const mapa = L.map(container, { zoomControl: true, attributionControl: true }).setView(
      [-15.78, -47.93],
      5,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(mapa);
    layerRef.current = L.layerGroup().addTo(mapa);
    mapRef.current = mapa;

    const observer = new ResizeObserver(() => {
      mapa.invalidateSize(false);
      ajustarVista(mapa, boundsRef.current);
    });
    observer.observe(container);

    setMapaPronto(true);

    return () => {
      observer.disconnect();
      mapa.remove();
      mapRef.current = null;
      layerRef.current = null;
      boundsRef.current = null;
      setMapaPronto(false);
    };
  }, [ajustarVista]);

  useEffect(() => {
    if (!mapaPronto) return;
    desenharRotas();
  }, [mapaPronto, desenharRotas]);

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: altura,
        minHeight: 360,
        flex: 1,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        bgcolor: '#f8fafc',
      }}
    />
  );
}
