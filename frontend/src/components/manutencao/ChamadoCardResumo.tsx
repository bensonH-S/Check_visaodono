import type { ReactNode, MouseEvent } from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import type { ManutChamado } from '../../api/client';
import NotificacaoBadge from '../NotificacaoBadge';
import {
  KANBAN_COLUNAS,
  STATUS_CHAMADO,
  SlaBarraProgresso,
  SlaCirculoPercentual,
  tipoChamadoChip,
  urgenciaChip,
} from '../../utils/manutencaoUi';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import {
  ehTecnicoCampoMobile,
  filtraNotificacoesPorRegiaoMobile,
  getUsuario,
  podeReceberPainelDiretorChamados,
  temPermissao,
} from '../../lib/auth';

const NAVY = '#1B2A6B';

function rotuloTecnicoCard(nome?: string | null) {
  if (!nome?.trim()) return null;
  return nome.trim().split(/\s+/)[0];
}

function statusAccent(status: string) {
  const col = KANBAN_COLUNAS.find((c) => c.status === status);
  if (col) return col.accent;
  if (status === 'cancelado') return '#EF4444';
  return '#9CA3AF';
}

function urgenciaPrioritaria(urgencia: string) {
  return urgencia === 'alta' || urgencia === 'critica';
}

type Props = {
  chamado: ManutChamado;
  onClick?: () => void;
  /** Layout otimizado para listas mobile */
  variant?: 'default' | 'mobile';
  /** Visualização mobile: card (padrão) ou linha compacta */
  mobileLayout?: 'card' | 'lista';
  /** Card menor para histórico ou kanban denso */
  compact?: boolean;
  /** Exibe loja (portal com várias unidades) */
  showLoja?: boolean;
  /** Oculta chip de status (ex.: coluna do kanban) */
  hideStatus?: boolean;
  /** Barra de SLA no rodapé */
  showSla?: boolean;
  /** Data de encerramento (aba fechados) */
  showDataEncerramento?: boolean;
  /** Botão assumir ticket (técnicos da região) */
  mostrarAssumir?: boolean;
  onAssumir?: (e: MouseEvent) => void;
  assumindo?: boolean;
  /** Última linha no modo lista (sem borda inferior) */
  isLast?: boolean;
};

