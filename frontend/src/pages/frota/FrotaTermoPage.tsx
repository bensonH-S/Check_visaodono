import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import SignaturePad from '../../components/frota/SignaturePad';
import FrotaMobileShell from '../../components/frota/FrotaMobileShell';
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
      setErro('Assine o termo antes de confirmar');
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

  if (loading) {
    return (
      <FrotaMobileShell
        titleLine1="Termo"
        titleLine2="ferramentas"
        sub="Carregando…"
        variant="page"
        onBack={() => navigate('/frota/mobile')}
      >
        <LinearProgress />
      </FrotaMobileShell>
    );
  }

  if (termo?.assinado) {
    return (
      <FrotaMobileShell
        titleLine1="Termo"
        titleLine2="ferramentas"
        sub="Assinatura já registrada"
        variant="page"
        onBack={() => navigate('/frota/mobile')}
        metrics={[{ value: `v${termo.versao}`, label: 'versão', accent: true }]}
      >
        <Alert severity="success" sx={{ mb: 2 }}>
          Termo v{termo.versao} já assinado
          {termo.assinado_em ? ` em ${new Date(termo.assinado_em).toLocaleString('pt-BR')}` : ''}.
        </Alert>
        <Button fullWidth className="ck-frota__cta" onClick={() => navigate('/frota/mobile')}>
          Voltar à frota
        </Button>
      </FrotaMobileShell>
    );
  }

  return (
    <FrotaMobileShell
      titleLine1="Termo"
      titleLine2="ferramentas"
      sub="Leia com atenção, assine e anexe fotos dos equipamentos se precisar."
      variant="page"
      onBack={() => navigate('/frota/mobile')}
      metrics={[
        { value: termo ? `v${termo.versao}` : '—', label: 'versão' },
        { value: fotos.length, label: 'fotos' },
        { value: assinatura ? 'OK' : '—', label: 'assinatura', accent: Boolean(assinatura) },
      ]}
    >
      <form onSubmit={assinar}>
        {erro && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {erro}
          </Alert>
        )}

        <Typography
          variant="caption"
          sx={{ display: 'block', mb: 1.25, fontSize: '0.72rem', color: 'text.secondary' }}
        >
          Leia o termo abaixo com atenção
          <span style={{ color: '#DC2626', fontWeight: 700 }}>*</span>
        </Typography>

        <div className="ck-frota__termo-box">
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {termo?.empresa.razaoSocial} · CNPJ {termo?.empresa.cnpj}
          </Typography>
          {termo?.texto}
        </div>

        <SignaturePad onChange={setAssinatura} />

        <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 2, mb: 1, color: '#142048' }}>
          Fotos dos equipamentos{' '}
          <Typography component="span" variant="caption" color="text.secondary">
            (opcional)
          </Typography>
        </Typography>
        <PhotoCaptureMulti fotos={fotos} onChange={setFotos} max={8} inlineActions />

        <Button
          fullWidth
          type="submit"
          variant="contained"
          size="large"
          disabled={salvando || !assinatura}
          className="ck-frota__cta"
          sx={{ mt: 3 }}
        >
          {salvando ? 'Registrando…' : 'Assinar termo'}
        </Button>
      </form>
    </FrotaMobileShell>
  );
}
