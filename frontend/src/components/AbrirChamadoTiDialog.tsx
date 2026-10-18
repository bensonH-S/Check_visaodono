import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Rating from '@mui/material/Rating';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import Tooltip from '@mui/material/Tooltip';
import { api, type TiTicket } from '../api/client';
import { getUsuario, podeAbrirTicketTi } from '../lib/auth';
import { formatDataHoraBrasilia, formatDataSomenteData } from '../utils/dateBr';
import {
  calcularPrazoSlaTicket,
  categoriaTicket,
  TI_TICKET_CATEGORIAS,
} from '../constants/tiTickets';

type Props = {
  /** Só o botão do header; o dialog fica interno. */
  variante?: 'portal' | 'icone';
};

export default function AbrirChamadoTiDialog({ variante = 'portal' }: Props) {
  const user = getUsuario();
  const pode = podeAbrirTicketTi(user);
  const [aberto, setAberto] = useState(false);
  const [tab, setTab] = useState(0);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [area, setArea] = useState('geral');
  const [prioridade, setPrioridade] = useState('media');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [meus, setMeus] = useState<TiTicket[]>([]);
  const [avaliarId, setAvaliarId] = useState<number | null>(null);
  const [nota, setNota] = useState<number | null>(5);
  const [comentarioAval, setComentarioAval] = useState('');
  const categoriaAtual = categoriaTicket(area);
  const prazoPrevisto = calcularPrazoSlaTicket(area);

  const carregarMeus = useCallback(async () => {
    try {
      setMeus(await api.tiMeusTickets());
    } catch {
      setMeus([]);
    }
  }, []);

  useEffect(() => {
    if (aberto && tab === 1) void carregarMeus();
  }, [aberto, tab, carregarMeus]);

  if (!pode) return null;

  async function enviar() {
    if (!titulo.trim()) {
      setErro('Informe um título');
      return;
    }
    setEnviando(true);
    setErro('');
    setOk('');
    try {
      await api.tiTicketCriar({
        titulo: titulo.trim(),
        descricao,
        area,
        prioridade: prioridade as TiTicket['prioridade'],
      });
      setOk(`Ticket aberto com prazo previsto para ${formatDataSomenteData(prazoPrevisto)}.`);
      setTitulo('');
      setDescricao('');
      setArea('geral');
      setPrioridade('media');
      setTab(1);
      await carregarMeus();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao abrir chamado');
    } finally {
      setEnviando(false);
    }
  }

  async function enviarAvaliacao() {
    if (!avaliarId || !nota) return;
    try {
      await api.tiTicketAvaliar(avaliarId, { avaliacao: nota, comentario: comentarioAval });
      setAvaliarId(null);
      setComentarioAval('');
      setNota(5);
      await carregarMeus();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao avaliar');
    }
  }

  const statusLabel: Record<string, string> = {
    chamado: 'Na fila',
    fazer: 'Em andamento',
    pendente: 'Pendente',
    feito: 'Concluído',
  };

  return (
    <>
      <Tooltip title="Abrir ticket">
        <IconButton
          size="small"
          aria-label="Abrir ticket"
          onClick={() => {
            setAberto(true);
            setErro('');
            setOk('');
          }}
          sx={{
            color: 'text.secondary',
            ...(variante === 'portal'
              ? {
                  '&:hover': { color: 'primary.main', bgcolor: 'action.hover' },
                }
              : {}),
          }}
        >
          <SupportAgentIcon sx={{ fontSize: variante === 'portal' ? 20 : 18 }} />
        </IconButton>
      </Tooltip>

      <Dialog open={aberto} onClose={() => setAberto(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Abrir ticket</DialogTitle>
        <DialogContent>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1.5 }}>
            <Tab label="Abrir" />
            <Tab label="Meus chamados" />
          </Tabs>

          {tab === 0 ? (
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                Descreva a demanda e escolha a categoria. O prazo é calculado automaticamente pelo SLA.
              </Typography>
              <TextField
                label="Título"
                fullWidth
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                autoFocus
              />
              <TextField
                label="Descrição"
                fullWidth
                multiline
                minRows={4}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
              <Stack direction="row" spacing={1}>
                <TextField
                  select
                  label="Categoria"
                  fullWidth
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                >
                  {TI_TICKET_CATEGORIAS.map((a) => (
                    <MenuItem key={a.value} value={a.value}>
                      {a.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Prioridade"
                  fullWidth
                  value={prioridade}
                  onChange={(e) => setPrioridade(e.target.value)}
                >
                  <MenuItem value="baixa">Baixa</MenuItem>
                  <MenuItem value="media">Média</MenuItem>
                  <MenuItem value="alta">Alta</MenuItem>
                  <MenuItem value="urgente">Urgente</MenuItem>
                </TextField>
              </Stack>
              <Box
                sx={{
                  px: 1.5,
                  py: 1.25,
                  borderRadius: 1.5,
                  bgcolor: 'action.hover',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                  SLA · {categoriaAtual.slaDiasUteis}{' '}
                  {categoriaAtual.slaDiasUteis === 1 ? 'dia útil' : 'dias úteis'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Prazo previsto para conclusão: {formatDataSomenteData(prazoPrevisto)}
                </Typography>
              </Box>
            </Stack>
          ) : (
            <Stack spacing={1}>
              {meus.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Você ainda não abriu chamados.
                </Typography>
              ) : (
                meus.map((t) => (
                  <Box
                    key={t.id_ticket}
                    sx={{
                      p: 1.25,
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{t.titulo}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      #{t.id_ticket} · {statusLabel[t.status] || t.status} ·{' '}
                      {formatDataHoraBrasilia(t.created_at)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {t.categoria_label || categoriaTicket(t.area).label}
                      {t.prazo ? ` · Prazo ${formatDataSomenteData(t.prazo)}` : ''}
                      {t.concluido_em ? ` · Concluído em ${formatDataHoraBrasilia(t.concluido_em)}` : ''}
                    </Typography>
                    {t.status === 'feito' && !t.avaliacao ? (
                      <Button
                        size="small"
                        sx={{ mt: 0.75 }}
                        onClick={() => {
                          setAvaliarId(t.id_ticket);
                          setNota(5);
                          setComentarioAval('');
                        }}
                      >
                        Avaliar atendimento
                      </Button>
                    ) : null}
                    {t.avaliacao ? (
                      <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                        Sua avaliação: {t.avaliacao}/5
                      </Typography>
                    ) : null}
                  </Box>
                ))
              )}

              {avaliarId ? (
                <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover' }}>
                  <Typography sx={{ fontWeight: 600, mb: 1 }}>Avaliar chamado #{avaliarId}</Typography>
                  <Rating value={nota} onChange={(_, v) => setNota(v)} />
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    minRows={2}
                    sx={{ mt: 1 }}
                    placeholder="Comentário (opcional)"
                    value={comentarioAval}
                    onChange={(e) => setComentarioAval(e.target.value)}
                  />
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button size="small" onClick={() => setAvaliarId(null)}>
                      Cancelar
                    </Button>
                    <Button size="small" variant="contained" onClick={() => void enviarAvaliacao()}>
                      Enviar avaliação
                    </Button>
                  </Stack>
                </Box>
              ) : null}
            </Stack>
          )}

          {erro ? (
            <Typography color="error" variant="body2" sx={{ mt: 1.5 }}>
              {erro}
            </Typography>
          ) : null}
          {ok ? (
            <Typography color="success.main" variant="body2" sx={{ mt: 1.5 }}>
              {ok}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAberto(false)}>Fechar</Button>
          {tab === 0 ? (
            <Button variant="contained" disabled={enviando} onClick={() => void enviar()}>
              {enviando ? 'Enviando…' : 'Enviar chamado'}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    </>
  );
}
