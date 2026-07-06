import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import { api } from '../../api/client';
import type { NcDetalhe } from '../../api/client';
import { parseNcDescricao } from '../../components/nc/ncPageUtils';
import { podeResolverNc } from '../../lib/auth';
import { extensaoMidia } from '../../utils/mediaFile';
import { showToast } from '../../utils/toast';
import { safeAreaBottomCalc } from '../../theme/safeArea';

const NAVY = '#1B2A6B';
const ORANGE = '#E8520A';

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function NcMobileResolverPage() {
  const { idNc } = useParams();
  const navigate = useNavigate();
  const [nc, setNc] = useState<NcDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [observacao, setObservacao] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const podeResolver = podeResolverNc();

  useEffect(() => {
    if (!idNc) return;
    api
      .ncDetalhe(Number(idNc))
      .then(setNc)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [idNc]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!nc || !podeResolver) return;
    const texto = observacao.trim();
    if (texto.length < 10) {
      setErr('Descreva o que foi feito (mínimo 10 caracteres).');
      return;
    }
    if (!fotos.length) {
      setErr('Tire pelo menos uma foto da correção.');
      return;
    }

    setSalvando(true);
    setErr('');
    try {
      const fd = new FormData();
      fd.append('observacao_resolucao', texto);
      fotos.forEach((dataUrl, i) => {
        const blob = dataUrlToBlob(dataUrl);
        fd.append('fotos', blob, `correcao-${i}${extensaoMidia(blob)}`);
      });
      await api.ncResolver(nc.id_nc, fd);
      setConcluido(true);
      showToast('Não conformidade encerrada.', 'success');
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Erro ao encerrar');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) return <LinearProgress />;
  if (err && !nc) return <Typography color="error">{err}</Typography>;
  if (!nc) return <Typography color="error">NC não encontrada</Typography>;

  const { codigo, texto, obs } = parseNcDescricao(nc.descricao);

  if (concluido || nc.status === 'Resolvida') {
    return (
      <Box sx={{ maxWidth: 480, mx: 'auto', textAlign: 'center', py: 4 }}>
        <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          NC encerrada
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {nc.nome_loja || nc.name}
        </Typography>
        <Button variant="contained" onClick={() => navigate('/nc/mobile', { replace: true })}>
          Voltar à lista
        </Button>
      </Box>
    );
  }

  return (
    <Box
      component="form"
      onSubmit={enviar}
      sx={{
        maxWidth: 480,
        mx: 'auto',
        width: '100%',
        pb: safeAreaBottomCalc(48),
      }}
    >
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          {nc.area}
          {codigo ? ` · ${codigo}` : ''}
        </Typography>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: NAVY, mt: 0.5, lineHeight: 1.35 }}>
          {nc.area === 'Resultado geral' ? nc.descricao : texto}
        </Typography>
        {obs && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Obs. da visita: {obs}
          </Typography>
        )}
        <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
          <Chip
            label={nc.gravidade}
            size="small"
            color={nc.gravidade === 'Crítica' ? 'error' : 'warning'}
          />
          <Chip label={nc.nome_loja || nc.name} size="small" variant="outlined" />
        </Box>
      </Paper>

      {!podeResolver ? (
        <Alert severity="info">Você pode visualizar, mas não tem permissão para encerrar NCs.</Alert>
      ) : (
        <>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              O que foi feito?
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={4}
              placeholder="Descreva a correção realizada na loja..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              disabled={salvando}
              onFocus={(e) => {
                window.setTimeout(() => {
                  e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }, 350);
              }}
            />
          </Paper>

          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Foto da correção
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              Registre evidência do que foi corrigido.
            </Typography>
            <PhotoCaptureMulti
              fotos={fotos}
              onChange={setFotos}
              max={3}
              inlineActions
              disabled={salvando}
            />
          </Paper>

          {err && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {err}
            </Alert>
          )}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={salvando}
            sx={{ bgcolor: ORANGE, '&:hover': { bgcolor: '#d14a09' }, py: 1.5, fontWeight: 700 }}
          >
            {salvando ? 'Enviando...' : 'Encerrar não conformidade'}
          </Button>
        </>
      )}
    </Box>
  );
}
