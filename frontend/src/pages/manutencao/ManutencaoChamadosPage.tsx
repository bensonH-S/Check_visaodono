import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import AddIcon from '@mui/icons-material/Add';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import ViewListIcon from '@mui/icons-material/ViewList';
import FilterListIcon from '@mui/icons-material/FilterList';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { api } from '../../api/client';
import type { ManutChamado } from '../../api/client';
import { getUsuario, temPermissao } from '../../lib/auth';
import { KANBAN_COLUNAS, STATUS_CHAMADO } from '../../utils/manutencaoUi';
import ChamadosKanbanBoard from '../../components/manutencao/ChamadosKanbanBoard';
import ChamadoCardResumo from '../../components/manutencao/ChamadoCardResumo';
import { NOTIFICACOES_REFRESH } from '../../utils/notificacoesEvent';
import { parseDataApi } from '../../utils/dateBr';
import { pageFillLayoutSx } from '../../utils/pageFillLayout';
import { colors } from '../../theme/tokens';

const TODAS_LOJAS = 'todas';

const PERIODOS = [
  { value: '', label: 'Todos os períodos' },
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'mes', label: 'Este mês' },
] as const;

type ModoVisual = 'kanban' | 'lista';

function LojaFiltroRotulo({ nome }: { nome: string }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
      <LocationOnOutlinedIcon sx={{ fontSize: 16, color: colors.orange, flexShrink: 0 }} />
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {nome}
      </Box>
    </Box>
  );
}

function pertenceAoPeriodo(abertoEm: string | undefined, prazoSla: string, periodo: string): boolean {
  if (!periodo) return true;
  const data = parseDataApi(abertoEm || prazoSla);
  if (Number.isNaN(data.getTime())) return false;
  const agora = new Date();
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  switch (periodo) {
    case 'hoje':
      return data.getTime() >= inicioHoje.getTime();
    case '7d':
      return data.getTime() >= agora.getTime() - 7 * 86400000;
    case '30d':
      return data.getTime() >= agora.getTime() - 30 * 86400000;
    case 'mes':
      return data.getMonth() === agora.getMonth() && data.getFullYear() === agora.getFullYear();
    default:
      return true;
  }
}

