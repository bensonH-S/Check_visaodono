import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import { api } from '../../api/client';
import type { FrotaVeiculo } from '../../api/client';
import { extensaoMidia } from '../../utils/mediaFile';
import {
  filtrarKmAoDigitar,
  formatarKmInput,
  kmInputParaNumero,
  labelFixo,
  ph,
  campoAlturaFrotaSx,
} from '../../constants/frotaVeiculo';

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function parseValorReais(texto: string): number | null {
  const limpo = String(texto || '')
    .trim()
    .replace(/\s/g, '')
    .replace(/R\$/gi, '');
  if (!limpo) return null;
  // Aceita 150,90 | 150.90 | 1.150,90
  let normalizado = limpo;
  if (limpo.includes(',') && limpo.includes('.')) {
    normalizado = limpo.replace(/\./g, '').replace(',', '.');
  } else if (limpo.includes(',')) {
    normalizado = limpo.replace(',', '.');
  }
  const n = Number(normalizado);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

export default function FrotaAbastecimentoPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [veiculo, setVeiculo] = useState<FrotaVeiculo | null>(null);
  const [km, setKm] = useState('');
  const [valor, setValor] = useState('');
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
        if (r.veiculo.km_atual != null) {
          setKm(formatarKmInput(String(r.veiculo.km_atual)));
        }
      })
      .catch(() => navigate('/frota/mobile', { replace: true }))
      .finally(() => setLoading(false));
  }, [navigate]);

  const kmNum = kmInputParaNumero(km);
  const valorNum = parseValorReais(valor);
  const temNota = fotos.length > 0;
  const podeSalvar = kmNum != null && valorNum != null && temNota && !salvando;

  const resumoObrigatorio = useMemo(
    () => [
      { ok: kmNum != null, label: 'KM atual' },
      { ok: valorNum != null, label: 'Valor do abastecimento' },
      { ok: temNota, label: 'Nota fiscal / comprovante' },
    ],
    [kmNum, valorNum, temNota],
  );

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setOk('');
    if (kmNum == null) {
      setErro('Informe o KM atual do odômetro');
      return;
    }
    if (valorNum == null) {
      setErro('Informe o valor abastecido (R$)');
      return;
    }
    if (!temNota) {
      setErro('Tire a foto da nota fiscal ou do comprovante de abastecimento');
      return;
    }
    setSalvando(true);
    try {
      const fd = new FormData();
      fd.append('km_atual', String(kmNum));
      fd.append('valor_abastecido', String(valorNum));
      const blob = dataUrlToBlob(fotos[0]);
      fd.append('comprovante', blob, `nota_fiscal${extensaoMidia(blob)}`);
      await api.frotaEnviarAbastecimento(fd);
      setOk('Abastecimento registrado!');
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
        Informe o KM, o valor pago e anexe a foto da nota fiscal / comprovante.
      </Typography>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro('')}>
          {erro}
        </Alert>
      )}
      {ok && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {ok}
        </Alert>
      )}

      {veiculo ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Veículo: <strong>{veiculo.placa}</strong>
          {veiculo.km_atual != null
            ? ` · KM cadastrado ${veiculo.km_atual.toLocaleString('pt-BR')}`
            : ''}
        </Alert>
      ) : (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Nenhum veículo sob seu controle. Peça ao responsável para atribuir pelo portal.
        </Alert>
      )}

      <TextField
        fullWidth
        label="KM atual"
        value={km}
        onChange={(e) => setKm(filtrarKmAoDigitar(e.target.value))}
        inputMode="numeric"
        required
        disabled={!veiculo}
        placeholder={ph.km}
        helperText="Odômetro no momento do abastecimento"
        sx={campoAlturaFrotaSx}
        slotProps={{ inputLabel: labelFixo.inputLabel }}
      />
      <TextField
        fullWidth
        label="Valor do abastecimento (R$)"
        value={valor}
        onChange={(e) => setValor(e.target.value.replace(/[^\d,.]/g, ''))}
        inputMode="decimal"
        required
        disabled={!veiculo}
        placeholder={ph.valor}
        helperText="Valor total pago no posto"
        sx={campoAlturaFrotaSx}
        slotProps={{ inputLabel: labelFixo.inputLabel }}
      />

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        Nota fiscal / comprovante *
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Foto da nota fiscal ou cupom do abastecimento (obrigatório)
      </Typography>
      <PhotoCaptureMulti
        fotos={fotos}
        onChange={setFotos}
        max={1}
        inlineActions
        disabled={!veiculo}
      />

      <Box sx={{ mt: 2, mb: 1 }}>
        {resumoObrigatorio.map((item) => (
          <Typography
            key={item.label}
            variant="caption"
            sx={{
              display: 'block',
              color: item.ok ? 'success.main' : 'text.secondary',
              fontWeight: item.ok ? 600 : 400,
            }}
          >
            {item.ok ? '✓' : '○'} {item.label}
          </Typography>
        ))}
      </Box>

      <Button
        fullWidth
        type="submit"
        variant="contained"
        size="large"
        disabled={!podeSalvar || !veiculo}
        sx={{ mt: 2, minHeight: 48 }}
      >
        {salvando ? 'Salvando…' : 'Registrar abastecimento'}
      </Button>
    </Box>
  );
}
