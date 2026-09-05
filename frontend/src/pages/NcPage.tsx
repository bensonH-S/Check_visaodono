import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Alert from '@mui/material/Alert';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import StorefrontIcon from '@mui/icons-material/Storefront';
import PageLoading from '../components/PageLoading';
import { api, fmtData, fmtNota, scoreChipSx } from '../api/client';
import type { NcItem, NcResponse } from '../api/client';
import { agruparNcsPorVisita, parseNcDescricao } from '../components/nc/ncPageUtils';
import { colors } from '../theme/tokens';
import { useAppTheme } from '../context/ThemeContext';

type FiltroStatus = 'aberto' | 'todas';

function gravChipSx(g: string, escuro: boolean) {
  if (g === 'Crítica') {
    return {
      bgcolor: escuro ? 'rgba(248, 113, 113, 0.2)' : 'rgba(220, 38, 38, 0.1)',
      color: escuro ? '#FCA5A5' : '#B91C1C',
      border: '1px solid',
      borderColor: escuro ? 'rgba(248, 113, 113, 0.45)' : 'rgba(220, 38, 38, 0.35)',
      fontWeight: 700,
    };
  }
  if (g === 'Moderada') {
    return {
      bgcolor: escuro ? 'rgba(251, 191, 36, 0.18)' : 'rgba(217, 119, 6, 0.12)',
      color: escuro ? '#FCD34D' : '#B45309',
      border: '1px solid',
      borderColor: escuro ? 'rgba(251, 191, 36, 0.4)' : 'rgba(217, 119, 6, 0.35)',
      fontWeight: 700,
    };
  }
  return {
    bgcolor: escuro ? 'rgba(148, 163, 184, 0.14)' : 'rgba(107, 114, 128, 0.1)',
    color: escuro ? '#CBD5E1' : '#374151',
    border: '1px solid',
    borderColor: escuro ? 'rgba(148, 163, 184, 0.35)' : 'rgba(107, 114, 128, 0.25)',
    fontWeight: 600,
  };
}