function MetaLinha({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
      <Box sx={{ color: 'text.disabled', display: 'flex', flexShrink: 0 }}>{icon}</Box>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          fontSize: '0.72rem',
          fontWeight: 500,
          lineHeight: 1.35,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}

function ChamadoCardMobile({
  chamado,
  onClick,
  compact,
  showLoja,
  showSla,
  showDataEncerramento,
  mostrarAssumir,
  onAssumir,
  assumindo,
}: Omit<Props, 'variant' | 'hideStatus'>) {
  const accent = statusAccent(chamado.status);
  const tecnico = rotuloTecnicoCard(chamado.tecnico);
  const sessao = getUsuario();
  const jaEhTecnico =
    sessao &&
    chamado.id_tecnico != null &&
    Number(chamado.id_tecnico) === Number(sessao.id_usuario);
  const podeAssumirUsuario = Boolean(
    sessao &&
      filtraNotificacoesPorRegiaoMobile(sessao) &&
      !podeReceberPainelDiretorChamados(sessao) &&
      !temPermissao('lojas.todas', sessao) &&
      (temPermissao('chamados.assumir', sessao) || ehTecnicoCampoMobile(sessao) || sessao.perfil === 'tecnico'),
  );
  const exibirAssumir = Boolean(
    mostrarAssumir &&
      podeAssumirUsuario &&
      ['aberto', 'em_atendimento'].includes(chamado.status) &&
      !jaEhTecnico,
  );
  const st = STATUS_CHAMADO[chamado.status] || {
    label: chamado.status,
    color: '#4B5563',
    bg: '#F3F4F6',
  };

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        display: 'flex',
        borderRadius: 2.5,
        border: '1px solid rgba(27, 42, 107, 0.09)',
        bgcolor: '#fff',
        boxShadow: '0 2px 12px rgba(27, 42, 107, 0.06)',
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'hidden',
        transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
        '&:hover': onClick
          ? { boxShadow: '0 4px 18px rgba(27, 42, 107, 0.11)', borderColor: 'rgba(27, 42, 107, 0.16)' }
          : undefined,
        '&:active': onClick ? { boxShadow: '0 1px 6px rgba(27, 42, 107, 0.08)' } : undefined,
      }}
    >
      <Box aria-hidden sx={{ width: 3, flexShrink: 0, bgcolor: accent }} />
      <Box
        sx={{
          position: 'relative',
          flex: 1,
          minWidth: 0,
          px: 1.75,
          py: 1.5,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.85,
            mb: 0.75,
            py: 0.65,
            px: 0.75,
            borderRadius: 1.75,
            bgcolor: 'rgba(27, 42, 107, 0.045)',
            border: '1px solid rgba(27, 42, 107, 0.08)',
          }}
        >
          <Box
            component="span"
            sx={{
              flexShrink: 0,
              alignSelf: 'center',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 40,
              px: 0.75,
              py: 0.35,
              borderRadius: 1.25,
              bgcolor: NAVY,
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.72rem',
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              boxShadow: '0 2px 8px rgba(27, 42, 107, 0.22)',
            }}
          >
            #{chamado.numero}
          </Box>
          <Box
            aria-hidden
            sx={{
              width: '1px',
              alignSelf: 'stretch',
              my: 0.35,
              bgcolor: 'rgba(27, 42, 107, 0.14)',
              flexShrink: 0,
            }}
          />
          <Typography
            sx={{
              fontWeight: 700,
              lineHeight: 1.38,
              color: 'text.primary',
              fontSize: compact ? '0.9rem' : '0.94rem',
              flex: 1,
              minWidth: 0,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {chamado.titulo}
          </Typography>
        </Box>

        {(urgenciaPrioritaria(chamado.urgencia) || chamado.tipo_chamado === 'orcamento') && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', mb: 0.35 }}>
            {urgenciaPrioritaria(chamado.urgencia) && urgenciaChip(chamado.urgencia)}
            {chamado.tipo_chamado === 'orcamento' && tipoChamadoChip('orcamento')}
          </Box>
        )}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.65,
            minWidth: 0,
            mb: 0.15,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              minWidth: 0,
              flex: 1,
              overflow: 'hidden',
            }}
          >
            {showLoja && chamado.loja && (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35, minWidth: 0, flexShrink: 1 }}>
                  <LocationOnOutlinedIcon sx={{ fontSize: 14, color: '#E8520A', flexShrink: 0 }} />
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.72rem',
                      lineHeight: 1.4,
                      fontWeight: 600,
                      color: NAVY,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {chamado.loja}
                  </Typography>
                </Box>
                <Typography
                  component="span"
                  aria-hidden
                  sx={{
                    color: 'rgba(27, 42, 107, 0.28)',
                    fontSize: '0.72rem',
                    fontWeight: 300,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  |
                </Typography>
              </>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35, minWidth: 0, flexShrink: 1 }}>
              <CategoryOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  fontSize: '0.72rem',
                  lineHeight: 1.4,
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {chamado.categoria}
              </Typography>
            </Box>
          </Box>
          <Chip
            label={st.label}
            size="small"
            sx={{
              height: 22,
              flexShrink: 0,
              ml: 'auto',
              fontWeight: 700,
              fontSize: '0.62rem',
              bgcolor: st.bg,
              color: st.color,
              border: `1px solid ${accent}40`,
            }}
          />
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            mt: 1,
            pt: 0.85,
            borderTop: '1px solid rgba(27, 42, 107, 0.06)',
          }}
        >
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              overflow: 'hidden',
            }}
          >
            <MetaLinha icon={<PersonOutlineOutlinedIcon sx={{ fontSize: 14 }} />}>
              {tecnico || 'Sem técnico'}
            </MetaLinha>
            <Box aria-hidden sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'rgba(27,42,107,0.2)', flexShrink: 0 }} />
            <MetaLinha icon={<ScheduleOutlinedIcon sx={{ fontSize: 14 }} />}>
              {showDataEncerramento && chamado.fechado_em
                ? `Encerrado ${formatDataHoraBrasilia(chamado.fechado_em)}`
                : formatDataHoraBrasilia(chamado.aberto_em || chamado.prazo_sla)}
            </MetaLinha>
            <NotificacaoBadge count={chamado.notificacoes_nao_lidas} />
          </Box>

          {(exibirAssumir || showSla) && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.65,
                flexShrink: 0,
              }}
            >
              {exibirAssumir && onAssumir && (
                <Button
                  size="small"
                  variant="contained"
                  disabled={assumindo}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAssumir(e);
                  }}
                  sx={{
                    minWidth: 0,
                    height: 28,
                    px: 1.1,
                    py: 0,
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: 1.5,
                    bgcolor: NAVY,
                    boxShadow: 'none',
                    whiteSpace: 'nowrap',
                    '&:hover': { bgcolor: '#152258', boxShadow: 'none' },
                  }}
                >
                  {assumindo ? <CircularProgress size={13} color="inherit" /> : 'Assumir'}
                </Button>
              )}
              {showSla && (
                <SlaCirculoPercentual
                  abertoEm={chamado.aberto_em}
                  prazoSla={chamado.prazo_sla}
                  status={chamado.status}
                  fechadoEm={chamado.fechado_em}
                  size={34}
                />
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Paper>
  );
}

