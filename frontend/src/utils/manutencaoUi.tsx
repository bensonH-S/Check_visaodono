import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { formatDataHoraBrasilia, parseDataApi } from './dateBr';

export const URGENCIAS = [
  { v: 'baixa', l: 'Baixa' },
  { v: 'media', l: 'Média' },
  { v: 'alta', l: 'Alta' },
  { v: 'critica', l: 'Crítica' },
] as const;

const URGENCIA_LABEL: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

const URGENCIA_COLOR: Record<string, 'success' | 'info' | 'warning' | 'error'> = {
  baixa: 'success',
  media: 'info',
  alta: 'warning',
  critica: 'error',
};

const chipMetadadoSx = {
  height: 20,
  fontWeight: 700,
  fontSize: '0.62rem',
  '& .MuiChip-label': { px: 0.65, py: 0, lineHeight: 1.2 },
};

export function urgenciaChip(urgencia: string) {
  return (
    <Chip
      label={URGENCIA_LABEL[urgencia] || urgencia}
      size="small"
      color={URGENCIA_COLOR[urgencia] || 'default'}
      sx={chipMetadadoSx}
    />
  );
}

export function slaChip(horas: number) {
  const color = horas <= 8 ? 'error' : horas <= 24 ? 'warning' : 'success';
  return (
    <Chip
      label={`${horas}h`}
      size="small"
      color={color}
      sx={{ minWidth: 56, justifyContent: 'center' }}
    />
  );
}

export const STATUS_CHAMADO: Record<string, { label: string; color: string; bg: string }> = {
  aberto: { label: 'Em aberto', color: '#92400E', bg: '#FEF3C7' },
  em_atendimento: { label: 'Em Tratamento', color: '#1E40AF', bg: '#DBEAFE' },
  em_aprovacao: { label: 'Em aprovação', color: '#7C3AED', bg: '#EDE9FE' },
  aprovado: { label: 'Aprovado', color: '#0F766E', bg: '#CCFBF1' },
  concluido: { label: 'Concluído', color: '#166534', bg: '#DCFCE7' },
  cancelado: { label: 'Cancelado', color: '#991B1B', bg: '#FEE2E2' },
};

export const KANBAN_COLUNAS = [
  { status: 'aberto', label: 'Em aberto', accent: '#F59E0B', icon: 'schedule' },
  { status: 'em_atendimento', label: 'Em Tratamento', accent: '#3B82F6', icon: 'schedule' },
  { status: 'em_aprovacao', label: 'Em aprovação', accent: '#8B5CF6', icon: 'schedule' },
  { status: 'aprovado', label: 'Aprovado', accent: '#14B8A6', icon: 'schedule' },
  { status: 'concluido', label: 'Concluído', accent: '#22C55E', icon: 'check' },
] as const;

export function labelDestinoAprovacao(
  destino?: string | null,
  cargos?: Array<{ codigo: string; nome: string }>,
) {
  if (!destino) return '';
  const found = cargos?.find((c) => c.codigo === destino);
  if (found) return found.nome;
  if (destino === 'financeiro') return 'Financeiro';
  if (destino === 'diretor') return 'Diretor';
  return destino;
}

/** Orçamentos antigos sem destino ficam visíveis para qualquer cargo aprovador. */
export function destinoPermiteCargoAprovacao(
  destino: string | null | undefined,
  cargoAprovacao: string | null | undefined,
) {
  if (!cargoAprovacao) return false;
  if (!destino) return true;
  return destino === cargoAprovacao;
}

export const TEXTOS_PADRAO_APROVACAO = [
  'Aprovado pelo Diretor. Aguarda aprovação final do Financeiro.',
  'Aprovado pelo Diretor.',
  'Encaminhado ao Diretor para avaliação.',
];