export default function ManutencaoChamadosPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const telaCompacta = useMediaQuery(theme.breakpoints.down('lg'));
  const sessao = getUsuario();
  const [lista, setLista] = useState<ManutChamado[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtroLoja, setFiltroLoja] = useState(TODAS_LOJAS);
  const [filtroPeriodo, setFiltroPeriodo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [modo, setModo] = useState<ModoVisual>(mobile || telaCompacta ? 'lista' : 'kanban');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  useEffect(() => {
    if (mobile) {
      setModo('lista');
      return;
    }
    setModo(telaCompacta ? 'lista' : 'kanban');
  }, [mobile, telaCompacta]);

  const lojasOpcoes = useMemo(() => {
    const map = new Map<number, string>();
    lista.forEach((c) => map.set(c.id_loja, c.loja));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [lista]);

  const listaFiltrada = useMemo(
    () =>
      lista.filter((c) => {
        if (filtroLoja !== TODAS_LOJAS && c.id_loja !== Number(filtroLoja)) return false;
        if (filtroStatus !== '' && c.status !== filtroStatus) return false;
        if (!pertenceAoPeriodo(c.aberto_em, c.prazo_sla, filtroPeriodo)) return false;
        return true;
      }),
    [lista, filtroLoja, filtroPeriodo, filtroStatus],
  );

  const contagemPorStatus = useMemo(() => {
    const map = new Map<string, number>();
    for (const col of KANBAN_COLUNAS) map.set(col.status, 0);
    map.set('cancelado', 0);
    for (const c of listaFiltrada) {
      const status = c.status === 'cancelado' ? 'cancelado' : c.status;
      map.set(status, (map.get(status) ?? 0) + 1);
    }
    return map;
  }, [listaFiltrada]);

  const filtrosAtivos = filtroLoja !== TODAS_LOJAS || filtroPeriodo !== '' || filtroStatus !== '';

  function recarregar() {
    return api.manutChamados().then(setLista).catch((e) => setErro(e.message));
  }

  function limparFiltros() {
    setFiltroLoja(TODAS_LOJAS);
    setFiltroPeriodo('');
    setFiltroStatus('');
  }

  useEffect(() => {
    recarregar().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function onRefresh() {
      recarregar();
    }
    window.addEventListener(NOTIFICACOES_REFRESH, onRefresh);
    return () => window.removeEventListener(NOTIFICACOES_REFRESH, onRefresh);
  }, []);

  if (loading) {
    return (
      <Box className="flex justify-center py-16">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={pageFillLayoutSx}>
      {/* Toolbar compacta — não rola */}
      <Box sx={{ flexShrink: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary">
          {listaFiltrada.length} chamado{listaFiltrada.length !== 1 ? 's' : ''}
          {filtrosAtivos ? ' · filtros ativos' : ''}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {!mobile && (
            <ToggleButtonGroup
              size="small"
              exclusive
              value={modo}
              onChange={(_, v: ModoVisual | null) => v && setModo(v)}
            >
              <ToggleButton value="lista" aria-label="Lista">
                <ViewListIcon sx={{ fontSize: 17 }} />
              </ToggleButton>
              <ToggleButton value="kanban" aria-label="Kanban">
                <ViewKanbanIcon sx={{ fontSize: 17 }} />
              </ToggleButton>
            </ToggleButtonGroup>
          )}
          <Button
            size="small"
            variant="outlined"
            startIcon={<FilterListIcon sx={{ fontSize: 16 }} />}
            endIcon={<ExpandMoreIcon sx={{ fontSize: 16, transform: filtrosAbertos ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />}
            onClick={() => setFiltrosAbertos((v) => !v)}
          >
            Filtros
          </Button>
          {sessao && temPermissao('chamados.abrir', sessao) && (
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => navigate('/chamados/novo')}>
              Novo
            </Button>
          )}
        </Box>
      </Box>

      <Box sx={{ flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        <Chip
          label={`Todos · ${listaFiltrada.length}`}
          size="small"
          onClick={() => setFiltroStatus('')}
          variant={filtroStatus === '' ? 'filled' : 'outlined'}
          color={filtroStatus === '' ? 'primary' : 'default'}
        />
        {KANBAN_COLUNAS.map((col) => {
          const qtd = contagemPorStatus.get(col.status) ?? 0;
          const st = STATUS_CHAMADO[col.status];
          const ativo = filtroStatus === col.status;
          return (
            <Chip
              key={col.status}
              size="small"
              label={`${col.label} · ${qtd}`}
              onClick={() => setFiltroStatus(ativo ? '' : col.status)}
              variant={ativo ? 'filled' : 'outlined'}
              sx={ativo ? { bgcolor: st?.bg, color: st?.color, fontWeight: 600 } : undefined}
            />
          );
        })}
      </Box>

      <Collapse in={filtrosAbertos}>
        <Paper elevation={0} sx={{ p: 1.5, border: '1px solid', borderColor: colors.border, flexShrink: 0 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.25 }}>
            <FormControl size="small" fullWidth>
              <InputLabel shrink>Loja</InputLabel>
              <Select
                label="Loja"
                value={filtroLoja}
                onChange={(e) => setFiltroLoja(e.target.value)}
                renderValue={(value) => {
                  if (value === TODAS_LOJAS) return 'Todas as lojas';
                  const loja = lojasOpcoes.find(([id]) => String(id) === value);
                  return loja ? <LojaFiltroRotulo nome={loja[1]} /> : 'Todas as lojas';
                }}
              >
                <MenuItem value={TODAS_LOJAS}>Todas as lojas</MenuItem>
                {lojasOpcoes.map(([id, nome]) => (
                  <MenuItem key={id} value={String(id)}>
                    <LojaFiltroRotulo nome={nome} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel shrink>Período</InputLabel>
              <Select label="Período" value={filtroPeriodo} displayEmpty onChange={(e) => setFiltroPeriodo(e.target.value)}>
                {PERIODOS.map((p) => (
                  <MenuItem key={p.value || 'todos'} value={p.value}>{p.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel shrink>Status</InputLabel>
              <Select label="Status" value={filtroStatus} displayEmpty onChange={(e) => setFiltroStatus(e.target.value)}>
                <MenuItem value="">Todos</MenuItem>
                {Object.entries(STATUS_CHAMADO).map(([value, st]) => (
                  <MenuItem key={value} value={value}>{st.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          {filtrosAtivos && (
            <Button size="small" onClick={limparFiltros} sx={{ mt: 1, fontSize: '0.75rem' }}>
              Limpar filtros
            </Button>
          )}
        </Paper>
      </Collapse>

      {erro && (
        <Alert severity="error" sx={{ flexShrink: 0 }}>
          {erro}
        </Alert>
      )}

      {/* Área principal — kanban/lista rola por dentro */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {!lista.length && !erro && (
          <Paper elevation={0} sx={{ p: 4, textAlign: 'center', border: '1px dashed', borderColor: colors.border }}>
            <Typography color="text.secondary" gutterBottom>Nenhum chamado ainda.</Typography>
            {sessao && temPermissao('chamados.abrir', sessao) && (
              <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate('/chamados/novo')}>
                Abrir primeiro chamado
              </Button>
            )}
          </Paper>
        )}

        {lista.length > 0 && !listaFiltrada.length && (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">Nenhum chamado com os filtros selecionados.</Typography>
            {filtrosAtivos && (
              <Button size="small" sx={{ mt: 1 }} onClick={limparFiltros}>Limpar filtros</Button>
            )}
          </Paper>
        )}

        {listaFiltrada.length > 0 && !mobile && modo === 'kanban' && (
          <ChamadosKanbanBoard chamados={listaFiltrada} />
        )}

        {listaFiltrada.length > 0 && (mobile || modo === 'lista') && (
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: 1.25, alignContent: 'start' }}>
            {listaFiltrada.map((c) => (
              <ChamadoCardResumo
                key={c.id_chamado}
                chamado={c}
                showLoja
                showSla
                onClick={() => navigate(`/chamados/${c.id_chamado}`)}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
