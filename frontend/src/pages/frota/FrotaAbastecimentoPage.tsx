import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import { api } from '../../api/client';
import { extensaoMidia } from '../../utils/mediaFile';

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function FrotaAbastecimentoPage() {
  const navigate = useNavigate();
  const [km, setKm] = useState('');
  const [valor, setValor] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setOk('');
    if (!fotos.length) {
      setErro('Tire a foto do comprovante de abastecimento');
      return;
    }
    setSalvando(true);
    try {
      const fd = new FormData();
      fd.append('km_atual', km.replace(/\D/g, ''));
      fd.append('valor_abastecido', valor.replace(',', '.'));
      const blob = dataUrlToBlob(fotos[0]);
      fd.append('comprovante', blob, `comprovante${extensaoMidia(blob)}`);
      await api.frotaEnviarAbastecimento(fd);
      setOk('Abastecimento registrado!');
      setTimeout(() => navigate('/frota/mobile', { replace: true }), 1200);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Box component="form" onSubmit={salvar} sx={{ px: 2, py: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Registre o abastecimento do veículo sob seu controle.
      </Typography>
      {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}
      {ok && <Alert severity="success" sx={{ mb: 2 }}>{ok}</Alert>}
      <TextField
        fullWidth
        label="KM atual"
        value={km}
        onChange={(e) => setKm(e.target.value.replace(/[^\d]/g, ''))}
        inputMode="numeric"
        required
        sx={{ mb: 2 }}
      />
      <TextField
        fullWidth
        label="Valor abastecido (R$)"
        value={valor}
        onChange={(e) => setValor(e.target.value.replace(/[^\d,.]/g, ''))}
        inputMode="decimal"
        required
        sx={{ mb: 2 }}
      />
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        Foto do comprovante
      </Typography>
      <PhotoCaptureMulti fotos={fotos} onChange={setFotos} max={1} />
      <Button fullWidth type="submit" variant="contained" size="large" disabled={salvando} sx={{ mt: 3, minHeight: 48 }}>
        {salvando ? 'Salvando…' : 'Registrar abastecimento'}
      </Button>
    </Box>
  );
}
