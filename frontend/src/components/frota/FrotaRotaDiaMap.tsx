import { useEffect, useRef } from 'react';
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

export default function FrotaRotaDiaMap({ rotas, pontos = [], altura = '100%' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const mapa = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView(
      [-15.78, -47.93],
      5,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(mapa);
    layerRef.current = L.layerGroup().addTo(mapa);
    mapRef.current = mapa;
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const mapa = mapRef.current;
    const layer = layerRef.current;
    if (!mapa || !layer) return;

    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [];
    const rotasDesenho =
      rotas.length > 0
        ? rotas
        : pontos.length > 0
          ? [{ id: 1, pontos, km: 0, inicio: pontos[0]?.atualizado_em, fim: pontos[pontos.length - 1]?.atualizado_em }]
          : [];

    rotasDesenho.forEach((rota, idx) => {
      if (!rota.pontos.length) return;
      const cor = CORES_ROTAS[idx % CORES_ROTAS.length];
      const coords = rota.pontos.map((p) => [p.latitude, p.longitude] as L.LatLngExpression);
      bounds.push(...coords);

      if (coords.length >= 2) {
        L.polyline(coords, {
          color: cor,
          weight: 4,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(layer);
      } else if (coords.length === 1) {
        L.circleMarker(coords[0], {
          radius: 8,
          color: '#ffffff',
          weight: 2,
          fillColor: cor,
          fillOpacity: 1,
        }).addTo(layer);
      }

      const inicio = rota.pontos[0];
      const fim = rota.pontos[rota.pontos.length - 1];
      L.circleMarker([inicio.latitude, inicio.longitude], {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: cor,
        fillOpacity: 1,
      })
        .bindTooltip(`Rota ${rota.id} — início`, { direction: 'top' })
        .addTo(layer);

      if (rota.pontos.length > 1) {
        L.circleMarker([fim.latitude, fim.longitude], {
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

    if (!bounds.length) {
      mapa.setView([-15.78, -47.93], 5);
      return;
    }
    if (bounds.length === 1) {
      mapa.setView(bounds[0], 14);
      return;
    }
    mapa.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40], maxZoom: 16 });
    window.setTimeout(() => mapa.invalidateSize(), 150);
  }, [rotas, pontos]);

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: altura,
        minHeight: 320,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        bgcolor: '#f8fafc',
      }}
    />
  );
}
