import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { fetchMediaAutenticada, type FrotaDocumento } from '../../api/client';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import { colors } from '../../theme/tokens';
import { useAppTheme } from '../../context/ThemeContext';

type TipoMidia = 'imagem' | 'pdf' | 'arquivo';

function tipoMidia(mime?: string | null): TipoMidia {
  if (!mime) return 'arquivo';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'imagem';
  return 'arquivo';
}

function labelTipoMidia(tipo: TipoMidia) {
  if (tipo === 'pdf') return 'PDF';
  if (tipo === 'imagem') return 'Imagem';
  return 'Arquivo';
}

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

type ModalProps = {
  documento: FrotaDocumento | null;
  open: boolean;
  onClose: () => void;
};

function nomeArquivoDocumento(d: FrotaDocumento) {
  const nome = d.nome_arquivo?.trim();
  const generico = !nome || /^doc\.[a-z0-9]+$/i.test(nome);
  if (nome && !generico) return nome;
  return d.titulo?.trim() || nome || 'Documento';
}

export function FrotaDocumentoModal({ documento, open, onClose }: ModalProps) {
  const { mode } = useAppTheme();
  const acento = mode === 'dark' ? '#E8520A' : colors.navy;
  const tipo = tipoMidia(documento?.tipo_mime);
  const { src, erro } = useMidiaUrl(open ? documento?.media_url : null);

  return (
    <Dialog open={open} onClose={onClose} maxWidth={tipo === 'pdf' ? 'lg' : 'md'} fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          fontWeight: 700,
          color: acento,
          pr: 1,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography component="span" variant="subtitle1" sx={{ fontWeight: 700, display: 'block' }}>
            {documento ? nomeArquivoDocumento(documento) : 'Documento'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {labelTipoMidia(tipo)}
            {documento?.created_at && ` · ${formatDataHoraBrasilia(documento.created_at)}`}
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Fechar">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {!documento?.media_url && (
          <Alert severity="info" sx={{ width: '100%' }}>
            Este documento não possui arquivo anexado.
          </Alert>
        )}

        {documento?.media_url && erro && (
          <Alert severity="error" sx={{ width: '100%' }}>
            Não foi possível carregar o documento.
          </Alert>
        )}

        {documento?.media_url && !erro && !src && (
          <Box sx={{ py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {documento?.media_url && !erro && src && tipo === 'imagem' && (
          <Box
            component="img"
            src={src}
            alt={documento.titulo}
            sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 1 }}
          />
        )}

        {documento?.media_url && !erro && src && tipo === 'pdf' && (
          <Box
            component="iframe"
            src={src}
            title={documento.titulo}
            sx={{
              width: '100%',
              height: { xs: '60vh', sm: '72vh' },
              border: 'none',
              borderRadius: 1,
              bgcolor: '#f3f4f6',
            }}
          />
        )}

        {documento?.media_url && !erro && src && tipo === 'arquivo' && (
          <Box sx={{ width: '100%', textAlign: 'center', py: 2 }}>
            <InsertDriveFileIcon sx={{ fontSize: 64, color: acento, mb: 2 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Arquivo anexado ao veículo
            </Typography>
            <Button component="a" href={src} target="_blank" rel="noopener noreferrer" variant="contained" download>
              Baixar arquivo
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function FrotaDocumentoMiniatura({
  documento,
  onClick,
}: {
  documento: FrotaDocumento;
  onClick: () => void;
}) {
  const tipo = tipoMidia(documento.tipo_mime);
  const { src, erro } = useMidiaUrl(documento.media_url);

  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      sx={{
        width: 72,
        height: 72,
        flexShrink: 0,
        borderRadius: 1,
        overflow: 'hidden',
        border: '1px solid rgba(27, 42, 107, 0.15)',
        bgcolor: '#f3f4f6',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'box-shadow 0.15s, transform 0.15s',
        '&:hover': {
          boxShadow: '0 4px 14px rgba(27, 42, 107, 0.18)',
          transform: 'scale(1.04)',
        },
      }}
    >
      {erro && <Typography variant="caption" color="error">Erro</Typography>}
      {!erro && !src && <CircularProgress size={22} />}
      {!erro && src && tipo === 'imagem' && (
        <Box component="img" src={src} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {!erro && src && tipo === 'pdf' && <PictureAsPdfIcon sx={{ fontSize: 32, color: '#DC2626' }} />}
      {!erro && src && tipo === 'arquivo' && <InsertDriveFileIcon sx={{ fontSize: 32, color: 'primary.main' }} />}
    </Box>
  );
}
