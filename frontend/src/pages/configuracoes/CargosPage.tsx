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
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import BadgeIcon from '@mui/icons-material/Badge';
import { api } from '../../api/client';
import type { Cargo } from '../../api/client';
import { dialogContentSx, dialogFieldProps } from '../../utils/dialogForm';
import { tableContainerSx, tablePageLayoutSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';
import { useToast } from '../../hooks/useToast';

const NAVY = '#1B2A6B';

const emptyForm = {
  nome: '',
  aprovador: false,
  ativo: true,
};

export default function CargosPage() {
  const [lista, setLista] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [dialog, setDialog] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [salvando, setSalvando] = useState(false);
  const [excluirAlvo, setExcluirAlvo] = useState<Cargo | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const { showToast, ToastSnackbar } = useToast();

  async function carregar() {
    setLoading(true);
    try {
      setLista(await api.cargosGestao());
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

  function abrirEditar(cargo: Cargo) {
    setEditId(cargo.id_cargo);
    setForm({
      nome: cargo.nome,
      aprovador: !!cargo.aprovador,
      ativo: cargo.ativo !== false,
    });
    setErro('');
    setDialog(true);
  }

  async function salvar() {
    if (!form.nome.trim()) {
      setErro('Informe o nome do cargo.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const body = {
        nome: form.nome.trim(),
        aprovador: form.aprovador,
        ativo: form.ativo,
      };
      if (editId) await api.cargoGestaoAtualizar(editId, body);
      else await api.cargoGestaoCriar(body);
      setDialog(false);
      showToast(editId ? 'Cargo atualizado!' : 'Cargo criado!');
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
      await api.cargoGestaoExcluir(excluirAlvo.id_cargo);
      setExcluirAlvo(null);
      showToast('Cargo excluído!');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir');
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <Box sx={tablePageLayoutSx}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <Typography variant="body2" color="text.secondary">
          Perfis usados em usuários e aprovações de orçamento
        </Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={abrirNovo}>
          Novo cargo
        </Button>
      </Box>

      {loading && <LinearProgress sx={{ flexShrink: 0 }} />}
      {erro && !dialog && !excluirAlvo && <Alert severity="error" sx={{ flexShrink: 0 }}>{erro}</Alert>}

      <Paper elevation={0} sx={tablePaperSx}>
        <TableContainer sx={tableContainerSx}>
          <Table size="small" stickyHeader sx={tableSx}>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Código</TableCell>
              <TableCell>Aprovador</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lista.map((c) => (
              <TableRow key={c.id_cargo} hover onClick={() => abrirEditar(c)} sx={{ cursor: 'pointer' }}>
                <TableCell sx={{ fontWeight: 600, color: NAVY }}>{c.nome}</TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {c.codigo}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={c.aprovador ? 'Sim' : 'Não'}
                    size="small"
                    color={c.aprovador ? 'primary' : 'default'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={c.ativo ? 'Ativo' : 'Inativo'}
                    size="small"
                    color={c.ativo ? 'success' : 'default'}
                  />
                </TableCell>
              </TableRow>
            ))}
            {!loading && !lista.length && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Nenhum cargo cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={dialog} onClose={() => !salvando && setDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BadgeIcon sx={{ color: NAVY }} />
          {editId ? 'Editar cargo' : 'Novo cargo'}
        </DialogTitle>
        <DialogContent dividers sx={dialogContentSx}>
          <TextField
            {...dialogFieldProps}
            label="Nome do cargo"
            required
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            placeholder="Ex.: Financeiro, Diretor, Gerente regional"
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.aprovador}
                onChange={(e) => setForm((f) => ({ ...f, aprovador: e.target.checked }))}
              />
            }
            label="Aprovador de orçamentos"
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
            Cargos aprovadores aparecem ao pedir aprovação de orçamento e na tela de Aprovações.
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={form.ativo}
                onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
              />
            }
            label="Cargo ativo"
          />
          {erro && dialog && <Alert severity="error">{erro}</Alert>}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 2 }}>
          {editId ? (
            <Button
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => {
                const alvo = lista.find((c) => c.id_cargo === editId);
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
        <DialogTitle>Excluir cargo</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2">
            Excluir o cargo <strong>{excluirAlvo?.nome}</strong>? Usuários e chamados vinculados impedem a exclusão.
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
          <Button color="error" variant="contained" onClick={() => void confirmarExclusao()} disabled={excluindo}>
            {excluindo ? 'Excluindo...' : 'Excluir'}
          </Button>
        </DialogActions>
      </Dialog>

      <ToastSnackbar />
    </Box>
  );
}
