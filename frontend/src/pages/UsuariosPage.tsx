import { useEffect, useMemo, useRef, useState } from 'react';
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
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Drawer from '@mui/material/Drawer';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Stack from '@mui/material/Stack';
import PageLoading from '../components/PageLoading';
import Switch from '@mui/material/Switch';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { Link as RouterLink } from 'react-router-dom';
import { api, type UsuarioGestao, type Loja, type PermissaoCatalogo, type Cargo, type TipoChecklist } from '../api/client';
import { atualizarUsuarioSessao, getToken, getUsuario, iniciaisUsuario, temPermissao } from '../lib/auth';
import { redimensionarFotoPerfil } from '../utils/fotoPerfil';
import { tableContainerSx, tableSx } from '../utils/tablePageLayout';
import { useToast } from '../hooks/useToast';
import {
  configPageSx,
  configPaperSx,
  configToolbarSx,
  finBtnContainedSx,
  finCampoSx,
  FIN_BORDER,
  FIN_MUTED,
  FIN_SURFACE,
  FIN_SURFACE_ALT,
  FIN_TEXT,
} from './configuracoes/configPageSx';

function Selo({ texto, tom = 'neutro' }: { texto: string; tom?: 'ok' | 'neutro' | 'alerta' }) {
  const estilo =
    tom === 'ok'
      ? { color: '#047857', border: 'rgba(5,150,105,0.45)', bg: 'rgba(5,150,105,0.1)' }
      : tom === 'alerta'
        ? { color: '#B45309', border: 'rgba(245,158,11,0.45)', bg: 'rgba(245,158,11,0.1)' }
        : { color: FIN_MUTED, border: FIN_BORDER, bg: 'transparent' };
  return (
    <Chip
      size="small"
      variant="outlined"
      label={texto}
      sx={{
        height: 22,
        fontSize: 11,
        fontWeight: 500,
        color: estilo.color,
        borderColor: estilo.border,
        bgcolor: estilo.bg,
      }}
    />
  );
}

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

const campoSx = { ...finCampoSx, width: '100%' };

type FormUsuarioProps = {
  usuario: UsuarioGestao | null;
  cargos: Cargo[];
  lojas: Loja[];
  catalogoPorGrupo: [string, PermissaoCatalogo[]][];
  tiposCatalogo: TipoChecklist[];
  podeEditarChecklistsCargo: boolean;
  idSessao?: number;
  onFechar: () => void;
  onSalvo: () => void;
  onPedirExcluir: (u: UsuarioGestao) => void;
  showToast: (msg: string) => void;
};

