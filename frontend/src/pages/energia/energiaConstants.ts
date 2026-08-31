export const CONCESSIONARIAS = [
  { value: 'Concessionária de energia', label: 'Concessionária de energia (genérico)' },
  { value: 'Neoenergia', label: 'Neoenergia' },
  { value: 'Equatorial', label: 'Equatorial' },
  { value: 'Enel', label: 'Enel' },
  { value: 'Energisa', label: 'Energisa' },
  { value: 'Cemig', label: 'Cemig' },
  { value: 'Light', label: 'Light' },
  { value: 'CPFL', label: 'CPFL' },
  { value: 'Outra', label: 'Outra' },
] as const;

export const TIPOS_OCORRENCIA = [
  { value: 'falta_energia', label: 'Falta de energia' },
  { value: 'oscilacao', label: 'Oscilação / queda' },
  { value: 'surto', label: 'Surto elétrico' },
  { value: 'equipamento_queimado', label: 'Equipamento queimado / danificado' },
  { value: 'outro', label: 'Outro' },
] as const;

export type EnergiaStatus = 'aberto' | 'em_andamento' | 'finalizado' | 'cancelado';

export const STATUS_ENERGIA: Record<
  EnergiaStatus,
  { label: string; color: 'warning' | 'info' | 'success' | 'default' }
> = {
  aberto: { label: 'Aberto', color: 'warning' },
  em_andamento: { label: 'Em andamento', color: 'info' },
  finalizado: { label: 'Finalizado', color: 'success' },
  cancelado: { label: 'Cancelado', color: 'default' },
};

export const STATUS_ABERTOS = new Set<EnergiaStatus>(['aberto', 'em_andamento']);

export function rotuloTipoOcorrencia(codigo: string): string {
  return TIPOS_OCORRENCIA.find((t) => t.value === codigo)?.label ?? codigo;
}

export function rotuloStatusEnergia(status: string): string {
  return STATUS_ENERGIA[status as EnergiaStatus]?.label ?? status;
}

export function agoraDatetimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isoParaDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return agoraDatetimeLocal();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return agoraDatetimeLocal();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function datetimeLocalParaIso(local: string): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
