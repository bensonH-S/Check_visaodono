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
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Divider from '@mui/material/Divider';
import Switch from '@mui/material/Switch';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PeopleIcon from '@mui/icons-material/People';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DialogTitleWithIcon from '../components/DialogTitleWithIcon';
import { api, type UsuarioGestao, type Loja, type PermissaoCatalogo, type Cargo } from '../api/client';
import { getUsuario } from '../lib/auth';
import { dialogContentSx, dialogFieldProps } from '../utils/dialogForm';
import { useToast } from '../hooks/useToast';

const NAVY = '#1B2A6B';

const emptyForm = {
  nome: '',
  email: '',
  senha: '',
  cargo_aprovacao: '',
  lojas_ids: [] as number[],
  permissoes: [] as string[],
  ativo: true,
};

export default function UsuariosPage() {
  const [lista, setLista] = useState<UsuarioGestao[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [catalogo, setCatalogo] = useState<PermissaoCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [salvando, setSalvando] = useState(false);
  const [excluirAlvo, setExcluirAlvo] = useState<UsuarioGestao | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const { showToast, ToastSnackbar } = useToast();

  const sessao = getUsuario();
  const todasLojas = form.permissoes.includes('lojas.todas');
  const exigeCargoAprovador = form.permissoes.includes('chamados.aprovar');

  const catalogoPorGrupo = useMemo(() => {
    const map = new Map<string, PermissaoCatalogo[]>();
    for (const p of catalogo) {
      const g = map.get(p.grupo) || [];
      g.push(p);
      map.set(p.grupo, g);
    }
    return [...map.entries()].sort((a, b) => (a[1][0]?.ordem ?? 0) - (b[1][0]?.ordem ?? 0));
  }, [catalogo]);

  function cargoSelecionado(codigo: string) {
    return cargos.find((c) => c.codigo === codigo);
  }

  function nomePerfilUsuario(u: UsuarioGestao) {
    if (u.cargo_nome) return u.cargo_nome;
    return cargoSelecionado(u.cargo_aprovacao || '')?.nome || '—';
  }

  function togglePermissao(codigo: string) {
    setForm((f) => {
      const tem = f.permissoes.includes(codigo);
      const permissoes = tem ? f.permissoes.filter((c) => c !== codigo) : [...f.permissoes, codigo];
      const lojas_ids = codigo === 'lojas.todas' && !tem ? [] : f.lojas_ids;
      let cargo_aprovacao = f.cargo_aprovacao;
      if (codigo === 'chamados.aprovar' && !tem) {
        const atual = cargoSelecionado(cargo_aprovacao);
        if (!atual?.aprovador) {
          cargo_aprovacao = cargos.find((c) => c.aprovador)?.codigo || cargo_aprovacao;
        }
      }
      return { ...f, permissoes, lojas_ids, cargo_aprovacao };
    });
  }

  async function carregar() {
    setLoading(true);
    try {
      const [u, l, cat, cargosLista] = await Promise.all([
        api.usuariosGestao(),
        api.lojas({ ativas: true }),
        api.permissoesCatalogo(),
        api.cargos(),
      ]);
      setLista(u);
      setLojas(l);
      setCatalogo(cat);
      setCargos(cargosLista);
      setErro('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  function abrirNovo() {
    setEditId(null);
    setForm({
      ...emptyForm,
      cargo_aprovacao: cargos[0]?.codigo || '',
    });
    setMostrarSenha(false);
    setErro('');
    setModalAberto(true);
  }

  function abrirEditar(u: UsuarioGestao) {
    setEditId(u.id_usuario);
    setForm({
      nome: u.nome,
      email: u.email,
      senha: '',
      cargo_aprovacao: u.cargo_aprovacao || '',
      lojas_ids: u.lojas_ids || [],
      permissoes: u.permissoes || [],
      ativo: u.ativo !== false,
    });
    setMostrarSenha(false);
    setErro('');
    setModalAberto(true);
  }

  async function salvar() {
    setSalvando(true);
    setErro('');
    try {
      if (!form.cargo_aprovacao) {
        setErro('Selecione o perfil.');
        setSalvando(false);
        return;
      }

      const cargo = cargoSelecionado(form.cargo_aprovacao);
      if (exigeCargoAprovador && !cargo?.aprovador) {
        setErro('Para aprovar orçamentos, escolha um perfil Financeiro ou Diretor.');
        setSalvando(false);
        return;
      }

      const body = {
        nome: form.nome.trim(),
        email: form.email.trim(),
        cargo_aprovacao: form.cargo_aprovacao,
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
        showToast('Usuário atualizado com sucesso!');
      } else {
        if (!form.senha || form.senha.length < 6) {
          setErro('Senha inicial com mínimo 6 caracteres.');
          setSalvando(false);
          return;
        }
        await api.usuarioGestaoCriar({ ...body, senha: form.senha });
        showToast('Usuário criado com sucesso!');
      }
      setModalAberto(false);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    if (!excluirAlvo) return;
    setExcluindo(true);
    setErro('');
    try {
      await api.usuarioGestaoExcluir(excluirAlvo.id_usuario);
      setExcluirAlvo(null);
      setModalAberto(false);
      showToast('Usuário excluído com sucesso!');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir');
    } finally {
      setExcluindo(false);
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
            O perfil vem de Configurações → Cargos. Marque as permissões de cada pessoa.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={abrirNovo}>
          Novo usuário
        </Button>
      </Box>

      {erro && !modalAberto && !excluirAlvo && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}

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
            </TableRow>
          </TableHead>
          <TableBody>
            {lista.map((u) => (
              <TableRow
                key={u.id_usuario}
                hover
                onClick={() => abrirEditar(u)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell
                  sx={{
                    fontWeight: 600,
                    color: NAVY,
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  {u.nome}
                </TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Chip
                    label={nomePerfilUsuario(u)}
                    size="small"
                    variant="outlined"
                  />
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog
        open={modalAberto}
        onClose={() => !salvando && setModalAberto(false)}
        fullWidth
        maxWidth="md"
        slotProps={{
          paper: {
            sx: {
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
              overflow: 'hidden',
            },
          },
        }}
      >
        <DialogTitleWithIcon
          fixed
          icon={
            editId ? (
              <PeopleIcon sx={{ fontSize: 22 }} />
            ) : (
              <PersonAddIcon sx={{ fontSize: 22 }} />
            )
          }
        >
          {editId ? 'Editar usuário' : 'Novo usuário'}
        </DialogTitleWithIcon>
        <DialogContent
          dividers
          sx={{
            ...dialogContentSx,
            gap: 2.5,
            pt: 3,
            pb: 3,
            flex: 1,
            overflowY: 'auto',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
              gap: 2,
              mb: 1,
            }}
          >
            <TextField
              {...dialogFieldProps}
              label="Nome"
              required
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
            <TextField
              {...dialogFieldProps}
              label="E-mail"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <TextField
              {...dialogFieldProps}
              select
              label="Perfil"
              required
              value={form.cargo_aprovacao}
              onChange={(e) => {
                const codigo = e.target.value;
                setForm((f) => ({
                  ...f,
                  cargo_aprovacao: codigo,
                  permissoes: codigo === 'ti' ? catalogo.map((p) => p.codigo) : f.permissoes,
                  lojas_ids: codigo === 'ti' ? [] : f.lojas_ids,
                }));
              }}
              helperText="Cadastre perfis em Configurações → Cargos"
            >
              {cargos.map((c) => (
                <MenuItem key={c.codigo} value={c.codigo}>
                  {c.nome}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          {form.cargo_aprovacao === 'ti' && (
            <Alert severity="info" sx={{ py: 0.5 }}>
              Perfil TI recebe todas as funções por padrão.
            </Alert>
          )}

          {!cargos.length && (
            <Alert severity="warning">
              Nenhum perfil cadastrado. Vá em Configurações → Cargos.
            </Alert>
          )}

          {exigeCargoAprovador && cargoSelecionado(form.cargo_aprovacao) && !cargoSelecionado(form.cargo_aprovacao)?.aprovador && (
            <Alert severity="warning">
              Para aprovar orçamentos, selecione o perfil Financeiro ou Diretor.
            </Alert>
          )}

          <Box sx={{ mt: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
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

          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 2,
              flexWrap: { xs: 'wrap', lg: 'nowrap' },
            }}
          >
            {todasLojas ? (
              <TextField
                {...dialogFieldProps}
                label="Lojas vinculadas"
                value="Todas as lojas"
                disabled
                helperText="Acesso global ativo"
                sx={{ flex: 1.2, minWidth: 160 }}
              />
            ) : (
              <TextField
                {...dialogFieldProps}
                select
                label="Lojas vinculadas"
                value={form.lojas_ids}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => ({
                    ...f,
                    lojas_ids: typeof v === 'string' ? [] : (v as number[]),
                  }));
                }}
                slotProps={{
                  ...dialogFieldProps.slotProps,
                  select: {
                    multiple: true,
                    renderValue: (selected: unknown) => {
                      const ids = selected as number[];
                      return lojas
                        .filter((l) => ids.includes(l.id_loja))
                        .map((l) => l.name)
                        .join(', ');
                    },
                  },
                }}
                sx={{ flex: 1.2, minWidth: 160 }}
              >
                {lojas.map((l) => (
                  <MenuItem key={l.id_loja} value={l.id_loja}>
                    <Checkbox checked={form.lojas_ids.includes(l.id_loja)} size="small" sx={{ mr: 1 }} />
                    <ListItemText
                      primary={l.name}
                      secondary={l.bk_number ? `BKN ${l.bk_number}` : undefined}
                    />
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              {...dialogFieldProps}
              label={editId ? 'Nova senha (opcional)' : 'Senha inicial'}
              type={mostrarSenha ? 'text' : 'password'}
              required={!editId}
              value={form.senha}
              onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
              helperText="Mín. 6 caracteres"
              autoComplete="new-password"
              slotProps={{
                ...dialogFieldProps.slotProps,
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        type="button"
                        aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                        onClick={() => setMostrarSenha((v) => !v)}
                        edge="end"
                        size="small"
                      >
                        {mostrarSenha ? (
                          <VisibilityOffOutlinedIcon fontSize="small" />
                        ) : (
                          <VisibilityOutlinedIcon fontSize="small" />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ flex: 1, minWidth: 140 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.ativo}
                  onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                />
              }
              label="Usuário ativo"
              sx={{ m: 0, flexShrink: 0, mt: 1, alignSelf: 'center' }}
            />
          </Box>

          {erro && modalAberto && <Alert severity="error">{erro}</Alert>}
        </DialogContent>
        <DialogActions
          sx={{
            justifyContent: 'space-between',
            px: 3,
            py: 2.5,
            flexShrink: 0,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          {editId && sessao?.id_usuario !== editId ? (
            <Button
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => {
                const alvo = lista.find((u) => u.id_usuario === editId);
                if (alvo) {
                  setErro('');
                  setExcluirAlvo(alvo);
                }
              }}
            >
              Excluir
            </Button>
          ) : (
            <span />
          )}
          <Box className="flex gap-1">
            <Button onClick={() => setModalAberto(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button variant="contained" onClick={() => void salvar()} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!excluirAlvo}
        onClose={() => !excluindo && setExcluirAlvo(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Excluir usuário</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2">
            Tem certeza que deseja excluir <strong>{excluirAlvo?.nome}</strong> (
            {excluirAlvo?.email})? Esta ação não pode ser desfeita.
          </Typography>
          {erro && excluirAlvo && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {erro}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExcluirAlvo(null)} disabled={excluindo}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => void confirmarExclusao()}
            disabled={excluindo}
          >
            {excluindo ? 'Excluindo...' : 'Excluir'}
          </Button>
        </DialogActions>
      </Dialog>

      <ToastSnackbar />
    </Box>
  );
}
