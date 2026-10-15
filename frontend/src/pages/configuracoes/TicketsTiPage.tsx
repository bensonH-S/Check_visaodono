import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Autocomplete from '@mui/material/Autocomplete';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import NoteAltOutlinedIcon from '@mui/icons-material/NoteAltOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleAltOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import {
  api,
  type TiTicket,
  type TiNota,
  type TiTicketAcesso,
  type TiTicketComentario,
} from '../../api/client';
import { finCampoSx, FIN_BORDER, FIN_MUTED, FIN_SURFACE, FIN_SURFACE_ALT, FIN_TEXT } from '../../financeiro/temaFinanceiroEscuro';
import { PrefsProvider } from '../../financeiro/prefs';
import { configPageSx } from './configPageSx';
import { formatDataHoraBrasilia, formatDataSomenteData } from '../../utils/dateBr';
import { showToast } from '../../utils/toast';
import { dispararAtualizacaoNotificacoes } from '../../utils/notificacoesEvent';

type UsuarioOpcao = {
  id_usuario: number;
  nome: string;
  email: string;
  avatar_inicial?: string | null;
  avatar_url?: string | null;
};

function AvatarResp({
  nome,
  inicial,
  url,
  size = 28,
}: {
  nome?: string | null;
  inicial?: string | null;
  url?: string | null;
  size?: number;
}) {
  const label =
    (inicial || '')
      .trim()
      .slice(0, 2)
      .toUpperCase() ||
    (nome || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() ||
    '?';
  return (
    <Avatar
      src={url || undefined}
      sx={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        fontWeight: 700,
        bgcolor: url ? undefined : '#1B6EF3',
        color: '#fff',
        border: '2px solid #fff',
        boxShadow: '0 1px 4px rgba(15,23,42,0.12)',
      }}
    >
      {label}
    </Avatar>
  );
}

function prazoInfo(prazo: string | null | undefined) {
  if (!prazo) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(`${prazo}T12:00:00`);
  const diff = Math.round((d.getTime() - hoje.getTime()) / 86400000);
  if (diff < 0) return { tom: '#dc2626', label: `Atrasado · ${formatDataSomenteData(prazo)}` };
  if (diff === 0) return { tom: '#d97706', label: 'Prazo hoje' };
  if (diff <= 2) return { tom: '#d97706', label: formatDataSomenteData(prazo) };
  return { tom: FIN_MUTED, label: formatDataSomenteData(prazo) };
}

const COLUNAS: { id: TiTicket['status']; label: string; cor: string }[] = [
  { id: 'chamado', label: 'Chamados', cor: '#f59e0b' },
  { id: 'fazer', label: 'Pra fazer', cor: '#3b82f6' },
  { id: 'pendente', label: 'Pendentes', cor: '#a855f7' },
  { id: 'feito', label: 'Feitos', cor: '#22c55e' },
];

/** finCampoSx trava altura — multiline precisa soltar height/overflow. */
const campoMultilineSx = {
  ...finCampoSx,
  '& .MuiOutlinedInput-root': {
    ...finCampoSx['& .MuiOutlinedInput-root'],
    height: 'auto',
    minHeight: 80,
    overflow: 'visible',
    alignItems: 'flex-start',
  },
  '& .MuiInputBase-input': {
    ...finCampoSx['& .MuiInputBase-input'],
    height: 'auto',
    py: 1.25,
    alignItems: 'flex-start',
  },
} as const;

const PRIORIDADE_COR: Record<string, string> = {
  baixa: '#94a3b8',
  media: '#38bdf8',
  alta: '#f59e0b',
  urgente: '#ef4444',
};

const AREAS = [
  'geral',
  'tecnologia',
  'financeiro',
  'operacoes',
  'manutencao',
  'rh',
];

