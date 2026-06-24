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
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import type { ReactNode } from 'react';
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

function InfoCelula({
  icone,
  rotulo,
  valor,
  compacto,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
  compacto?: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', gap: compacto ? 0.5 : 1, alignItems: 'flex-start', minWidth: 0 }}>
      <Box sx={{ color: NAVY, opacity: 0.7, mt: 0.1, flexShrink: 0 }}>{icone}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', fontSize: compacto ? '0.62rem' : '0.68rem', lineHeight: 1.2 }}
        >
          {rotulo}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            color: NAVY,
            lineHeight: 1.3,
            wordBreak: 'break-word',
            fontSize: compacto ? '0.78rem' : undefined,
          }}
        >
          {valor}
        </Typography>
      </Box>
    </Box>
  );
}

type ItemMetadado = {
  chave: string;
  icone: ReactNode;
  rotulo: string;
  valor: string;
};

function MetadadosFlex({
  itens,
  compacto,
}: {
  itens: ItemMetadado[];
  compacto?: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: compacto ? 1 : 1.5,
        mb: 1.5,
        '& > *': {
          flex: '1 1 128px',
          minWidth: 0,
          maxWidth: '100%',
        },
      }}
    >
      {itens.map((item) => (
        <InfoCelula
          key={item.chave}
          compacto={compacto}
          icone={item.icone}
          rotulo={item.rotulo}
          valor={item.valor}
        />
      ))}
    </Box>
  );
}

type Props = {
  detalhe: ManutChamadoDetalhe;
  variante?: 'desktop' | 'mobile';
  ocultarSla?: boolean;
  chipsExtras?: ReactNode;
  onVoltar?: () => void;
  voltarLabel?: string;
  podeAssumir?: boolean;
  assumindo?: boolean;
  onAssumir?: () => void;
  rotuloAssumir?: string;
};