function ChamadoLinhaMobile({
  chamado,
  onClick,
  showLoja,
  showSla,
  isLast,
}: {
  chamado: ManutChamado;
  onClick?: () => void;
  showLoja?: boolean;
  showSla?: boolean;
  isLast?: boolean;
}) {
  const accent = statusAccent(chamado.status);
  const st = STATUS_CHAMADO[chamado.status] || {
    label: chamado.status,
    color: '#4B5563',
    bg: '#F3F4F6',
  };

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        minHeight: 56,
        cursor: onClick ? 'pointer' : 'default',
        bgcolor: '#fff',
        borderBottom: isLast ? 'none' : '1px solid rgba(27, 42, 107, 0.08)',
        '&:active': { bgcolor: 'rgba(27, 42, 107, 0.03)' },
      }}
    >
      <Box aria-hidden sx={{ width: 3, flexShrink: 0, bgcolor: accent }} />
      <Box sx={{ flex: 1, minWidth: 0, py: 1.1, px: 1.25, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          component="span"
          sx={{
            flexShrink: 0,
            fontWeight: 800,
            fontSize: '0.72rem',
            color: NAVY,
            minWidth: 36,
          }}
        >
          #{chamado.numero}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '0.88rem',
              lineHeight: 1.3,
              color: 'text.primary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {chamado.titulo}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 0.2,
              fontSize: '0.68rem',
              color: 'text.secondary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {showLoja && chamado.loja ? `${chamado.loja} · ` : ''}
            {chamado.categoria}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          <Chip
            label={st.label}
            size="small"
            sx={{
              height: 20,
              fontWeight: 700,
              fontSize: '0.58rem',
              bgcolor: st.bg,
              color: st.color,
              border: `1px solid ${accent}40`,
            }}
          />
          {showSla && (
            <SlaCirculoPercentual
              abertoEm={chamado.aberto_em}
              prazoSla={chamado.prazo_sla}
              status={chamado.status}
              fechadoEm={chamado.fechado_em}
              size={32}
            />
          )}
          <NotificacaoBadge count={chamado.notificacoes_nao_lidas} />
        </Box>
      </Box>
    </Box>
  );
}

