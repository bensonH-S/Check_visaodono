import type { EscalaPlanejamentoTipo } from '../../api/client';

export const TIPOS_PLANEJAMENTO: { value: EscalaPlanejamentoTipo; label: string }[] = [
  { value: 'audiencia', label: 'Audiência' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'congresso', label: 'Congresso' },
  { value: 'treinamento', label: 'Treinamento' },
];
