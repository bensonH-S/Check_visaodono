import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { api, type FrotaVeiculo, type FrotaRegiaoResumo } from '../../api/client';
import FrotaVeiculoFormFields from './FrotaVeiculoFormFields';
import FrotaVeiculoDocumentosPanel, { FROTA_DOC_FORM_ID } from './FrotaVeiculoDocumentosPanel';
import { formParaBody, formVeiculoVazio, veiculoParaForm, type FormVeiculoFrota } from '../../constants/frotaVeiculo';
import { colors } from '../../theme/tokens';
import { showToast } from '../../utils/toast';

type Props = {
  open: boolean;
  veiculo: FrotaVeiculo | null;
  onClose: () => void;
  onSalvo: () => void;
  onExcluido?: () => void;
};

export default function FrotaVeiculoDialog({ open, veiculo, onClose, onSalvo, onExcluido }: Props) {
  const editando = veiculo != null;
  const [aba, setAba] = useState(0);
  const [form, setForm] = useState<FormVeiculoFrota>(formVeiculoVazio());
  const [salvando, setSalvando] = useState(false);
  const [salvandoDoc, setSalvandoDoc] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState(false);
  const [podeAnexarDoc, setPodeAnexarDoc] = useState(false);
  const [regioes, setRegioes] = useState<FrotaRegiaoResumo[]>([]);

  useEffect(() => {
    if (!open) return;
    api.frotaRegioes().then(setRegioes).catch(() => setRegioes([]));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setPodeAnexarDoc(false);
      setConfirmExcluir(false);
      return;
    }
    setAba(0);
    if (veiculo) {
      setForm(veiculoParaForm(veiculo));
    } else {
      setForm(formVeiculoVazio());
    }
  }, [open, veiculo]);

  async function salvarDados() {
    if (!form.placa.trim()) {
      showToast('Informe a placa', 'warning');
      if (editando && aba === 1) setAba(0);
      return;
    }
    setSalvando(true);
    const body = formParaBody(form);
    try {
      if (editando && veiculo) {
        await api.frotaAtualizarVeiculo(veiculo.id_veiculo, body);
        showToast('Veículo atualizado com sucesso!');
        onSalvo();
      } else {
        await api.frotaCriarVeiculo(body);
        showToast('Veículo cadastrado com sucesso!');
        onSalvo();
        onClose();
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao salvar', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    if (!veiculo) return;
    setExcluindo(true);
    try {
      await api.frotaExcluirVeiculo(veiculo.id_veiculo);
      showToast('Veículo excluído com sucesso!');
      setConfirmExcluir(false);
      onExcluido?.();
      onSalvo();
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao excluir veículo', 'error');
    } finally {
      setExcluindo(false);
    }
  }

  function fechar() {
    if (!salvando && !salvandoDoc && !excluindo) onClose();
  }

  const titulo = editando ? 'Editar veículo' : 'Adicionar veículo';
  const TituloIcon = editando ? EditOutlinedIcon : AddIcon;
  const bloqueado = salvando || salvandoDoc || excluindo;

  return (
    <>
      <Dialog open={open} onClose={fechar} fullWidth maxWidth="sm" scroll="paper">
        <DialogTitle sx={{ pb: editando ? 0 : 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TituloIcon sx={{ color: colors.navy, fontSize: 22 }} />
          {titulo}
        </DialogTitle>

        {editando && veiculo && (
          <Box sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={aba} onChange={(_, v) => setAba(v)}>
              <Tab label="Dados do veículo" />
              <Tab label="Documentos" />
            </Tabs>
          </Box>
        )}

        <DialogContent dividers sx={{ pt: 2 }}>
          {(!editando || aba === 0) && (
            <FrotaVeiculoFormFields form={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} regioes={regioes} />
          )}

          {editando && veiculo && aba === 1 && (
            <FrotaVeiculoDocumentosPanel
              idVeiculo={veiculo.id_veiculo}
              ativo={aba === 1}
              anexarNoRodape
              onSalvandoChange={setSalvandoDoc}
              onPodeAnexarChange={setPodeAnexarDoc}
            />
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Button onClick={fechar} disabled={bloqueado}>
              {editando ? 'Fechar' : 'Cancelar'}
            </Button>
            {editando && (
              <Tooltip title="Excluir veículo">
                <span>
                  <IconButton
                    color="error"
                    aria-label="Excluir veículo"
                    onClick={() => setConfirmExcluir(true)}
                    disabled={bloqueado}
                    size="small"
                  >
                    <DeleteOutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Box>
          {editando && aba === 1 ? (
            <Button
              type="submit"
              form={FROTA_DOC_FORM_ID}
              variant="contained"
              disabled={salvandoDoc || !podeAnexarDoc}
            >
              {salvandoDoc ? 'Enviando…' : 'Anexar documento'}
            </Button>
          ) : (
            (!editando || aba === 0) && (
              <Button variant="contained" onClick={() => void salvarDados()} disabled={salvando}>
                {salvando ? 'Salvando…' : 'Salvar'}
              </Button>
            )
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmExcluir}
        onClose={() => !excluindo && setConfirmExcluir(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Excluir veículo</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2">
            Deseja excluir o veículo <strong>{veiculo?.placa}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmExcluir(false)} disabled={excluindo}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteOutlinedIcon />}
            onClick={() => void confirmarExclusao()}
            disabled={excluindo}
          >
            {excluindo ? 'Excluindo…' : 'Excluir'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
