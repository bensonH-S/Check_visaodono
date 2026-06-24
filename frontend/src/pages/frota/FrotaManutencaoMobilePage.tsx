import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import CampoDataFrota, { dataHojeIso } from '../../components/frota/CampoDataFrota';
import { api } from '../../api/client';
import type { FrotaVeiculo } from '../../api/client';
import { extensaoMidia } from '../../utils/mediaFile';
import { filtrarKmAoDigitar, kmInputParaNumero, labelFixo, ph, campoAlturaFrotaSx } from '../../constants/frotaVeiculo';

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function FrotaManutencaoMobilePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [veiculo, setVeiculo] = useState<FrotaVeiculo | null>(null);
  const [descricao, setDescricao] = useState('');
  const [km, setKm] = useState('');
  const [valor, setValor] = useState('');
  const [dataManutencao, setDataManutencao] = useState(dataHojeIso);
  const [fotos, setFotos] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    api
      .frotaResumo()
      .then((r) => {
        if (!r.veiculo) {
          navigate('/frota/mobile', { replace: true });
          return;
        }
        setVeiculo(r.veiculo);
      })
      .catch((e) => {
        setErro(e instanceof Error ? e.message : 'Erro ao carregar');
        navigate('/frota/mobile', { replace: true });
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!veiculo) {
      setErro('Assuma o controle de um veículo antes de registrar manutenção');
      return;
    }
    if (!descricao.trim()) {
      setErro('Descreva o que foi feito na manutenção');
      return;
    }
    setSalvando(true);
    setErro('');
    setOk('');
    try {
      const fd = new FormData();
      fd.append('descricao', descricao.trim());
      const kmNum = kmInputParaNumero(km);
      if (kmNum != null) fd.append('km', String(kmNum));
      if (valor.trim()) fd.append('valor', valor.replace(',', '.'));
      if (dataManutencao) fd.append('data_manutencao', dataManutencao);
      if (fotos[0]) {
        const blob = dataUrlToBlob(fotos[0]);
        fd.append('comprovante', blob, `fatura${extensaoMidia(blob)}`);
      }
      await api.frotaEnviarManutencaoVeiculo(veiculo.id_veiculo, fd);
      setOk('Manutenção registrada!');
      setDescricao('');
      setKm('');
      setValor('');
      setDataManutencao(dataHojeIso());
      setFotos([]);
      setTimeout(() => navigate('/frota/mobile', { replace: true }), 1200);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) return <LinearProgress sx={{ mt: 1 }} />;

  return (
    <Box component="form" onSubmit={salvar} sx={{ px: 2, py: 1, pb: 4 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Registre serviços realizados no veículo e anexe a fatura ou nota fiscal.
      </Typography>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro('')}>
          {erro}
        </Alert>
      )}
      {ok && <Alert severity="success" sx={{ mb: 2 }}>{ok}</Alert>}

      {!veiculo ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Nenhum veículo sob seu controle. Assuma um veículo na aba Veículo antes de registrar manutenção.
        </Alert>
      ) : (
        <Alert severity="info" sx={{ mb: 2 }}>
          Veículo: <strong>{veiculo.placa}</strong>
        </Alert>
      )}

      <TextField
        fullWidth
        multiline
        minRows={3}
        label="O que foi feito"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        required
        disabled={!veiculo}
        sx={{ mb: 2 }}
        slotProps={{ inputLabel: labelFixo.inputLabel }}
      />
      <TextField
        fullWidth
        label="KM no momento da manutenção"
        value={km}
        onChange={(e) => setKm(filtrarKmAoDigitar(e.target.value))}
        inputMode="numeric"
        placeholder={ph.km}
        disabled={!veiculo}
        sx={campoAlturaFrotaSx}
        slotProps={{ inputLabel: labelFixo.inputLabel }}
      />
      <TextField
        fullWidth
        label="Valor (R$)"
        value={valor}
        onChange={(e) => setValor(e.target.value.replace(/[^\d,.]/g, ''))}
        inputMode="decimal"
        placeholder={ph.valor}
        disabled={!veiculo}
        sx={campoAlturaFrotaSx}
        slotProps={{ inputLabel: labelFixo.inputLabel }}
      />
      <CampoDataFrota
        label="Data da manutenção"
        value={dataManutencao}
        onChange={setDataManutencao}
        disabled={!veiculo}
        sx={campoAlturaFrotaSx}
      />
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        Fatura / nota fiscal
      </Typography>
      <PhotoCaptureMulti fotos={fotos} onChange={setFotos} max={1} inlineActions />
      <Button
        fullWidth
        type="submit"
        variant="contained"
        size="large"
        disabled={salvando || !veiculo}
        sx={{ mt: 3, minHeight: 48 }}
      >
        {salvando ? 'Salvando…' : 'Registrar manutenção'}
      </Button>
    </Box>
  );
}
