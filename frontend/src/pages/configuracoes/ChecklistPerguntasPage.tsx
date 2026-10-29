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
import InputAdornment from '@mui/material/InputAdornment';
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
import { simIndicaProblema } from '../../utils/checklistRules';
import { tableContainerSx, tableSx } from '../../utils/tablePageLayout';
import {
  configPageSx,
  configPaperSx,
  configToolbarSx,
  finBtnContainedSx,
  finBtnOutlinedSx,
  finCampoSx,
  FIN_MUTED,
  FIN_TEXT,
} from './configPageSx';

function chipRegra(tom: 'ok' | 'info' | 'alerta' | 'erro') {
  const mapa = {
    ok: { color: '#047857', border: 'rgba(5,150,105,0.45)', bg: 'rgba(5,150,105,0.1)' },
    info: { color: '#0D4ECC', border: 'rgba(27,110,243,0.4)', bg: 'rgba(27,110,243,0.08)' },
    alerta: { color: '#B45309', border: 'rgba(245,158,11,0.45)', bg: 'rgba(245,158,11,0.1)' },
    erro: { color: '#B91C1C', border: 'rgba(239,68,68,0.4)', bg: 'rgba(239,68,68,0.08)' },
  } as const;
  const e = mapa[tom];
  return {
    height: 22,
    fontSize: 11,
    fontWeight: 500,
    color: e.color,
    borderColor: e.border,
    bgcolor: e.bg,
  };
}

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
  sim_indica_problema: false,
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
      sim_indica_problema: simIndicaProblema(p),
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
        sim_indica_problema:
          form.sim_indica_problema || simIndicaProblema({ texto: form.texto, sim_indica_problema: false }),
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
    <Box sx={configPageSx}>
      <Box sx={configToolbarSx}>
        <TextField
          select
          size="small"
          value={filtroSecao}
          onChange={(e) => {
            const v = e.target.value;
            setFiltroSecao(v === 'todas' ? 'todas' : Number(v));
          }}
          sx={{ width: { xs: '100%', md: 240 }, ...finCampoSx }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <FilterListIcon sx={{ fontSize: 18, color: FIN_MUTED }} />
                </InputAdornment>
              ),
            },
          }}
        >
          <MenuItem value="todas">Todas as seções · {perguntas.length}</MenuItem>
          {secoes.map((s) => (
            <MenuItem key={s.id_categoria} value={s.id_categoria}>
              {s.ordem}. {s.nome} ({s.perguntas.length})
            </MenuItem>
          ))}
        </TextField>
        {tiposChecklist.length > 1 ? (
          <FormControl size="small" sx={{ minWidth: 180, ...finCampoSx }}>
            <Select
              value={tipoGestao}
              onChange={(e) => void trocarTipoGestao(String(e.target.value))}
              displayEmpty
            >
              {tiposChecklist.map((t) => (
                <MenuItem key={t.codigo} value={t.codigo}>
                  {t.nome}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}
        <Typography sx={{ fontSize: 12, color: FIN_MUTED, display: { xs: 'none', md: 'block' } }}>
          {totalPerguntas} perguntas · {secoes.length} seções
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            setNomeSecao('');
            setDialogSecao(true);
          }}
          sx={finBtnOutlinedSx}
        >
          Nova seção
        </Button>
        <Button size="small" variant="contained" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={abrirNova} sx={finBtnContainedSx}>
          Nova pergunta
        </Button>
      </Box>

      {erro && !dialog && !dialogSecao && !excluirAlvo && (
        <Alert severity="error" sx={{ flexShrink: 0 }}>
          {erro}
        </Alert>
      )}

      <Paper elevation={0} sx={configPaperSx}>
        <TableContainer sx={tableContainerSx}>
          <Table size="small" stickyHeader sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell width={56}>Cód.</TableCell>
                <TableCell width={140}>Seção</TableCell>
                <TableCell>Pergunta</TableCell>
                <TableCell width={140}>Tipo</TableCell>
                <TableCell width={220}>Regras</TableCell>
                <TableCell width={72} align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {perguntas.map((p) => (
                <TableRow
                  key={p.id_pergunta}
                  hover
                  onClick={() => abrirEditar(p)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell sx={{ fontWeight: 650, fontSize: 13, color: FIN_TEXT }}>{p.codigo}</TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 12.5, color: FIN_MUTED }} noWrap>
                      {(p as Pergunta & { secao_nome: string }).secao_nome}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 420 }}>
                    <Typography sx={{ fontSize: 13, color: FIN_TEXT }} noWrap title={p.texto}>
                      {p.texto}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 12.5, color: FIN_MUTED }} noWrap>
                      {labelTipo(p.tipo_resposta)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {p.obrigatoria ? (
                        <Tooltip title="Resposta obrigatória">
                          <Chip label="Obrigatória" size="small" variant="outlined" sx={chipRegra('ok')} />
                        </Tooltip>
                      ) : null}
                      {p.requer_foto ? (
                        <Tooltip title="Exige foto">
                          <Chip label="Foto" size="small" variant="outlined" sx={chipRegra('info')} />
                        </Tooltip>
                      ) : null}
                      {p.requer_obs_em_nao ? (
                        <Tooltip title="Observação no Não">
                          <Chip label="Obs." size="small" variant="outlined" sx={chipRegra('alerta')} />
                        </Tooltip>
                      ) : null}
                      {p.critica ? (
                        <Tooltip title="Pergunta crítica">
                          <Chip label="Crítica" size="small" variant="outlined" sx={chipRegra('erro')} />
                        </Tooltip>
                      ) : null}
                    </Box>
                  </TableCell>
                  <TableCell align="right" onClick={(ev) => ev.stopPropagation()}>
                    <IconButton
                      size="small"
                      aria-label="Editar"
                      onClick={() => abrirEditar(p)}
                      sx={{ color: FIN_MUTED, '&:hover': { color: '#1B6EF3' } }}
                    >
                      <EditOutlinedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label="Excluir"
                      onClick={() => setExcluirAlvo(p)}
                      sx={{ color: FIN_MUTED, '&:hover': { color: '#B91C1C' } }}
                    >
                      <DeleteOutlinedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!perguntas.length && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5, color: FIN_MUTED }}>
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
            onChange={(e) => {
              const texto = e.target.value;
              setForm((f) => ({
                ...f,
                texto,
                sim_indica_problema:
                  f.sim_indica_problema || simIndicaProblema({ texto, sim_indica_problema: false }),
              }));
            }}
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
          <SwitchRow>
            <FormControlLabel
              control={
                <Switch
                  checked={
                    form.sim_indica_problema ||
                    simIndicaProblema({ texto: form.texto, sim_indica_problema: false })
                  }
                  disabled={simIndicaProblema({ texto: form.texto, sim_indica_problema: false })}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sim_indica_problema: e.target.checked }))
                  }
                />
              }
              label={'Sim indica problema (Não = 100 pts)'}
            />
          </SwitchRow>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: -0.5, mb: 1, fontSize: '0.7rem', lineHeight: 1.35 }}
          >
            Em perguntas de achado (barata, contaminação, revalidação, produto vencido servido),
            Sim abre NC e Não mantém a pontuação. O texto dessas perguntas liga esta opção sozinho.
          </Typography>
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
