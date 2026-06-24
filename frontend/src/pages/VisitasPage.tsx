import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableContainer from '@mui/material/TableContainer';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { api, fmtNota, fmtData, notaChipSx } from '../api/client';
import type { VisitaResumo } from '../api/client';
import { tableCellWrapSx, tableContainerSx, tablePageLayoutSx, tablePaperSx, tableSx } from '../utils/tablePageLayout';
import { colors } from '../theme/tokens';

const STATUS_VISITA = [
  { value: 'Rascunho', label: 'Rascunho', color: '#92400E', bg: '#FEF3C7', accent: '#F59E0B' },
  { value: 'Finalizada', label: 'Finalizada', color: '#166534', bg: '#DCFCE7', accent: '#22C55E' },
] as const;

function notaChip(nota: string | number | null | undefined) {
  if (nota == null) return '—';
  const valor = Number(nota);
  return <Chip label={fmtNota(valor)} size="small" sx={notaChipSx(valor)} />;
}

function statusChip(status: string) {
  const cfg = STATUS_VISITA.find((s) => s.value === status);
  if (!cfg) {
    return <Chip label={status} size="small" variant="outlined" />;
  }
  return (
    <Chip
      label={cfg.label}
      size="small"
      sx={{
        fontWeight: 700,
        fontSize: '0.72rem',
        color: cfg.color,
        bgcolor: cfg.bg,
        border: `1px solid ${cfg.accent}40`,
      }}
    />
  );
}

function statusAccent(status: string) {
  return STATUS_VISITA.find((s) => s.value === status)?.accent ?? colors.navy;
}

function MetaLinha({
  icon,
  label,
  valor,
}: {
  icon: ReactNode;
  label: string;
  valor: string;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, minWidth: 0 }}>
      <Box sx={{ color: colors.textMuted, mt: 0.15, flexShrink: 0, display: 'flex' }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.35, wordBreak: 'break-word' }}>
          {valor}
        </Typography>
      </Box>
    </Box>
  );
}

function VisitaCardMobile({ visita: v }: { visita: VisitaResumo }) {
  const accent = statusAccent(v.status);
  return (
    <Paper
      component={Link}
      to={`/relatorio/visita/${v.id_visita}`}
      elevation={0}
      sx={{
        display: 'flex',
        textDecoration: 'none',
        color: 'inherit',
        borderRadius: 2,
        border: '1px solid',
        borderColor: colors.border,
        bgcolor: colors.surface,
        boxShadow: '0 1px 3px rgba(27, 42, 107, 0.06)',
        overflow: 'hidden',
        flexShrink: 0,
        '&:active': { bgcolor: 'rgba(27, 42, 107, 0.04)' },
      }}
    >
      <Box aria-hidden sx={{ width: 4, flexShrink: 0, bgcolor: accent }} />
      <Box sx={{ flex: 1, minWidth: 0, p: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.25 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colors.navy, lineHeight: 1.3 }}>
              {v.name}
            </Typography>
            {v.bk_number && (
              <Typography variant="caption" color="text.secondary">
                BKN {v.bk_number}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
            {statusChip(v.status)}
            {notaChip(v.nota_final)}
          </Box>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 1.25,
            mb: 1.25,
          }}
        >
          <MetaLinha
            icon={<ScheduleOutlinedIcon sx={{ fontSize: 16 }} />}
            label="Data"
            valor={fmtData(v.data_visita)}
          />
          <MetaLinha
            icon={<ScheduleOutlinedIcon sx={{ fontSize: 16 }} />}
            label="Duração"
            valor={v.duracao_minutos ? `${v.duracao_minutos} min` : '—'}
          />
          <MetaLinha
            icon={<PersonOutlineOutlinedIcon sx={{ fontSize: 16 }} />}
            label="Usuário"
            valor={v.nome_usuario}
          />
          <MetaLinha
            icon={<AssignmentOutlinedIcon sx={{ fontSize: 16 }} />}
            label="Checklist"
            valor={v.tipo_checklist_nome ?? 'Auditoria Operacional'}
          />
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pt: 1,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: colors.navy }}>
            <StorefrontOutlinedIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              Ver relatório
            </Typography>
          </Box>
          <ChevronRightIcon sx={{ fontSize: 20, color: colors.textMuted }} />
        </Box>
      </Box>
    </Paper>
  );
}