export default function ChamadoCardResumo({
  chamado,
  onClick,
  variant = 'default',
  mobileLayout = 'card',
  compact = false,
  showLoja = false,
  hideStatus = false,
  showSla = false,
  showDataEncerramento = false,
  mostrarAssumir = false,
  onAssumir,
  assumindo = false,
  isLast = false,
}: Props) {
  if (variant === 'mobile' && mobileLayout === 'lista') {
    return (
      <ChamadoLinhaMobile
        chamado={chamado}
        onClick={onClick}
        showLoja={showLoja}
        showSla={showSla}
        isLast={isLast}
      />
    );
  }

  if (variant === 'mobile') {
    return (
      <ChamadoCardMobile
        chamado={chamado}
        onClick={onClick}
        compact={compact}
        showLoja={showLoja}
        showSla={showSla}
        showDataEncerramento={showDataEncerramento}
        mostrarAssumir={mostrarAssumir}
        onAssumir={onAssumir}
        assumindo={assumindo}
      />
    );
  }

  const st = STATUS_CHAMADO[chamado.status] || {
    label: chamado.status,
    color: '#4B5563',
    bg: '#F3F4F6',
  };
  const accent = statusAccent(chamado.status);

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        display: 'flex',
        borderRadius: 2,
        border: '1px solid rgba(27, 42, 107, 0.1)',
        bgcolor: '#fff',
        boxShadow: compact
          ? '0 1px 4px rgba(27, 42, 107, 0.06)'
          : '0 2px 10px rgba(27, 42, 107, 0.08)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s ease, transform 0.12s ease',
        '&:hover': onClick
          ? { boxShadow: '0 6px 20px rgba(27, 42, 107, 0.14)', transform: 'translateY(-1px)' }
          : undefined,
        '&:active': onClick ? { transform: 'translateY(0)' } : undefined,
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 4,
          flexShrink: 0,
          bgcolor: accent,
          borderRadius: '8px 0 0 8px',
        }}
      />
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          px: compact ? 2 : 2.25,
          py: compact ? 1.5 : 1.75,
          pb: showSla ? (compact ? 1.75 : 2.25) : compact ? 1.5 : 1.75,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1 }}>
            <Box
              sx={{
                bgcolor: 'rgba(27, 42, 107, 0.08)',
                color: NAVY,
                fontWeight: 800,
                fontSize: compact ? '0.75rem' : '0.8125rem',
                px: 0.875,
                py: 0.35,
                borderRadius: 1,
                lineHeight: 1.2,
                flexShrink: 0,
              }}
            >
              #{chamado.numero}
            </Box>
            <NotificacaoBadge count={chamado.notificacoes_nao_lidas} />
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {urgenciaChip(chamado.urgencia)}
            {chamado.tipo_chamado === 'orcamento' && tipoChamadoChip('orcamento')}
          </Box>
        </Box>

        <Typography
          sx={{
            fontWeight: 700,
            lineHeight: 1.35,
            color: 'text.primary',
            fontSize: compact ? '0.875rem' : '1rem',
            mb: 0.5,
            whiteSpace: 'normal',
            wordBreak: 'break-word',
          }}
        >
          {chamado.titulo}
        </Typography>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', lineHeight: 1.4, whiteSpace: 'normal', wordBreak: 'break-word' }}
        >
          {chamado.categoria}
        </Typography>

        {showLoja && (
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mt: 0.75 }}>
            <LocationOnOutlinedIcon sx={{ fontSize: 15, color: '#E8520A', flexShrink: 0, mt: 0.15 }} />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: NAVY,
                lineHeight: 1.35,
                whiteSpace: 'normal',
                wordBreak: 'break-word',
              }}
            >
              {chamado.loja}
            </Typography>
          </Box>
        )}

        <Box
          sx={{
            display: 'flex',
            gap: 0.5,
            mt: 1,
            flexWrap: 'wrap',
            alignItems: 'center',
            pt: 0.75,
            borderTop: '1px solid rgba(27, 42, 107, 0.08)',
          }}
        >
          {!hideStatus && (
            <Chip
              label={st.label}
              size="small"
              sx={{
                height: 22,
                fontWeight: 700,
                fontSize: '0.68rem',
                bgcolor: st.bg,
                color: st.color,
                border: `1px solid ${accent}40`,
              }}
            />
          )}
          {chamado.tecnico ? (
            <Chip
              icon={
                <AssignmentIndOutlinedIcon sx={{ fontSize: '12px !important', color: `${NAVY} !important` }} />
              }
              label={rotuloTecnicoCard(chamado.tecnico)}
              size="small"
              variant="outlined"
              title={chamado.tecnico}
              sx={{
                height: 22,
                maxWidth: 'min(140px, 42%)',
                fontSize: '0.68rem',
                fontWeight: 600,
                color: NAVY,
                borderColor: 'rgba(27, 42, 107, 0.18)',
                '& .MuiChip-icon': { ml: 0.5 },
                '& .MuiChip-label': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  px: 0.75,
                },
              }}
            />
          ) : (
            <Chip
              label="Sem técnico"
              size="small"
              variant="outlined"
              sx={{
                height: 22,
                fontSize: '0.65rem',
                fontWeight: 500,
                color: 'text.secondary',
                borderColor: 'rgba(27, 42, 107, 0.12)',
              }}
            />
          )}
          {!compact && (
            <Chip
              icon={<ScheduleOutlinedIcon sx={{ fontSize: '12px !important', color: `${NAVY} !important` }} />}
              label={formatDataHoraBrasilia(chamado.aberto_em || chamado.prazo_sla)}
              size="small"
              variant="outlined"
              sx={{
                height: 22,
                fontSize: '0.68rem',
                fontWeight: 600,
                color: NAVY,
                borderColor: 'rgba(27, 42, 107, 0.2)',
                '& .MuiChip-icon': { ml: 0.5 },
              }}
            />
          )}
          {showDataEncerramento && chamado.fechado_em && (
            <Chip
              icon={<ScheduleOutlinedIcon sx={{ fontSize: '12px !important', color: `${NAVY} !important` }} />}
              label={`Encerrado ${formatDataHoraBrasilia(chamado.fechado_em)}`}
              size="small"
              variant="outlined"
              sx={{
                height: 22,
                fontSize: '0.65rem',
                fontWeight: 600,
                color: 'text.secondary',
                borderColor: 'rgba(27, 42, 107, 0.15)',
                '& .MuiChip-icon': { ml: 0.5 },
              }}
            />
          )}
          {compact && !showDataEncerramento && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ScheduleOutlinedIcon sx={{ fontSize: 14, color: NAVY, flexShrink: 0 }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: NAVY, fontSize: '0.68rem', lineHeight: 1.35 }}>
                {formatDataHoraBrasilia(chamado.aberto_em || chamado.prazo_sla)}
              </Typography>
            </Box>
          )}
        </Box>

        {showSla && (
          <Box sx={{ mt: 1 }}>
            <SlaBarraProgresso
              abertoEm={chamado.aberto_em}
              prazoSla={chamado.prazo_sla}
              status={chamado.status}
              fechadoEm={chamado.fechado_em ?? undefined}
              larguraTotal
              compact
            />
          </Box>
        )}
      </Box>
    </Paper>
  );
}
