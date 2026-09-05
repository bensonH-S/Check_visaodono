import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableContainer from '@mui/material/TableContainer';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import PageLoading from '../../components/PageLoading';
import { api, type AuditoriaEvento, type AuditoriaUsuarioFiltro } from '../../api/client';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import { tableContainerSx, tablePageLayoutSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';
import { selectMenuScrollProps } from '../../utils/selectMenuScroll';

const MODULOS = [
  { value: '', label: 'Todos' },
  { value: 'auth', label: 'Acesso' },
  { value: 'chamados', label: 'Chamados' },
  { value: 'energia', label: 'Energia' },
  { value: 'frota', label: 'Frota' },
  { value: 'escalas', label: 'Escalas' },
  { value: 'visitas', label: 'Visitas' },
  { value: 'metas', label: 'Metas' },
  { value: 'configuracoes', label: 'Configurações' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'usuarios', label: 'Usuários' },
  { value: 'cargos', label: 'Cargos' },
  { value: 'lojas', label: 'Lojas' },
  { value: 'sistema', label: 'Sistema' },
];

/** Cores por tipo de ação (não pelo módulo). */
function estiloAcao(tipo?: string, isDark = false) {
  if (isDark) {
    switch (tipo) {
      case 'exclusao':
        return { bg: 'rgba(239, 68, 68, 0.16)', color: '#F87171', border: 'rgba(239, 68, 68, 0.38)' };
      case 'upload':
        return { bg: 'rgba(96, 165, 250, 0.16)', color: '#60A5FA', border: 'rgba(96, 165, 250, 0.38)' };
      case 'acesso':
        return { bg: 'rgba(251, 191, 36, 0.16)', color: '#FBBF24', border: 'rgba(251, 191, 36, 0.38)' };
      case 'criacao':
        return { bg: 'rgba(52, 211, 153, 0.16)', color: '#34D399', border: 'rgba(52, 211, 153, 0.38)' };
      case 'alteracao':
        return { bg: 'rgba(192, 132, 252, 0.16)', color: '#C084FC', border: 'rgba(192, 132, 252, 0.38)' };
      case 'operacao':
        return { bg: 'rgba(56, 189, 248, 0.16)', color: '#38BDF8', border: 'rgba(56, 189, 248, 0.38)' };
      default:
        return { bg: 'rgba(156, 163, 175, 0.16)', color: '#CBD5E1', border: 'rgba(156, 163, 175, 0.35)' };
    }
  }

  switch (tipo) {
    case 'exclusao':
      return { bg: 'rgba(220, 38, 38, 0.10)', color: '#B91C1C', border: 'rgba(220, 38, 38, 0.28)' };
    case 'upload':
      return { bg: 'rgba(37, 99, 235, 0.10)', color: '#1D4ED8', border: 'rgba(37, 99, 235, 0.28)' };
    case 'acesso':
      return { bg: 'rgba(217, 119, 6, 0.12)', color: '#B45309', border: 'rgba(217, 119, 6, 0.30)' };
    case 'criacao':
      return { bg: 'rgba(5, 150, 105, 0.10)', color: '#047857', border: 'rgba(5, 150, 105, 0.28)' };
    case 'alteracao':
      return { bg: 'rgba(124, 58, 237, 0.10)', color: '#6D28D9', border: 'rgba(124, 58, 237, 0.28)' };
    case 'operacao':
      return { bg: 'rgba(8, 145, 178, 0.10)', color: '#0E7490', border: 'rgba(8, 145, 178, 0.28)' };
    default:
      return { bg: 'rgba(100, 116, 139, 0.10)', color: '#475569', border: 'rgba(100, 116, 139, 0.25)' };
  }
}

function ChipAcao({ ev }: { ev: AuditoriaEvento }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const estilo = estiloAcao(ev.tipo_acao, isDark);
  return (
    <Chip
      size="small"
      label={ev.acao_label || ev.acao}
      sx={{
        fontWeight: 600,
        fontSize: '0.72rem',
        height: 24,
        bgcolor: estilo.bg,
        color: estilo.color,
        border: `1px solid ${estilo.border}`,
      }}
    />
  );
}

function ChipModulo({ ev }: { ev: AuditoriaEvento }) {
  const key = String(ev.modulo || '').toLowerCase();
  const label = ev.modulo_label || MODULOS.find((m) => m.value === key)?.label || ev.modulo;
  return (
    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, letterSpacing: '0.02em' }}>
      {label}
    </Typography>
  );
}

