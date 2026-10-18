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
import PeopleOutlineIcon from '@mui/icons-material/PeopleAltOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import {
  api,
  type TiTicket,
  type TiTicketAcesso,
  type TiTicketAnexo,
  type TiTicketComentario,
} from '../../api/client';
import TiTicketAnexos from '../../components/TiTicketAnexos';
import { finCampoSx, FIN_BORDER, FIN_MUTED, FIN_SURFACE, FIN_SURFACE_ALT, FIN_TEXT } from '../../financeiro/temaFinanceiroEscuro';
import { PrefsProvider } from '../../financeiro/prefs';
import { configPageSx } from './configPageSx';
import { formatDataHoraBrasilia, formatDataSomenteData } from '../../utils/dateBr';
import { showToast } from '../../utils/toast';
import { dispararAtualizacaoNotificacoes } from '../../utils/notificacoesEvent';
import Alert from '@mui/material/Alert';
import {
  calcularPrazoSlaTicket,
  categoriaTicket,
  formatarSlaDuracao,
  inputLocalParaPrazoIso,
  prazoParaInputLocal,
  textoAlertaSla,
  textoPrazoRestante,
  TI_TICKET_CATEGORIAS,
} from '../../constants/tiTickets';

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

function prazoInfo(ticket: TiTicket) {
  if (ticket.status === 'feito') {
    const rest = textoPrazoRestante(ticket.prazo, ticket.concluido_em ? new Date(ticket.concluido_em) : new Date());
    const foraDoSla = Boolean(rest?.atrasado);
    return {
      tom: foraDoSla ? '#d97706' : '#16a34a',
      label: ticket.concluido_em
        ? `Concluído ${formatDataHoraBrasilia(ticket.concluido_em)}${foraDoSla ? ' · fora do SLA' : ''}`
        : 'Concluído',
    };
  }
  const rest = textoPrazoRestante(ticket.prazo);
  if (!rest) return null;
  if (rest.atrasado) return { tom: '#dc2626', label: rest.label };
  if (rest.minutos <= 60) return { tom: '#d97706', label: rest.label };
  if (rest.minutos <= 24 * 60) return { tom: '#d97706', label: rest.label };
  return { tom: FIN_MUTED, label: rest.label };
}

function chamadoNovo(ticket: TiTicket) {
  if (ticket.status !== 'chamado') return false;
  const abertoEm = new Date(ticket.created_at).getTime();
  return Number.isFinite(abertoEm) && Date.now() - abertoEm <= 24 * 60 * 60 * 1000;
}

