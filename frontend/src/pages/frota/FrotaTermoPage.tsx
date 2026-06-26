import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import SignaturePad from '../../components/frota/SignaturePad';
import { api } from '../../api/client';
import type { FrotaTermoInfo } from '../../api/client';
import { getUsuario, podeAssinarTermoFerramentasMobile } from '../../lib/auth';
import { extensaoMidia } from '../../utils/mediaFile';

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/png';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function FrotaTermoPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [termo, setTermo] = useState<FrotaTermoInfo | null>(null);
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [fotos, setFotos] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!podeAssinarTermoFerramentasMobile(getUsuario())) {
      navigate('/frota/mobile', { replace: true });
      return;
    }
    api
      .frotaTermo()
      .then(setTermo)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [navigate]);

  async function assinar(e: React.FormEvent) {
    e.preventDefault();
    if (!termo || termo.assinado) return;
    if (!assinatura) {
      setErro('Assine digitalmente o termo');
      return;
    }
    if (!fotos.length) {
      setErro('Fotografe os equipamentos/ferramentas');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const fd = new FormData();
      fd.append('assinatura', dataUrlToBlob(assinatura), 'assinatura.png');
      fotos.forEach((f, i) => {
        const blob = dataUrlToBlob(f);
        fd.append('fotos', blob, `equipamento_${i + 1}${extensaoMidia(blob)}`);
      });
      await api.frotaEnviarTermo(fd);
      navigate('/frota/mobile', { replace: true });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao assinar');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) return <LinearProgress sx={{ mt: 1 }} />;

  if (termo?.assinado) {
    return (
      <Box sx={{ px: 2, py: 2 }}>
        <Alert severity="success">
          Termo v{termo.versao} já assinado
          {termo.assinado_em ? ` em ${new Date(termo.assinado_em).toLocaleString('pt-BR')}` : ''}.
        </Alert>
        <Button fullWidth sx={{ mt: 2 }} onClick={() => navigate('/frota/mobile')}>
          Voltar
        </Button>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={assinar} sx={{ px: 2, py: 1, pb: 4 }}>
      {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}
      <Paper sx={{ p: 2, mb: 2, maxHeight: 220, overflowY: 'auto', bgcolor: '#fafafa' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {termo?.empresa.razaoSocial} · CNPJ {termo?.empresa.cnpj}
        </Typography>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', lineHeight: 1.5 }}>
          {termo?.texto}
        </Typography>
      </Paper>
      <SignaturePad onChange={setAssinatura} />
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 2, mb: 1 }}>
        Fotos dos equipamentos
      </Typography>
      <PhotoCaptureMulti fotos={fotos} onChange={setFotos} max={8} inlineActions />
      <Button
        fullWidth
        type="submit"
        variant="contained"
        size="large"
        disabled={salvando}
        sx={{ mt: 3, minHeight: 48 }}
      >
        {salvando ? 'Registrando…' : 'Assinar termo digitalmente'}
      </Button>
    </Box>
  );
}
