import { useEffect, useMemo, useState } from 'react';
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
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import AssignmentIcon from '@mui/icons-material/Assignment';
import FilterListIcon from '@mui/icons-material/FilterList';
import { api } from '../../api/client';
import type { CategoriaChecklist, Pergunta, PerguntaInput, TipoResposta, TipoChecklist } from '../../api/client';
import { dialogContentSx, dialogFieldProps } from '../../utils/dialogForm';
import { useToast } from '../../hooks/useToast';
import { dispararAtualizacaoChecklist } from '../../utils/checklistEvent';
import { tableCellWrapSx, tableContainerSx, tablePageLayoutSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';

const NAVY = '#1B2A6B';

const chipRegraSx = {
  fontWeight: 600,
  color: 'white',
  '& .MuiChip-label': { color: 'white', px: 0.75 },
};

const TIPOS: { value: TipoResposta; label: string }[] = [
  { value: 'sim_nao', label: 'Sim / Não' },
  { value: 'sim_nao_foto', label: 'Sim / Não com foto' },
  { value: 'estrelas', label: 'Estrelas (1 a 5)' },
  { value: 'estrelas_foto', label: 'Estrelas com foto' },
];

const emptyPergunta = {
  id_categoria: '' as number | '',
  codigo: '',
  texto: '',
  tipo_resposta: 'sim_nao' as TipoResposta,
  obrigatoria: true,
  peso: 1,
  ordem: '' as number | '',
  requer_foto: false,
  requer_obs_em_nao: false,
  critica: false,
};

function labelTipo(tipo: TipoResposta) {
  return TIPOS.find((t) => t.value === tipo)?.label ?? tipo;
}

function FormRow({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        flexDirection: { xs: 'column', sm: 'row' },
        '& > *': { flex: 1, minWidth: 0 },
      }}
    >
      {children}
    </Box>
  );
}

function SwitchRow({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: { xs: 0, sm: 2 },
        flexDirection: { xs: 'column', sm: 'row' },
        '& .MuiFormControlLabel-root': {
          flex: 1,
          minWidth: 0,
          mx: 0,
          alignItems: 'center',
        },
      }}
    >
      {children}
    </Box>
  );
}

