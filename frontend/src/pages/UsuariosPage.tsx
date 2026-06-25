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
import TableContainer from '@mui/material/TableContainer';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
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
import SearchIcon from '@mui/icons-material/Search';
import PeopleIcon from '@mui/icons-material/People';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DialogTitleWithIcon from '../components/DialogTitleWithIcon';
import { api, type UsuarioGestao, type Loja, type PermissaoCatalogo, type Cargo } from '../api/client';
import { getUsuario } from '../lib/auth';
import { dialogContentSxCompact, dialogFieldPropsResponsive } from '../utils/dialogForm';
import { tableContainerSx, tablePageLayoutSx, tablePaperSx, tableSx, tableCellWrapSx } from '../utils/tablePageLayout';
import { useToast } from '../hooks/useToast';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { colors } from '../theme/tokens';
import { estiloChipPerfil } from '../constants/perfilCores';

const emptyForm = {
  nome: '',
  email: '',
  senha: '',
  cargo_aprovacao: '',
  lojas_ids: [] as number[],
  permissoes: [] as string[],
  ativo: true,
  telefone_whatsapp: '',
  notifica_whatsapp: true,
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
  const [busca, setBusca] = useState('');
  const [buscaExpandida, setBuscaExpandida] = useState(false);
  const { showToast, ToastSnackbar } = useToast();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
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

  const listaFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((u) => {
      const perfil = nomePerfilUsuario(u).toLowerCase();
      const lojas = (u.lojas || []).map((l) => l.nome).join(' ').toLowerCase();
      return (
        u.nome.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        perfil.includes(q) ||
        lojas.includes(q)
      );
    });
  }, [lista, busca, cargos]);

  const buscaAberta = buscaExpandida || busca.trim().length > 0;

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
      telefone_whatsapp: u.telefone_whatsapp || '',
      notifica_whatsapp: u.notifica_whatsapp !== false,
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
        telefone_whatsapp: form.telefone_whatsapp.trim() || null,
        notifica_whatsapp: form.notifica_whatsapp,
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
      <Box sx={{ width: '100%' }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={tablePageLayoutSx}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Gestão de usuários
          </Typography>
          <Typography variant="body2" color="text.secondary">
            O perfil vem de Configurações → Cargos. Marque as permissões de cada pessoa.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          <Box
            onMouseEnter={() => setBuscaExpandida(true)}
            onMouseLeave={() => {
              if (!busca.trim()) setBuscaExpandida(false);
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              height: 40,
              width: buscaAberta ? { xs: 200, sm: 260 } : 40,
              transition: 'width 0.22s ease',
              overflow: 'hidden',
              borderRadius: 1,
              border: '1px solid',
              borderColor: buscaAberta ? 'divider' : 'transparent',
              bgcolor: buscaAberta ? 'background.paper' : 'transparent',
              flexShrink: 0,
            }}
          >
            <IconButton
              size="small"
              aria-label="Buscar usuário"
              onClick={() => setBuscaExpandida(true)}
              sx={{ flexShrink: 0, color: 'text.secondary' }}
            >
              <SearchIcon fontSize="small" />
            </IconButton>
            {buscaAberta && (
              <TextField
                size="small"
                placeholder="Buscar usuário..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                variant="standard"
                slotProps={{
                  input: {
                    disableUnderline: true,
                    sx: { fontSize: '0.875rem', py: 0.5, pr: 1 },
                  },
                }}
                sx={{ flex: 1, minWidth: 0 }}
                autoFocus={buscaExpandida && !busca}
              />
            )}
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={abrirNovo}>
            Novo usuário
          </Button>
        </Box>
      </Box>

      {erro && !modalAberto && !excluirAlvo && (
        <Alert severity="error" sx={{ flexShrink: 0 }}>
          {erro}
        </Alert>
      )}

      <Paper
        elevation={0}
        sx={tablePaperSx}
      >
        <TableContainer sx={tableContainerSx}>
          <Table size="small" stickyHeader sx={tableSx}>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>E-mail</TableCell>
              <TableCell>Perfil</TableCell>
              <TableCell>WhatsApp</TableCell>
              <TableCell>Funções</TableCell>
              <TableCell>Lojas</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {listaFiltrada.map((u) => (
              <TableRow
                key={u.id_usuario}
                hover
                onClick={() => abrirEditar(u)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell
                  sx={{
                    ...tableCellWrapSx,
                    fontWeight: 600,
                    color: colors.navy,
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  {u.nome}
                </TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  {(() => {
                    const estilo = estiloChipPerfil(u.cargo_aprovacao);
                    return (
                      <Chip
                        label={nomePerfilUsuario(u)}
                        size="small"
                        variant="outlined"
                        sx={{
                          fontWeight: 600,
                          bgcolor: estilo.bgcolor,
                          color: estilo.color,
                          borderColor: estilo.borderColor,
                        }}
                      />
                    );
                  })()}
                </TableCell>
                <TableCell>
                  {u.telefone_whatsapp ? (
                    <Chip
                      label={u.notifica_whatsapp !== false ? 'Ativo' : 'Silenciado'}
                      size="small"
                      color={u.notifica_whatsapp !== false ? 'success' : 'default'}
                      variant="outlined"
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      —
                    </Typography>
                  )}
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
            {!listaFiltrada.length && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  {busca.trim() ? 'Nenhum usuário encontrado para esta busca.' : 'Nenhum usuário cadastrado.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </TableContainer>
      </Paper>

      <Dialog
        open={modalAberto}
        onClose={() => !salvando && setModalAberto(false)}
        fullWidth
        fullScreen={isMobile}
        maxWidth="md"
        slotProps={{
          paper: {
            sx: {
              display: 'flex',
              flexDirection: 'column',
              maxHeight: isMobile ? '100dvh' : '88vh',
              overflow: 'hidden',
              width: { xs: '100%', sm: 'min(100%, 520px)', lg: 'min(100%, 640px)' },
              m: { xs: 0, sm: 1.5 },
            },
          },
        }}
      >
        <DialogTitleWithIcon
          fixed
          compact
          icon={
            editId ? (
              <PeopleIcon sx={{ fontSize: 18 }} />
            ) : (
              <PersonAddIcon sx={{ fontSize: 18 }} />
            )
          }
          endAction={
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={form.ativo}
                  onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                />
              }
              label={
                <Typography
                  variant="caption"
                  sx={{ fontSize: { xs: '0.72rem', lg: '0.8rem' }, whiteSpace: 'nowrap' }}
                >
                  Usuário ativo
                </Typography>
              }
              sx={{ m: 0, mr: 0 }}
            />
          }
        >
          {editId ? 'Editar usuário' : 'Novo usuário'}
        </DialogTitleWithIcon>
        <DialogContent
          dividers
          sx={{
            ...dialogContentSxCompact,
            px: { xs: 2, sm: 2.5 },
            pt: { xs: 1.5, sm: 2 },
            pb: { xs: 1.5, sm: 2 },
            flex: 1,
            overflowY: 'auto',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(3, minmax(0, 1fr))',
              },
              gap: { xs: 1, sm: 1.25, lg: 1.5 },
            }}
          >
            <TextField
              {...dialogFieldPropsResponsive}
              label="Nome"
              required
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
            <TextField
              {...dialogFieldPropsResponsive}
              label="E-mail"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <TextField
              {...dialogFieldPropsResponsive}
              select
              label="Perfil"
              required
              value={form.cargo_aprovacao}
              onChange={(e) => {
                const codigo = e.target.value;
                setForm((f) => ({
                  ...f,
                  cargo_aprovacao: codigo,
                }));
              }}
            >
              {cargos.map((c) => {
                const estilo = estiloChipPerfil(c.codigo);
                return (
                  <MenuItem
                    key={c.codigo}
                    value={c.codigo}
                    dense
                    sx={{ fontSize: { xs: '0.8rem', lg: '0.9rem' } }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: estilo.color,
                          flexShrink: 0,
                        }}
                      />
                      {c.nome}
                    </Box>
                  </MenuItem>
                );
              })}
            </TextField>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr auto' },
              gap: { xs: 1, sm: 1.25 },
              alignItems: 'center',
              mt: 1,
            }}
          >
            <TextField
              {...dialogFieldPropsResponsive}
              label="WhatsApp (DDD + número)"
              placeholder="61999998888"
              value={form.telefone_whatsapp}
              onChange={(e) => setForm((f) => ({ ...f, telefone_whatsapp: e.target.value }))}
              helperText="Recebe alertas de chamados com link direto para o app"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.notifica_whatsapp}
                  onChange={(e) => setForm((f) => ({ ...f, notifica_whatsapp: e.target.checked }))}
                  disabled={!form.telefone_whatsapp.trim()}
                />
              }
              label="Notificar por WhatsApp"
              sx={{ m: 0 }}
            />
          </Box>

          {!cargos.length && (
            <Alert severity="warning" sx={{ py: 0.25, fontSize: '0.75rem' }}>
              Nenhum perfil cadastrado. Vá em Configurações → Cargos.
            </Alert>
          )}

          {exigeCargoAprovador && cargoSelecionado(form.cargo_aprovacao) && !cargoSelecionado(form.cargo_aprovacao)?.aprovador && (
            <Alert severity="warning" sx={{ py: 0.25, fontSize: '0.75rem' }}>
              Para aprovar orçamentos, selecione o perfil Financeiro ou Diretor.
            </Alert>
          )}

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 1, fontSize: '0.8rem' }}>
              Permissões no sistema
            </Typography>
            {catalogoPorGrupo.map(([grupo, itens], idx) => (
              <Box key={grupo} sx={{ mb: 1 }}>
                {idx > 0 && <Divider sx={{ mb: 0.75 }} />}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 0.25, fontSize: '0.7rem', fontWeight: 600 }}
                >
                  {grupo}
                </Typography>
                <FormGroup
                  row
                  sx={{
                    flexWrap: 'wrap',
                    gap: 0,
                    m: 0,
                    ...(grupo === 'Lojas'
                      ? {
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                          width: '100%',
                        }
                      : {}),
                  }}
                >
                  {itens.map((p) => (
                    <FormControlLabel
                      key={p.codigo}
                      control={
                        <Checkbox
                          size="small"
                          checked={form.permissoes.includes(p.codigo)}
                          onChange={() => togglePermissao(p.codigo)}
                          sx={{ py: 0.25 }}
                        />
                      }
                      label={
                        <Typography variant="caption" sx={{ fontSize: '0.75rem', lineHeight: 1.3 }}>
                          {p.nome}
                        </Typography>
                      }
                      sx={{
                        width: grupo === 'Lojas' ? '100%' : { xs: '100%', sm: '50%', md: '48%' },
                        mr: 0,
                        my: 0,
                        ml: 0,
                      }}
                    />
                  ))}
                </FormGroup>
              </Box>
            ))}
            {!form.permissoes.length && (
              <Alert severity="warning" sx={{ mt: 0.75, py: 0.25, fontSize: '0.75rem' }}>
                Sem permissões marcadas, o usuário não verá menus nem poderá usar o sistema.
              </Alert>
            )}
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: { xs: 1, sm: 1.25, lg: 1.5 },
              alignItems: 'flex-start',
            }}
          >
            {todasLojas ? (
              <TextField
                {...dialogFieldPropsResponsive}
                label="Lojas vinculadas"
                value="Todas as lojas"
                disabled
                helperText="Acesso global ativo"
              />
            ) : (
              <TextField
                {...dialogFieldPropsResponsive}
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
                  ...dialogFieldPropsResponsive.slotProps,
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
              >
                {lojas.map((l) => (
                  <MenuItem key={l.id_loja} value={l.id_loja} dense>
                    <Checkbox checked={form.lojas_ids.includes(l.id_loja)} size="small" sx={{ mr: 1 }} />
                    <ListItemText
                      primary={l.name}
                      secondary={l.bk_number ? `BKN ${l.bk_number}` : undefined}
                      slotProps={{
                        primary: { sx: { fontSize: '0.8rem' } },
                        secondary: { sx: { fontSize: '0.7rem' } },
                      }}
                    />
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              {...dialogFieldPropsResponsive}
              label={editId ? 'Nova senha (opcional)' : 'Senha inicial'}
              type={mostrarSenha ? 'text' : 'password'}
              required={!editId}
              value={form.senha}
              onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
              helperText="Mín. 6 caracteres"
              autoComplete="new-password"
              slotProps={{
                ...dialogFieldPropsResponsive.slotProps,
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
            />
          </Box>

          {erro && modalAberto && (
            <Alert severity="error" sx={{ py: 0.25, fontSize: '0.75rem' }}>
              {erro}
            </Alert>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            justifyContent: 'space-between',
            px: { xs: 2, sm: 2.5 },
            py: { xs: 1.25, sm: 1.5 },
            flexShrink: 0,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          {editId && sessao?.id_usuario !== editId ? (
            <Button
              color="error"
              size="small"
              startIcon={<DeleteIcon fontSize="small" />}
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
          <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
            <Button size="small" onClick={() => setModalAberto(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button size="small" variant="contained" onClick={() => void salvar()} disabled={salvando}>
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