export default function ChamadoDetalheHeader({
  detalhe,
  variante = 'desktop',
  ocultarSla,
  chipsExtras,
  onVoltar,
  voltarLabel = 'Voltar aos chamados',
  podeAssumir,
  assumindo,
  onAssumir,
  rotuloAssumir = 'Assumir ticket',
}: Props) {
  const accent = statusAccent(detalhe.status);
  const isMobile = variante === 'mobile';
  const semSla = ocultarSla ?? isMobile;
  const iconSize = isMobile ? 15 : 18;

  const itensMetadadosMobile: ItemMetadado[] = [
    {
      chave: 'loja',
      icone: <LocationOnOutlinedIcon sx={{ fontSize: iconSize, color: '#E8520A' }} />,
      rotulo: 'Loja',
      valor: detalhe.loja,
    },
    {
      chave: 'categoria',
      icone: <CategoryOutlinedIcon sx={{ fontSize: iconSize }} />,
      rotulo: 'Categoria',
      valor: detalhe.categoria,
    },
    {
      chave: 'solicitante',
      icone: <PersonOutlineOutlinedIcon sx={{ fontSize: iconSize }} />,
      rotulo: 'Solicitante',
      valor: detalhe.solicitante,
    },
  ];
  if (detalhe.tecnico) {
    itensMetadadosMobile.push({
      chave: 'tecnico',
      icone: <EngineeringOutlinedIcon sx={{ fontSize: iconSize }} />,
      rotulo: 'Técnico responsável',
      valor: detalhe.tecnico,
    });
  }
  if (detalhe.local_detalhe) {
    itensMetadadosMobile.push({
      chave: 'local',
      icone: <PlaceOutlinedIcon sx={{ fontSize: iconSize }} />,
      rotulo: 'Local',
      valor: detalhe.local_detalhe,
    });
  }
  itensMetadadosMobile.push({
    chave: 'aberto_em',
    icone: <ScheduleOutlinedIcon sx={{ fontSize: iconSize }} />,
    rotulo: 'Aberto em',
    valor: formatDataHoraBrasilia(detalhe.aberto_em || detalhe.prazo_sla),
  });
  if (!semSla) {
    itensMetadadosMobile.push({
      chave: 'prazo_sla',
      icone: <ScheduleOutlinedIcon sx={{ fontSize: iconSize }} />,
      rotulo: 'Prazo SLA',
      valor: formatDataHoraBrasilia(detalhe.prazo_sla),
    });
  }

  const gridMetadados = isMobile ? (
    <MetadadosFlex itens={itensMetadadosMobile} compacto />
  ) : (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
        gap: { xs: 1.5, md: 2 },
        mb: 2,
      }}
    >
      <InfoCelula
        icone={<LocationOnOutlinedIcon sx={{ fontSize: iconSize, color: '#E8520A' }} />}
        rotulo="Loja"
        valor={detalhe.loja}
      />
      <InfoCelula
        icone={<CategoryOutlinedIcon sx={{ fontSize: iconSize }} />}
        rotulo="Categoria"
        valor={detalhe.categoria}
      />
      <InfoCelula
        icone={<PersonOutlineOutlinedIcon sx={{ fontSize: iconSize }} />}
        rotulo="Solicitante"
        valor={detalhe.solicitante}
      />
      {detalhe.tecnico && (
        <InfoCelula
          icone={<EngineeringOutlinedIcon sx={{ fontSize: iconSize }} />}
          rotulo="Técnico responsável"
          valor={detalhe.tecnico}
        />
      )}
      {detalhe.local_detalhe && (
        <InfoCelula
          icone={<PlaceOutlinedIcon sx={{ fontSize: iconSize }} />}
          rotulo="Local"
          valor={detalhe.local_detalhe}
        />
      )}
      <InfoCelula
        icone={<ScheduleOutlinedIcon sx={{ fontSize: iconSize }} />}
        rotulo="Aberto em"
        valor={formatDataHoraBrasilia(detalhe.aberto_em || detalhe.prazo_sla)}
      />
      {!semSla && (
        <InfoCelula
          icone={<ScheduleOutlinedIcon sx={{ fontSize: iconSize }} />}
          rotulo="Prazo SLA"
          valor={formatDataHoraBrasilia(detalhe.prazo_sla)}
        />
      )}
    </Box>
  );

  return (
    <Box sx={{ mb: isMobile ? 1.5 : 2 }}>
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
          boxShadow: isMobile ? '0 1px 6px rgba(27, 42, 107, 0.06)' : '0 2px 12px rgba(27, 42, 107, 0.08)',
        }}
      >
        <Box sx={{ height: 4, bgcolor: accent }} />

        <Box sx={{ p: isMobile ? 1.25 : { xs: 2, md: 2.5 } }}>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              mb: 1,
            }}
          >
            <Box
              sx={{
                bgcolor: 'rgba(27, 42, 107, 0.08)',
                color: NAVY,
                fontWeight: 800,
                fontSize: isMobile ? '0.85rem' : { xs: '0.9rem', md: '1rem' },
                px: 1.25,
                py: 0.4,
                borderRadius: 1,
                lineHeight: 1.2,
              }}
            >
              #{detalhe.numero}
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, justifyContent: 'flex-end' }}>
              {podeAssumir && onAssumir && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AssignmentIndIcon sx={{ fontSize: 18 }} />}
                  disabled={assumindo}
                  onClick={onAssumir}
                  sx={{ fontSize: '0.78rem', py: 0.5, px: 1.25, whiteSpace: 'nowrap' }}
                >
                  {assumindo ? 'Assumindo...' : rotuloAssumir}
                </Button>
              )}
              {statusChip(detalhe.status)}
              {urgenciaChip(detalhe.urgencia)}
              {chipsExtras}
              {detalhe.tipo_chamado === 'orcamento' && tipoChamadoChip('orcamento')}
            </Box>
          </Box>

          <Typography
            sx={{
              fontWeight: 800,
              color: NAVY,
              fontSize: isMobile ? '1rem' : { xs: '1.15rem', md: '1.35rem' },
              lineHeight: 1.3,
              mb: isMobile ? 1 : 1.5,
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
                lineHeight: 1.5,
                mb: isMobile ? 1.25 : 2,
                whiteSpace: 'pre-wrap',
                fontSize: isMobile ? '0.8rem' : undefined,
                bgcolor: 'rgba(27, 42, 107, 0.03)',
                borderRadius: 1.5,
                px: isMobile ? 1 : 1.5,
                py: isMobile ? 0.75 : 1.25,
                border: '1px solid rgba(27, 42, 107, 0.06)',
              }}
            >
              {detalhe.descricao}
            </Typography>
          )}

          {gridMetadados}

          {!semSla && (
            <>
              <Divider sx={{ mb: 1.25, borderColor: 'rgba(27, 42, 107, 0.08)' }} />

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
                    compact={isMobile}
                  />
                </Box>
              </Box>
            </>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