const COLUNAS: { id: TiTicket['status']; label: string; cor: string }[] = [
  { id: 'chamado', label: 'Chamados', cor: '#f59e0b' },
  { id: 'fazer', label: 'Em andamento', cor: '#3b82f6' },
  { id: 'pendente', label: 'Pendentes', cor: '#a855f7' },
  { id: 'feito', label: 'Concluídos', cor: '#22c55e' },
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

function prioridadeLabel(p: string) {
  return ({ baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' } as Record<string, string>)[p] || p;
}

function novoFormTicket() {
  const area = 'tecnologia';
  return {
    titulo: '',
    descricao: '',
    prioridade: 'media',
    area,
    prazo: calcularPrazoSlaTicket(area),
    status: 'chamado' as TiTicket['status'],
  };
}

export default function TicketsTiPage() {
  const [tickets, setTickets] = useState<TiTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroArea, setFiltroArea] = useState('');
  const [filtroColaborador, setFiltroColaborador] = useState('');
  const [selecionado, setSelecionado] = useState<TiTicket | null>(null);
  const [comentarios, setComentarios] = useState<TiTicketComentario[]>([]);
  const [anexos, setAnexos] = useState<TiTicketAnexo[]>([]);
  const [anexosPendentes, setAnexosPendentes] = useState<{ nome: string; mime: string; dataUrl: string }[]>([]);
  const [novoComentario, setNovoComentario] = useState('');
  const [acessos, setAcessos] = useState<TiTicketAcesso[]>([]);
  const [acessoAberto, setAcessoAberto] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioOpcao[]>([]);
  const [novoAcessoId, setNovoAcessoId] = useState('');
  const [criarAberto, setCriarAberto] = useState(false);
  const [form, setForm] = useState(novoFormTicket);
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

  useEffect(() => {
    const timer = window.setInterval(() => {
      api.tiTicketsBoard().then(setTickets).catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const opcoesFiltroColaborador = useMemo(() => {
    const semResponsavel: UsuarioOpcao = {
      id_usuario: -1,
      nome: 'Sem responsável',
      email: 'Tickets sem colaborador atribuído',
    };
    return [semResponsavel, ...usuarios];
  }, [usuarios]);

  const colaboradorFiltroSelecionado = useMemo(() => {
    if (!filtroColaborador) return null;
    if (filtroColaborador === 'sem') return opcoesFiltroColaborador[0] || null;
    return usuarios.find((u) => String(u.id_usuario) === filtroColaborador) || null;
  }, [filtroColaborador, opcoesFiltroColaborador, usuarios]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return tickets.filter((t) => {
      if (filtroArea && t.area !== filtroArea) return false;
      if (filtroColaborador === 'sem') {
        if (t.responsavel_id != null) return false;
      } else if (filtroColaborador) {
        if (Number(t.responsavel_id) !== Number(filtroColaborador)) return false;
      }
      if (!q) return true;
      return (
        t.titulo.toLowerCase().includes(q) ||
        (t.descricao || '').toLowerCase().includes(q) ||
        (t.criado_por_nome || '').toLowerCase().includes(q) ||
        (t.responsavel_nome || '').toLowerCase().includes(q)
      );
    });
  }, [tickets, busca, filtroArea, filtroColaborador]);

  const porStatus = useMemo(() => {
    const map: Record<string, TiTicket[]> = {};
    for (const c of COLUNAS) map[c.id] = [];
    for (const t of filtrados) {
      (map[t.status] || map.chamado).push(t);
    }
    map.chamado.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    map.feito.sort(
      (a, b) =>
        new Date(b.concluido_em || b.updated_at).getTime() -
        new Date(a.concluido_em || a.updated_at).getTime(),
    );
    return map;
  }, [filtrados]);

  async function abrirDetalhe(t: TiTicket) {
    setSelecionado(t);
    setAnexos([]);
    try {
      const full = await api.tiTicket(t.id_ticket);
      setSelecionado(full);
      setComentarios(full.comentarios || []);
      setAnexos(full.anexos || []);
    } catch {
      setComentarios([]);
      setAnexos([]);
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

  async function concluirSelecionado() {
    if (!selecionado || selecionado.status === 'feito') return;
    try {
      const atualizado = await api.tiTicketMover(selecionado.id_ticket, { status: 'feito' });
      setTickets((prev) => prev.map((t) => (t.id_ticket === atualizado.id_ticket ? atualizado : t)));
      setSelecionado(null);
      showToast(
        `Ticket #${atualizado.id_ticket} concluído em ${formatDataHoraBrasilia(atualizado.concluido_em)}`,
        'success',
      );
      dispararAtualizacaoNotificacoes();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao concluir ticket');
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
        prazo: form.prazo,
      });
      if (anexosPendentes.length) {
        try {
          await api.tiTicketAnexar(
          t.id_ticket,
          anexosPendentes.map((p) => ({
            nome_arquivo: p.nome,
            tipo_mime: p.mime,
            data_url: p.dataUrl,
          })),
        );
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Ticket criado, mas falhou ao anexar', 'error');
        }
      }
      setTickets((prev) => [t, ...prev]);
      setCriarAberto(false);
      setForm(novoFormTicket());
      setAnexosPendentes([]);
      showToast(`Ticket #${t.id_ticket} criado`, 'success');
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
            Central de Tickets
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
            label="Categoria"
            value={filtroArea}
            onChange={(e) => setFiltroArea(e.target.value)}
            sx={{ ...finCampoSx, minWidth: 140 }}
          >
            <MenuItem value="">Todas</MenuItem>
            {TI_TICKET_CATEGORIAS.map((categoria) => (
              <MenuItem key={categoria.value} value={categoria.value}>
                {categoria.label}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: { md: 260 } }}>
            <AvatarResp
              nome={colaboradorFiltroSelecionado?.nome}
              inicial={colaboradorFiltroSelecionado?.avatar_inicial}
              url={colaboradorFiltroSelecionado?.avatar_url}
              size={30}
            />
            <Autocomplete
              size="small"
              fullWidth
              options={opcoesFiltroColaborador}
              value={colaboradorFiltroSelecionado}
              onChange={(_, u) => {
                if (!u) setFiltroColaborador('');
                else if (u.id_usuario === -1) setFiltroColaborador('sem');
                else setFiltroColaborador(String(u.id_usuario));
              }}
              getOptionLabel={(u) => u.nome}
              isOptionEqualToValue={(a, b) => a.id_usuario === b.id_usuario}
              noOptionsText="Nenhum colaborador"
              slotProps={{
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
                  label="Colaborador"
                  placeholder="Buscar colaborador…"
                  sx={finCampoSx}
                />
              )}
            />
          </Box>
          <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => setCriarAberto(true)}>
            Novo
          </Button>
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
                      bgcolor: chamadoNovo(t) ? 'rgba(245,158,11,0.08)' : FIN_SURFACE_ALT,
                      border: `1px solid ${chamadoNovo(t) ? 'rgba(245,158,11,0.55)' : FIN_BORDER}`,
                      boxShadow: chamadoNovo(t) ? '0 0 0 1px rgba(245,158,11,0.08)' : 'none',
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
                      <Typography sx={{ fontSize: 11, color: FIN_MUTED, flex: 1 }}>
                        {t.categoria_label || categoriaTicket(t.area).label} · aberto{' '}
                        {formatDataSomenteData(t.created_at)}
                      </Typography>
                      {chamadoNovo(t) ? (
                        <Chip
                          size="small"
                          icon={<NotificationsActiveRoundedIcon />}
                          label="Novo"
                          sx={{
                            height: 20,
                            fontSize: 10,
                            fontWeight: 800,
                            color: '#b45309',
                            bgcolor: 'rgba(245,158,11,0.15)',
                            '& .MuiChip-icon': { color: '#d97706', fontSize: 13 },
                          }}
                        />
                      ) : null}
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
                        const p = prazoInfo(t);
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
          onClose={() => { setSelecionado(null); setAnexos([]); }}
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
                      label="Categoria"
                      value={selecionado.area}
                      onChange={(e) => {
                        const area = e.target.value;
                        setSelecionado({
                          ...selecionado,
                          area,
                          prazo: calcularPrazoSlaTicket(area, selecionado.created_at),
                        });
                        showToast(textoAlertaSla(area), 'info');
                      }}
                      sx={{ ...finCampoSx, flex: 1 }}
                    >
                      {TI_TICKET_CATEGORIAS.map((categoria) => (
                        <MenuItem key={categoria.value} value={categoria.value}>
                          {categoria.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>
                  <Alert severity="info" sx={{ py: 0.5 }}>
                    {textoAlertaSla(selecionado.area)}
                  </Alert>

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
                      label="Responder até"
                      type="datetime-local"
                      value={prazoParaInputLocal(selecionado.prazo)}
                      onChange={(e) =>
                        setSelecionado({
                          ...selecionado,
                          prazo: inputLocalParaPrazoIso(e.target.value),
                        })
                      }
                      slotProps={{ inputLabel: { shrink: true } }}
                      sx={{ ...finCampoSx, minWidth: { sm: 210 } }}
                    />
                  </Stack>

                  <Typography sx={{ fontSize: 12, color: FIN_MUTED }}>
                    Aberto em {formatDataHoraBrasilia(selecionado.created_at)}
                    {selecionado.criado_por_nome ? ` · ${selecionado.criado_por_nome}` : ''}
                  </Typography>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={0.75}
                    sx={{ color: FIN_MUTED, fontSize: 12, alignItems: { sm: 'center' } }}
                  >
                    <Typography sx={{ fontSize: 12, color: 'inherit' }}>
                      SLA: {selecionado.sla_label || formatarSlaDuracao(categoriaTicket(selecionado.area).slaMinutos)}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: prazoInfo(selecionado)?.tom || 'inherit',
                      }}
                    >
                      · {prazoInfo(selecionado)?.label || 'Prazo não definido'}
                    </Typography>
                    {selecionado.concluido_em ? (
                      <Typography sx={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>
                        · Concluído em {formatDataHoraBrasilia(selecionado.concluido_em)}
                      </Typography>
                    ) : null}
                    {selecionado.avaliacao ? (
                      <Typography sx={{ fontSize: 12, color: 'inherit' }}>
                        · Avaliação: {selecionado.avaliacao}/5
                      </Typography>
                    ) : null}
                  </Stack>

                  <TiTicketAnexos
                    idTicket={selecionado.id_ticket}
                    anexos={anexos}
                    onChange={setAnexos}
                  />

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
                {selecionado.status !== 'feito' ? (
                  <Button
                    color="success"
                    variant="outlined"
                    startIcon={<TaskAltRoundedIcon />}
                    onClick={() => void concluirSelecionado()}
                  >
                    Concluir ticket
                  </Button>
                ) : null}
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
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField
                  select
                  label="Categoria"
                  value={form.area}
                  onChange={(e) => {
                    const area = e.target.value;
                    setForm({
                      ...form,
                      area,
                      prazo: calcularPrazoSlaTicket(area),
                    });
                    showToast(textoAlertaSla(area), 'info');
                  }}
                  sx={{ ...finCampoSx, flex: 1 }}
                >
                  {TI_TICKET_CATEGORIAS.map((categoria) => (
                    <MenuItem key={categoria.value} value={categoria.value}>
                      {categoria.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Responder até"
                  type="datetime-local"
                  value={prazoParaInputLocal(form.prazo)}
                  onChange={(e) =>
                    setForm({ ...form, prazo: inputLocalParaPrazoIso(e.target.value) || '' })
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ ...finCampoSx, flex: 1 }}
                />
              </Stack>
              <Alert severity="info" sx={{ py: 0.5 }}>
                {textoAlertaSla(form.area)}
              </Alert>
              <TiTicketAnexos
                anexos={[]}
                onChange={() => undefined}
                pendentesMeta={anexosPendentes}
                onPendentesChange={setAnexosPendentes}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setCriarAberto(false);
                setAnexosPendentes([]);
              }}
            >
              Cancelar
            </Button>
            <Button variant="contained" onClick={() => void criarTicket()}>
              Criar
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
