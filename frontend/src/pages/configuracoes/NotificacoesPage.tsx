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
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { api } from '../../api/client';
import type {
  ManutNotificacaoEvento,
  ManutNotificacaoPlaceholder,
} from '../../api/client';
import { dialogContentSx, dialogFieldProps } from '../../utils/dialogForm';
import { tableContainerSx, tablePageLayoutSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';
import { useToast } from '../../hooks/useToast';

type FormState = {
  codigo: string;
  descricao: string;
  template_mensagem: string;
  template_destinatario: string;
  notifica_abrir: boolean;
  notifica_ver: boolean;
  ativo: boolean;
};

const emptyForm: FormState = {
  codigo: '',
  descricao: '',
  template_mensagem: '',
  template_destinatario: '',
  notifica_abrir: true,
  notifica_ver: true,
  ativo: true,
};

function resumoTemplate(texto: string, max = 56) {
  const t = texto.trim();
  if (!t) return '—';
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export default function NotificacoesPage() {
  const [lista, setLista] = useState<ManutNotificacaoEvento[]>([]);
  const [placeholders, setPlaceholders] = useState<ManutNotificacaoPlaceholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [dialog, setDialog] = useState(false);
  const [editCodigo, setEditCodigo] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [salvando, setSalvando] = useState(false);
  const [excluirAlvo, setExcluirAlvo] = useState<ManutNotificacaoEvento | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [previewGeral, setPreviewGeral] = useState('');
  const [previewDest, setPreviewDest] = useState('');
  const { showToast, ToastSnackbar } = useToast();

  async function carregar() {
    setLoading(true);
    try {
      const data = await api.manutNotificacaoEventos();
      setLista(data.eventos);
      setPlaceholders(data.placeholders);
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

  const atualizarPreview = useCallback(async (codigo: string, f: FormState) => {
    if (!codigo || !f.template_mensagem.trim()) {
      setPreviewGeral('');
      setPreviewDest('');
      return;
    }
    try {
      const [geral, dest] = await Promise.all([
        api.manutNotificacaoEventoPreview({
          codigo,
          template_mensagem: f.template_mensagem,
          template_destinatario: f.template_destinatario || null,
          destinatario: false,
        }),
        f.template_destinatario.trim()
          ? api.manutNotificacaoEventoPreview({
              codigo,
              template_mensagem: f.template_mensagem,
              template_destinatario: f.template_destinatario,
              destinatario: true,
            })
          : Promise.resolve({ preview: '' }),
      ]);
      setPreviewGeral(geral.preview);
      setPreviewDest(dest.preview);
    } catch {
      setPreviewGeral('');
      setPreviewDest('');
    }
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const codigo = editCodigo || form.codigo.trim().toLowerCase();
    const t = setTimeout(() => {
      void atualizarPreview(codigo, form);
    }, 350);
    return () => clearTimeout(t);
  }, [dialog, editCodigo, form, atualizarPreview]);

  function abrirNovo() {
    setEditCodigo(null);
    setForm(emptyForm);
    setPreviewGeral('');
    setPreviewDest('');
    setErro('');
    setDialog(true);
  }

  function abrirEditar(ev: ManutNotificacaoEvento) {
    setEditCodigo(ev.codigo);
    setForm({
      codigo: ev.codigo,
      descricao: ev.descricao,
      template_mensagem: ev.template_mensagem,
      template_destinatario: ev.template_destinatario || '',
      notifica_abrir: ev.notifica_abrir,
      notifica_ver: ev.notifica_ver,
      ativo: ev.ativo,
    });
    setErro('');
    setDialog(true);
  }

  async function salvar() {
    if (!form.descricao.trim() || !form.template_mensagem.trim()) {
      setErro('Preencha descrição e template da mensagem.');
      return;
    }
    if (!editCodigo && !form.codigo.trim()) {
      setErro('Informe o código do evento.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const body = {
        descricao: form.descricao.trim(),
        template_mensagem: form.template_mensagem.trim(),
        template_destinatario: form.template_destinatario.trim() || null,
        notifica_abrir: form.notifica_abrir,
        notifica_ver: form.notifica_ver,
        ativo: form.ativo,
      };
      if (editCodigo) {
        await api.manutNotificacaoEventoAtualizar(editCodigo, body);
      } else {
        await api.manutNotificacaoEventoCriar({
          ...body,
          codigo: form.codigo.trim().toLowerCase(),
        });
      }
      setDialog(false);
      showToast(editCodigo ? 'Template atualizado!' : 'Evento criado!');
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
      await api.manutNotificacaoEventoExcluir(excluirAlvo.codigo);
      setExcluirAlvo(null);
      setDialog(false);
      showToast('Evento excluído.');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir');
    } finally {
      setExcluindo(false);
    }
  }

  if (loading) return <LinearProgress />;

  const ativos = lista.filter((e) => e.ativo);
  const ops = lista.filter((e) => e.envia_push);

  return (
    <Box sx={tablePageLayoutSx}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexShrink: 0 }}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {ativos.length} eventos ativos · {ops.length} com push no celular
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Use placeholders como {'{numero}'}, {'{loja}'}, {'{tecnico}'} nos templates. Alterações valem para novas
            notificações.
          </Typography>
        </Box>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={abrirNovo}>
          Novo evento
        </Button>
      </Box>

      {erro && !dialog && !excluirAlvo && (
        <Alert severity="error" sx={{ flexShrink: 0 }}>
          {erro}
        </Alert>
      )}

      <Paper elevation={0} sx={tablePaperSx}>
        <TableContainer sx={tableContainerSx}>
          <Table size="small" stickyHeader sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 160 }}>Código</TableCell>
                <TableCell sx={{ minWidth: 180 }}>Descrição</TableCell>
                <TableCell>Template</TableCell>
                <TableCell align="center" sx={{ width: 72 }}>
                  Push
                </TableCell>
                <TableCell align="center" sx={{ width: 80 }}>
                  Status
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lista.map((ev) => (
                <TableRow
                  key={ev.codigo}
                  hover
                  onClick={() => abrirEditar(ev)}
                  sx={{ cursor: 'pointer', opacity: ev.ativo ? 1 : 0.55 }}
                >
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {ev.codigo}
                    {!ev.sistema && (
                      <Chip label="custom" size="small" sx={{ ml: 1, height: 18, fontSize: '0.65rem' }} />
                    )}
                  </TableCell>
                  <TableCell>{ev.descricao}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                    {resumoTemplate(ev.template_mensagem)}
                  </TableCell>
                  <TableCell align="center">
                    {ev.envia_push ? (
                      <Tooltip title="Envia push e WhatsApp">
                        <NotificationsActiveIcon fontSize="small" color="primary" />
                      </Tooltip>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={ev.ativo ? 'Ativo' : 'Inativo'}
                      size="small"
                      color={ev.ativo ? 'success' : 'default'}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={dialog} onClose={() => !salvando && setDialog(false)} fullWidth maxWidth="md">
        <DialogTitle>{editCodigo ? `Editar: ${editCodigo}` : 'Novo evento de notificação'}</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          {!editCodigo && (
            <TextField
              {...dialogFieldProps}
              label="Código do evento"
              required
              value={form.codigo}
              onChange={(e) =>
                setForm((f) => ({ ...f, codigo: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))
              }
              placeholder="ex.: meu_evento"
              helperText="Letras minúsculas, números e _. Eventos custom precisam ser disparados pelo sistema."
            />
          )}
          <TextField
            {...dialogFieldProps}
            label="Descrição"
            required
            value={form.descricao}
            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
          />
          <TextField
            {...dialogFieldProps}
            label="Template da mensagem"
            required
            multiline
            minRows={2}
            value={form.template_mensagem}
            onChange={(e) => setForm((f) => ({ ...f, template_mensagem: e.target.value }))}
            placeholder="Novo chamado urgente #{numero} - {loja}. Verifique Imediatamente!"
          />
          <TextField
            {...dialogFieldProps}
            label="Template para o destinatário (opcional)"
            multiline
            minRows={2}
            value={form.template_destinatario}
            onChange={(e) => setForm((f) => ({ ...f, template_destinatario: e.target.value }))}
            placeholder="Chamado atribuído! Chamado #{numero} atribuído a você"
            helperText="Usado quando a notificação é para o próprio técnico (ex.: assumido)."
          />

          <Alert severity="info" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
            <Typography variant="caption" component="div" sx={{ mb: 0.5, fontWeight: 600 }}>
              Placeholders disponíveis
            </Typography>
            <Typography variant="caption" component="div">
              {placeholders.map((p) => (
                <span key={p.chave} style={{ marginRight: 12 }}>
                  <code>{`{${p.chave}}`}</code> — {p.descricao}
                </span>
              ))}
            </Typography>
          </Alert>

          {(previewGeral || previewDest) && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {previewGeral && (
                <Alert severity="success" icon={false}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Prévia (geral)
                  </Typography>
                  {previewGeral}
                </Alert>
              )}
              {previewDest && (
                <Alert severity="success" icon={false}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Prévia (destinatário)
                  </Typography>
                  {previewDest}
                </Alert>
              )}
            </Box>
          )}

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.ativo}
                  onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                />
              }
              label="Evento ativo"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.notifica_abrir}
                  onChange={(e) => setForm((f) => ({ ...f, notifica_abrir: e.target.checked }))}
                />
              }
              label="Notifica quem abre chamados"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.notifica_ver}
                  onChange={(e) => setForm((f) => ({ ...f, notifica_ver: e.target.checked }))}
                />
              }
              label="Notifica quem vê chamados"
            />
          </Box>

          {erro && dialog && <Alert severity="error">{erro}</Alert>}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          {editCodigo && !lista.find((e) => e.codigo === editCodigo)?.sistema ? (
            <Button
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => {
                const ev = lista.find((e) => e.codigo === editCodigo);
                if (ev) {
                  setErro('');
                  setExcluirAlvo(ev);
                }
              }}
            >
              Excluir
            </Button>
          ) : (
            <span />
          )}
          <Box className="flex gap-1">
            <Button onClick={() => setDialog(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button variant="contained" onClick={() => void salvar()} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      <Dialog open={!!excluirAlvo} onClose={() => !excluindo && setExcluirAlvo(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Excluir evento</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2">
            Excluir o evento <strong>{excluirAlvo?.codigo}</strong>? Só eventos custom podem ser removidos.
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
