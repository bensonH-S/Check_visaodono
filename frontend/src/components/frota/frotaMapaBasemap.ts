import L from 'leaflet';

/** Fundo neutro enquanto os tiles carregam (alinha ao Positron). */
export const FROTA_MAPA_FUNDO = '#f0efeb';

/**
 * Basemap limpo estilo “profissional”: tom bege/cinza, vias neutras,
 * poucos rótulos e sem POI saturados (Carto Positron).
 */
export function criarCamadaBasemapLimpo(opcoes?: { mobile?: boolean; semRotulos?: boolean }) {
  const mobile = opcoes?.mobile ?? false;
  const estilo = opcoes?.semRotulos ? 'light_nolabels' : 'light_all';
  return L.tileLayer(`https://{s}.basemaps.cartocdn.com/${estilo}/{z}/{x}/{y}{r}.png`, {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
    updateWhenIdle: mobile,
    keepBuffer: mobile ? 4 : 2,
    updateWhenZooming: !mobile,
  });
}

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
