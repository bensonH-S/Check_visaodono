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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { api } from '../../api/client';
import type { ManutCategoria, ManutSla } from '../../api/client';
import { slaChip, urgenciaChip } from '../../utils/manutencaoUi';
import { dialogContentSx, dialogFieldProps } from '../../utils/dialogForm';
import { useToast } from '../../hooks/useToast';
import { tableContainerSx, tablePageLayoutSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';

const emptyForm = {
  nome: '',
  id_sla: '' as number | '',
  ativo: true,
};

export default function CategoriasPage() {
  const [lista, setLista] = useState<ManutCategoria[]>([]);
  const [slas, setSlas] = useState<ManutSla[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [dialog, setDialog] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [salvando, setSalvando] = useState(false);
  const [excluirAlvo, setExcluirAlvo] = useState<ManutCategoria | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const { showToast, ToastSnackbar } = useToast();

  const slaSelecionado = useMemo(
    () => slas.find((s) => s.id_sla === form.id_sla),
    [slas, form.id_sla],
  );

  async function carregar() {
    setLoading(true);
    try {
      const [cats, slaLista] = await Promise.all([api.manutCategorias(), api.manutSlas()]);
      setLista(cats);
      setSlas(slaLista.filter((s) => s.ativo !== false));
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
    setForm({ ...emptyForm, id_sla: slas[0]?.id_sla ?? '' });
    setErro('');
    setDialog(true);
  }

  function abrirEditar(cat: ManutCategoria) {
    setEditId(cat.id_categoria);
    setForm({
      nome: cat.nome,
      id_sla: cat.id_sla ?? '',
      ativo: cat.ativo !== false,
    });
    setErro('');
    setDialog(true);
  }

  async function salvar() {
    if (!form.nome.trim() || !form.id_sla) {
      setErro('Preencha nome e SLA.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const body = {
        nome: form.nome.trim(),
        id_sla: Number(form.id_sla),
        ativo: form.ativo,
      };
      if (editId) await api.manutCategoriaAtualizar(editId, body);
      else await api.manutCategoriaCriar(body);
      setDialog(false);
      showToast(editId ? 'Categoria atualizada com sucesso!' : 'Categoria criada com sucesso!');
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
      const res = await api.manutCategoriaExcluir(excluirAlvo.id_categoria);
      setExcluirAlvo(null);
      setDialog(false);
      showToast(
        res && typeof res === 'object' && res.inativada
          ? 'Categoria inativada (há chamados vinculados).'
          : 'Categoria excluída com sucesso!',
      );
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir');
    } finally {
      setExcluindo(false);
    }
  }

  if (loading) return <LinearProgress />;

  const ativas = lista.filter((c) => c.ativo !== false);

  return (
    <Box sx={tablePageLayoutSx}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexShrink: 0 }}>
        <Typography variant="body2" color="text.secondary">
          {ativas.length} categorias ativas · {lista.length} no total
        </Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={abrirNovo}>
          Nova categoria
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
              <TableCell>Categoria</TableCell>
              <TableCell align="center" sx={{ width: 140 }}>
                Urgência padrão
              </TableCell>
              <TableCell align="center" sx={{ width: 100 }}>
                SLA
              </TableCell>
              <TableCell align="center" sx={{ width: 100 }}>
                Status
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lista.map((c) => (
              <TableRow
                key={c.id_categoria}
                hover
                onClick={() => abrirEditar(c)}
                sx={{ cursor: 'pointer', opacity: c.ativo === false ? 0.55 : 1 }}
              >
                <TableCell sx={{ fontWeight: 600 }}>{c.nome}</TableCell>
                <TableCell align="center">{urgenciaChip(c.urgencia_padrao)}</TableCell>
                <TableCell align="center">{slaChip(c.sla_horas)}</TableCell>
                <TableCell align="center">
                  <Chip
                    label={c.ativo === false ? 'Inativa' : 'Ativa'}
                    size="small"
                    color={c.ativo === false ? 'default' : 'success'}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={dialog} onClose={() => !salvando && setDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editId ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <TextField
            {...dialogFieldProps}
            label="Nome da categoria"
            required
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
          />
          <TextField
            {...dialogFieldProps}
            select
            label="SLA"
            required
            value={form.id_sla}
            onChange={(e) => setForm((f) => ({ ...f, id_sla: Number(e.target.value) }))}
          >
            {slas.map((s) => (
              <MenuItem key={s.id_sla} value={s.id_sla}>
                {s.horas}h
              </MenuItem>
            ))}
          </TextField>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            {slaSelecionado ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Urgência
                </Typography>
                {urgenciaChip(slaSelecionado.urgencia_padrao)}
              </Box>
            ) : (
              <span />
            )}
            <FormControlLabel
              control={
                <Switch
                  checked={form.ativo}
                  onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                />
              }
              label="Categoria ativa"
              sx={{ m: 0 }}
            />
          </Box>
          {erro && dialog && <Alert severity="error">{erro}</Alert>}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          {editId ? (
            <Button
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => {
                const cat = lista.find((c) => c.id_categoria === editId);
                if (cat) {
                  setErro('');
                  setExcluirAlvo(cat);
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

      <Dialog
        open={!!excluirAlvo}
        onClose={() => !excluindo && setExcluirAlvo(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Excluir categoria</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2">
            Tem certeza que deseja excluir a categoria <strong>{excluirAlvo?.nome}</strong>?
            Se houver chamados vinculados, ela será apenas inativada.
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