/** Monta só quando aberto — mesmo fluxo da Conta bancária. */
function FormUsuario({
  usuario,
  cargos,
  lojas,
  catalogoPorGrupo,
  tiposCatalogo,
  podeEditarChecklistsCargo,
  idSessao,
  onFechar,
  onSalvo,
  onPedirExcluir,
  showToast,
}: FormUsuarioProps) {
  const codigoInicial = usuario?.cargo_aprovacao || cargos[0]?.codigo || '';
  const [form, setForm] = useState(() =>
    usuario
      ? {
          nome: usuario.nome,
          email: usuario.email,
          senha: '',
          cargo_aprovacao: codigoInicial,
          lojas_ids: usuario.lojas_ids || [],
          permissoes: usuario.permissoes || [],
          ativo: usuario.ativo !== false,
          telefone_whatsapp: usuario.telefone_whatsapp || '',
          notifica_whatsapp: usuario.notifica_whatsapp !== false,
        }
      : { ...emptyForm, cargo_aprovacao: codigoInicial },
  );
  const [cargoTiposChecklist, setCargoTiposChecklist] = useState(() => {
    const cargo = cargos.find((c) => c.codigo === codigoInicial);
    return (cargo?.tipos_checklist || []).map((t) => t.codigo);
  });
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  /** null = sem mudança; string = data URL; '' = remover foto. */
  const [avatarDraft, setAvatarDraft] = useState<string | null>(usuario?.avatar_url ?? null);
  const [avatarTouched, setAvatarTouched] = useState(false);
  const inputFotoRef = useRef<HTMLInputElement>(null);
  /** Lista pesada de permissões entra depois do slide — evita tranco. */
  const [detalhePronto, setDetalhePronto] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDetalhePronto(true), 180);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!usuario?.id_usuario || usuario.avatar_url) return;
    let cancel = false;
    void api.usuarioGestao(usuario.id_usuario).then((full) => {
      if (cancel || avatarTouched) return;
      if (full.avatar_url) setAvatarDraft(full.avatar_url);
    }).catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [usuario?.id_usuario, usuario?.avatar_url, avatarTouched]);

  async function onEscolherFoto(file?: File | null) {
    if (!file) return;
    try {
      const dataUrl = await redimensionarFotoPerfil(file);
      setAvatarDraft(dataUrl);
      setAvatarTouched(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao processar a foto');
    }
  }

  const todasLojas = form.permissoes.includes('lojas.todas');
  const exigeCargoAprovador = form.permissoes.includes('chamados.aprovar');

  function cargoSelecionado(codigo: string) {
    return cargos.find((c) => c.codigo === codigo);
  }

  function sincronizarTiposDoCargo(codigo: string) {
    const cargo = cargos.find((c) => c.codigo === codigo);
    setCargoTiposChecklist((cargo?.tipos_checklist || []).map((t) => t.codigo));
  }

  function tiposChecklistAlterados(codigo: string) {
    const cargo = cargos.find((c) => c.codigo === codigo);
    const orig = (cargo?.tipos_checklist || []).map((t) => t.codigo).sort().join(',');
    const novo = [...cargoTiposChecklist].sort().join(',');
    return orig !== novo;
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
        ...(avatarTouched || (typeof avatarDraft === 'string' && avatarDraft.startsWith('data:image/'))
          ? { avatar_base64: avatarDraft || null }
          : {}),
      };
      if (!todasLojas && !body.lojas_ids.length) {
        setErro('Selecione ao menos uma loja ou marque "Acesso a todas as lojas".');
        setSalvando(false);
        return;
      }
      let salvoId = usuario?.id_usuario;
      if (usuario) {
        await api.usuarioGestaoAtualizar(usuario.id_usuario, body);
        showToast('Usuário atualizado com sucesso!');
      } else {
        if (!form.senha || form.senha.length < 6) {
          setErro('Senha inicial com mínimo 6 caracteres.');
          setSalvando(false);
          return;
        }
        const criado = await api.usuarioGestaoCriar({ ...body, senha: form.senha });
        salvoId = criado.id_usuario;
        showToast('Usuário criado com sucesso!');
      }
      if (podeEditarChecklistsCargo && form.cargo_aprovacao && tiposChecklistAlterados(form.cargo_aprovacao)) {
        const c = cargoSelecionado(form.cargo_aprovacao);
        if (c) await api.cargoGestaoAtualizar(c.id_cargo, { tipos_checklist: cargoTiposChecklist });
      }
      if (salvoId && idSessao && salvoId === idSessao && avatarTouched) {
        const token = getToken();
        if (token) {
          try {
            const me = await api.me({ skipSessionRedirect: true });
            atualizarUsuarioSessao(me);
          } catch {
            /* sessão segue; próximo login/me puxa a foto */
          }
        }
      }
      onSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Drawer
      anchor="right"
      open
      onClose={() => !salvando && onFechar()}
      transitionDuration={200}
      ModalProps={{ disableScrollLock: true, keepMounted: false }}
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100%', sm: 480 },
            bgcolor: FIN_SURFACE_ALT,
            color: FIN_TEXT,
            borderLeft: `1px solid ${FIN_BORDER}`,
            backgroundImage: 'none',
          },
        },
      }}
    >
      <Stack sx={{ height: '100%' }}>
        <Stack
          direction="row"
          sx={{
            alignItems: 'flex-start',
            px: 2.5,
            py: 2,
            borderBottom: `1px solid ${FIN_BORDER}`,
            bgcolor: FIN_SURFACE,
            gap: 1,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 650, color: FIN_TEXT }}>
              {usuario ? 'Editar usuário' : 'Novo usuário'}
            </Typography>
            <Typography sx={{ fontSize: 12, color: FIN_MUTED, mt: 0.25 }}>
              Perfil, lojas e o que a pessoa pode fazer no sistema.
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch size="small" checked={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))} />
            }
            label={<Typography sx={{ fontSize: 12, color: FIN_MUTED }}>Ativo</Typography>}
            sx={{ m: 0, mr: 0.5 }}
          />
          <IconButton size="small" onClick={() => !salvando && onFechar()} sx={{ color: FIN_MUTED }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Stack spacing={2.25} sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 2.25 }}>
          <Stack spacing={1.25}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: FIN_MUTED }}>
              Conta
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Avatar
                src={avatarDraft || undefined}
                alt={form.nome || 'Usuário'}
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: '#1B6EF3',
                  fontSize: 16,
                  fontWeight: 700,
                  border: `1px solid ${FIN_BORDER}`,
                }}
              >
                {!avatarDraft
                  ? iniciaisUsuario({
                      nome: form.nome || usuario?.nome || 'U',
                      avatar_inicial: usuario?.avatar_inicial,
                    })
                  : null}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: FIN_TEXT }}>Foto de perfil</Typography>
                <Typography sx={{ fontSize: 12, color: FIN_MUTED, mt: 0.25 }}>
                  Aparece no menu quando a pessoa estiver logada.
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PhotoCameraOutlinedIcon sx={{ fontSize: 16 }} />}
                    onClick={() => inputFotoRef.current?.click()}
                    disabled={salvando}
                    sx={{ textTransform: 'none', borderColor: FIN_BORDER, color: FIN_TEXT }}
                  >
                    Anexar foto
                  </Button>
                  {avatarDraft ? (
                    <Button
                      size="small"
                      onClick={() => {
                        setAvatarDraft('');
                        setAvatarTouched(true);
                      }}
                      disabled={salvando}
                      sx={{ textTransform: 'none', color: FIN_MUTED }}
                    >
                      Remover
                    </Button>
                  ) : null}
                </Stack>
                <input
                  ref={inputFotoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    void onEscolherFoto(f);
                  }}
                />
              </Box>
            </Stack>
            <TextField size="small" label="Nome" required value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} sx={campoSx} />
            <TextField size="small" label="E-mail" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} sx={campoSx} />
            <TextField
              size="small"
              select
              label="Perfil"
              required
              value={form.cargo_aprovacao}
              onChange={(e) => {
                const codigo = e.target.value;
                setForm((f) => ({ ...f, cargo_aprovacao: codigo }));
                sincronizarTiposDoCargo(codigo);
              }}
              sx={campoSx}
            >
              {cargos.map((c) => (
                <MenuItem key={c.codigo} value={c.codigo} dense>
                  {c.nome}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label={usuario ? 'Nova senha (opcional)' : 'Senha inicial'}
              type={mostrarSenha ? 'text' : 'password'}
              required={!usuario}
              value={form.senha}
              onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
              helperText="Mín. 6 caracteres"
              autoComplete="new-password"
              sx={campoSx}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton type="button" size="small" onClick={() => setMostrarSenha((v) => !v)} edge="end">
                        {mostrarSenha ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Stack>

          {form.cargo_aprovacao ? (
            <Stack spacing={1}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: FIN_MUTED }}>
                Checklists do perfil
              </Typography>
              {podeEditarChecklistsCargo && tiposCatalogo.length > 0 ? (
                <>
                  <Typography sx={{ fontSize: 12, color: FIN_MUTED }}>
                    Vale para todos com o perfil{' '}
                    <Box component="span" sx={{ fontWeight: 600, color: FIN_TEXT }}>
                      {cargoSelecionado(form.cargo_aprovacao)?.nome || form.cargo_aprovacao}
                    </Box>
                    . Também em{' '}
                    <RouterLink to="/configuracoes/cargos" style={{ color: '#1B6EF3', fontWeight: 600 }}>
                      Permissões
                    </RouterLink>
                    .
                  </Typography>
                  <FormGroup>
                    {tiposCatalogo.map((t) => (
                      <FormControlLabel
                        key={t.codigo}
                        control={
                          <Checkbox
                            size="small"
                            checked={cargoTiposChecklist.includes(t.codigo)}
                            onChange={() =>
                              setCargoTiposChecklist((atual) =>
                                atual.includes(t.codigo) ? atual.filter((c) => c !== t.codigo) : [...atual, t.codigo],
                              )
                            }
                          />
                        }
                        label={<Typography sx={{ fontSize: 13 }}>{t.nome}</Typography>}
                        sx={{ m: 0 }}
                      />
                    ))}
                  </FormGroup>
                </>
              ) : (
                <Typography sx={{ fontSize: 12, color: FIN_MUTED }}>
                  {cargoTiposChecklist.length
                    ? cargoTiposChecklist.map((c) => tiposCatalogo.find((t) => t.codigo === c)?.nome || c).join(' · ')
                    : 'Nenhum checklist vinculado a este perfil.'}
                </Typography>
              )}
            </Stack>
          ) : null}

          <Stack spacing={1.25}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: FIN_MUTED }}>
              WhatsApp
            </Typography>
            <TextField
              size="small"
              label="WhatsApp (DDD + número)"
              placeholder="61999998888"
              value={form.telefone_whatsapp}
              onChange={(e) => setForm((f) => ({ ...f, telefone_whatsapp: e.target.value }))}
              helperText="Alertas de chamado com link para o app"
              sx={campoSx}
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={form.notifica_whatsapp}
                  onChange={(e) => setForm((f) => ({ ...f, notifica_whatsapp: e.target.checked }))}
                  disabled={!form.telefone_whatsapp.trim()}
                />
              }
              label={<Typography sx={{ fontSize: 13 }}>Notificar por WhatsApp</Typography>}
              sx={{ m: 0 }}
            />
          </Stack>

          {!cargos.length ? <Alert severity="warning">Nenhum perfil cadastrado. Vá em Configurações → Permissões.</Alert> : null}
          {exigeCargoAprovador && cargoSelecionado(form.cargo_aprovacao) && !cargoSelecionado(form.cargo_aprovacao)?.aprovador ? (
            <Alert severity="warning">Para aprovar orçamentos, use o perfil Financeiro ou Diretor.</Alert>
          ) : null}

          <Stack spacing={1.25}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: FIN_MUTED }}>
              Permissões
            </Typography>
            {!detalhePronto ? (
              <Typography sx={{ fontSize: 12, color: FIN_MUTED }}>Carregando permissões…</Typography>
            ) : (
              catalogoPorGrupo.map(([grupo, itens]) => (
                <Box key={grupo}>
                  <Typography sx={{ fontSize: 11, fontWeight: 650, color: FIN_MUTED, mb: 0.5 }}>{grupo}</Typography>
                  <FormGroup>
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
                        label={<Typography sx={{ fontSize: 13, lineHeight: 1.35 }}>{p.nome}</Typography>}
                        sx={{ m: 0, alignItems: 'flex-start', '& .MuiCheckbox-root': { pt: 0.15 } }}
                      />
                    ))}
                  </FormGroup>
                </Box>
              ))
            )}
            {detalhePronto && !form.permissoes.length ? (
              <Alert severity="warning">Sem permissões, a pessoa não vê menus nem usa o sistema.</Alert>
            ) : null}
          </Stack>

          <Stack spacing={1.25}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: FIN_MUTED }}>
              Lojas
            </Typography>
            {todasLojas ? (
              <TextField size="small" label="Lojas vinculadas" value="Todas as lojas" disabled helperText="Permissão «Todas as lojas» ativa" sx={campoSx} />
            ) : (
              <TextField
                size="small"
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
                sx={campoSx}
                slotProps={{
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
                        primary: { sx: { fontSize: 13 } },
                        secondary: { sx: { fontSize: 11 } },
                      }}
                    />
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>

          {erro ? <Alert severity="error">{erro}</Alert> : null}
        </Stack>

        <Stack direction="row" spacing={1} sx={{ px: 2.5, py: 1.75, borderTop: `1px solid ${FIN_BORDER}`, bgcolor: FIN_SURFACE }}>
          {usuario && idSessao !== usuario.id_usuario ? (
            <Button
              color="error"
              size="small"
              startIcon={<DeleteOutlineIcon sx={{ fontSize: 16 }} />}
              onClick={() => onPedirExcluir(usuario)}
            >
              Excluir
            </Button>
          ) : null}
          <Box sx={{ flex: 1 }} />
          <Button size="small" onClick={onFechar} disabled={salvando} sx={{ color: FIN_MUTED }}>
            Cancelar
          </Button>
          <Button size="small" variant="contained" onClick={() => void salvar()} disabled={salvando} sx={finBtnContainedSx}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}

export default function UsuariosPage() {
  const [lista, setLista] = useState<UsuarioGestao[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [catalogo, setCatalogo] = useState<PermissaoCatalogo[]>([]);
  const [tiposCatalogo, setTiposCatalogo] = useState<TipoChecklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroLista, setErroLista] = useState('');
  /** Igual Contas: um setState e o painel monta pronto. */
  const [editando, setEditando] = useState<UsuarioGestao | 'novo' | null>(null);
  const [excluirAlvo, setExcluirAlvo] = useState<UsuarioGestao | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [busca, setBusca] = useState('');
  const { showToast, ToastSnackbar } = useToast();

  const sessao = getUsuario();
  const ativos = lista.filter((u) => u.ativo).length;
  const podeEditarChecklistsCargo =
    temPermissao('configuracoes.ver', sessao) || temPermissao('usuarios.gerenciar', sessao);

  const catalogoPorGrupo = useMemo(() => {
    const map = new Map<string, PermissaoCatalogo[]>();
    for (const p of catalogo) {
      const g = map.get(p.grupo) || [];
      g.push(p);
      map.set(p.grupo, g);
    }
    return [...map.entries()].sort((a, b) => (a[1][0]?.ordem ?? 0) - (b[1][0]?.ordem ?? 0));
  }, [catalogo]);

  function nomePerfilUsuario(u: UsuarioGestao) {
    if (u.cargo_nome) return u.cargo_nome;
    return cargos.find((c) => c.codigo === (u.cargo_aprovacao || ''))?.nome || '—';
  }

  const listaFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((u) => {
      const perfil = nomePerfilUsuario(u).toLowerCase();
      const lojasTxt = (u.lojas || []).map((l) => l.nome).join(' ').toLowerCase();
      return (
        u.nome.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        perfil.includes(q) ||
        lojasTxt.includes(q)
      );
    });
  }, [lista, busca, cargos]);

  async function carregar() {
    setLoading(true);
    try {
      const [u, l, cat, cargosLista, tipos] = await Promise.all([
        api.usuariosGestao(),
        api.lojas({ ativas: true }),
        api.permissoesCatalogo(),
        api.cargos(),
        podeEditarChecklistsCargo ? api.checklistTiposCatalogo().catch(() => []) : Promise.resolve([]),
      ]);
      setLista(u);
      setLojas(l);
      setCatalogo(cat);
      setCargos(cargosLista);
      setTiposCatalogo(tipos);
      setErroLista('');
    } catch (e) {
      setErroLista(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function confirmarExclusao() {
    if (!excluirAlvo) return;
    setExcluindo(true);
    try {
      await api.usuarioGestaoExcluir(excluirAlvo.id_usuario);
      setExcluirAlvo(null);
      setEditando(null);
      showToast('Usuário excluído com sucesso!');
      await carregar();
    } catch (e) {
      setErroLista(e instanceof Error ? e.message : 'Erro ao excluir');
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
    return <PageLoading />;
  }

  return (
    <Box sx={configPageSx}>
      <Box sx={configToolbarSx}>
        <TextField
          size="small"
          placeholder="Buscar usuário"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: FIN_MUTED }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ width: { xs: '100%', md: 260 }, flexShrink: 0, ...finCampoSx }}
        />
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 12, color: FIN_MUTED, display: { xs: 'none', md: 'block' } }}>
          {ativos} ativos · {lista.length} no total
        </Typography>
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon sx={{ fontSize: 16 }} />}
          onClick={() => setEditando('novo')}
          sx={finBtnContainedSx}
        >
          Novo usuário
        </Button>
      </Box>

      {erroLista && !excluirAlvo ? (
        <Alert severity="error" sx={{ flexShrink: 0 }}>
          {erroLista}
        </Alert>
      ) : null}

      <Paper elevation={0} sx={configPaperSx}>
        <TableContainer sx={tableContainerSx}>
          <Table size="small" stickyHeader sx={tableSx}>
            <TableHead>
              <TableRow>
                {['Nome', 'E-mail', 'Perfil', 'WhatsApp', 'Permissões', 'Lojas', 'Status', ''].map((h) => (
                  <TableCell key={h || 'acoes'}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {listaFiltrada.map((u) => (
                <TableRow
                  key={u.id_usuario}
                  hover
                  onClick={() => setEditando(u)}
                  sx={{ cursor: 'pointer', opacity: u.ativo ? 1 : 0.55 }}
                >
                  <TableCell>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: FIN_TEXT }}>{u.nome}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 13, color: FIN_MUTED }}>{u.email}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 13, color: FIN_TEXT }}>{nomePerfilUsuario(u)}</Typography>
                  </TableCell>
                  <TableCell>
                    {u.telefone_whatsapp ? (
                      <Selo
                        texto={u.notifica_whatsapp !== false ? 'Notifica' : 'Silenciado'}
                        tom={u.notifica_whatsapp !== false ? 'ok' : 'alerta'}
                      />
                    ) : (
                      <Typography sx={{ fontSize: 13, color: FIN_MUTED }}>—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 13, color: FIN_MUTED }}>
                      {u.permissoes?.length ? String(u.permissoes.length) : '0'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 13, color: FIN_TEXT, maxWidth: 220 }} noWrap title={lojasLabel(u)}>
                      {lojasLabel(u)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Selo texto={u.ativo ? 'Ativo' : 'Inativo'} tom={u.ativo ? 'ok' : 'neutro'} />
                  </TableCell>
                  <TableCell align="right" sx={{ width: 44, px: 0.5 }}>
                    <IconButton
                      size="small"
                      aria-label="Editar"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setEditando(u);
                      }}
                      sx={{ color: FIN_MUTED, '&:hover': { color: '#1B6EF3', bgcolor: 'rgba(27,110,243,0.08)' } }}
                    >
                      <EditOutlinedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!listaFiltrada.length && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5, color: FIN_MUTED }}>
                    {busca.trim() ? 'Nenhum usuário encontrado.' : 'Nenhum usuário cadastrado.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {editando ? (
        <FormUsuario
          key={editando === 'novo' ? 'novo' : editando.id_usuario}
          usuario={editando === 'novo' ? null : editando}
          cargos={cargos}
          lojas={lojas}
          catalogoPorGrupo={catalogoPorGrupo}
          tiposCatalogo={tiposCatalogo}
          podeEditarChecklistsCargo={podeEditarChecklistsCargo}
          idSessao={sessao?.id_usuario}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            void carregar();
          }}
          onPedirExcluir={(u) => setExcluirAlvo(u)}
          showToast={showToast}
        />
      ) : null}

      <Dialog
        open={!!excluirAlvo}
        onClose={() => !excluindo && setExcluirAlvo(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: FIN_SURFACE,
              color: FIN_TEXT,
              border: `1px solid ${FIN_BORDER}`,
              borderRadius: '12px',
              backgroundImage: 'none',
            },
          },
        }}
      >
        <DialogTitle sx={{ color: FIN_TEXT }}>Excluir usuário</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: FIN_MUTED }}>
            Excluir <Box component="span" sx={{ fontWeight: 600, color: FIN_TEXT }}>{excluirAlvo?.nome}</Box> ({excluirAlvo?.email})?
            Não dá para desfazer.
          </Typography>
          {erroLista && excluirAlvo ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {erroLista}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setExcluirAlvo(null)} disabled={excluindo} sx={{ color: FIN_MUTED }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => void confirmarExclusao()}
            disabled={excluindo}
          >
            {excluindo ? 'Excluindo…' : 'Excluir'}
          </Button>
        </DialogActions>
      </Dialog>

      <ToastSnackbar />
    </Box>
  );
}
