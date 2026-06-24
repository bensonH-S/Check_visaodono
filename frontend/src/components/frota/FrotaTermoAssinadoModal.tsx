import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import CloseIcon from '@mui/icons-material/Close';
import { api, fetchMediaAutenticada, type FrotaTermoPortalDetalhe } from '../../api/client';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import { colors } from '../../theme/tokens';

function mediaUrlCompleta(mediaUrl: string) {
  return mediaUrl.startsWith('http') ? mediaUrl : `${window.location.origin}${mediaUrl}`;
}

function useMidiaUrl(mediaUrl: string | null | undefined) {
  const [src, setSrc] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!mediaUrl) {
      setSrc(null);
      setErro(false);
      return;
    }
    let url: string | null = null;
    let ativo = true;
    setSrc(null);
    setErro(false);
    fetchMediaAutenticada(mediaUrlCompleta(mediaUrl))
      .then((u) => {
        if (ativo) {
          url = u;
          setSrc(u);
        }
      })
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [mediaUrl]);

  return { src, erro };
}

function MidiaImagem({ url, alt }: { url: string; alt: string }) {
  const { src, erro } = useMidiaUrl(url);
  if (erro) return <Alert severity="error">Não foi possível carregar a imagem.</Alert>;
  if (!src) {
    return (
      <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }
  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      sx={{
        width: '100%',
        maxHeight: 220,
        objectFit: 'contain',
        borderRadius: 1,
        border: '1px solid',
        borderColor: colors.border,
        bgcolor: '#fafafa',
      }}
    />
  );
}

type Props = {
  idTermo: number | null;
  open: boolean;
  onClose: () => void;
};

export default function FrotaTermoAssinadoModal({ idTermo, open, onClose }: Props) {
  const [termo, setTermo] = useState<FrotaTermoPortalDetalhe | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!open || idTermo == null) {
      setTermo(null);
      setErro('');
      return;
    }
    let ativo = true;
    setLoading(true);
    setErro('');
    api
      .frotaTermoPortal(idTermo)
      .then((t) => ativo && setTermo(t))
      .catch((e) => ativo && setErro(e instanceof Error ? e.message : 'Erro ao carregar termo'))
      .finally(() => ativo && setLoading(false));
    return () => {
      ativo = false;
    };
  }, [open, idTermo]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          fontWeight: 700,
          color: colors.navy,
          pr: 1,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography component="span" variant="subtitle1" sx={{ fontWeight: 700, display: 'block' }}>
            Termo de ferramentas
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {termo
              ? `${termo.nome_usuario} · v${termo.termo_versao} · ${formatDataHoraBrasilia(termo.assinado_em)}`
              : 'Carregando…'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Fechar">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading && (
          <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        )}
        {erro && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {erro}
          </Alert>
        )}
        {termo && !loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {termo.empresa.razaoSocial} · CNPJ {termo.empresa.cnpj}
            </Typography>
            <Typography
              variant="body2"
              sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.55, color: 'text.primary' }}
            >
              {termo.texto}
            </Typography>

            <Divider />

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Assinatura digital
              </Typography>
              <MidiaImagem url={termo.assinatura_url} alt={`Assinatura de ${termo.nome_usuario}`} />
            </Box>

            {termo.fotos.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Fotos dos equipamentos ({termo.fotos.length})
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: 1,
                  }}
                >
                  {termo.fotos.map((f) => (
                    <MidiaImagem key={f.id_anexo} url={f.url} alt="Equipamento" />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
