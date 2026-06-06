import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import type { ManutChamadoDetalhe } from '../../api/client';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import {
  KANBAN_COLUNAS,
  SlaBarraProgresso,
  statusChip,
  tipoChamadoChip,
  urgenciaChip,
} from '../../utils/manutencaoUi';

const NAVY = '#1B2A6B';

function statusAccent(status: string) {
  const col = KANBAN_COLUNAS.find((c) => c.status === status);
  if (col) return col.accent;
  if (status === 'cancelado') return '#EF4444';
  return NAVY;
}

function InfoCelula({ icone, rotulo, valor }: { icone: React.ReactNode; rotulo: string; valor: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', minWidth: 0 }}>
      <Box sx={{ color: NAVY, opacity: 0.7, mt: 0.15, flexShrink: 0 }}>{icone}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.68rem', lineHeight: 1.2 }}>
          {rotulo}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, color: NAVY, lineHeight: 1.35, wordBreak: 'break-word' }}>
          {valor}
        </Typography>
      </Box>
    </Box>
  );
}

type Props = {
  detalhe: ManutChamadoDetalhe;
  onVoltar?: () => void;
  voltarLabel?: string;
};

export default function ChamadoDetalheHeader({ detalhe, onVoltar, voltarLabel = 'Voltar aos chamados' }: Props) {
  const accent = statusAccent(detalhe.status);

  return (
    <Box sx={{ mb: 2 }}>
      {onVoltar && (
        <Button
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={onVoltar}
          sx={{
            mb: 1.5,
            color: 'text.secondary',
            fontWeight: 600,
            fontSize: '0.8rem',
            '&:hover': { bgcolor: 'rgba(27, 42, 107, 0.06)', color: NAVY },
          }}
        >
          {voltarLabel}
        </Button>
      )}

      <Paper
        elevation={0}
        sx={{
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid rgba(27, 42, 107, 0.1)',
          boxShadow: '0 2px 12px rgba(27, 42, 107, 0.08)',
        }}
      >
        <Box sx={{ height: 4, bgcolor: accent }} />

        <Box sx={{ p: { xs: 2, md: 2.5 } }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1.25 }}>
            <Box
              sx={{
                bgcolor: 'rgba(27, 42, 107, 0.08)',
                color: NAVY,
                fontWeight: 800,
                fontSize: { xs: '0.9rem', md: '1rem' },
                px: 1.25,
                py: 0.4,
                borderRadius: 1,
                lineHeight: 1.2,
              }}
            >
              #{detalhe.numero}
            </Box>
            {statusChip(detalhe.status)}
            {urgenciaChip(detalhe.urgencia)}
            {detalhe.tipo_chamado === 'orcamento' && tipoChamadoChip('orcamento')}
          </Box>

          <Typography
            sx={{
              fontWeight: 800,
              color: NAVY,
              fontSize: { xs: '1.15rem', md: '1.35rem' },
              lineHeight: 1.3,
              mb: 1.5,
              letterSpacing: '-0.02em',
            }}
          >
            {detalhe.titulo}
          </Typography>

          {detalhe.descricao && (
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                lineHeight: 1.6,
                mb: 2,
                whiteSpace: 'pre-wrap',
                bgcolor: 'rgba(27, 42, 107, 0.03)',
                borderRadius: 1.5,
                px: 1.5,
                py: 1.25,
                border: '1px solid rgba(27, 42, 107, 0.06)',
              }}
            >
              {detalhe.descricao}
            </Typography>
          )}

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
              gap: { xs: 1.5, md: 2 },
              mb: 2,
            }}
          >
            <InfoCelula
              icone={<LocationOnOutlinedIcon sx={{ fontSize: 18, color: '#E8520A' }} />}
              rotulo="Loja"
              valor={detalhe.loja}
            />
            <InfoCelula
              icone={<CategoryOutlinedIcon sx={{ fontSize: 18 }} />}
              rotulo="Categoria"
              valor={detalhe.categoria}
            />
            <InfoCelula
              icone={<PersonOutlineOutlinedIcon sx={{ fontSize: 18 }} />}
              rotulo="Solicitante"
              valor={detalhe.solicitante}
            />
            {detalhe.tecnico && (
              <InfoCelula
                icone={<EngineeringOutlinedIcon sx={{ fontSize: 18 }} />}
                rotulo="Técnico responsável"
                valor={detalhe.tecnico}
              />
            )}
            {detalhe.local_detalhe && (
              <InfoCelula
                icone={<PlaceOutlinedIcon sx={{ fontSize: 18 }} />}
                rotulo="Local"
                valor={detalhe.local_detalhe}
              />
            )}
            <InfoCelula
              icone={<ScheduleOutlinedIcon sx={{ fontSize: 18 }} />}
              rotulo="Aberto em"
              valor={formatDataHoraBrasilia(detalhe.aberto_em || detalhe.prazo_sla)}
            />
            <InfoCelula
              icone={<ScheduleOutlinedIcon sx={{ fontSize: 18 }} />}
              rotulo="Prazo SLA"
              valor={formatDataHoraBrasilia(detalhe.prazo_sla)}
            />
          </Box>

          <Divider sx={{ mb: 1.5, borderColor: 'rgba(27, 42, 107, 0.08)' }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: NAVY, flexShrink: 0 }}>
              Progresso SLA
            </Typography>
            <Box sx={{ flex: 1, minWidth: 160, maxWidth: { xs: '100%', md: 320 } }}>
              <SlaBarraProgresso
                abertoEm={detalhe.aberto_em}
                prazoSla={detalhe.prazo_sla}
                status={detalhe.status}
                fechadoEm={detalhe.fechado_em ?? undefined}
                larguraTotal
              />
            </Box>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