function NcItemLinha({ nc, escuro }: { nc: NcItem; escuro: boolean }) {
  const { codigo, texto, obs } = parseNcDescricao(nc.descricao);
  const resolvida = nc.status === 'Resolvida';

  return (
    <Box
      sx={{
        py: 1.25,
        px: 1.5,
        borderRadius: 1,
        bgcolor: resolvida
          ? escuro
            ? 'rgba(148, 163, 184, 0.08)'
            : 'action.hover'
          : colors.surface,
        border: '1px solid',
        borderColor: resolvida ? colors.border : escuro ? 'rgba(148, 163, 184, 0.28)' : colors.border,
        opacity: resolvida ? 0.78 : 1,
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.4, color: colors.textPrimary }}>
            {codigo && (
              <Box component="span" sx={{ color: colors.textSecondary, mr: 0.75 }}>
                {codigo}
              </Box>
            )}
            {texto}
          </Typography>
          {obs && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: colors.textSecondary }}>
              Obs.: {obs}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
          <Chip label={nc.gravidade} size="small" sx={gravChipSx(nc.gravidade, escuro)} />
          {nc.status !== 'Em aberto' && (
            <Chip
              label={nc.status}
              size="small"
              sx={{
                fontWeight: 700,
                bgcolor: escuro ? 'rgba(52, 211, 153, 0.18)' : 'rgba(5, 150, 105, 0.1)',
                color: escuro ? '#6EE7B7' : '#047857',
                border: '1px solid',
                borderColor: escuro ? 'rgba(52, 211, 153, 0.45)' : 'rgba(5, 150, 105, 0.35)',
              }}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default function NcPage() {
  const { mode } = useAppTheme();
  const escuro = mode === 'dark';
  const [data, setData] = useState<NcResponse | null>(null);
  const [err, setErr] = useState('');
  const [filtro, setFiltro] = useState<FiltroStatus>('aberto');
  const [expandido, setExpandido] = useState<number | false>(false);

  useEffect(() => {
    setData(null);
    const params = filtro === 'aberto' ? { status: 'Em aberto' } : undefined;
    api
      .naoConformidades(params)
      .then((res) => {
        setData(res);
        const grupos = agruparNcsPorVisita(res.items);
        setExpandido(grupos[0]?.id_visita ?? false);
      })
      .catch((e) => setErr(e.message));
  }, [filtro]);

  const visitas = useMemo(() => (data ? agruparNcsPorVisita(data.items) : []), [data]);

  if (err) return <Typography color="error">{err}</Typography>;
  if (!data) return <PageLoading />;

  const visitasPendentes =
    filtro === 'aberto'
      ? Number(data.stats.visitas_pendentes ?? visitas.length)
      : visitas.length;

  const statPaperSx = {
    p: 2,
    borderRadius: 2,
    bgcolor: colors.surface,
    border: '1px solid',
    borderColor: escuro ? 'rgba(148, 163, 184, 0.28)' : colors.border,
  } as const;

  return (
    <div>
      <Grid container spacing={2} sx={{ mb: 2, alignItems: 'center' }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper sx={statPaperSx}>
            <Typography variant="caption" sx={{ color: colors.textSecondary }}>
              Visitas com pendências
            </Typography>
            <Typography variant="h4" sx={{ color: colors.textPrimary, fontWeight: 700 }}>
              {visitasPendentes}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper sx={statPaperSx}>
            <Typography variant="caption" sx={{ color: colors.textSecondary }}>
              Itens em aberto
            </Typography>
            <Typography variant="h4" sx={{ color: colors.textPrimary, fontWeight: 700 }}>
              {data.stats.total_aberto}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper
            sx={{
              ...statPaperSx,
              borderTop: '3px solid #E8520A',
              bgcolor: escuro ? 'rgba(232, 82, 10, 0.12)' : colors.surface,
            }}
          >
            <Typography variant="caption" sx={{ color: colors.textSecondary }}>
              Críticas
            </Typography>
            <Typography variant="h4" sx={{ color: '#E8520A', fontWeight: 700 }}>
              {data.stats.criticas}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }} sx={{ display: 'flex', justifyContent: { md: 'flex-end' } }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={filtro}
            onChange={(_, v: FiltroStatus | null) => v && setFiltro(v)}
            sx={{
              bgcolor: colors.surface,
              border: `1px solid ${colors.border}`,
              '& .MuiToggleButton-root': {
                color: colors.textSecondary,
                border: 'none',
                '&.Mui-selected': {
                  bgcolor: escuro ? 'rgba(232, 82, 10, 0.2)' : 'rgba(27, 42, 107, 0.08)',
                  color: escuro ? '#E8520A' : '#1B2A6B',
                  fontWeight: 700,
                },
              },
            }}
          >
            <ToggleButton value="aberto">Em aberto</ToggleButton>
            <ToggleButton value="todas">Todas</ToggleButton>
          </ToggleButtonGroup>
        </Grid>
      </Grid>

      {visitas.length === 0 ? (
        <Paper sx={{ ...statPaperSx, p: 4, textAlign: 'center' }}>
          <Typography sx={{ color: colors.textSecondary }}>
            {filtro === 'aberto'
              ? 'Nenhuma não conformidade em aberto de checklists finalizados.'
              : 'Nenhuma não conformidade de checklists finalizados.'}
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {visitas.map((visita) => {
            const nota = visita.nota_final;

            return (
              <Accordion
                key={visita.id_visita}
                expanded={expandido === visita.id_visita}
                onChange={(_, aberto) => setExpandido(aberto ? visita.id_visita : false)}
                disableGutters
                sx={{
                  borderRadius: '12px !important',
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: escuro ? 'rgba(148, 163, 184, 0.28)' : colors.border,
                  bgcolor: colors.surface,
                  '&:before': { display: 'none' },
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: colors.textSecondary }} />} sx={{ px: 2, py: 0.5 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 1.5,
                      width: '100%',
                      pr: 1,
                    }}
                  >
                    <StorefrontIcon fontSize="small" sx={{ color: colors.textSecondary }} />
                    <Box sx={{ flex: 1, minWidth: 200 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3, color: colors.textPrimary }}>
                        {visita.loja}
                      </Typography>
                      <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                        {fmtData(visita.data_visita)} · Visita #{visita.id_visita}
                      </Typography>
                    </Box>
                    {nota != null && (
                      <Chip
                        label={`Nota ${fmtNota(nota)}`}
                        size="small"
                        sx={scoreChipSx(nota, escuro)}
                      />
                    )}
                    <Chip
                      label={`${visita.abertas} item(ns)`}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        bgcolor: escuro ? 'rgba(148, 163, 184, 0.14)' : 'transparent',
                        color: colors.textPrimary,
                        border: '1px solid',
                        borderColor: escuro ? 'rgba(148, 163, 184, 0.35)' : colors.border,
                      }}
                    />
                    {visita.criticas > 0 && (
                      <Chip
                        label={`${visita.criticas} crítica(s)`}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          bgcolor: escuro ? 'rgba(248, 113, 113, 0.2)' : 'rgba(220, 38, 38, 0.1)',
                          color: escuro ? '#FCA5A5' : '#B91C1C',
                          border: '1px solid',
                          borderColor: escuro ? 'rgba(248, 113, 113, 0.45)' : 'rgba(220, 38, 38, 0.35)',
                        }}
                      />
                    )}
                    <Button
                      component={Link}
                      to={`/relatorio/visita/${visita.id_visita}`}
                      size="small"
                      variant="outlined"
                      endIcon={<OpenInNewIcon fontSize="small" />}
                      onClick={(e) => e.stopPropagation()}
                      sx={{
                        ml: { md: 'auto' },
                        borderColor: escuro ? 'rgba(148, 163, 184, 0.4)' : colors.border,
                        color: colors.textPrimary,
                        '&:hover': {
                          borderColor: escuro ? 'rgba(248, 250, 252, 0.55)' : colors.borderStrong,
                          bgcolor: escuro ? 'rgba(248, 250, 252, 0.1)' : 'rgba(27, 42, 107, 0.04)',
                          color: escuro ? '#F8FAFC' : colors.textPrimary,
                        },
                      }}
                    >
                      Relatório
                    </Button>
                  </Box>
                </AccordionSummary>

                <AccordionDetails
                  sx={{
                    px: 2,
                    pb: 2,
                    pt: 0,
                    bgcolor: escuro ? 'rgba(15, 23, 42, 0.45)' : colors.canvasAlt,
                  }}
                >
                  {visita.resumoGeral && (
                    <Alert
                      severity="warning"
                      icon={false}
                      sx={{
                        mb: 2,
                        bgcolor: colors.orangeLight,
                        color: escuro ? '#FDBA74' : '#9A3412',
                        border: '1px solid',
                        borderColor: escuro ? 'rgba(232, 82, 10, 0.45)' : 'rgba(232, 82, 10, 0.28)',
                        '& .MuiAlert-message': { color: 'inherit', fontWeight: 600 },
                      }}
                    >
                      {visita.resumoGeral.descricao}
                    </Alert>
                  )}

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {visita.porArea.map(({ area, itens }) => (
                      <Box key={area}>
                        <Typography
                          variant="overline"
                          sx={{
                            display: 'block',
                            fontWeight: 700,
                            color: colors.textSecondary,
                            letterSpacing: 0.6,
                            mb: 1,
                          }}
                        >
                          {area} ({itens.length})
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {itens.map((nc) => (
                            <NcItemLinha key={nc.id_nc} nc={nc} escuro={escuro} />
                          ))}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>
      )}
    </div>
  );
}
