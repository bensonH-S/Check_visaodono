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
  SlaCirculoPercentual,
  STATUS_CHAMADO,
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
  valor?: string;
  compacto?: boolean;
}) {
  const valorExibir = valor?.trim();
  return (
    <Box sx={{ display: 'flex', gap: compacto ? 0.5 : 1, alignItems: 'center', minWidth: 0 }}>
      <Box sx={{ color: NAVY, opacity: 0.7, flexShrink: 0, display: 'flex' }}>{icone}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', fontSize: compacto ? '0.62rem' : '0.68rem', lineHeight: 1.2 }}
        >
          {rotulo}
        </Typography>
        {valorExibir ? (
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
            {valorExibir}
          </Typography>
        ) : null}
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

function LinhaTecnicoResponsavel({
  tecnico,
  iconSize,
  compacto,
  podeAssumir,
  assumindo,
  onAssumir,
  rotuloAssumir,
}: {
  tecnico?: string | null;
  iconSize: number;
  compacto?: boolean;
  podeAssumir?: boolean;
  assumindo?: boolean;
  onAssumir?: () => void;
  rotuloAssumir: string;
}) {
  const temTecnico = Boolean(tecnico?.trim());
  const exibirAssumir = Boolean(podeAssumir && onAssumir);

  if (!temTecnico && !exibirAssumir) return null;

  const botaoAssumir = exibirAssumir ? (
    <Button
      variant="contained"
      size="small"
      disabled={assumindo}
      onClick={onAssumir}
      startIcon={
        assumindo ? undefined : (
          <AssignmentIndIcon sx={{ fontSize: '1.2em', width: '1.2em', height: '1.2em' }} />
        )
      }
      sx={{
        flexShrink: 0,
        minWidth: 'auto !important',
        width: 'auto',
        px: compacto ? 0.85 : 1.25,
        py: compacto ? 0.45 : 0.5,
        fontSize: compacto ? '0.7rem' : '0.78rem',
        fontWeight: 700,
        lineHeight: compacto ? 1.15 : undefined,
        whiteSpace: 'nowrap',
        boxShadow: 'none',
        '& .MuiButton-startIcon': {
          mr: compacto ? 0.25 : 0.35,
          ml: 0,
          '& svg': { fontSize: '1.2em', width: '1.2em', height: '1.2em' },
        },
      }}
    >
      {assumindo ? (compacto ? '…' : 'Assumindo...') : compacto ? 'Assumir' : rotuloAssumir}
    </Button>
  ) : null;

  if (!temTecnico) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          mb: 1.5,
          width: '100%',
        }}
      >
        {botaoAssumir}
      </Box>
    );
  }

  if (compacto) {
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: botaoAssumir ? 'minmax(0, 1fr) auto' : '1fr',
          alignItems: 'center',
          columnGap: 0.5,
          rowGap: 0,
          mb: 1.5,
          width: '100%',
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.45,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <EngineeringOutlinedIcon
            sx={{ fontSize: iconSize, flexShrink: 0, color: NAVY, opacity: 0.72 }}
          />
          <Typography
            component="div"
            noWrap
            sx={{
              minWidth: 0,
              fontSize: '0.75rem',
              lineHeight: 1.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              Técnico responsável
            </Box>
            <Box component="span" sx={{ color: 'text.secondary' }}>
              {': '}
            </Box>
            <Box component="span" sx={{ fontWeight: 700, color: NAVY }}>
              {tecnico!.trim()}
            </Box>
          </Typography>
        </Box>
        {botaoAssumir}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: botaoAssumir ? 'minmax(0, 1fr) auto' : '1fr',
        alignItems: 'center',
        gap: 1,
        mb: 1.5,
        minWidth: 0,
        width: '100%',
      }}
    >
      <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
        <InfoCelula
          icone={<EngineeringOutlinedIcon sx={{ fontSize: iconSize }} />}
          rotulo="Técnico responsável"
          valor={tecnico!.trim()}
        />
      </Box>
      {botaoAssumir}
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
      valor: detalhe.loja?.trim() || '—',
    },
  ];
  if (detalhe.local_detalhe?.trim()) {
    itensMetadadosMobile.push({
      chave: 'local',
      icone: <PlaceOutlinedIcon sx={{ fontSize: iconSize }} />,
      rotulo: 'Localização',
      valor: detalhe.local_detalhe.trim(),
    });
  }
  itensMetadadosMobile.push(
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
  );
  itensMetadadosMobile.push({
    chave: 'aberto_em',
    icone: <ScheduleOutlinedIcon sx={{ fontSize: iconSize }} />,
    rotulo: 'Aberto em',
    valor: formatDataHoraBrasilia(detalhe.aberto_em || detalhe.prazo_sla),
  });
  if (!semSla && !isMobile) {
    itensMetadadosMobile.push({
      chave: 'prazo_sla',
      icone: <ScheduleOutlinedIcon sx={{ fontSize: iconSize }} />,
      rotulo: 'Prazo SLA',
      valor: formatDataHoraBrasilia(detalhe.prazo_sla),
    });
  }

  const badgeStatusMobile = (() => {
    const st = STATUS_CHAMADO[detalhe.status] || {
      label: detalhe.status,
      color: '#4B5563',
      bg: '#F3F4F6',
    };
    return (
      <Box
        component="span"
        sx={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          height: 22,
          px: 0.85,
          borderRadius: 999,
          fontWeight: 700,
          fontSize: '0.62rem',
          bgcolor: st.bg,
          color: st.color,
          border: `1px solid ${accent}40`,
        }}
      >
        {st.label}
      </Box>
    );
  })();

  const gridMetadados = isMobile ? (
    <Box sx={{ width: '100%', minWidth: 0, mb: 0 }}>
      <MetadadosFlex
        itens={itensMetadadosMobile.filter((i) => i.chave !== 'aberto_em')}
        compacto
      />
      <LinhaTecnicoResponsavel
        tecnico={detalhe.tecnico}
        iconSize={iconSize}
        compacto
        podeAssumir={podeAssumir}
        assumindo={assumindo}
        onAssumir={onAssumir}
        rotuloAssumir={rotuloAssumir}
      />
    </Box>
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
      {detalhe.local_detalhe?.trim() && (
        <InfoCelula
          icone={<PlaceOutlinedIcon sx={{ fontSize: iconSize }} />}
          rotulo="Localização"
          valor={detalhe.local_detalhe.trim()}
        />
      )}
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
      <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
        <LinhaTecnicoResponsavel
          tecnico={detalhe.tecnico}
          iconSize={iconSize}
          podeAssumir={podeAssumir}
          assumindo={assumindo}
          onAssumir={onAssumir}
          rotuloAssumir={rotuloAssumir}
        />
      </Box>
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
    <Box sx={{ mb: isMobile ? 0 : 2 }}>
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
          {isMobile ? (
            <>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  mb: detalhe.descricao ? 0.85 : 1,
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
                  }}
                >
                  #{detalhe.numero}
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
                    fontSize: '0.94rem',
                    flex: 1,
                    minWidth: 0,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {detalhe.titulo}
                </Typography>
              </Box>

              {detalhe.descricao && (
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    lineHeight: 1.5,
                    mb: 1,
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.8rem',
                    bgcolor: 'rgba(27, 42, 107, 0.03)',
                    borderRadius: 1.5,
                    px: 1,
                    py: 0.75,
                    border: '1px solid rgba(27, 42, 107, 0.06)',
                  }}
                >
                  {detalhe.descricao}
                </Typography>
              )}

              {gridMetadados}

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.65,
                  mt: 1,
                  pt: 0.85,
                  borderTop: '1px solid rgba(27, 42, 107, 0.06)',
                  minWidth: 0,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, minWidth: 0, flex: 1, overflow: 'hidden' }}>
                  <ScheduleOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: '0.68rem', fontWeight: 600, flexShrink: 0 }}
                  >
                    Aberto em
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: NAVY,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatDataHoraBrasilia(detalhe.aberto_em || detalhe.prazo_sla)}
                  </Typography>
                </Box>
                {badgeStatusMobile}
                {urgenciaChip(detalhe.urgencia)}
                {chipsExtras}
                {detalhe.tipo_chamado === 'orcamento' && tipoChamadoChip('orcamento')}
                <SlaCirculoPercentual
                  abertoEm={detalhe.aberto_em}
                  prazoSla={detalhe.prazo_sla}
                  status={detalhe.status}
                  fechadoEm={detalhe.fechado_em ?? undefined}
                  size={34}
                />
              </Box>
            </>
          ) : (
            <>
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
                fontSize: { xs: '0.9rem', md: '1rem' },
                px: 1.25,
                py: 0.4,
                borderRadius: 1,
                lineHeight: 1.2,
              }}
            >
              #{detalhe.numero}
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, justifyContent: 'flex-end' }}>
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
                lineHeight: 1.5,
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
                  />
                </Box>
              </Box>
            </>
          )}
            </>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
