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
import AddIcon from '@mui/icons-material/Add';
import { api } from '../../api/client';
import type { ManutChamado } from '../../api/client';
import { getUsuario, temPermissao } from '../../lib/auth';
import { STATUS_CHAMADO } from '../../utils/manutencaoUi';
import ChamadosKanbanBoard from '../../components/manutencao/ChamadosKanbanBoard';
import { NOTIFICACOES_REFRESH } from '../../utils/notificacoesEvent';
import { parseDataApi } from '../../utils/dateBr';
import type { SxProps, Theme } from '@mui/material/styles';

const TODAS_LOJAS = 'todas';

const FILTRO_MENU_PROPS = {
  slotProps: {
    paper: {
      sx: { maxHeight: 320, minWidth: 220 },
    },
  },
};

function filtroFormSx(largura: number): SxProps<Theme> {
  return {
    width: largura,
    minWidth: largura,
    maxWidth: '100%',
    flexShrink: 0,
    '& .MuiInputLabel-root': {
      fontSize: '0.9rem',
      fontWeight: 600,
      '&.MuiInputLabel-shrink': {
        fontSize: '0.9rem',
        transform: 'translate(14px, -9px) scale(1)',
        bgcolor: 'background.default',
        px: '5px',
        zIndex: 1,
      },
    },
    '& .MuiOutlinedInput-notchedOutline legend': {
      fontSize: '0.9rem',
      '& > span': {
        px: '5px',
      },
    },
    '& .MuiOutlinedInput-root': {
      fontSize: '0.875rem',
      height: 'auto',
      minHeight: 40,
      alignItems: 'center',
    },
    '& .MuiSelect-select': {
      fontSize: '0.875rem !important',
      py: '9px !important',
      pr: '30px !important',
      lineHeight: 1.35,
      whiteSpace: 'normal',
      wordBreak: 'break-word',
      overflow: 'visible !important',
      textOverflow: 'clip',
    },
  };
}

const PERIODOS = [
  { value: '', label: 'Todos os períodos' },
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'mes', label: 'Este mês' },
] as const;

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
  const sessao = getUsuario();
  const [lista, setLista] = useState<ManutChamado[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtroLoja, setFiltroLoja] = useState(TODAS_LOJAS);
  const [filtroPeriodo, setFiltroPeriodo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  const lojasOpcoes = useMemo(() => {
    const map = new Map<number, string>();
    lista.forEach((c) => map.set(c.id_loja, c.loja));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [lista]);

  const larguraFiltros = useMemo(() => {
    const textos = [
      'Todas as lojas',
      'Todos os períodos',
      'Todos os status',
      ...lojasOpcoes.map(([, nome]) => nome),
      ...PERIODOS.map((p) => p.label),
      ...Object.values(STATUS_CHAMADO).map((s) => s.label),
    ];
    const maior = Math.max(...textos.map((t) => t.length), 14);
    const estimada = Math.ceil(maior * 8.2 + 52);
    return Math.min(Math.max(estimada, 220), 340);
  }, [lojasOpcoes]);

  const sxFiltro = filtroFormSx(larguraFiltros);

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

  const filtrosAtivos =
    filtroLoja !== TODAS_LOJAS || filtroPeriodo !== '' || filtroStatus !== '';

  function recarregar() {
    return api
      .manutChamados()
      .then(setLista)
      .catch((e) => setErro(e.message));
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
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1.25,
          mb: 2,
        }}
      >
        <FormControl size="small" sx={sxFiltro}>
          <InputLabel id="filtro-loja-label" shrink>
            Loja
          </InputLabel>
          <Select
            labelId="filtro-loja-label"
            label="Loja"
            value={filtroLoja}
            onChange={(e) => setFiltroLoja(e.target.value)}
            MenuProps={FILTRO_MENU_PROPS}
            renderValue={(value) => {
              if (value === TODAS_LOJAS) return 'Todas as lojas';
              const loja = lojasOpcoes.find(([id]) => String(id) === value);
              return loja?.[1] ?? 'Todas as lojas';
            }}
          >
            <MenuItem value={TODAS_LOJAS} sx={{ fontSize: '0.875rem' }}>
              Todas as lojas
            </MenuItem>
            {lojasOpcoes.map(([id, nome]) => (
              <MenuItem key={id} value={String(id)} sx={{ fontSize: '0.875rem', whiteSpace: 'normal' }}>
                {nome}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={sxFiltro}>
          <InputLabel id="filtro-periodo-label" shrink>
            Período
          </InputLabel>
          <Select
            labelId="filtro-periodo-label"
            label="Período"
            value={filtroPeriodo}
            displayEmpty
            onChange={(e) => setFiltroPeriodo(e.target.value)}
            MenuProps={FILTRO_MENU_PROPS}
            renderValue={(value) =>
              PERIODOS.find((p) => p.value === value)?.label ?? 'Todos os períodos'
            }
          >
            {PERIODOS.map((p) => (
              <MenuItem key={p.value || 'todos'} value={p.value} sx={{ fontSize: '0.875rem' }}>
                {p.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={sxFiltro}>
          <InputLabel id="filtro-status-label" shrink>
            Status
          </InputLabel>
          <Select
            labelId="filtro-status-label"
            label="Status"
            value={filtroStatus}
            displayEmpty
            onChange={(e) => setFiltroStatus(e.target.value)}
            MenuProps={FILTRO_MENU_PROPS}
            renderValue={(value) =>
              value === '' ? 'Todos os status' : (STATUS_CHAMADO[value]?.label ?? value)
            }
          >
            <MenuItem value="" sx={{ fontSize: '0.875rem' }}>
              Todos os status
            </MenuItem>
            {Object.entries(STATUS_CHAMADO).map(([value, st]) => (
              <MenuItem key={value} value={value} sx={{ fontSize: '0.875rem' }}>
                {st.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {sessao && temPermissao('chamados.abrir', sessao) && (
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => navigate('/chamados/novo')}
            sx={{ ml: { md: 'auto' }, flexShrink: 0 }}
          >
            Novo
          </Button>
        )}
      </Box>

      {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}

      {!lista.length && !erro && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
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
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary" gutterBottom>
            Nenhum chamado encontrado com os filtros selecionados.
          </Typography>
          {filtrosAtivos && (
            <Button
              size="small"
              sx={{ mt: 1 }}
              onClick={() => {
                setFiltroLoja(TODAS_LOJAS);
                setFiltroPeriodo('');
                setFiltroStatus('');
              }}
            >
              Limpar filtros
            </Button>
          )}
        </Paper>
      )}

      {listaFiltrada.length > 0 && (
        <ChamadosKanbanBoard chamados={listaFiltrada} />
      )}
    </Box>
  );
}