export default function ChecklistPerguntasPage() {
  const [secoes, setSecoes] = useState<CategoriaChecklist[]>([]);
  const [tiposChecklist, setTiposChecklist] = useState<TipoChecklist[]>([]);
  const [tipoGestao, setTipoGestao] = useState('auditoria_operacional');
  const [filtroSecao, setFiltroSecao] = useState<number | 'todas'>('todas');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [dialog, setDialog] = useState(false);
  const [dialogSecao, setDialogSecao] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyPergunta);
  const [nomeSecao, setNomeSecao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [excluirAlvo, setExcluirAlvo] = useState<Pergunta | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const { showToast, ToastSnackbar } = useToast();

  const perguntas = useMemo(() => {
    const lista = secoes.flatMap((s) =>
      s.perguntas.map((p) => ({ ...p, secao_nome: s.nome })),
    );
    if (filtroSecao === 'todas') return lista;
    return lista.filter((p) => p.id_categoria === filtroSecao);
  }, [secoes, filtroSecao]);

  const totalPerguntas = useMemo(
    () => secoes.reduce((n, s) => n + s.perguntas.length, 0),
    [secoes],
  );

  async function carregar(codigoTipo = tipoGestao) {
    setLoading(true);
    try {
      const data = await api.checklistGestao(codigoTipo);
      setSecoes(data);
      setFiltroSecao('todas');
      setErro('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void api.checklistTipos().then(setTiposChecklist).catch(() => {});
    void carregar();
  }, []);

  async function trocarTipoGestao(codigo: string) {
    setTipoGestao(codigo);
    await carregar(codigo);
  }

  function abrirNova() {
    setEditId(null);
    const idCat =
      filtroSecao !== 'todas' ? filtroSecao : secoes[0]?.id_categoria ?? '';
    setForm({ ...emptyPergunta, id_categoria: idCat });
    setErro('');
    setDialog(true);
  }

  function abrirEditar(p: Pergunta) {
    setEditId(p.id_pergunta);
    setForm({
      id_categoria: p.id_categoria,
      codigo: p.codigo,
      texto: p.texto,
      tipo_resposta: p.tipo_resposta,
      obrigatoria: p.obrigatoria,
      peso: Number(p.peso) || 1,
      ordem: p.ordem,
      requer_foto: p.requer_foto,
      requer_obs_em_nao: p.requer_obs_em_nao,
      critica: p.critica,
    });
    setErro('');
    setDialog(true);
  }

  async function salvarPergunta() {
    if (!form.texto.trim() || !form.id_categoria) {
      setErro('Preencha a seção e o texto da pergunta.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const body: PerguntaInput = {
        id_categoria: Number(form.id_categoria),
        codigo: form.codigo.trim() || undefined,
        texto: form.texto.trim(),
        tipo_resposta: form.tipo_resposta,
        obrigatoria: form.obrigatoria,
        peso: Number(form.peso) || 1,
        ordem: form.ordem ? Number(form.ordem) : undefined,
        requer_foto: form.requer_foto,
        requer_obs_em_nao: form.requer_obs_em_nao,
        critica: form.critica,
      };
      if (editId) await api.checklistPerguntaAtualizar(editId, body);
      else await api.checklistPerguntaCriar(body);
      setDialog(false);
      showToast(editId ? 'Pergunta atualizada.' : 'Pergunta criada.');
      dispararAtualizacaoChecklist();
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarSecao() {
    if (!nomeSecao.trim()) {
      setErro('Informe o nome da seção.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await api.checklistCategoriaCriar({ nome: nomeSecao.trim(), codigo_tipo_checklist: tipoGestao });
      setDialogSecao(false);
      setNomeSecao('');
      showToast('Seção criada.');
      dispararAtualizacaoChecklist();
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar seção');
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    if (!excluirAlvo) return;
    setExcluindo(true);
    setErro('');
    try {
      await api.checklistPerguntaExcluir(excluirAlvo.id_pergunta);
      setExcluirAlvo(null);
      showToast('Pergunta excluída.');
      dispararAtualizacaoChecklist();
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir');
    } finally {
      setExcluindo(false);
    }
  }

  if (loading) return <LinearProgress />;

  return (
    <Box sx={tablePageLayoutSx}>
      <Paper
        elevation={0}
        sx={{
          flexShrink: 0,
          p: { xs: 2, sm: 2.5 },
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          background: `linear-gradient(135deg, ${NAVY} 0%, #2a3d8f 100%)`,
          color: 'white',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
            mb: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, minWidth: 0 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AssignmentIcon sx={{ fontSize: 26 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                Checklist perguntas
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                <Chip
                  label={`${totalPerguntas} perguntas`}
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: 'white', fontWeight: 600, height: 24 }}
                />
                <Chip
                  label={`${secoes.length} seções`}
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: 'white', fontWeight: 600, height: 24 }}
                />
                <Chip
                  label={`${perguntas.length} exibidas`}
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.95)', height: 24 }}
                />
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                setNomeSecao('');
                setDialogSecao(true);
              }}
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.45)', '&:hover': { borderColor: 'white' } }}
            >
              Nova seção
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={abrirNova}
              sx={{ bgcolor: 'white', color: NAVY, '&:hover': { bgcolor: '#f0f2fa' } }}
            >
              Nova pergunta
            </Button>
          </Box>
        </Box>

        {tiposChecklist.length > 1 && (
          <FormControl
            size="small"
            sx={{
              minWidth: 220,
              mb: 1.5,
              '& .MuiInputLabel-root, & .MuiSelect-select': { color: 'white' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.35)' },
            }}
          >
            <InputLabel>Checklist</InputLabel>
            <Select
              label="Checklist"
              value={tipoGestao}
              onChange={(e) => void trocarTipoGestao(String(e.target.value))}
            >
              {tiposChecklist.map((t) => (
                <MenuItem key={t.codigo} value={t.codigo}>
                  {t.nome}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: 'rgba(255,255,255,0.1)',
            borderRadius: 1.5,
            px: 1.5,
            py: 0.5,
          }}
        >
          <FilterListIcon sx={{ fontSize: 20, opacity: 0.9, flexShrink: 0 }} />
          <TextField
            select
            variant="standard"
            size="small"
            value={filtroSecao}
            onChange={(e) => {
              const v = e.target.value;
              setFiltroSecao(v === 'todas' ? 'todas' : Number(v));
            }}
            slotProps={{
              input: {
                disableUnderline: true,
                sx: { color: 'white', fontSize: '0.875rem', fontWeight: 500 },
              },
            }}
            sx={{ flex: 1, minWidth: 0, '& .MuiSelect-icon': { color: 'white' } }}
          >
            <MenuItem value="todas">Todas as seções</MenuItem>
            {secoes.map((s) => (
              <MenuItem key={s.id_categoria} value={s.id_categoria}>
                {s.ordem}. {s.nome} ({s.perguntas.length})
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Paper>

      {erro && !dialog && !dialogSecao && !excluirAlvo && (
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
                <TableCell width={52}>Cód.</TableCell>
                <TableCell>Seção</TableCell>
                <TableCell>Pergunta</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Regras</TableCell>
                <TableCell width={88} align="center">
                  Ações
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {perguntas.map((p) => (
                <TableRow key={p.id_pergunta} hover>
                  <TableCell sx={{ fontWeight: 700 }}>{p.codigo}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>
                    {(p as Pergunta & { secao_nome: string }).secao_nome}
                  </TableCell>
                  <TableCell sx={tableCellWrapSx}>{p.texto}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                    {labelTipo(p.tipo_resposta)}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                      {p.obrigatoria && (
                        <Tooltip title="Resposta obrigatória para avançar no checklist">
                          <Chip label="Obrigatória" size="small" color="success" sx={chipRegraSx} />
                        </Tooltip>
                      )}
                      {p.requer_foto && (
                        <Tooltip title="Exige foto ao responder (quando o campo de foto aparece)">
                          <Chip label="Foto obrigatória" size="small" color="info" sx={chipRegraSx} />
                        </Tooltip>
                      )}
                      {p.requer_obs_em_nao && (
                        <Tooltip title="Exige observação quando a resposta for Não">
                          <Chip label="Observação" size="small" color="warning" sx={chipRegraSx} />
                        </Tooltip>
                      )}
                      {p.critica && (
                        <Tooltip title="Pergunta crítica de segurança ou operação">
                          <Chip label="Crítica" size="small" color="error" sx={chipRegraSx} />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Editar">
                      <IconButton size="small" color="primary" onClick={() => abrirEditar(p)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton size="small" color="error" onClick={() => setExcluirAlvo(p)}>
                        <DeleteOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {!perguntas.length && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Nenhuma pergunta encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={dialog} onClose={() => !salvando && setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssignmentIcon color="primary" />
          {editId ? 'Editar pergunta' : 'Nova pergunta'}
        </DialogTitle>
        <DialogContent sx={dialogContentSx}>
          {erro && dialog && <Alert severity="error">{erro}</Alert>}
          <FormRow>
            <TextField
              {...dialogFieldProps}
              select
              label="Seção"
              required
              value={form.id_categoria}
              onChange={(e) => setForm((f) => ({ ...f, id_categoria: Number(e.target.value) }))}
            >
              {secoes.map((s) => (
                <MenuItem key={s.id_categoria} value={s.id_categoria}>
                  {s.ordem}. {s.nome}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              {...dialogFieldProps}
              label="Código"
              placeholder="Auto"
              value={form.codigo}
              onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
            />
          </FormRow>
          <TextField
            {...dialogFieldProps}
            label="Texto da pergunta"
            required
            multiline
            minRows={3}
            value={form.texto}
            onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))}
          />
          <FormRow>
            <TextField
              {...dialogFieldProps}
              select
              label="Tipo de resposta"
              value={form.tipo_resposta}
              onChange={(e) =>
                setForm((f) => ({ ...f, tipo_resposta: e.target.value as TipoResposta }))
              }
            >
              {TIPOS.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              {...dialogFieldProps}
              label="Ordem"
              type="number"
              placeholder="Auto"
              value={form.ordem}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  ordem: e.target.value === '' ? '' : Number(e.target.value),
                }))
              }
            />
          </FormRow>
          <SwitchRow>
            <FormControlLabel
              control={
                <Switch
                  checked={form.obrigatoria}
                  onChange={(e) => setForm((f) => ({ ...f, obrigatoria: e.target.checked }))}
                />
              }
              label="Obrigatória"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.requer_foto}
                  onChange={(e) => setForm((f) => ({ ...f, requer_foto: e.target.checked }))}
                />
              }
              label="Foto obrigatória"
            />
          </SwitchRow>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: -0.5, mb: 1, fontSize: '0.7rem', lineHeight: 1.35 }}
          >
            Perguntas do tipo &quot;com foto&quot; exibem o campo de anexo após a resposta, mas a foto é
            opcional. Marque este switch apenas quando for obrigatório tirar foto para avançar.
          </Typography>
          <SwitchRow>
            <FormControlLabel
              control={
                <Switch
                  checked={form.requer_obs_em_nao}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, requer_obs_em_nao: e.target.checked }))
                  }
                />
              }
              label="Observação quando Não"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.critica}
                  onChange={(e) => setForm((f) => ({ ...f, critica: e.target.checked }))}
                />
              }
              label="Pergunta crítica"
            />
          </SwitchRow>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={salvarPergunta} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogSecao} onClose={() => !salvando && setDialogSecao(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Nova seção</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          {erro && dialogSecao && <Alert severity="error">{erro}</Alert>}
          <TextField
            {...dialogFieldProps}
            label="Nome da seção"
            required
            value={nomeSecao}
            onChange={(e) => setNomeSecao(e.target.value)}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogSecao(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={salvarSecao} disabled={salvando}>
            Criar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!excluirAlvo} onClose={() => !excluindo && setExcluirAlvo(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Excluir pergunta?</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Código
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {excluirAlvo?.codigo}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Pergunta
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.45 }}>
                {excluirAlvo?.texto}
              </Typography>
            </Box>
          </Box>
          {erro && excluirAlvo && <Alert severity="error" sx={{ mt: 2 }}>{erro}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExcluirAlvo(null)} disabled={excluindo}>
            Cancelar
          </Button>
          <Button
            color="error"
            variant="contained"
            startIcon={<DeleteOutlinedIcon />}
            onClick={confirmarExclusao}
            disabled={excluindo}
          >
            Excluir
          </Button>
        </DialogActions>
      </Dialog>

      <ToastSnackbar />
    </Box>
  );
}
