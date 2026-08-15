import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Tooltip from '@mui/material/Tooltip';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import VisitasMobileScreen from '../components/visitas/VisitasMobileScreen';
import DialogTitleWithIcon from '../components/DialogTitleWithIcon';
import { api, fmtNota, fmtData, notaChipSx } from '../api/client';
import type { VisitaResumo } from '../api/client';
import { getUsuario, podeApagarVisitas, podeReabrirVisitas } from '../lib/auth';
import { showToast } from '../utils/toast';
import { gerarPdfVisitasPorPessoa } from '../utils/gerarPdfVisitasPorPessoa';
import { tableCellWrapSx, tableContainerSx, tablePageLayoutSx, tablePaperSx, tableSx } from '../utils/tablePageLayout';
import { colors } from '../theme/tokens';

type OrdenacaoVisitas = 'data_desc' | 'nota_desc';

const TIPOS_CHECKLIST = [
  { codigo: 'auditoria_operacional', nome: 'Auditoria Operacional' },
  { codigo: 'time_de_campo', nome: 'Time de Campo' },
] as const;

function codigoTipoVisita(v: VisitaResumo): string {
  return v.tipo_checklist_codigo || 'auditoria_operacional';
}

function podeEnviarEmailRelatorio(v: VisitaResumo): boolean {
  return v.status === 'Finalizada' && codigoTipoVisita(v) === 'auditoria_operacional';
}

function nomeTipoVisita(codigo: string, visitas: VisitaResumo[]): string {
  const daLista = visitas.find((v) => codigoTipoVisita(v) === codigo)?.tipo_checklist_nome;
  if (daLista) return daLista;
  return TIPOS_CHECKLIST.find((t) => t.codigo === codigo)?.nome ?? codigo;
}

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

function checklistBasePath(pathname: string) {
  return pathname.includes('/mobile') ? '/checklist/mobile' : '/checklist';
}

function VisitaCardMobile({
  visita: v,
  checklistBase,
  podeApagar,
  onApagar,
  podeReabrir,
  onReabrir,
  enviandoEmail,
  onEnviarEmail,
}: {
  visita: VisitaResumo;
  checklistBase: string;
  podeApagar?: boolean;
  onApagar?: (v: VisitaResumo) => void;
  podeReabrir?: boolean;
  onReabrir?: (v: VisitaResumo) => void;
  enviandoEmail?: boolean;
  onEnviarEmail?: (v: VisitaResumo) => void;
}) {
  const accent = statusAccent(v.status);
  const emRascunho = v.status === 'Rascunho';
  const podeEmail = podeEnviarEmailRelatorio(v) && !!onEnviarEmail;
  const destino = emRascunho
    ? `${checklistBase}?visita=${v.id_visita}`
    : `/relatorio/visita/${v.id_visita}`;
  return (
    <Paper
      elevation={0}
      sx={{
        display: 'flex',
        color: 'inherit',
        borderRadius: 2,
        border: '1px solid',
        borderColor: colors.border,
        bgcolor: colors.surface,
        boxShadow: '0 1px 3px rgba(27, 42, 107, 0.06)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <Box aria-hidden sx={{ width: 4, flexShrink: 0, bgcolor: accent }} />
      <Box
        component={Link}
        to={destino}
        sx={{
          flex: 1,
          minWidth: 0,
          p: 1.5,
          textDecoration: 'none',
          color: 'inherit',
          '&:active': { bgcolor: 'rgba(27, 42, 107, 0.04)' },
        }}
      >
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
            {emRascunho ? (
              <PlayArrowIcon sx={{ fontSize: 16 }} />
            ) : (
              <StorefrontOutlinedIcon sx={{ fontSize: 16 }} />
            )}
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {emRascunho ? 'Continuar checklist' : 'Ver relatório'}
            </Typography>
          </Box>
          <ChevronRightIcon sx={{ fontSize: 20, color: colors.textMuted }} />
        </Box>
      </Box>
      {(podeEmail && onEnviarEmail) || (podeReabrir && !emRascunho && onReabrir) || (podeApagar && onApagar) ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pr: 0.75, gap: 0.25 }}>
          {podeEmail && onEnviarEmail && (
            <Tooltip title="Enviar relatório por e-mail">
              <span>
                <IconButton
                  size="small"
                  aria-label="Enviar relatório por e-mail"
                  disabled={enviandoEmail}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEnviarEmail(v);
                  }}
                  sx={{ color: colors.orange }}
                >
                  {enviandoEmail ? <CircularProgress size={16} /> : <EmailOutlinedIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          )}
          {podeReabrir && !emRascunho && onReabrir && (
            <Tooltip title="Reabrir">
              <IconButton
                size="small"
                aria-label="Reabrir visita"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onReabrir(v);
                }}
                sx={{ color: colors.navy }}
              >
                <LockOpenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {podeApagar && onApagar && (
            <IconButton
              size="small"
              aria-label="Apagar relatório"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onApagar(v);
              }}
              sx={{ color: 'error.main' }}
            >
              <DeleteOutlinedIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      ) : null}
    </Paper>
  );
}

