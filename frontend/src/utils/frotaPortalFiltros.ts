import type { FrotaVeiculo } from '../api/client';

function parseDataFiltro(iso: string): Date {
  const parte = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(parte) && iso.length <= 10) {
    return new Date(`${parte}T12:00:00`);
  }
  return new Date(iso);
}

export function dataDentroIntervalo(iso: string, inicio: string, fim: string): boolean {
  if (!inicio && !fim) return true;
  const d = parseDataFiltro(iso);
  if (Number.isNaN(d.getTime())) return false;
  if (inicio) {
    const start = parseDataFiltro(inicio);
    start.setHours(0, 0, 0, 0);
    if (d < start) return false;
  }
  if (fim) {
    const end = parseDataFiltro(fim);
    end.setHours(23, 59, 59, 999);
    if (d > end) return false;
  }
  return true;
}

export function matchVeiculo(
  item: { id_veiculo: number; placa: string },
  idVeiculo: number | null,
  busca: string,
  veiculos?: FrotaVeiculo[],
): boolean {
  if (idVeiculo != null) return item.id_veiculo === idVeiculo;
  const q = busca.trim().toLowerCase();
  if (!q) return true;
  if (item.placa.toLowerCase().includes(q)) return true;
  const v = veiculos?.find((x) => x.id_veiculo === item.id_veiculo);
  if (!v) return false;
  const hay = [v.placa, v.marca, v.modelo].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q);
}

export function matchVeiculoObj(v: FrotaVeiculo, idVeiculo: number | null, busca: string): boolean {
  if (idVeiculo != null) return v.id_veiculo === idVeiculo;
  const q = busca.trim().toLowerCase();
  if (!q) return true;
  const hay = [v.placa, v.marca, v.modelo].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q);
}
