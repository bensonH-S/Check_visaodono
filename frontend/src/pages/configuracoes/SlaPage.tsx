import { useEffect, useState } from 'react';
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
import type { ManutSla } from '../../api/client';
import { URGENCIAS, fmtPrazo, slaChip, urgenciaChip } from '../../utils/manutencaoUi';
import { dialogContentSx, dialogFieldProps } from '../../utils/dialogForm';
import { tableContainerSx, tablePageLayoutSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';
import { useToast } from '../../hooks/useToast';

const emptyForm = {
  nome: '',
  horas: '',
  urgencia_padrao: 'media',
  ativo: true,
};

export default function SlaPage() {
  const [lista, setLista] = useState<ManutSla[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [dialog, setDialog] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [salvando, setSalvando] = useState(false);
  const [excluirAlvo, setExcluirAlvo] = useState<ManutSla | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const { showToast, ToastSnackbar } = useToast();

  async function carregar() {
    setLoading(true);
    try {
      const slas = await api.manutSlas();
      setLista(slas);
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
    setForm(emptyForm);
    setErro('');
    setDialog(true);
  }

  function abrirEditar(sla: ManutSla) {
    setEditId(sla.id_sla);
    setForm({
      nome: sla.nome,
      horas: String(sla.horas),
      urgencia_padrao: sla.urgencia_padrao || 'media',
      ativo: sla.ativo !== false,
    });
    setErro('');
    setDialog(true);
  }

  async function salvar() {
    const horas = Number(form.horas);
    if (!form.nome.trim() || !horas || horas <= 0 || !form.urgencia_padrao) {
      setErro('Preencha nome, horas e urgência válidas.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const body = {
        nome: form.nome.trim(),
        horas,
        urgencia_padrao: form.urgencia_padrao,
        ativo: form.ativo,
      };
      if (editId) await api.manutSlaAtualizar(editId, body);
      else await api.manutSlaCriar(body);
      setDialog(false);
      showToast(editId ? 'SLA atualizado com sucesso!' : 'SLA criado com sucesso!');
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
      await api.manutSlaExcluir(excluirAlvo.id_sla);
      setExcluirAlvo(null);
      setDialog(false);
      showToast('SLA excluído com sucesso!');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir');
    } finally {
      setExcluindo(false);
    }
  }

  if (loading) return <LinearProgress />;

  const ativos = lista.filter((s) => s.ativo !== false);

  return (
    <Box sx={tablePageLayoutSx}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexShrink: 0 }}>
        <Typography variant="body2" color="text.secondary">
          {ativos.length} SLAs ativos · {lista.length} no total
        </Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={abrirNovo}>
          Novo SLA
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
              <TableCell sx={{ minWidth: 160 }}>Nome</TableCell>
              <TableCell align="center" sx={{ width: 100 }}>
                Horas
              </TableCell>
              <TableCell align="center" sx={{ width: 140 }}>
                Urgência
              </TableCell>
              <TableCell align="center" sx={{ width: 140 }}>
                Prazo
              </TableCell>
              <TableCell align="center" sx={{ width: 90 }}>
                Status
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lista.map((s) => (
              <TableRow
                key={s.id_sla}
                hover
                onClick={() => abrirEditar(s)}
                sx={{ cursor: 'pointer', opacity: s.ativo === false ? 0.55 : 1 }}
              >
                <TableCell sx={{ fontWeight: 600 }}>{s.nome}</TableCell>
                <TableCell align="center">{slaChip(s.horas)}</TableCell>
                <TableCell align="center">{urgenciaChip(s.urgencia_padrao)}</TableCell>
                <TableCell align="center">{fmtPrazo(s.horas)}</TableCell>
                <TableCell align="center">
                  <Chip
                    label={s.ativo === false ? 'Inativo' : 'Ativo'}
                    size="small"
                    color={s.ativo === false ? 'default' : 'success'}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={dialog} onClose={() => !salvando && setDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editId ? 'Editar SLA' : 'Novo SLA'}</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <TextField
            {...dialogFieldProps}
            label="Nome do SLA"
            required
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            placeholder="Ex.: Urgente 4h"
          />
          <TextField
            {...dialogFieldProps}
            label="Horas de atendimento"
            required
            type="number"
            slotProps={{ ...dialogFieldProps.slotProps, htmlInput: { min: 1 } }}
            value={form.horas}
            onChange={(e) => setForm((f) => ({ ...f, horas: e.target.value }))}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TextField
              {...dialogFieldProps}
              select
              label="Urgência padrão"
              required
              value={form.urgencia_padrao}
              onChange={(e) => setForm((f) => ({ ...f, urgencia_padrao: e.target.value }))}
              sx={{ flex: 1, minWidth: 0 }}
            >
              {URGENCIAS.map((u) => (
                <MenuItem key={u.v} value={u.v}>
                  {u.l}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={
                <Switch
                  checked={form.ativo}
                  onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                />
              }
              label="SLA ativo"
              sx={{ m: 0, flexShrink: 0 }}
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
                const sla = lista.find((s) => s.id_sla === editId);
                if (sla) {
                  setErro('');
                  setExcluirAlvo(sla);
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
        <DialogTitle>Excluir SLA</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2">
            Tem certeza que deseja excluir o SLA <strong>{excluirAlvo?.nome}</strong>?
            SLAs vinculados a categorias não podem ser removidos.
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
