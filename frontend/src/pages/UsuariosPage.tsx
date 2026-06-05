import { useEffect, useMemo, useState } from 'react';
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
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import { api, type UsuarioGestao, type Loja, type PermissaoCatalogo } from '../api/client';
import { labelPerfil } from '../lib/auth';

const PERFIS = ['administrador', 'coordenador', 'gerente', 'tecnico', 'ti'] as const;

const emptyForm = {
  nome: '',
  email: '',
  senha: '',
  perfil: 'tecnico' as (typeof PERFIS)[number],
  lojas_ids: [] as number[],
  permissoes: [] as string[],
  ativo: true,
};

export default function UsuariosPage() {
  const [lista, setLista] = useState<UsuarioGestao[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [catalogo, setCatalogo] = useState<PermissaoCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [dialog, setDialog] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [salvando, setSalvando] = useState(false);

  const todasLojas = form.permissoes.includes('lojas.todas');

  const catalogoPorGrupo = useMemo(() => {
    const map = new Map<string, PermissaoCatalogo[]>();
    for (const p of catalogo) {
      const g = map.get(p.grupo) || [];
      g.push(p);
      map.set(p.grupo, g);
    }
    return [...map.entries()].sort((a, b) => (a[1][0]?.ordem ?? 0) - (b[1][0]?.ordem ?? 0));
  }, [catalogo]);

  function togglePermissao(codigo: string) {
    setForm((f) => {
      const tem = f.permissoes.includes(codigo);
      const permissoes = tem ? f.permissoes.filter((c) => c !== codigo) : [...f.permissoes, codigo];
      const lojas_ids = codigo === 'lojas.todas' && !tem ? [] : f.lojas_ids;
      return { ...f, permissoes, lojas_ids };
    });
  }

  async function carregar() {
    setLoading(true);
    try {
      const [u, l, cat] = await Promise.all([
        api.usuariosGestao(),
        api.lojas({ ativas: true }),
        api.permissoesCatalogo(),
      ]);
      setLista(u);
      setLojas(l);
      setCatalogo(cat);
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
      permissoes: u.permissoes || [],
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
        lojas_ids: todasLojas ? [] : form.lojas_ids,
        permissoes: form.permissoes,
        ativo: form.ativo,
        ...(form.senha ? { senha: form.senha } : {}),
      };

      if (!todasLojas && !body.lojas_ids.length) {
        setErro('Selecione ao menos uma loja ou marque "Acesso a todas as lojas".');
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
            Perfil é só o cargo. Marque abaixo o que cada pessoa pode fazer no sistema.
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
              <TableCell>Funções</TableCell>
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
                  <Typography variant="body2" color={u.permissoes?.length ? 'text.primary' : 'text.secondary'}>
                    {u.permissoes?.length ? `${u.permissoes.length} permissão(ões)` : 'Nenhuma'}
                  </Typography>
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

      <Dialog open={dialog} onClose={() => !salvando && setDialog(false)} fullWidth maxWidth="md">
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
            label="Perfil (cargo)"
            required
            fullWidth
            value={form.perfil}
            onChange={(e) => {
              const perfil = e.target.value as typeof form.perfil;
              setForm((f) => ({
                ...f,
                perfil,
                permissoes:
                  perfil === 'ti' ? catalogo.map((p) => p.codigo) : f.permissoes,
                lojas_ids: perfil === 'ti' ? [] : f.lojas_ids,
              }));
            }}
            helperText={
              form.perfil === 'ti'
                ? 'Perfil TI recebe todas as funções por padrão'
                : 'Apenas identificação — marque as permissões abaixo'
            }
          >
            {PERFIS.map((p) => (
              <MenuItem key={p} value={p}>
                {labelPerfil(p)}
              </MenuItem>
            ))}
          </TextField>

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Permissões no sistema
            </Typography>
            {catalogoPorGrupo.map(([grupo, itens], idx) => (
              <Box key={grupo} sx={{ mb: 1.5 }}>
                {idx > 0 && <Divider sx={{ mb: 1 }} />}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {grupo}
                </Typography>
                <FormGroup row sx={{ flexWrap: 'wrap', gap: 0 }}>
                  {itens.map((p) => (
                    <FormControlLabel
                      key={p.codigo}
                      control={
                        <Checkbox
                          size="small"
                          checked={form.permissoes.includes(p.codigo)}
                          onChange={() => togglePermissao(p.codigo)}
                        />
                      }
                      label={<Typography variant="body2">{p.nome}</Typography>}
                      sx={{ width: { xs: '100%', sm: '48%' }, mr: 0 }}
                    />
                  ))}
                </FormGroup>
              </Box>
            ))}
            {!form.permissoes.length && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Sem permissões marcadas, o usuário não verá menus nem poderá usar o sistema.
              </Alert>
            )}
          </Box>

          {todasLojas ? (
            <Alert severity="info" sx={{ py: 0.5 }}>
              Com <strong>Acesso a todas as lojas</strong>, o vínculo manual de lojas é ignorado.
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
