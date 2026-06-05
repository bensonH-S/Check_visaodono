import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import OutlinedInput from '@mui/material/OutlinedInput';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import AddIcon from '@mui/icons-material/Add';
import { api, type UsuarioGestao, type Loja } from '../api/client';
import { labelPerfil } from '../lib/auth';

const PERFIS = ['administrador', 'coordenador', 'gerente', 'tecnico', 'ti'] as const;
const PERFIS_TODAS_LOJAS = ['administrador', 'ti'];

const emptyForm = {
  nome: '',
  email: '',
  senha: '',
  perfil: 'tecnico' as (typeof PERFIS)[number],
  lojas_ids: [] as number[],
  ativo: true,
};

export default function UsuariosPage() {
  const [lista, setLista] = useState<UsuarioGestao[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [dialog, setDialog] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [salvando, setSalvando] = useState(false);

  const perfilTodasLojas = PERFIS_TODAS_LOJAS.includes(form.perfil);

  async function carregar() {
    setLoading(true);
    try {
      const [u, l] = await Promise.all([api.usuariosGestao(), api.lojas({ ativas: true })]);
      setLista(u);
      setLojas(l);
      setErro('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function abrirNovo() {
    setEditId(null);
    setForm(emptyForm);
    setDialog(true);
  }

  function abrirEditar(u: UsuarioGestao) {
    setEditId(u.id_usuario);
    setForm({
      nome: u.nome,
      email: u.email,
      senha: '',
      perfil: u.perfil as (typeof PERFIS)[number],
      lojas_ids: u.lojas_ids || [],
      ativo: u.ativo,
    });
    setDialog(true);
  }

  async function salvar() {
    setSalvando(true);
    setErro('');
    try {
      const body = {
        nome: form.nome.trim(),
        email: form.email.trim(),
        perfil: form.perfil,
        lojas_ids: perfilTodasLojas ? [] : form.lojas_ids,
        ativo: form.ativo,
        ...(form.senha ? { senha: form.senha } : {}),
      };

      if (!perfilTodasLojas && !body.lojas_ids.length) {
        setErro('Selecione ao menos uma loja.');
        setSalvando(false);
        return;
      }

      if (editId) {
        await api.usuarioGestaoAtualizar(editId, body);
      } else {
        if (!form.senha || form.senha.length < 6) {
          setErro('Senha inicial com mínimo 6 caracteres.');
          setSalvando(false);
          return;
        }
        await api.usuarioGestaoCriar({ ...body, senha: form.senha });
      }
      setDialog(false);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  function lojasLabel(u: UsuarioGestao) {
    if (u.acesso_todas_lojas) return 'Todas as lojas';
    if (!u.lojas?.length) return '—';
    if (u.lojas.length <= 2) return u.lojas.map((l) => l.nome).join(', ');
    return `${u.lojas.length} lojas`;
  }

  if (loading) {
    return (
      <Box className="flex justify-center py-16">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="max-w-5xl mx-auto w-full">
      <Box className="flex justify-between items-center mb-4 gap-2">
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Gestão de usuários
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Vincule uma ou várias lojas por usuário. TI e Administrador têm todas automaticamente.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={abrirNovo}>
          Novo usuário
        </Button>
      </Box>

      {erro && !dialog && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}

      <Paper sx={{ overflow: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>E-mail</TableCell>
              <TableCell>Perfil</TableCell>
              <TableCell>Lojas</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lista.map((u) => (
              <TableRow key={u.id_usuario} hover>
                <TableCell>{u.nome}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Chip label={labelPerfil(u.perfil)} size="small" variant="outlined" />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{lojasLabel(u)}</Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={u.ativo ? 'Ativo' : 'Inativo'}
                    size="small"
                    color={u.ativo ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => abrirEditar(u)}>
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={dialog} onClose={() => !salvando && setDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editId ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
        <DialogContent className="flex flex-col gap-3 pt-2">
          <TextField
            label="Nome"
            required
            fullWidth
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
          />
          <TextField
            label="E-mail"
            type="email"
            required
            fullWidth
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <TextField
            select
            label="Perfil"
            required
            fullWidth
            value={form.perfil}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                perfil: e.target.value as typeof form.perfil,
                lojas_ids: PERFIS_TODAS_LOJAS.includes(e.target.value) ? [] : f.lojas_ids,
              }))
            }
          >
            {PERFIS.map((p) => (
              <MenuItem key={p} value={p}>
                {labelPerfil(p)}
              </MenuItem>
            ))}
          </TextField>

          {perfilTodasLojas ? (
            <Alert severity="info" sx={{ py: 0.5 }}>
              Perfil <strong>{labelPerfil(form.perfil)}</strong> tem acesso a <strong>todas as lojas</strong>{' '}
              automaticamente.
            </Alert>
          ) : (
            <FormControl fullWidth>
              <InputLabel>Lojas vinculadas</InputLabel>
              <Select
                multiple
                value={form.lojas_ids}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => ({
                    ...f,
                    lojas_ids: typeof v === 'string' ? [] : (v as number[]),
                  }));
                }}
                input={<OutlinedInput label="Lojas vinculadas" />}
                renderValue={(selected) =>
                  lojas
                    .filter((l) => selected.includes(l.id_loja))
                    .map((l) => l.name)
                    .join(', ')
                }
              >
                {lojas.map((l) => (
                  <MenuItem key={l.id_loja} value={l.id_loja}>
                    <Checkbox checked={form.lojas_ids.includes(l.id_loja)} />
                    <ListItemText primary={l.name} secondary={l.bk_number ? `BKN ${l.bk_number}` : undefined} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField
            label={editId ? 'Nova senha (opcional)' : 'Senha inicial'}
            type="password"
            fullWidth
            required={!editId}
            value={form.senha}
            onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
            helperText="Mínimo 6 caracteres"
          />
          <TextField
            select
            label="Status"
            fullWidth
            value={form.ativo ? '1' : '0'}
            onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.value === '1' }))}
          >
            <MenuItem value="1">Ativo</MenuItem>
            <MenuItem value="0">Inativo</MenuItem>
          </TextField>
          {erro && dialog && <Alert severity="error">{erro}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
