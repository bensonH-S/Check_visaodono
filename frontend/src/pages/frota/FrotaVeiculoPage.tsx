import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import FrotaVeiculoControleCard from '../../components/frota/FrotaVeiculoControleCard';
import { api } from '../../api/client';
import type { FrotaVeiculo } from '../../api/client';
import { extensaoMidia } from '../../utils/mediaFile';
import { selectMenuScrollProps } from '../../utils/selectMenuScroll';
import { filtrarKmAoDigitar, kmInputParaNumero, labelFixo, ph, rotuloVeiculoLista } from '../../constants/frotaVeiculo';

const MAX_FOTOS_VEICULO = 6;

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function FrotaVeiculoPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [veiculos, setVeiculos] = useState<FrotaVeiculo[]>([]);
  const [meuVeiculo, setMeuVeiculo] = useState<FrotaVeiculo | null>(null);
  const [idVeiculoAssumir, setIdVeiculoAssumir] = useState<number | ''>('');
  const [kmAssumir, setKmAssumir] = useState('');
  const [fotoCnh, setFotoCnh] = useState<string[]>([]);
  const [fotosVeiculo, setFotosVeiculo] = useState<string[]>([]);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [salvando, setSalvando] = useState(false);

  const dadosPreenchidos = Boolean(idVeiculoAssumir && kmInputParaNumero(kmAssumir) != null);
  const cnhPreenchida = fotoCnh.length > 0;
  const fotosVeiculoOk = fotosVeiculo.length > 0;
  const podeAssumir = dadosPreenchidos && cnhPreenchida && fotosVeiculoOk;

  const etapaAtiva = !dadosPreenchidos ? 0 : !cnhPreenchida ? 1 : !fotosVeiculoOk ? 2 : 3;

  async function carregar() {
    setLoading(true);
    try {
      const [lista, resumo] = await Promise.all([api.frotaVeiculos(), api.frotaResumo()]);
      setVeiculos(lista);
      setMeuVeiculo(resumo.veiculo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  function limparFotosAoAlterarDados() {
    setFotoCnh([]);
    setFotosVeiculo([]);
  }

  function aoMudarVeiculo(valor: number | '') {
    setIdVeiculoAssumir(valor);
    limparFotosAoAlterarDados();
  }

  function aoMudarKm(valor: string) {
    setKmAssumir(filtrarKmAoDigitar(valor));
    limparFotosAoAlterarDados();
  }

  function aoMudarCnh(fotos: string[]) {
    setFotoCnh(fotos);
    if (!fotos.length) setFotosVeiculo([]);
  }

  async function desassumir() {
    if (!meuVeiculo) return;
    setSalvando(true);
    setErro('');
    setOk('');
    try {
      await api.frotaDesassumirVeiculo();
      setMeuVeiculo(null);
      setIdVeiculoAssumir('');
      setKmAssumir('');
      setFotoCnh([]);
      setFotosVeiculo([]);
      setOk('Veículo liberado com sucesso.');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao desassumir');
    } finally {
      setSalvando(false);
    }
  }

  async function assumir() {
    if (!podeAssumir) return;
    const km = kmInputParaNumero(kmAssumir);
    if (km == null) {
      setErro('Informe a quilometragem atual');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const fd = new FormData();
      fd.append('id_veiculo', String(idVeiculoAssumir));
      fd.append('km_atual', String(km));
      const cnhBlob = dataUrlToBlob(fotoCnh[0]);
      fd.append('cnh', cnhBlob, `cnh${extensaoMidia(cnhBlob)}`);
      fotosVeiculo.forEach((foto, i) => {
        const blob = dataUrlToBlob(foto);
        fd.append('fotos_veiculo', blob, `veiculo_${i + 1}${extensaoMidia(blob)}`);
      });
      const r = await api.frotaAssumirVeiculo(fd);
      setMeuVeiculo(r.veiculo);
      setIdVeiculoAssumir('');
      setKmAssumir('');
      setFotoCnh([]);
      setFotosVeiculo([]);
      setOk('Controle do veículo assumido hoje.');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao assumir');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) return <LinearProgress sx={{ mt: 1 }} />;

  return (
    <Box sx={{ px: 2, py: 1, pb: 4 }}>
      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro('')}>
          {erro}
        </Alert>
      )}
      {ok && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setOk('')}>
          {ok}
        </Alert>
      )}

      {meuVeiculo ? (
        <FrotaVeiculoControleCard
          veiculo={meuVeiculo}
          salvando={salvando}
          onDesassumir={() => void desassumir()}
        />
      ) : (
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Assumir controle do carro
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Preencha cada etapa na ordem: veículo e KM, foto da CNH e fotos do veículo.
          </Typography>

          <Stepper activeStep={etapaAtiva} alternativeLabel sx={{ mb: 3 }}>
            <Step>
              <StepLabel>Veículo e KM</StepLabel>
            </Step>
            <Step>
              <StepLabel>CNH</StepLabel>
            </Step>
            <Step>
              <StepLabel>Fotos do carro</StepLabel>
            </Step>
            <Step>
              <StepLabel>Confirmar</StepLabel>
            </Step>
          </Stepper>

          <TextField
            select
            fullWidth
            label="Veículo"
            value={idVeiculoAssumir}
            onChange={(e) => aoMudarVeiculo(Number(e.target.value) || '')}
            sx={{ mb: 2 }}
            slotProps={{
              inputLabel: labelFixo.inputLabel,
              select: {
                displayEmpty: true,
                renderValue: (selected: unknown) => {
                  if (!selected) {
                    return (
                      <Box component="span" sx={{ color: 'text.disabled' }}>
                        {ph.veiculo}
                      </Box>
                    );
                  }
                  const v = veiculos.find((item) => item.id_veiculo === Number(selected));
                  return v ? rotuloVeiculoLista(v) : String(selected);
                },
                ...selectMenuScrollProps,
              },
            }}
          >
            {veiculos.map((v) => (
              <MenuItem key={v.id_veiculo} value={v.id_veiculo}>
                {rotuloVeiculoLista(v)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            label="Quilometragem atual"
            value={kmAssumir}
            onChange={(e) => aoMudarKm(e.target.value)}
            inputMode="numeric"
            required
            placeholder={ph.km}
            sx={{ mb: 2 }}
            slotProps={{ inputLabel: labelFixo.inputLabel }}
          />

          {dadosPreenchidos && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Foto da CNH
              </Typography>
              <PhotoCaptureMulti fotos={fotoCnh} onChange={aoMudarCnh} max={1} inlineActions />
            </Box>
          )}

          {dadosPreenchidos && cnhPreenchida && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Fotos do veículo
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Envie de 1 a {MAX_FOTOS_VEICULO} fotos do carro.
              </Typography>
              <PhotoCaptureMulti
                fotos={fotosVeiculo}
                onChange={setFotosVeiculo}
                max={MAX_FOTOS_VEICULO}
                inlineActions
                thumbColumns={3}
              />
            </Box>
          )}

          <Button
            fullWidth
            variant="contained"
            onClick={() => void assumir()}
            disabled={salvando || !podeAssumir}
            sx={{ mt: 1, minHeight: 48 }}
          >
            {salvando ? 'Registrando…' : 'Assumir controle hoje'}
          </Button>

          {!podeAssumir && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
              {!dadosPreenchidos
                ? 'Selecione o veículo e informe a quilometragem para continuar.'
                : !cnhPreenchida
                  ? 'Tire a foto da CNH para liberar as fotos do veículo.'
                  : 'Adicione ao menos uma foto do veículo para assumir.'}
            </Typography>
          )}
        </Paper>
      )}

      <Button fullWidth sx={{ mt: 2 }} onClick={() => navigate('/frota/mobile')}>
        Voltar ao início da frota
      </Button>
    </Box>
  );
}