function prioridadeLabel(p: string) {
  return ({ baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' } as Record<string, string>)[p] || p;
}

export default function TicketsTiPage() {
  const [tickets, setTickets] = useState<TiTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroArea, setFiltroArea] = useState('');
  const [selecionado, setSelecionado] = useState<TiTicket | null>(null);
  const [comentarios, setComentarios] = useState<TiTicketComentario[]>([]);
  const [novoComentario, setNovoComentario] = useState('');
  const [notas, setNotas] = useState<TiNota[]>([]);
  const [notaAtivaId, setNotaAtivaId] = useState<number | null>(null);
  const [notaAberta, setNotaAberta] = useState(false);
  const [notaTituloDraft, setNotaTituloDraft] = useState('');
  const [notaDraft, setNotaDraft] = useState('');
  const [salvandoNota, setSalvandoNota] = useState(false);
  const [acessos, setAcessos] = useState<TiTicketAcesso[]>([]);
  const [acessoAberto, setAcessoAberto] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioOpcao[]>([]);
  const [novoAcessoId, setNovoAcessoId] = useState('');
  const [criarAberto, setCriarAberto] = useState(false);
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    prioridade: 'media',
    area: 'tecnologia',
    status: 'chamado' as TiTicket['status'],
  });
  const [dragId, setDragId] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const lista = await api.tiTicketsBoard();
      setTickets(lista);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    api
      .tiUsuariosAcesso()
      .then(setUsuarios)
      .catch(() => setUsuarios([]));
  }, [carregar]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return tickets.filter((t) => {
      if (filtroArea && t.area !== filtroArea) return false;
      if (!q) return true;
      return (
        t.titulo.toLowerCase().includes(q) ||
        (t.descricao || '').toLowerCase().includes(q) ||
        (t.criado_por_nome || '').toLowerCase().includes(q) ||
        (t.responsavel_nome || '').toLowerCase().includes(q)
      );
    });
  }, [tickets, busca, filtroArea]);

  const porStatus = useMemo(() => {
    const map: Record<string, TiTicket[]> = {};
    for (const c of COLUNAS) map[c.id] = [];
    for (const t of filtrados) {
      (map[t.status] || map.chamado).push(t);
    }
    return map;
  }, [filtrados]);

  async function abrirDetalhe(t: TiTicket) {
    setSelecionado(t);
    try {
      const full = await api.tiTicket(t.id_ticket);
      setSelecionado(full);
      setComentarios(full.comentarios || []);
    } catch {
      setComentarios([]);
    }
  }

  async function mover(id: number, status: TiTicket['status']) {
    try {
      const atualizado = await api.tiTicketMover(id, { status });
      setTickets((prev) => prev.map((t) => (t.id_ticket === id ? atualizado : t)));
      if (selecionado?.id_ticket === id) setSelecionado(atualizado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao mover');
    }
  }

  async function salvarDetalhe() {
    if (!selecionado) return;
    const respAntes = selecionado.responsavel_id;
    try {
      const atualizado = await api.tiTicketAtualizar(selecionado.id_ticket, {
        titulo: selecionado.titulo,
        descricao: selecionado.descricao,
        prioridade: selecionado.prioridade,
        area: selecionado.area,
        status: selecionado.status,
        responsavel_id: selecionado.responsavel_id,
        prazo: selecionado.prazo,
      });
      setTickets((prev) => prev.map((t) => (t.id_ticket === atualizado.id_ticket ? atualizado : t)));
      const mudouResp =
        atualizado.responsavel_id != null &&
        Number(atualizado.responsavel_id) !== Number(respAntes || 0);
      if (mudouResp || (atualizado as TiTicket & { atribuicao_notificada?: boolean }).atribuicao_notificada) {
        showToast(
          `Salvo · notificação enviada para ${atualizado.responsavel_nome || 'o responsável'}`,
          'success',
        );
      } else {
        showToast('Ticket salvo', 'success');
      }
      dispararAtualizacaoNotificacoes();
      setSelecionado(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    }
  }

  async function apagarComentario(id: number) {
    try {
      await api.tiTicketComentarioExcluir(id);
      setComentarios((prev) => prev.filter((c) => c.id_comentario !== id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao apagar comentário');
    }
  }

  async function excluirSelecionado() {
    if (!selecionado) return;
    if (!window.confirm('Excluir este ticket?')) return;
    try {
      await api.tiTicketExcluir(selecionado.id_ticket);
      setTickets((prev) => prev.filter((t) => t.id_ticket !== selecionado.id_ticket));
      setSelecionado(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir');
    }
  }

  async function enviarComentario() {
    if (!selecionado || !novoComentario.trim()) return;
    try {
      const c = await api.tiTicketComentar(selecionado.id_ticket, novoComentario.trim());
      setComentarios((prev) => [...prev, c]);
      setNovoComentario('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao comentar');
    }
  }

  function selecionarNota(n: TiNota) {
    setNotaAtivaId(n.id_nota);
    setNotaTituloDraft(n.titulo || '');
    setNotaDraft(n.corpo || '');
  }

  async function abrirNotas() {
    try {
      const lista = await api.tiNotas();
      setNotas(lista);
      const ativa = lista[0] || null;
      if (ativa) selecionarNota(ativa);
      else {
        setNotaAtivaId(null);
        setNotaTituloDraft('');
        setNotaDraft('');
      }
      setNotaAberta(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao abrir anotações');
    }
  }

  async function salvarNotas() {
    if (!notaAtivaId) return;
    setSalvandoNota(true);
    try {
      const n = await api.tiNotaSalvar(notaAtivaId, {
        titulo: notaTituloDraft.trim() || 'Sem título',
        corpo: notaDraft,
      });
      setNotas((prev) => prev.map((x) => (x.id_nota === n.id_nota ? n : x)));
      selecionarNota(n);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar anotações');
    } finally {
      setSalvandoNota(false);
    }
  }

  async function novaListaNotas() {
    try {
      const n = await api.tiNotaCriar({ titulo: `Lista ${notas.length + 1}` });
      setNotas((prev) => [...prev, n]);
      selecionarNota(n);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar lista');
    }
  }

  async function excluirListaNotas(id: number) {
    if (!window.confirm('Excluir esta lista de anotações?')) return;
    try {
      await api.tiNotaExcluir(id);
      const resto = notas.filter((n) => n.id_nota !== id);
      setNotas(resto);
      if (notaAtivaId === id) {
        if (resto[0]) selecionarNota(resto[0]);
        else {
          setNotaAtivaId(null);
          setNotaTituloDraft('');
          setNotaDraft('');
        }
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir lista');
    }
  }

  async function abrirAcessos() {
    try {
      const [a, u] = await Promise.all([api.tiAcessos(), api.tiUsuariosAcesso()]);
      setAcessos(a);
      setUsuarios(u);
      setAcessoAberto(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar acessos');
    }
  }

  async function concederAcesso() {
    const id = Number(novoAcessoId);
    if (!id) return;
    try {
      setAcessos(await api.tiAcessoConceder(id));
      setNovoAcessoId('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao conceder acesso');
    }
  }

  async function revogarAcesso(id: number) {
    try {
      setAcessos(await api.tiAcessoRevogar(id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao revogar');
    }
  }

  async function criarTicket() {
    if (!form.titulo.trim()) return;
    try {
      const t = await api.tiTicketCriar({
        titulo: form.titulo.trim(),
        descricao: form.descricao,
        prioridade: form.prioridade as TiTicket['prioridade'],
        area: form.area,
        status: form.status,
        origem: 'interno',
      });
      setTickets((prev) => [...prev, t]);
      setCriarAberto(false);
      setForm({ titulo: '', descricao: '', prioridade: 'media', area: 'tecnologia', status: 'chamado' });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar');
    }
  }

  function onDropColuna(status: TiTicket['status']) {
    if (dragId == null) return;
    void mover(dragId, status);
    setDragId(null);
  }

  return (
    <PrefsProvider>
      <Box sx={{ ...configPageSx, gap: 1.25 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          sx={{ alignItems: { md: 'center' }, flexShrink: 0 }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: 18, flex: 1 }}>
            Tickets TI
          </Typography>
          <TextField
            size="small"
            placeholder="Buscar…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            sx={{ ...finCampoSx, minWidth: { md: 220 } }}
          />
          <TextField
            select
            size="small"
            label="Área"
            value={filtroArea}
            onChange={(e) => setFiltroArea(e.target.value)}
            sx={{ ...finCampoSx, minWidth: 140 }}
          >
            <MenuItem value="">Todas</MenuItem>
            {AREAS.map((a) => (
              <MenuItem key={a} value={a}>
                {a}
              </MenuItem>
            ))}
          </TextField>
          <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => setCriarAberto(true)}>
            Novo
          </Button>
          <Tooltip title="Anotações de reunião">
            <IconButton onClick={() => void abrirNotas()} size="small" sx={{ color: FIN_TEXT }}>
              <NoteAltOutlinedIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Quem acessa o board">
            <IconButton onClick={() => void abrirAcessos()} size="small" sx={{ color: FIN_TEXT }}>
              <PeopleOutlineIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {erro ? (
          <Typography sx={{ color: '#f87171', fontSize: 13 }}>{erro}</Typography>
        ) : null}

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            gap: 1.25,
            overflowX: 'auto',
            overflowY: 'hidden',
            pb: 0.5,
          }}
        >
          {COLUNAS.map((col) => (
            <Box
              key={col.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDropColuna(col.id)}
              sx={{
                flex: '1 1 0',
                minWidth: { xs: 240, md: 0 },
                maxWidth: { xs: 320, md: 'none' },
                flexShrink: { xs: 0, md: 1 },
                display: 'flex',
                flexDirection: 'column',
                bgcolor: FIN_SURFACE,
                border: `1px solid ${FIN_BORDER}`,
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  px: 1.25,
                  py: 1,
                  alignItems: 'center',
                  borderBottom: `1px solid ${FIN_BORDER}`,
                  borderTop: `3px solid ${col.cor}`,
                }}
              >
                <Typography sx={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{col.label}</Typography>
                <Chip
                  size="small"
                  label={porStatus[col.id]?.length || 0}
                  sx={{ height: 22, fontSize: 11, bgcolor: FIN_SURFACE_ALT }}
                />
              </Stack>
              <Box sx={{ flex: 1, overflowY: 'auto', p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {loading && !porStatus[col.id]?.length ? (
                  <Typography sx={{ color: FIN_MUTED, fontSize: 12, p: 1 }}>Carregando…</Typography>
                ) : null}
                {(porStatus[col.id] || []).map((t) => (
                  <Box
                    key={t.id_ticket}
                    draggable
                    onDragStart={() => setDragId(t.id_ticket)}
                    onClick={() => void abrirDetalhe(t)}
                    sx={{
                      p: 1.1,
                      borderRadius: 1.5,
                      bgcolor: FIN_SURFACE_ALT,
                      border: `1px solid ${FIN_BORDER}`,
                      cursor: 'grab',
                      '&:hover': { borderColor: col.cor },
                    }}
                  >
                    <Stack direction="row" spacing={0.75} sx={{ mb: 0.5, alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: PRIORIDADE_COR[t.prioridade] || FIN_MUTED,
                          flexShrink: 0,
                        }}
                      />
                      <Typography sx={{ fontSize: 11, color: FIN_MUTED, flex: 1 }}>{t.area}</Typography>
                      {t.origem === 'mesa' ? (
                        <Chip size="small" label="Mesa" sx={{ height: 18, fontSize: 10 }} />
                      ) : null}
                    </Stack>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, mb: 1 }}>
                      {t.titulo}
                    </Typography>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minHeight: 28 }}>
                      {t.responsavel_id ? (
                        <>
                          <AvatarResp
                            nome={t.responsavel_nome}
                            inicial={t.responsavel_avatar_inicial}
                            url={t.responsavel_avatar_url}
                            size={26}
                          />
                          <Typography
                            sx={{
                              fontSize: 11,
                              color: FIN_TEXT,
                              fontWeight: 600,
                              flex: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {t.responsavel_nome}
                          </Typography>
                        </>
                      ) : (
                        <Typography sx={{ fontSize: 11, color: FIN_MUTED, flex: 1 }}>Sem responsável</Typography>
                      )}
                      {(() => {
                        const p = prazoInfo(t.prazo);
                        if (!p) return null;
                        return (
                          <Stack direction="row" spacing={0.35} sx={{ alignItems: 'center', color: p.tom }}>
                            <EventOutlinedIcon sx={{ fontSize: 13 }} />
                            <Typography sx={{ fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {p.label}
                            </Typography>
                          </Stack>
                        );
                      })()}
                    </Stack>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>

        {/* Detalhe */}
        <Dialog
          open={Boolean(selecionado)}
          onClose={() => setSelecionado(null)}
          maxWidth="md"
          fullWidth
          slotProps={{ paper: { sx: { bgcolor: FIN_SURFACE, color: FIN_TEXT } } }}
        >
          {selecionado ? (
            <>
              <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
                <Typography sx={{ flex: 1, fontWeight: 700 }}>Ticket #{selecionado.id_ticket}</Typography>
                <IconButton size="small" onClick={() => void excluirSelecionado()} sx={{ color: '#f87171' }}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => setSelecionado(null)}>
                  <CloseIcon />
                </IconButton>
              </DialogTitle>
              <DialogContent dividers>
                <Stack spacing={1.5}>
                  <TextField
                    label="Título"
                    fullWidth
                    value={selecionado.titulo}
                    onChange={(e) => setSelecionado({ ...selecionado, titulo: e.target.value })}
                    sx={finCampoSx}
                  />
                  <TextField
                    label="Descrição"
                    fullWidth
                    multiline
                    minRows={3}
                    value={selecionado.descricao || ''}
                    onChange={(e) => setSelecionado({ ...selecionado, descricao: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={campoMultilineSx}
                  />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField
                      select
                      label="Status"
                      value={selecionado.status}
                      onChange={(e) =>
                        setSelecionado({ ...selecionado, status: e.target.value as TiTicket['status'] })
                      }
                      sx={{ ...finCampoSx, flex: 1 }}
                    >
                      {COLUNAS.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label="Prioridade"
                      value={selecionado.prioridade}
                      onChange={(e) =>
                        setSelecionado({
                          ...selecionado,
                          prioridade: e.target.value as TiTicket['prioridade'],
                        })
                      }
                      sx={{ ...finCampoSx, flex: 1 }}
                    >
                      {(['baixa', 'media', 'alta', 'urgente'] as const).map((p) => (
                        <MenuItem key={p} value={p}>
                          {prioridadeLabel(p)}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label="Área"
                      value={selecionado.area}
                      onChange={(e) => setSelecionado({ ...selecionado, area: e.target.value })}
                      sx={{ ...finCampoSx, flex: 1 }}
                    >
                      {AREAS.map((a) => (
                        <MenuItem key={a} value={a}>
                          {a}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>

                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.25}
                    sx={{
                      p: 1.25,
                      borderRadius: 2,
                      bgcolor: FIN_SURFACE_ALT,
                      border: `1px solid ${FIN_BORDER}`,
                      alignItems: { sm: 'center' },
                    }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flex: 1, minWidth: 0 }}>
                      <AvatarResp
                        nome={selecionado.responsavel_nome}
                        inicial={selecionado.responsavel_avatar_inicial}
                        url={selecionado.responsavel_avatar_url}
                        size={36}
                      />
                      <Autocomplete
                        fullWidth
                        options={usuarios}
                        value={usuarios.find((u) => u.id_usuario === selecionado.responsavel_id) || null}
                        onChange={(_, u) => {
                          setSelecionado({
                            ...selecionado,
                            responsavel_id: u?.id_usuario ?? null,
                            responsavel_nome: u?.nome || null,
                            responsavel_avatar_inicial: u?.avatar_inicial || null,
                            responsavel_avatar_url: u?.avatar_url || null,
                          });
                        }}
                        getOptionLabel={(u) => u.nome}
                        isOptionEqualToValue={(a, b) => a.id_usuario === b.id_usuario}
                        noOptionsText="Nenhum usuário"
                        slotProps={{
                          popper: { sx: { zIndex: 1400 } },
                          listbox: { sx: { maxHeight: 280 } },
                        }}
                        renderOption={(props, u) => {
                          const { key, ...rest } = props;
                          return (
                            <Box
                              component="li"
                              key={key ?? u.id_usuario}
                              {...rest}
                              sx={{ display: 'flex !important', alignItems: 'center', gap: 1, py: 0.75 }}
                            >
                              <AvatarResp
                                nome={u.nome}
                                inicial={u.avatar_inicial}
                                url={u.avatar_url}
                                size={28}
                              />
                              <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
                                  {u.nome}
                                </Typography>
                                <Typography sx={{ fontSize: 11, color: FIN_MUTED, lineHeight: 1.2 }}>
                                  {u.email}
                                </Typography>
                              </Box>
                            </Box>
                          );
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Responsável"
                            placeholder="Buscar colaborador…"
                            sx={finCampoSx}
                          />
                        )}
                      />
                    </Stack>
                    <TextField
                      label="Prazo"
                      type="date"
                      value={selecionado.prazo || ''}
                      onChange={(e) =>
                        setSelecionado({ ...selecionado, prazo: e.target.value || null })
                      }
                      slotProps={{ inputLabel: { shrink: true } }}
                      sx={{ ...finCampoSx, minWidth: { sm: 170 } }}
                    />
                  </Stack>

                  <Typography sx={{ fontSize: 12, color: FIN_MUTED }}>
                    Aberto em {formatDataHoraBrasilia(selecionado.created_at)}
                    {selecionado.criado_por_nome ? ` · ${selecionado.criado_por_nome}` : ''}
                    {selecionado.avaliacao
                      ? ` · Avaliação: ${selecionado.avaliacao}/5`
                      : ''}
                  </Typography>

                  <Typography sx={{ fontWeight: 700, fontSize: 14, pt: 1 }}>Comentários</Typography>
                  <Box sx={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {comentarios.length === 0 ? (
                      <Typography sx={{ fontSize: 12, color: FIN_MUTED }}>Nenhum comentário.</Typography>
                    ) : (
                      comentarios.map((c) => (
                        <Box
                          key={c.id_comentario}
                          sx={{
                            p: 1,
                            borderRadius: 1,
                            bgcolor: FIN_SURFACE_ALT,
                            border: `1px solid ${FIN_BORDER}`,
                            display: 'flex',
                            gap: 1,
                            alignItems: 'flex-start',
                          }}
                        >
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: 11, color: FIN_MUTED }}>
                              {c.usuario_nome || '—'} · {formatDataHoraBrasilia(c.created_at)}
                            </Typography>
                            <Typography sx={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{c.texto}</Typography>
                          </Box>
                          <Tooltip title="Apagar comentário">
                            <IconButton
                              size="small"
                              onClick={() => void apagarComentario(c.id_comentario)}
                              sx={{ color: '#f87171', mt: -0.25 }}
                            >
                              <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      ))
                    )}
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Escrever comentário…"
                      value={novoComentario}
                      onChange={(e) => setNovoComentario(e.target.value)}
                      sx={finCampoSx}
                    />
                    <Button variant="outlined" onClick={() => void enviarComentario()}>
                      Enviar
                    </Button>
                  </Stack>
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setSelecionado(null)}>Fechar</Button>
                <Button variant="contained" onClick={() => void salvarDetalhe()}>
                  Salvar
                </Button>
              </DialogActions>
            </>
          ) : null}
        </Dialog>

        {/* Criar */}
        <Dialog
          open={criarAberto}
          onClose={() => setCriarAberto(false)}
          maxWidth="sm"
          fullWidth
          slotProps={{ paper: { sx: { bgcolor: FIN_SURFACE, color: FIN_TEXT } } }}
        >
          <DialogTitle>Novo ticket</DialogTitle>
          <DialogContent>
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <TextField
                label="Título"
                fullWidth
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                sx={finCampoSx}
              />
              <TextField
                label="Descrição"
                fullWidth
                multiline
                minRows={3}
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={campoMultilineSx}
              />
              <Stack direction="row" spacing={1}>
                <TextField
                  select
                  label="Coluna"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as TiTicket['status'] })}
                  sx={{ ...finCampoSx, flex: 1 }}
                >
                  {COLUNAS.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Prioridade"
                  value={form.prioridade}
                  onChange={(e) => setForm({ ...form, prioridade: e.target.value })}
                  sx={{ ...finCampoSx, flex: 1 }}
                >
                  {(['baixa', 'media', 'alta', 'urgente'] as const).map((p) => (
                    <MenuItem key={p} value={p}>
                      {prioridadeLabel(p)}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCriarAberto(false)}>Cancelar</Button>
            <Button variant="contained" onClick={() => void criarTicket()}>
              Criar
            </Button>
          </DialogActions>
        </Dialog>

        {/* Notas — várias listas */}
        <Dialog
          open={notaAberta}
          onClose={() => setNotaAberta(false)}
          maxWidth="lg"
          fullWidth
          slotProps={{
            paper: {
              sx: {
                bgcolor: FIN_SURFACE,
                color: FIN_TEXT,
                minHeight: '72vh',
                maxHeight: '88vh',
                display: 'flex',
                flexDirection: 'column',
              },
            },
          }}
        >
          <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>Anotações</DialogTitle>
          <DialogContent
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              gap: 1.5,
              pt: '8px !important',
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                width: { xs: '100%', md: 240 },
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                borderRight: { md: `1px solid ${FIN_BORDER}` },
                pr: { md: 1.25 },
                minHeight: 0,
              }}
            >
              <Button
                startIcon={<AddIcon />}
                variant="outlined"
                size="small"
                onClick={() => void novaListaNotas()}
                fullWidth
              >
                Nova lista
              </Button>
              <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {notas.map((n) => {
                  const ativa = n.id_nota === notaAtivaId;
                  return (
                    <Box
                      key={n.id_nota}
                      onClick={() => selecionarNota(n)}
                      sx={{
                        p: 1.1,
                        borderRadius: 1.5,
                        cursor: 'pointer',
                        border: `1px solid ${ativa ? '#1B6EF3' : FIN_BORDER}`,
                        bgcolor: ativa ? 'rgba(27,110,243,0.08)' : FIN_SURFACE_ALT,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontSize: 13,
                            fontWeight: 700,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {n.titulo || 'Sem título'}
                        </Typography>
                        <Typography sx={{ fontSize: 10.5, color: FIN_MUTED }}>
                          {formatDataHoraBrasilia(n.updated_at)}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          void excluirListaNotas(n.id_nota);
                        }}
                        sx={{ color: '#f87171' }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1.25,
              }}
            >
              {notaAtivaId ? (
                <>
                  <TextField
                    label="Título da lista"
                    fullWidth
                    value={notaTituloDraft}
                    onChange={(e) => setNotaTituloDraft(e.target.value)}
                    sx={{ ...finCampoSx, maxWidth: 720 }}
                  />
                  <TextField
                    fullWidth
                    multiline
                    minRows={14}
                    value={notaDraft}
                    onChange={(e) => setNotaDraft(e.target.value)}
                    placeholder="Anote aqui durante a reunião…"
                    sx={{
                      ...campoMultilineSx,
                      maxWidth: 720,
                      flex: 1,
                      '& .MuiOutlinedInput-root': {
                        ...campoMultilineSx['& .MuiOutlinedInput-root'],
                        minHeight: 320,
                        height: '100%',
                      },
                    }}
                  />
                  {(() => {
                    const n = notas.find((x) => x.id_nota === notaAtivaId);
                    if (!n?.updated_at) return null;
                    return (
                      <Typography sx={{ fontSize: 11, color: FIN_MUTED, textAlign: 'center' }}>
                        Última atualização: {formatDataHoraBrasilia(n.updated_at)}
                        {n.atualizado_por_nome ? ` · ${n.atualizado_por_nome}` : ''}
                      </Typography>
                    );
                  })()}
                </>
              ) : (
                <Typography sx={{ color: FIN_MUTED, mt: 6, textAlign: 'center' }}>
                  Crie uma lista para começar a anotar.
                </Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'center', gap: 1 }}>
            <Button onClick={() => setNotaAberta(false)}>Fechar</Button>
            <Button
              variant="contained"
              disabled={salvandoNota || !notaAtivaId}
              onClick={() => void salvarNotas()}
            >
              {salvandoNota ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Acessos */}
        <Dialog
          open={acessoAberto}
          onClose={() => setAcessoAberto(false)}
          maxWidth="sm"
          fullWidth
          slotProps={{ paper: { sx: { bgcolor: FIN_SURFACE, color: FIN_TEXT } } }}
        >
          <DialogTitle>Acesso ao board de tickets</DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: 13, color: FIN_MUTED, mb: 1.5 }}>
              Além de quem já tem a permissão TI, você pode liberar outros usuários para tratar chamados.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <TextField
                select
                size="small"
                fullWidth
                label="Usuário"
                value={novoAcessoId}
                onChange={(e) => setNovoAcessoId(e.target.value)}
                sx={finCampoSx}
              >
                {usuarios
                  .filter((u) => !acessos.some((a) => a.id_usuario === u.id_usuario))
                  .map((u) => (
                    <MenuItem key={u.id_usuario} value={String(u.id_usuario)}>
                      {u.nome} ({u.email})
                    </MenuItem>
                  ))}
              </TextField>
              <Button variant="contained" onClick={() => void concederAcesso()}>
                Liberar
              </Button>
            </Stack>
            <Stack spacing={1}>
              {acessos.length === 0 ? (
                <Typography sx={{ fontSize: 13, color: FIN_MUTED }}>Nenhum acesso extra.</Typography>
              ) : (
                acessos.map((a) => (
                  <Stack
                    key={a.id_usuario}
                    direction="row"
                    sx={{
                      alignItems: 'center',
                      p: 1,
                      borderRadius: 1,
                      border: `1px solid ${FIN_BORDER}`,
                      bgcolor: FIN_SURFACE_ALT,
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{a.nome}</Typography>
                      <Typography sx={{ fontSize: 11, color: FIN_MUTED }}>{a.email}</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => void revogarAcesso(a.id_usuario)} sx={{ color: '#f87171' }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAcessoAberto(false)}>Fechar</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </PrefsProvider>
  );
}