export function limparTextoAprovacao(texto?: string | null) {
  if (!texto?.trim()) return '';
  let t = texto.trim();
  for (const padrao of TEXTOS_PADRAO_APROVACAO) {
    t = t.replace(padrao, '').trim();
  }
  t = t.replace(/\n*Destino:\s*.+$/gim, '').trim();
  t = t.replace(/^Enviado para aprovação do .+$/gim, '').trim();
  t = t.replace(/^Encaminhado ao Diretor para avaliação\.?$/gim, '').trim();
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

const LABEL_HISTORICO_APROVACAO: Record<string, string> = {
  envio_aprovacao: 'Enviado para aprovação',
  encaminhar_diretor: 'Encaminhado ao Diretor',
  aprovacao_diretor: 'Aprovado pelo Diretor',
  aprovacao: 'Orçamento aprovado',
  recusa_aprovacao: 'Não aprovado',
};

export function labelHistoricoAprovacao(tipo: string) {
  return LABEL_HISTORICO_APROVACAO[tipo] || tipo;
}

export function destinoAprovacaoChip(
  destino?: string | null,
  cargos?: Array<{ codigo: string; nome: string }>,
) {
  if (!destino) return null;
  const label = labelDestinoAprovacao(destino, cargos);
  const st =
    destino === 'financeiro'
      ? { color: '#7C3AED', bg: '#EDE9FE' }
      : destino === 'diretor'
        ? { color: '#1E40AF', bg: '#DBEAFE' }
        : { color: '#1B2A6B', bg: '#E8EBF5' };
  return (
    <Chip
      label={label}
      size="small"
      sx={{ bgcolor: st.bg, color: st.color, fontWeight: 600 }}
    />
  );
}

export const TIPO_CHAMADO: Record<string, { label: string; color: string; bg: string }> = {
  normal: { label: 'Normal', color: '#1E40AF', bg: '#DBEAFE' },
  orcamento: { label: 'Orçamento', color: '#B45309', bg: '#FFEDD5' },
};

export function tipoChamadoChip(tipo?: string) {
  if (!tipo || tipo === 'normal') return null;
  const st = TIPO_CHAMADO[tipo] ?? TIPO_CHAMADO.orcamento;
  return (
    <Chip
      label={st.label}
      size="small"
      sx={{
        ...chipMetadadoSx,
        color: st.color,
        bgcolor: st.bg,
        border: 'none',
      }}
    />
  );
}

export function statusChamadoLabel(status: string) {
  return STATUS_CHAMADO[status]?.label ?? status.replace(/_/g, ' ');
}

export function statusChip(status: string) {
  const st = STATUS_CHAMADO[status] ?? { label: status, color: '#4B5563', bg: '#F3F4F6' };
  return (
    <Chip
      label={st.label}
      size="small"
      sx={{
        fontWeight: 700,
        fontSize: '0.72rem',
        color: st.color,
        bgcolor: st.bg,
        border: 'none',
      }}
    />
  );
}

export function chamadoEncerrado(status: string) {
  return status === 'concluido' || status === 'cancelado';
}

type SlaEstilo = { color: string; bg: string; border: string };

function estiloSla(prazoSla: string): SlaEstilo {
  const prazo = parseDataApi(prazoSla);
  if (Number.isNaN(prazo.getTime())) {
    return { color: '#4B5563', bg: '#F3F4F6', border: '#D1D5DB' };
  }
  const diffMs = prazo.getTime() - Date.now();
  if (diffMs < 0) {
    return { color: '#991B1B', bg: '#FEE2E2', border: '#EF4444' };
  }
  if (diffMs < 2 * 60 * 60 * 1000) {
    return { color: '#92400E', bg: '#FEF3C7', border: '#F59E0B' };
  }
  return { color: '#1E40AF', bg: '#DBEAFE', border: '#3B82F6' };
}

export function prazoSlaChip(prazoSla: string) {
  const st = estiloSla(prazoSla);
  return (
    <Chip
      icon={<ScheduleOutlinedIcon sx={{ fontSize: '14px !important', color: `${st.color} !important` }} />}
      label={`SLA ${formatDataHoraBrasilia(prazoSla)}`}
      size="small"
      sx={{
        height: 26,
        fontWeight: 700,
        fontSize: '0.72rem',
        color: st.color,
        bgcolor: st.bg,
        border: `1px solid ${st.border}40`,
        '& .MuiChip-icon': { ml: 0.75 },
      }}
    />
  );
}

export function fmtPrazo(horas: number) {
  if (horas < 24) return `${horas} hora${horas === 1 ? '' : 's'}`;
  const dias = Math.floor(horas / 24);
  const resto = horas % 24;
  if (!resto) return `${dias} dia${dias === 1 ? '' : 's'}`;
  return `${dias}d ${resto}h`;
}

export function calcularProgressoSla(
  abertoEm: string | undefined,
  prazoSla: string,
  opts?: { status?: string; fechadoEm?: string | null },
) {
  const fim = parseDataApi(prazoSla);
  if (Number.isNaN(fim.getTime())) {
    return { percentual: 0, estourado: false, cancelado: false, label: '—' };
  }

  if (opts?.status === 'cancelado') {
    return { percentual: 100, estourado: false, cancelado: true, label: 'Encerrado' };
  }

  const inicio = parseDataApi(abertoEm || prazoSla);
  const total = fim.getTime() - inicio.getTime();
  if (total <= 0 || Number.isNaN(inicio.getTime())) {
    return { percentual: 0, estourado: false, cancelado: false, label: '0%' };
  }

  if (opts?.status === 'concluido' && !opts.fechadoEm) {
    return { percentual: 100, estourado: false, cancelado: false, label: '100%' };
  }

  const emAndamento =
    !opts?.status ||
    opts.status === 'aberto' ||
    opts.status === 'em_atendimento' ||
    opts.status === 'em_aprovacao' ||
    opts.status === 'aprovado';
  const referencia =
    opts?.status === 'concluido' && opts.fechadoEm
      ? parseDataApi(opts.fechadoEm).getTime()
      : emAndamento
        ? Date.now()
        : inicio.getTime();

  if (opts?.status === 'concluido' && opts.fechadoEm && Number.isNaN(referencia)) {
    return { percentual: 0, estourado: false, cancelado: false, label: '—' };
  }

  const decorrido = referencia - inicio.getTime();
  const percentualReal = Math.round((decorrido / total) * 100);
  const estourado = referencia > fim.getTime();
  const percentualExibir = estourado ? 100 : Math.min(Math.max(percentualReal, 0), 100);

  return {
    percentual: percentualExibir,
    percentualReal,
    estourado,
    cancelado: false,
    label: `${percentualExibir}%`,
  };
}

export function SlaBarraProgresso({
  abertoEm,
  prazoSla,
  status,
  fechadoEm,
  larguraTotal = false,
  compact = false,
}: {
  abertoEm?: string;
  prazoSla: string;
  status?: string;
  fechadoEm?: string | null;
  larguraTotal?: boolean;
  compact?: boolean;
}) {
  const { percentual, estourado, label, cancelado } = calcularProgressoSla(abertoEm, prazoSla, {
    status,
    fechadoEm,
  });
  const cor = cancelado ? '#9CA3AF' : estourado ? '#DC2626' : percentual >= 85 ? '#F59E0B' : '#22C55E';

  const textoCor =
    cancelado || estourado || percentual >= 45 ? '#fff' : '#1B2A6B';

  const barHeight = compact ? 16 : 22;

  return (
    <Box
      sx={{
        position: 'relative',
        width: larguraTotal ? '100%' : undefined,
        minWidth: larguraTotal ? '100%' : compact ? 72 : 96,
        maxWidth: larguraTotal ? '100%' : compact ? 96 : 120,
        height: barHeight,
      }}
    >
      <LinearProgress
        variant="determinate"
        value={percentual}
        sx={{
          height: barHeight,
          borderRadius: compact ? 3 : 4,
          bgcolor: 'rgba(27, 42, 107, 0.12)',
          '& .MuiLinearProgress-bar': {
            borderRadius: compact ? 3 : 4,
            bgcolor: cor,
          },
        }}
      />
      <Typography
        variant="caption"
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: compact ? '0.58rem' : '0.62rem',
          color: textoCor,
          lineHeight: 1,
          pointerEvents: 'none',
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

export function rotuloPrazoSlaResumo(
  abertoEm: string | undefined,
  prazoSla: string,
  opts?: { status?: string; fechadoEm?: string | null },
) {
  const { percentual, estourado } = calcularProgressoSla(abertoEm, prazoSla, opts);
  const prazo = parseDataApi(prazoSla);
  if (Number.isNaN(prazo.getTime())) {
    return { texto: '—', cor: '#9CA3AF', destaque: false };
  }
  if (estourado) {
    return { texto: 'Prazo estourado', cor: '#DC2626', destaque: true };
  }

  const diffMs = prazo.getTime() - Date.now();
  if (diffMs < 60 * 60 * 1000) {
    const mins = Math.max(1, Math.ceil(diffMs / (60 * 1000)));
    return {
      texto: mins === 1 ? 'Vence em 1 min' : `Vence em ${mins} min`,
      cor: '#D97706',
      destaque: true,
    };
  }
  if (diffMs < 24 * 60 * 60 * 1000) {
    const horas = Math.floor(diffMs / (60 * 60 * 1000));
    const mins = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
    const texto = mins > 0 ? `Vence em ${horas}h ${mins}min` : `Vence em ${horas}h`;
    return {
      texto,
      cor: percentual >= 85 ? '#D97706' : '#6B7280',
      destaque: percentual >= 85,
    };
  }

  return {
    texto: formatDataHoraBrasilia(prazoSla),
    cor: '#6B7280',
    destaque: false,
  };
}

/** Círculo compacto com % do SLA consumido. */
export function SlaCirculoPercentual({
  abertoEm,
  prazoSla,
  status,
  fechadoEm,
  size = 38,
}: {
  abertoEm?: string;
  prazoSla: string;
  status?: string;
  fechadoEm?: string | null;
  size?: number;
}) {
  const { percentual, estourado, cancelado } = calcularProgressoSla(abertoEm, prazoSla, { status, fechadoEm });
  const stroke = cancelado ? '#9CA3AF' : estourado ? '#EF4444' : percentual >= 85 ? '#F59E0B' : '#22C55E';
  const textoCor = cancelado ? '#6B7280' : estourado ? '#DC2626' : percentual >= 85 ? '#B45309' : '#1B2A6B';
  const raio = (size - 5) / 2;
  const centro = size / 2;
  const circunferencia = 2 * Math.PI * raio;
  const offset = circunferencia - (percentual / 100) * circunferencia;

  return (
    <Box
      aria-label={`SLA ${percentual}%`}
      sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
    >
      <Box
        component="svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        sx={{ display: 'block', transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={centro}
          cy={centro}
          r={raio}
          fill="none"
          stroke="rgba(27, 42, 107, 0.1)"
          strokeWidth={3}
        />
        <circle
          cx={centro}
          cy={centro}
          r={raio}
          fill="none"
          stroke={stroke}
          strokeWidth={3}
          strokeDasharray={circunferencia}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </Box>
      <Typography
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: size <= 34 ? '0.52rem' : '0.58rem',
          color: textoCor,
          lineHeight: 1,
        }}
      >
        {cancelado ? '—' : `${percentual}%`}
      </Typography>
    </Box>
  );
}

/** SLA para listas mobile — círculo com % e texto do prazo. */
export function SlaIndicadorSubtil({
  abertoEm,
  prazoSla,
  status,
  fechadoEm,
}: {
  abertoEm?: string;
  prazoSla: string;
  status?: string;
  fechadoEm?: string | null;
}) {
  const { texto, cor, destaque } = rotuloPrazoSlaResumo(abertoEm, prazoSla, { status, fechadoEm });

  return (
    <Box
      sx={{
        mt: 1.25,
        pt: 1,
        borderTop: '1px solid rgba(27, 42, 107, 0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
      }}
    >
      <SlaCirculoPercentual
        abertoEm={abertoEm}
        prazoSla={prazoSla}
        status={status}
        fechadoEm={fechadoEm}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem', fontWeight: 500, display: 'block' }}>
          Prazo SLA
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: destaque ? cor : 'text.secondary',
            fontWeight: destaque ? 700 : 500,
            fontSize: '0.74rem',
            lineHeight: 1.35,
            display: 'block',
          }}
        >
          {texto}
        </Typography>
      </Box>
    </Box>
  );
}

export function slaCelulaTabela(prazoSla: string) {
  const st = estiloSla(prazoSla);
  return (
    <Chip
      icon={
        <ScheduleOutlinedIcon sx={{ fontSize: '14px !important', color: `${st.color} !important` }} />
      }
      label={formatDataHoraBrasilia(prazoSla)}
      size="small"
      sx={{
        height: 26,
        fontWeight: 700,
        fontSize: '0.72rem',
        color: st.color,
        bgcolor: st.bg,
        border: `1px solid ${st.border}40`,
        borderRadius: '999px',
        '& .MuiChip-icon': { ml: 0.75 },
        '& .MuiChip-label': { px: 1 },
      }}
    />
  );
}