function FiltrosStatus({
  visitas,
  filtroStatus,
  onFiltro,
  mobile,
}: {
  visitas: VisitaResumo[];
  filtroStatus: string;
  onFiltro: (status: string) => void;
  mobile: boolean;
}) {
  const contagemPorStatus = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of STATUS_VISITA) map.set(s.value, 0);
    for (const v of visitas) {
      map.set(v.status, (map.get(v.status) ?? 0) + 1);
    }
    return map;
  }, [visitas]);

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        flexShrink: 0,
        flexWrap: mobile ? 'nowrap' : 'wrap',
        overflowX: mobile ? 'auto' : 'visible',
        pb: mobile ? 0.25 : 0,
        mx: mobile ? -0.5 : 0,
        px: mobile ? 0.5 : 0,
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      <Chip
        label={`Todos · ${visitas.length}`}
        onClick={() => onFiltro('')}
        variant={filtroStatus === '' ? 'filled' : 'outlined'}
        sx={{
          fontWeight: 700,
          flexShrink: 0,
          bgcolor: filtroStatus === '' ? colors.navy : 'white',
          color: filtroStatus === '' ? 'white' : colors.navy,
          borderColor: colors.navyBorder,
        }}
      />
      {STATUS_VISITA.map((st) => {
        const qtd = contagemPorStatus.get(st.value) ?? 0;
        const ativo = filtroStatus === st.value;
        return (
          <Chip
            key={st.value}
            label={`${st.label} · ${qtd}`}
            onClick={() => onFiltro(ativo ? '' : st.value)}
            variant={ativo ? 'filled' : 'outlined'}
            sx={{
              fontWeight: 600,
              fontSize: '0.78rem',
              flexShrink: 0,
              bgcolor: ativo ? st.bg : 'white',
              color: ativo ? st.color : 'text.secondary',
              borderColor: `${st.accent}50`,
            }}
          />
        );
      })}
    </Box>
  );
}

export default function VisitasPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [visitas, setVisitas] = useState<VisitaResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  useEffect(() => {
    api
      .visitas()
      .then(setVisitas)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const visitasFiltradas = useMemo(
    () => (filtroStatus ? visitas.filter((v) => v.status === filtroStatus) : visitas),
    [visitas, filtroStatus],
  );

  if (loading) return <LinearProgress />;

  if (err) return <Typography color="error">{err}</Typography>;

  if (!visitas.length) {
    return (
      <Box sx={tablePageLayoutSx}>
        <Paper
          elevation={0}
          sx={{
            ...tablePaperSx,
            alignItems: 'center',
            justifyContent: 'center',
            p: { xs: 3, md: 4 },
            textAlign: 'center',
          }}
        >
          <Typography color="text.secondary">Nenhuma visita registrada ainda.</Typography>
          <Button
            component={Link}
            to="/checklist"
            variant="contained"
            fullWidth={isMobile}
            sx={{ mt: 2, maxWidth: isMobile ? 'none' : 280 }}
          >
            Iniciar checklist
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ ...tablePageLayoutSx, gap: { xs: 1, md: 1.5 } }}>
      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0, fontSize: { xs: '0.8rem', md: '0.875rem' } }}>
        {visitasFiltradas.length} de {visitas.length} visita(s)
      </Typography>

      <FiltrosStatus
        visitas={visitas}
        filtroStatus={filtroStatus}
        onFiltro={setFiltroStatus}
        mobile={isMobile}
      />

      {isMobile ? (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
            pb: 0.5,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {visitasFiltradas.map((v) => (
            <VisitaCardMobile key={v.id_visita} visita={v} />
          ))}
          {!visitasFiltradas.length && (
            <Paper
              elevation={0}
              sx={{
                p: 3,
                textAlign: 'center',
                border: '1px solid',
                borderColor: colors.border,
                borderRadius: 2,
              }}
            >
              <Typography color="text.secondary">Nenhuma visita com este status.</Typography>
            </Paper>
          )}
        </Box>
      ) : (
        <Paper elevation={0} sx={tablePaperSx}>
          <TableContainer sx={tableContainerSx}>
            <Table size="small" stickyHeader sx={tableSx}>
              <TableHead>
                <TableRow>
                  <TableCell>Loja</TableCell>
                  <TableCell>Checklist</TableCell>
                  <TableCell>Data</TableCell>
                  <TableCell>Duração</TableCell>
                  <TableCell>Usuário</TableCell>
                  <TableCell align="center">Nota</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="center" width={88} />
                </TableRow>
              </TableHead>
              <TableBody>
                {visitasFiltradas.map((v) => (
                  <TableRow key={v.id_visita} hover>
                    <TableCell sx={tableCellWrapSx}>{v.name}</TableCell>
                    <TableCell sx={tableCellWrapSx}>
                      {v.tipo_checklist_nome ?? 'Auditoria Operacional'}
                    </TableCell>
                    <TableCell>{fmtData(v.data_visita)}</TableCell>
                    <TableCell>{v.duracao_minutos ? `${v.duracao_minutos} min` : '—'}</TableCell>
                    <TableCell sx={tableCellWrapSx}>{v.nome_usuario}</TableCell>
                    <TableCell align="center">{notaChip(v.nota_final)}</TableCell>
                    <TableCell align="center">{statusChip(v.status)}</TableCell>
                    <TableCell align="center">
                      <Button component={Link} to={`/relatorio/visita/${v.id_visita}`} size="small">
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!visitasFiltradas.length && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      Nenhuma visita com este status.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}
