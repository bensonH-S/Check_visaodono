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
import AddIcon from '@mui/icons-material/Add';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import ViewListIcon from '@mui/icons-material/ViewList';
import FilterListIcon from '@mui/icons-material/FilterList';
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

const NAVY = '#1B2A6B';
const TODAS_LOJAS = 'todas';

const PERIODOS = [
  { value: '', label: 'Todos os períodos' },
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'mes', label: 'Este mês' },
] as const;

type ModoVisual = 'kanban' | 'lista';

function pertenceAoPeriodo(
  abertoEm: string | undefined,
  prazoSla: string,
  periodo: string,
): boolean {
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
  const telaCompacta = useMediaQuery(theme.breakpoints.down('lg'));
  const sessao = getUsuario();
  const [lista, setLista] = useState<ManutChamado[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtroLoja, setFiltroLoja] = useState(TODAS_LOJAS);
  const [filtroPeriodo, setFiltroPeriodo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [modo, setModo] = useState<ModoVisual>(telaCompacta ? 'lista' : 'kanban');

  useEffect(() => {
    setModo(telaCompacta ? 'lista' : 'kanban');
  }, [telaCompacta]);

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

  const filtrosAtivos =
    filtroLoja !== TODAS_LOJAS || filtroPeriodo !== '' || filtroStatus !== '';

  function recarregar() {
    return api
      .manutChamados()
      .then(setLista)
      .catch((e) => setErro(e.message));
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
    <Box sx={{ width: '100%' }}>
      {/* Cabeçalho */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1.5,
          mb: 2,
        }}
      >
        <Box>
          <Typography sx={{ fontWeight: 800, color: NAVY, fontSize: { xs: '1.1rem', md: '1.25rem' } }}>
            Chamados de manutenção
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {listaFiltrada.length} chamado{listaFiltrada.length !== 1 ? 's' : ''}
            {filtrosAtivos ? ' com filtros aplicados' : ' no total'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={modo}
            onChange={(_, v: ModoVisual | null) => v && setModo(v)}
            sx={{
              bgcolor: 'white',
              '& .MuiToggleButton-root': {
                px: 1.25,
                py: 0.5,
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'none',
                borderColor: 'rgba(27, 42, 107, 0.15)',
                '&.Mui-selected': { bgcolor: 'rgba(27, 42, 107, 0.08)', color: NAVY },
              },
            }}
          >
            <ToggleButton value="lista" aria-label="Lista">
              <ViewListIcon sx={{ fontSize: 18, mr: 0.5 }} />
              Lista
            </ToggleButton>
            <ToggleButton value="kanban" aria-label="Kanban">
              <ViewKanbanIcon sx={{ fontSize: 18, mr: 0.5 }} />
              Kanban
            </ToggleButton>
          </ToggleButtonGroup>
          {sessao && temPermissao('chamados.abrir', sessao) && (
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => navigate('/chamados/novo')}>
              Novo chamado
            </Button>
          )}
        </Box>
      </Box>

      {/* Resumo por status — clique filtra */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Chip
          label={`Todos · ${listaFiltrada.length}`}
          onClick={() => setFiltroStatus('')}
          variant={filtroStatus === '' ? 'filled' : 'outlined'}
          sx={{
            fontWeight: 700,
            bgcolor: filtroStatus === '' ? NAVY : 'white',
            color: filtroStatus === '' ? 'white' : NAVY,
            borderColor: 'rgba(27, 42, 107, 0.2)',
          }}
        />
        {KANBAN_COLUNAS.map((col) => {
          const qtd = contagemPorStatus.get(col.status) ?? 0;
          const st = STATUS_CHAMADO[col.status];
          const ativo = filtroStatus === col.status;
          return (
            <Chip
              key={col.status}
              label={`${col.label} · ${qtd}`}
              onClick={() => setFiltroStatus(ativo ? '' : col.status)}
              variant={ativo ? 'filled' : 'outlined'}
              sx={{
                fontWeight: 600,
                fontSize: '0.78rem',
                bgcolor: ativo ? st?.bg : 'white',
                color: ativo ? st?.color : 'text.secondary',
                borderColor: `${col.accent}50`,
              }}
            />
          );
        })}
      </Box>

      {/* Filtros */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.5, md: 2 },
          mb: 2,
          borderRadius: 2,
          border: '1px solid rgba(27, 42, 107, 0.1)',
          bgcolor: 'white',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
          <FilterListIcon sx={{ fontSize: 18, color: NAVY }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: NAVY }}>
            Filtros
          </Typography>
          {filtrosAtivos && (
            <Button size="small" onClick={limparFiltros} sx={{ ml: 'auto', fontSize: '0.75rem' }}>
              Limpar
            </Button>
          )}
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, minmax(0, 1fr))' },
            gap: 1.25,
          }}
        >
          <FormControl size="small" fullWidth>
            <InputLabel id="filtro-loja-label" shrink>
              Loja
            </InputLabel>
            <Select
              labelId="filtro-loja-label"
              label="Loja"
              value={filtroLoja}
              onChange={(e) => setFiltroLoja(e.target.value)}
              renderValue={(value) => {
                if (value === TODAS_LOJAS) return 'Todas as lojas';
                const loja = lojasOpcoes.find(([id]) => String(id) === value);
                return loja?.[1] ?? 'Todas as lojas';
              }}
            >
              <MenuItem value={TODAS_LOJAS}>Todas as lojas</MenuItem>
              {lojasOpcoes.map(([id, nome]) => (
                <MenuItem key={id} value={String(id)}>
                  {nome}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel id="filtro-periodo-label" shrink>
              Período
            </InputLabel>
            <Select
              labelId="filtro-periodo-label"
              label="Período"
              value={filtroPeriodo}
              displayEmpty
              onChange={(e) => setFiltroPeriodo(e.target.value)}
              renderValue={(value) =>
                PERIODOS.find((p) => p.value === value)?.label ?? 'Todos os períodos'
              }
            >
              {PERIODOS.map((p) => (
                <MenuItem key={p.value || 'todos'} value={p.value}>
                  {p.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth sx={{ gridColumn: { sm: 'span 2', lg: 'span 1' } }}>
            <InputLabel id="filtro-status-label" shrink>
              Status
            </InputLabel>
            <Select
              labelId="filtro-status-label"
              label="Status"
              value={filtroStatus}
              displayEmpty
              onChange={(e) => setFiltroStatus(e.target.value)}
              renderValue={(value) =>
                value === '' ? 'Todos os status' : (STATUS_CHAMADO[value]?.label ?? value)
              }
            >
              <MenuItem value="">Todos os status</MenuItem>
              {Object.entries(STATUS_CHAMADO).map(([value, st]) => (
                <MenuItem key={value} value={value}>
                  {st.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {erro}
        </Alert>
      )}

      {!lista.length && !erro && (
        <Paper
          elevation={0}
          sx={{
            p: 4,
            textAlign: 'center',
            borderRadius: 2,
            border: `1.5px dashed ${NAVY}`,
            bgcolor: 'rgba(27, 42, 107, 0.03)',
          }}
        >
          <Typography color="text.secondary" gutterBottom>
            Nenhum chamado ainda.
          </Typography>
          {sessao && temPermissao('chamados.abrir', sessao) && (
            <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate('/chamados/novo')}>
              Abrir primeiro chamado
            </Button>
          )}
        </Paper>
      )}

      {lista.length > 0 && !listaFiltrada.length && (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <Typography color="text.secondary" gutterBottom>
            Nenhum chamado encontrado com os filtros selecionados.
          </Typography>
          {filtrosAtivos && (
            <Button size="small" sx={{ mt: 1 }} onClick={limparFiltros}>
              Limpar filtros
            </Button>
          )}
        </Paper>
      )}

      {listaFiltrada.length > 0 && modo === 'kanban' && (
        <ChamadosKanbanBoard chamados={listaFiltrada} />
      )}

      {listaFiltrada.length > 0 && modo === 'lista' && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' },
            gap: 1.5,
          }}
        >
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
  );
}
