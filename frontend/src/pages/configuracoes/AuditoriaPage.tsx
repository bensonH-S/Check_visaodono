import { useCallback, useEffect, useState } from 'react';
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
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import { api, type AuditoriaEvento } from '../../api/client';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import { tableContainerSx, tablePageLayoutSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';
import { selectMenuScrollProps } from '../../utils/selectMenuScroll';

const MODULOS = [
  { value: '', label: 'Todos os módulos' },
  { value: 'usuarios', label: 'Usuários' },
  { value: 'cargos', label: 'Cargos' },
  { value: 'lojas', label: 'Lojas' },
  { value: 'configuracoes', label: 'Configurações' },
  { value: 'auth', label: 'Acesso (login)' },
  { value: 'chamados', label: 'Chamados' },
  { value: 'frota', label: 'Frota' },
  { value: 'visitas', label: 'Visitas' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'sistema', label: 'Sistema' },
];

function rotuloModulo(modulo: string) {
  const m = MODULOS.find((x) => x.value === modulo.toLowerCase());
  return m?.label ?? modulo;
}

function chipModulo(modulo: string) {
  const key = modulo.toLowerCase();
  const color =
    key === 'chamados'
      ? 'primary'
      : key === 'frota'
        ? 'secondary'
        : key === 'checklist' || key === 'visitas'
          ? 'success'
          : key === 'usuarios' || key === 'auth'
            ? 'warning'
            : key === 'cargos' || key === 'lojas' || key === 'configuracoes'
              ? 'info'
              : 'default';
  return <Chip size="small" label={rotuloModulo(modulo)} color={color} variant="outlined" />;
}

export default function AuditoriaPage() {
  const [lista, setLista] = useState<AuditoriaEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [modulo, setModulo] = useState('');
  const [offset, setOffset] = useState(0);
  const limite = 80;

  const carregar = useCallback(() => {
    setLoading(true);
    setErro('');
    api
      .auditoriaEventos({ limite, offset, modulo: modulo || undefined })
      .then((rows) => setLista(rows))
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar auditoria'))
      .finally(() => setLoading(false));
  }, [modulo, offset]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    setOffset(0);
  }, [modulo]);

  return (
    <Box sx={tablePageLayoutSx}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Auditoria do sistema
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Alterações, criações, assunções de veículos, chamados, checklist e demais eventos.
          </Typography>
        </Box>
        <TextField
          select
          size="small"
          label="Módulo"
          value={modulo}
          onChange={(e) => setModulo(e.target.value)}
          sx={{ minWidth: 200 }}
          slotProps={{ select: selectMenuScrollProps }}
        >
          {MODULOS.map((m) => (
            <MenuItem key={m.value || 'todos'} value={m.value}>
              {m.label}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {erro}
        </Alert>
      )}

      <Paper elevation={0} sx={tablePaperSx}>
        {loading && <LinearProgress />}
        <TableContainer sx={tableContainerSx}>
          <Table size="small" sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Data / hora</TableCell>
                <TableCell>Módulo</TableCell>
                <TableCell>Ação</TableCell>
                <TableCell>Descrição</TableCell>
                <TableCell>Usuário</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lista.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Nenhum registro encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                lista.map((ev, idx) => (
                  <TableRow key={`${ev.created_at}-${ev.modulo}-${ev.acao}-${idx}`} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDataHoraBrasilia(ev.created_at)}</TableCell>
                    <TableCell>{chipModulo(ev.modulo)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                        {ev.acao}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                        {ev.descricao}
                      </Typography>
                    </TableCell>
                    <TableCell>{ev.usuario_nome || '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
        <Button size="small" disabled={offset === 0 || loading} onClick={() => setOffset((o) => Math.max(0, o - limite))}>
          Anterior
        </Button>
        <Button
          size="small"
          disabled={lista.length < limite || loading}
          onClick={() => setOffset((o) => o + limite)}
        >
          Próxima
        </Button>
      </Box>
    </Box>
  );
}
