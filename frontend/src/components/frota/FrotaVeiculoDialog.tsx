import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { api, type FrotaVeiculo } from '../../api/client';
import FrotaVeiculoFormFields from './FrotaVeiculoFormFields';
import FrotaVeiculoDocumentosPanel, { FROTA_DOC_FORM_ID } from './FrotaVeiculoDocumentosPanel';
import FrotaVeiculoKmPanel from './FrotaVeiculoKmPanel';
import FrotaVeiculoAbasEdicao from './FrotaVeiculoAbasEdicao';
import { periodoSemanaAtualKm } from './FrotaVeiculosKmSemanaPanel';
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
  const [kmDataInicio, setKmDataInicio] = useState('');
  const [kmDataFim, setKmDataFim] = useState('');

  useEffect(() => {
    if (!open) {
      setPodeAnexarDoc(false);
      setConfirmExcluir(false);
      setKmDataInicio('');
      setKmDataFim('');
      return;
    }
    const semana = periodoSemanaAtualKm();
    setKmDataInicio(semana.inicio);
    setKmDataFim(semana.fim);
    setAba(0);
    if (veiculo) {
      void api
        .frotaVeiculo(veiculo.id_veiculo)
        .then((atualizado) => setForm(veiculoParaForm(atualizado)))
        .catch(() => setForm(veiculoParaForm(veiculo)));
    } else {
      setForm(formVeiculoVazio());
    }
  }, [open, veiculo]);

  async function salvarDados() {
    if (!form.placa.trim()) {
      showToast('Informe a placa', 'warning');
      if (editando && aba !== 0) setAba(0);
      return;
    }
    setSalvando(true);
    const body = formParaBody(form, { omitirRegiao: true });
    try {
      if (editando && veiculo) {
        await api.frotaAtualizarVeiculo(veiculo.id_veiculo, body);
        showToast('Veículo atualizado com sucesso!');
        onSalvo();
        onClose();
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
      <Dialog open={open} onClose={fechar} fullWidth maxWidth="md" scroll="paper">
        <DialogTitle sx={{ pb: editando ? 0 : 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TituloIcon sx={{ color: colors.navy, fontSize: 22 }} />
          {titulo}
        </DialogTitle>

        {editando && veiculo && (
          <FrotaVeiculoAbasEdicao
            aba={aba}
            onChangeAba={setAba}
            kmDataInicio={kmDataInicio}
            kmDataFim={kmDataFim}
            onChangeKmInicio={setKmDataInicio}
            onChangeKmFim={setKmDataFim}
          />
        )}

        <DialogContent dividers sx={{ pt: 2 }}>
          {(!editando || (editando && veiculo)) && (
            <Box sx={{ display: !editando || aba === 0 ? 'block' : 'none' }}>
              <FrotaVeiculoFormFields
                form={form}
                onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
              />
            </Box>
          )}

          {editando && veiculo && (
            <Box sx={{ display: aba === 1 ? 'block' : 'none' }}>
              <FrotaVeiculoKmPanel
                idVeiculo={veiculo.id_veiculo}
                emDialogo
                ocultarFiltro
                dataInicio={kmDataInicio}
                dataFim={kmDataFim}
                onChangeInicio={setKmDataInicio}
                onChangeFim={setKmDataFim}
              />
            </Box>
          )}

          {editando && veiculo && (
            <Box sx={{ display: aba === 2 ? 'block' : 'none' }}>
              <FrotaVeiculoDocumentosPanel
                idVeiculo={veiculo.id_veiculo}
                anexarNoRodape
                onSalvandoChange={setSalvandoDoc}
                onPodeAnexarChange={setPodeAnexarDoc}
              />
            </Box>
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
          {editando && aba === 2 ? (
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
