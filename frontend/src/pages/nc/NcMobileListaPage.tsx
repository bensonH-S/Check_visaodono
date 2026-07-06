import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { api, fmtData, fmtNota, scoreColor } from '../../api/client';
import type { NcItem } from '../../api/client';
import { agruparNcsPorVisita, parseNcDescricao } from '../../components/nc/ncPageUtils';
import { MOBILE_SCROLL_AREA } from '../../theme/safeArea';

const NAVY = '#1B2A6B';

type Aba = 'abertas' | 'resolvidas';

function gravColor(g: string): 'error' | 'warning' | 'default' {
  if (g === 'Crítica') return 'error';
  if (g === 'Moderada') return 'warning';
  return 'default';
}

export default function NcMobileListaPage() {
  const navigate = useNavigate();
  const [aba, setAba] = useState<Aba>('abertas');
  const [itens, setItens] = useState<NcItem[]>([]);
  const [stats, setStats] = useState({ total_aberto: '0', criticas: '0', visitas_pendentes: '0' });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .naoConformidades(aba === 'abertas' ? { status: 'Em aberto' } : undefined)
      .then((res) => {
        const lista =
          aba === 'resolvidas'
            ? res.items.filter((i) => i.status === 'Resolvida')
            : res.items;
        setItens(lista);
        setStats(res.stats);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [aba]);

  const visitas = useMemo(() => agruparNcsPorVisita(itens), [itens]);

  if (loading) return <LinearProgress />;
  if (err) return <Typography color="error">{err}</Typography>;

  return (
    <Box sx={{ ...MOBILE_SCROLL_AREA, maxWidth: 480, mx: 'auto', width: '100%', pb: 2 }}>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Paper sx={{ flex: 1, p: 1.5, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: NAVY }}>
            {stats.visitas_pendentes ?? visitas.length}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Visitas
          </Typography>
        </Paper>
        <Paper sx={{ flex: 1, p: 1.5, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: NAVY }}>
            {stats.total_aberto}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Em aberto
          </Typography>
        </Paper>
        <Paper sx={{ flex: 1, p: 1.5, textAlign: 'center', borderTop: '3px solid #E8520A' }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#E8520A' }}>
            {stats.criticas}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Críticas
          </Typography>
        </Paper>
      </Box>

      <ToggleButtonGroup
        fullWidth
        exclusive
        size="small"
        value={aba}
        onChange={(_, v: Aba | null) => v && setAba(v)}
        sx={{ mb: 2 }}
      >
        <ToggleButton value="abertas">Em aberto</ToggleButton>
        <ToggleButton value="resolvidas">Resolvidas</ToggleButton>
      </ToggleButtonGroup>

      {visitas.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {aba === 'abertas'
              ? 'Nenhuma pendência de checklist na sua região.'
              : 'Nenhuma NC resolvida ainda.'}
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {visitas.map((visita) => {
            const nota = visita.nota_final;
            const pendentes = visita.itens.filter((i) => i.status === 'Em aberto');
            const lista = aba === 'abertas' ? pendentes : visita.itens.filter((i) => i.status === 'Resolvida');
            if (!lista.length) return null;

            return (
              <Paper key={visita.id_visita} sx={{ overflow: 'hidden' }}>
                <Box sx={{ px: 2, py: 1.5, bgcolor: 'rgba(27,42,107,0.04)', borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: NAVY }}>
                    {visita.loja}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
                    <Chip label={fmtData(visita.data_visita)} size="small" variant="outlined" />
                    {nota != null && (
                      <Chip
                        label={`Nota ${fmtNota(nota)}`}
                        size="small"
                        sx={{ fontWeight: 700, color: scoreColor(nota), borderColor: `${scoreColor(nota)}55` }}
                        variant="outlined"
                      />
                    )}
                    {visita.criticas > 0 && aba === 'abertas' && (
                      <Chip label={`${visita.criticas} crítica(s)`} size="small" color="error" />
                    )}
                  </Box>
                </Box>

                {lista.map((nc) => {
                  const { codigo, texto } = parseNcDescricao(nc.descricao);
                  if (nc.area === 'Resultado geral') {
                    return (
                      <Box
                        key={nc.id_nc}
                        onClick={() => aba === 'abertas' && navigate(`/nc/mobile/${nc.id_nc}`)}
                        sx={{
                          px: 2,
                          py: 1.25,
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          cursor: aba === 'abertas' ? 'pointer' : 'default',
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {nc.descricao}
                        </Typography>
                        <Chip label={nc.gravidade} size="small" color={gravColor(nc.gravidade)} sx={{ mt: 0.75 }} />
                      </Box>
                    );
                  }
                  return (
                    <Box
                      key={nc.id_nc}
                      onClick={() => aba === 'abertas' && navigate(`/nc/mobile/${nc.id_nc}`)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 2,
                        py: 1.25,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        cursor: aba === 'abertas' ? 'pointer' : 'default',
                        '&:active': aba === 'abertas' ? { bgcolor: 'action.hover' } : undefined,
                      }}
                    >
                      <WarningAmberIcon
                        fontSize="small"
                        color={nc.gravidade === 'Crítica' ? 'error' : 'warning'}
                        sx={{ flexShrink: 0 }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {nc.area}
                          {codigo ? ` · ${codigo}` : ''}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.35 }}>
                          {texto}
                        </Typography>
                      </Box>
                      {aba === 'abertas' && <ChevronRightIcon color="action" />}
                      {aba === 'resolvidas' && (
                        <Chip label="Resolvida" size="small" color="success" variant="outlined" />
                      )}
                    </Box>
                  );
                })}
              </Paper>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