type FiltroStatusVisita = '' | 'Rascunho' | 'Finalizada';

function FiltrosStatus({
  visitas,
  filtroStatus,
  onFiltro,
  mobile,
}: {
  visitas: VisitaResumo[];
  filtroStatus: FiltroStatusVisita;
  onFiltro: (status: FiltroStatusVisita) => void;
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
  const location = useLocation();
  const navigate = useNavigate();
  const checklistBase = checklistBasePath(location.pathname);
  const isMobileApp = false;
  const isMobile = useMediaQuery(theme.breakpoints.down('md')) || isMobileApp;
  const usuario = getUsuario();
  const podeApagar = podeApagarVisitas(usuario);
  const podeReabrir = podeReabrirVisitas(usuario);
  const [visitas, setVisitas] = useState<VisitaResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'' | 'Rascunho' | 'Finalizada'>('');
  const [filtroUsuario, setFiltroUsuario] = useState<number | ''>('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [ordenacao, setOrdenacao] = useState<OrdenacaoVisitas>('data_desc');
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [apagarAlvo, setApagarAlvo] = useState<VisitaResumo | null>(null);
  const [apagando, setApagando] = useState(false);
  const [reabrirAlvo, setReabrirAlvo] = useState<VisitaResumo | null>(null);
  const [reabrindo, setReabrindo] = useState(false);
  const [enviandoEmailId, setEnviandoEmailId] = useState<number | null>(null);

  const carregar = useCallback(() => {
    setLoading(true);
    api
      .visitas()
      .then(setVisitas)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const pessoas = useMemo(() => {
    const map = new Map<number, string>();
    for (const v of visitas) {
      if (v.id_usuario != null && v.nome_usuario) {
        map.set(v.id_usuario, v.nome_usuario);
      }
    }
    return [...map.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [visitas]);

  const tiposDisponiveis = useMemo(() => {
    const codigos = new Set(visitas.map(codigoTipoVisita));
    return TIPOS_CHECKLIST.filter((t) => codigos.has(t.codigo)).map((t) => ({
      codigo: t.codigo,
      nome: nomeTipoVisita(t.codigo, visitas),
    }));
  }, [visitas]);

  const visitasFiltradas = useMemo(() => {
    let base = visitas;
    if (filtroUsuario !== '') {
      base = base.filter((v) => v.id_usuario === filtroUsuario);
    }
    if (filtroTipo) {
      base = base.filter((v) => codigoTipoVisita(v) === filtroTipo);
    }
    if (filtroStatus) {
      base = base.filter((v) => v.status === filtroStatus);
    }
    if (ordenacao === 'nota_desc') {
      return [...base].sort((a, b) => {
        const na = a.nota_final == null ? -1 : Number(a.nota_final);
        const nb = b.nota_final == null ? -1 : Number(b.nota_final);
        if (nb !== na) return nb - na;
        return String(b.data_visita).localeCompare(String(a.data_visita));
      });
    }
    return base;
  }, [visitas, filtroStatus, filtroUsuario, filtroTipo, ordenacao]);

  const nomePessoaSelecionada = useMemo(() => {
    if (filtroUsuario === '') return '';
    return pessoas.find((p) => p.id === filtroUsuario)?.nome
      ?? visitas.find((v) => v.id_usuario === filtroUsuario)?.nome_usuario
      ?? '';
  }, [filtroUsuario, pessoas, visitas]);

  async function gerarRelatorioPorPessoa() {
    if (filtroUsuario === '' || !nomePessoaSelecionada) {
      showToast('Selecione um auditor para gerar o relatório', 'warning');
      return;
    }
    if (!filtroTipo) {
      showToast('Selecione o tipo de checklist (Auditoria ou Time de Campo)', 'warning');
      return;
    }
    setGerandoPdf(true);
    try {
      const lista = await api.visitas({
        usuario: filtroUsuario,
        status: 'Finalizada',
        order: 'nota_desc',
        tipo: filtroTipo,
      });
      if (!lista.length) {
        showToast('Nenhuma visita finalizada para este auditor neste checklist', 'warning');
        return;
      }
      await gerarPdfVisitasPorPessoa({
        nomePessoa: nomePessoaSelecionada,
        tipoChecklistCodigo: filtroTipo,
        tipoChecklistNome: nomeTipoVisita(filtroTipo, lista),
        visitas: lista,
      });
      showToast('PDF gerado', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao gerar PDF', 'error');
    } finally {
      setGerandoPdf(false);
    }
  }

  async function confirmarApagar() {
    if (!apagarAlvo) return;
    setApagando(true);
    try {
      await api.apagarVisita(apagarAlvo.id_visita);
      setVisitas((lista) => lista.filter((v) => v.id_visita !== apagarAlvo.id_visita));
      showToast('Relatório apagado', 'success');
      setApagarAlvo(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao apagar', 'error');
    } finally {
      setApagando(false);
    }
  }

  async function confirmarReabrir() {
    if (!reabrirAlvo) return;
    setReabrindo(true);
    try {
      await api.reabrirVisita(reabrirAlvo.id_visita);
      showToast('Visita reaberta para edição', 'success');
      setReabrirAlvo(null);
      navigate(`${checklistBase}?visita=${reabrirAlvo.id_visita}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível reabrir a visita', 'error');
    } finally {
      setReabrindo(false);
    }
  }

  async function enviarRelatorioEmail(v: VisitaResumo) {
    if (!podeEnviarEmailRelatorio(v)) {
      showToast('Só é possível enviar e-mail de Auditoria Operacional finalizada', 'warning');
      return;
    }
    setEnviandoEmailId(v.id_visita);
    try {
      const r = await api.enviarRelatorioVisitaEmail(v.id_visita);
      showToast(r.subject ? `E-mail enviado: ${r.subject}` : 'Relatório enviado por e-mail', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Falha ao enviar e-mail', 'error');
    } finally {
      setEnviandoEmailId(null);
    }
  }

  const dialogReabrir = (
    <Dialog open={!!reabrirAlvo} onClose={() => !reabrindo && setReabrirAlvo(null)} maxWidth="xs" fullWidth>
      <DialogTitleWithIcon plainIcon icon={<LockOpenIcon />}>
        Reabrir visita
      </DialogTitleWithIcon>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          A visita
          {reabrirAlvo ? (
            <>
              {' '}
              de <strong>{reabrirAlvo.name}</strong> ({fmtData(reabrirAlvo.data_visita)})
            </>
          ) : null}{' '}
          voltará para rascunho e poderá ser editada no checklist.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setReabrirAlvo(null)} disabled={reabrindo}>
          Cancelar
        </Button>
        <Button variant="contained" disabled={reabrindo} onClick={() => void confirmarReabrir()}>
          {reabrindo ? 'Reabrindo…' : 'Reabrir'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  if (loading) return <LinearProgress />;

  if (err) return <Typography color="error">{err}</Typography>;

  if (isMobileApp) {
    return (
      <>
        <VisitasMobileScreen
          visitas={visitas}
          visitasFiltradas={visitasFiltradas}
          filtroStatus={filtroStatus}
          onFiltro={setFiltroStatus}
          checklistBase={checklistBase}
          podeApagar={podeApagar}
          onApagar={setApagarAlvo}
          podeReabrir={podeReabrir}
          onReabrir={setReabrirAlvo}
          enviandoEmailId={enviandoEmailId}
          onEnviarEmail={(v) => void enviarRelatorioEmail(v)}
        />
        <Dialog open={!!apagarAlvo} onClose={() => !apagando && setApagarAlvo(null)}>
          <DialogTitle>Apagar relatório?</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              {apagarAlvo
                ? `A visita em ${apagarAlvo.name} (${fmtData(apagarAlvo.data_visita)}) será removida.`
                : ''}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setApagarAlvo(null)} disabled={apagando}>
              Cancelar
            </Button>
            <Button color="error" variant="contained" onClick={() => void confirmarApagar()} disabled={apagando}>
              {apagando ? 'Apagando…' : 'Apagar'}
            </Button>
          </DialogActions>
        </Dialog>
        {dialogReabrir}
      </>
    );
  }

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
    <Box
      sx={{
        ...tablePageLayoutSx,
        gap: { xs: 1, md: 1.5 },
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0, fontSize: { xs: '0.8rem', md: '0.875rem' } }}>
        {visitasFiltradas.length} de {visitas.length} visita(s)
        {filtroUsuario !== '' && nomePessoaSelecionada ? ` · ${nomePessoaSelecionada}` : ''}
        {filtroTipo ? ` · ${nomeTipoVisita(filtroTipo, visitas)}` : ''}
      </Typography>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 200 }, flex: { sm: '0 1 220px' } }}>
          <InputLabel id="filtro-pessoa-label">Auditor</InputLabel>
          <Select
            labelId="filtro-pessoa-label"
            label="Auditor"
            value={filtroUsuario === '' ? '' : String(filtroUsuario)}
            onChange={(e) => {
              const v = e.target.value;
              setFiltroUsuario(v === '' ? '' : Number(v));
              if (v !== '') setOrdenacao('nota_desc');
            }}
          >
            <MenuItem value="">Todos os auditores</MenuItem>
            {pessoas.map((p) => (
              <MenuItem key={p.id} value={String(p.id)}>
                {p.nome}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 200 }, flex: { sm: '0 1 220px' } }}>
          <InputLabel id="filtro-tipo-label">Checklist</InputLabel>
          <Select
            labelId="filtro-tipo-label"
            label="Checklist"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
          >
            <MenuItem value="">Todos os checklists</MenuItem>
            {(tiposDisponiveis.length ? tiposDisponiveis : TIPOS_CHECKLIST).map((t) => (
              <MenuItem key={t.codigo} value={t.codigo}>
                {t.nome}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 160 }, flex: { sm: '0 1 180px' } }}>
          <InputLabel id="ordenacao-visitas-label">Ordenar</InputLabel>
          <Select
            labelId="ordenacao-visitas-label"
            label="Ordenar"
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value as OrdenacaoVisitas)}
          >
            <MenuItem value="data_desc">Data (mais recente)</MenuItem>
            <MenuItem value="nota_desc">Nota (maior → menor)</MenuItem>
          </Select>
        </FormControl>

        <Button
          variant="contained"
          size="small"
          disabled={filtroUsuario === '' || !filtroTipo || gerandoPdf}
          onClick={() => void gerarRelatorioPorPessoa()}
          startIcon={gerandoPdf ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfIcon />}
          sx={{
            flexShrink: 0,
            minHeight: 40,
            bgcolor: colors.navy,
            '&:hover': { bgcolor: '#152456' },
          }}
        >
          {gerandoPdf ? 'Gerando…' : 'Gerar relatório do auditor'}
        </Button>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 1, flexShrink: 0, mb: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
          <FiltrosStatus
            visitas={visitas.filter((v) => {
              if (filtroUsuario !== '' && v.id_usuario !== filtroUsuario) return false;
              if (filtroTipo && codigoTipoVisita(v) !== filtroTipo) return false;
              return true;
            })}
            filtroStatus={filtroStatus}
            onFiltro={setFiltroStatus}
            mobile={isMobile}
          />
        </Box>
      </Box>

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
            <VisitaCardMobile
              key={v.id_visita}
              visita={v}
              checklistBase={checklistBase}
              podeApagar={podeApagar}
              onApagar={setApagarAlvo}
              podeReabrir={podeReabrir}
              onReabrir={setReabrirAlvo}
              enviandoEmail={enviandoEmailId === v.id_visita}
              onEnviarEmail={(vv) => void enviarRelatorioEmail(vv)}
            />
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
                  <TableCell align="center" width={220} />
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
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        {v.status === 'Rascunho' ? (
                          <Button
                            component={Link}
                            to={`${checklistBase}?visita=${v.id_visita}`}
                            size="small"
                            color="warning"
                            startIcon={<PlayArrowIcon />}
                          >
                            Continuar
                          </Button>
                        ) : (
                          <Button component={Link} to={`/relatorio/visita/${v.id_visita}`} size="small">
                            Ver
                          </Button>
                        )}
                        {podeEnviarEmailRelatorio(v) && (
                          <Tooltip title="Enviar relatório por e-mail">
                            <span>
                              <IconButton
                                size="small"
                                aria-label="Enviar relatório por e-mail"
                                disabled={enviandoEmailId === v.id_visita}
                                onClick={() => void enviarRelatorioEmail(v)}
                                sx={{ color: colors.orange }}
                              >
                                {enviandoEmailId === v.id_visita ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  <EmailOutlinedIcon fontSize="small" />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                        {podeReabrir && v.status === 'Finalizada' && (
                          <Tooltip title="Reabrir">
                            <IconButton
                              size="small"
                              aria-label="Reabrir visita"
                              onClick={() => setReabrirAlvo(v)}
                              sx={{ color: colors.navy }}
                            >
                              <LockOpenIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {podeApagar && (
                          <Tooltip title="Apagar relatório">
                            <IconButton
                              size="small"
                              aria-label="Apagar relatório"
                              onClick={() => setApagarAlvo(v)}
                              sx={{ color: 'error.main' }}
                            >
                              <DeleteOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
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

      <Dialog open={!!apagarAlvo} onClose={() => !apagando && setApagarAlvo(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Apagar relatório?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Isso remove permanentemente a visita
            {apagarAlvo ? (
              <>
                {' '}
                de <strong>{apagarAlvo.name}</strong> ({fmtData(apagarAlvo.data_visita)},{' '}
                {apagarAlvo.nome_usuario})
              </>
            ) : null}
            . Não dá para desfazer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApagarAlvo(null)} disabled={apagando}>
            Cancelar
          </Button>
          <Button color="error" variant="contained" onClick={() => void confirmarApagar()} disabled={apagando}>
            {apagando ? 'Apagando…' : 'Apagar'}
          </Button>
        </DialogActions>
      </Dialog>
      {dialogReabrir}
    </Box>
  );
}
