import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
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
import { api, fmtData, fmtNota, scoreColor } from '../api/client';
import type { NcItem, NcResponse } from '../api/client';
import { agruparNcsPorVisita, parseNcDescricao } from '../components/nc/ncPageUtils';

type FiltroStatus = 'aberto' | 'todas';

function gravChipColor(g: string): 'error' | 'warning' | 'default' {
  if (g === 'Crítica') return 'error';
  if (g === 'Moderada') return 'warning';
  return 'default';
}

function NcItemLinha({ nc }: { nc: NcItem }) {
  const { codigo, texto, obs } = parseNcDescricao(nc.descricao);
  const resolvida = nc.status === 'Resolvida';

  return (
    <Box
      sx={{
        py: 1.25,
        px: 1.5,
        borderRadius: 1,
        bgcolor: resolvida ? 'action.hover' : 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        opacity: resolvida ? 0.72 : 1,
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.4 }}>
            {codigo && (
              <Box component="span" sx={{ color: 'text.secondary', mr: 0.75 }}>
                {codigo}
              </Box>
            )}
            {texto}
          </Typography>
          {obs && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Obs.: {obs}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
          <Chip label={nc.gravidade} size="small" color={gravChipColor(nc.gravidade)} />
          {nc.status !== 'Em aberto' && (
            <Chip label={nc.status} size="small" variant="outlined" color="success" />
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default function NcPage() {
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
  if (!data) return <LinearProgress />;

  const visitasPendentes =
    filtro === 'aberto'
      ? Number(data.stats.visitas_pendentes ?? visitas.length)
      : visitas.length;

  return (
    <div>
      <Grid container spacing={2} sx={{ mb: 2, alignItems: 'center' }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper className="p-4">
            <Typography variant="caption" color="text.secondary">
              Visitas com pendências
            </Typography>
            <Typography variant="h4">{visitasPendentes}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper className="p-4">
            <Typography variant="caption" color="text.secondary">
              Itens em aberto
            </Typography>
            <Typography variant="h4">{data.stats.total_aberto}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper className="p-4 border-t-[3px] border-[#E8520A]">
            <Typography variant="caption" color="text.secondary">
              Críticas
            </Typography>
            <Typography variant="h4" color="primary">
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
          >
            <ToggleButton value="aberto">Em aberto</ToggleButton>
            <ToggleButton value="todas">Todas</ToggleButton>
          </ToggleButtonGroup>
        </Grid>
      </Grid>

      {visitas.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {filtro === 'aberto'
              ? 'Nenhuma não conformidade em aberto de checklists finalizados.'
              : 'Nenhuma não conformidade de checklists finalizados.'}
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {visitas.map((visita) => {
            const nota = visita.nota_final;
            const corNota = nota != null ? scoreColor(nota) : undefined;

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
                  borderColor: 'divider',
                  '&:before': { display: 'none' },
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2, py: 0.5 }}>
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
                    <StorefrontIcon fontSize="small" color="action" />
                    <Box sx={{ flex: 1, minWidth: 200 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                        {visita.loja}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {fmtData(visita.data_visita)} · Visita #{visita.id_visita}
                      </Typography>
                    </Box>
                    {nota != null && (
                      <Chip
                        label={`Nota ${fmtNota(nota)}`}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          bgcolor: `${corNota}18`,
                          color: corNota,
                          border: `1px solid ${corNota}55`,
                        }}
                      />
                    )}
                    <Chip
                      label={`${visita.abertas} item(ns)`}
                      size="small"
                      variant="outlined"
                    />
                    {visita.criticas > 0 && (
                      <Chip label={`${visita.criticas} crítica(s)`} size="small" color="error" />
                    )}
                    <Button
                      component={Link}
                      to={`/relatorio/visita/${visita.id_visita}`}
                      size="small"
                      variant="outlined"
                      endIcon={<OpenInNewIcon fontSize="small" />}
                      onClick={(e) => e.stopPropagation()}
                      sx={{ ml: { md: 'auto' } }}
                    >
                      Relatório
                    </Button>
                  </Box>
                </AccordionSummary>

                <AccordionDetails sx={{ px: 2, pb: 2, pt: 0, bgcolor: 'grey.50' }}>
                  {visita.resumoGeral && (
                    <Alert
                      severity={visita.resumoGeral.gravidade === 'Crítica' ? 'error' : 'warning'}
                      sx={{ mb: 2 }}
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
                            color: 'text.secondary',
                            letterSpacing: 0.6,
                            mb: 1,
                          }}
                        >
                          {area} ({itens.length})
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {itens.map((nc) => (
                            <NcItemLinha key={nc.id_nc} nc={nc} />
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