export default function AuditoriaPage() {
  const [lista, setLista] = useState<AuditoriaEvento[]>([]);
  const [usuarios, setUsuarios] = useState<AuditoriaUsuarioFiltro[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [modulo, setModulo] = useState('');
  const [idUsuario, setIdUsuario] = useState('');
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [offset, setOffset] = useState(0);
  const limite = 80;

  useEffect(() => {
    const t = window.setTimeout(() => setBuscaDebounced(busca.trim()), 350);
    return () => window.clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    api
      .auditoriaUsuariosFiltro()
      .then(setUsuarios)
      .catch(() => setUsuarios([]));
  }, []);

  const carregar = useCallback(() => {
    setLoading(true);
    setErro('');
    api
      .auditoriaEventos({
        limite,
        offset,
        modulo: modulo || undefined,
        id_usuario: idUsuario ? Number(idUsuario) : undefined,
        q: buscaDebounced || undefined,
      })
      .then((rows) => setLista(rows))
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar auditoria'))
      .finally(() => setLoading(false));
  }, [modulo, offset, idUsuario, buscaDebounced]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    setOffset(0);
  }, [modulo, idUsuario, buscaDebounced]);

  const usuariosAtivos = useMemo(
    () => [...usuarios].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome)),
    [usuarios],
  );

  return (
    <Box sx={tablePageLayoutSx}>
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
          Auditoria
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 640 }}>
          Quem fez o quê — exclusões em vermelho, uploads em azul, acessos em âmbar.
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '180px 1fr 1.2fr' },
          gap: 1.5,
          mb: 2,
        }}
      >
        <TextField
          select
          size="small"
          label="Módulo"
          value={modulo}
          onChange={(e) => setModulo(e.target.value)}
          slotProps={{ select: selectMenuScrollProps }}
        >
          {MODULOS.map((m) => (
            <MenuItem key={m.value || 'todos'} value={m.value}>
              {m.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Usuário"
          value={idUsuario}
          onChange={(e) => setIdUsuario(e.target.value)}
          slotProps={{ select: selectMenuScrollProps }}
        >
          <MenuItem value="">Todos os usuários</MenuItem>
          {usuariosAtivos.map((u) => (
            <MenuItem key={u.id_usuario} value={String(u.id_usuario)}>
              {u.nome}
              {!u.ativo ? ' (inativo)' : ''}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          size="small"
          label="Buscar"
          placeholder="Arquivo, placa, chamado, pessoa…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {(
          [
            ['exclusao', 'Exclusão'],
            ['upload', 'Upload'],
            ['acesso', 'Acesso'],
            ['criacao', 'Criação'],
            ['alteracao', 'Alteração'],
            ['operacao', 'Operação'],
          ] as const
        ).map(([tipo, label]) => {
          const e = estiloAcao(tipo);
          return (
            <Chip
              key={tipo}
              size="small"
              label={label}
              sx={{ bgcolor: e.bg, color: e.color, border: `1px solid ${e.border}`, fontWeight: 600, height: 22, fontSize: '0.7rem' }}
            />
          );
        })}
      </Box>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {erro}
        </Alert>
      )}

      <Paper elevation={0} sx={tablePaperSx}>
        {loading && <PageLoading />}
        <TableContainer sx={tableContainerSx}>
          <Table size="small" sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 140 }}>Quando</TableCell>
                <TableCell sx={{ width: 150 }}>Quem</TableCell>
                <TableCell sx={{ width: 130 }}>Ação</TableCell>
                <TableCell>Detalhe</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lista.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    Nenhum evento encontrado com esses filtros.
                  </TableCell>
                </TableRow>
              ) : (
                lista.map((ev, idx) => {
                  const corLinha =
                    ev.tipo_acao === 'exclusao'
                      ? 'rgba(220, 38, 38, 0.03)'
                      : ev.tipo_acao === 'upload'
                        ? 'rgba(37, 99, 235, 0.03)'
                        : 'transparent';
                  return (
                    <TableRow
                      key={`${ev.created_at}-${ev.modulo}-${ev.acao}-${ev.id_referencia}-${idx}`}
                      hover
                      sx={{ bgcolor: corLinha }}
                    >
                      <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                        {formatDataHoraBrasilia(ev.created_at)}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                          {ev.usuario_nome || 'Sistema'}
                        </Typography>
                        <ChipModulo ev={ev} />
                      </TableCell>
                      <TableCell>
                        <ChipAcao ev={ev} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.8125rem', lineHeight: 1.45, color: 'text.primary' }}>
                          {ev.descricao}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
        <Button size="small" disabled={offset === 0 || loading} onClick={() => setOffset((o) => Math.max(0, o - limite))}>
          Anterior
        </Button>
        <Button size="small" disabled={lista.length < limite || loading} onClick={() => setOffset((o) => o + limite)}>
          Próxima
        </Button>
      </Box>
    </Box>
  );
}
