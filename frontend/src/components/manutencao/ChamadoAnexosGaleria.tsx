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
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import { fetchMediaAutenticada, type ManutAnexo } from '../../api/client';
import { formatDataHoraBrasilia } from '../../utils/dateBr';

import { colors } from '../../theme/tokens';

const NAVY = colors.textPrimary;

type TipoAnexo = 'imagem' | 'video' | 'pdf' | 'arquivo';

function tipoAnexo(mime: string): TipoAnexo {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'imagem';
  return 'arquivo';
}

function labelTipo(tipo: TipoAnexo) {
  if (tipo === 'pdf') return 'PDF';
  if (tipo === 'video') return 'Vídeo';
  if (tipo === 'imagem') return 'Foto';
  return 'Arquivo';
}

function useAnexoUrl(mediaUrl: string) {
  const [src, setSrc] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let ativo = true;
    setSrc(null);
    setErro(false);
    fetchMediaAutenticada(mediaUrl)
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

export function AnexoQuadrado({
  anexo,
  onClick,
  compact = false,
  mini = false,
  tamanhoFixo,
}: {
  anexo: ManutAnexo;
  onClick: () => void;
  compact?: boolean;
  mini?: boolean;
  tamanhoFixo?: number;
}) {
  const tamanho = tamanhoFixo ?? (mini ? 44 : compact ? 56 : null);
  const tipo = tipoAnexo(anexo.tipo_mime);
  const { src, erro } = useAnexoUrl(anexo.media_url);

  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      sx={{
        aspectRatio: tamanho ? undefined : '1',
        width: tamanho ?? '100%',
        height: tamanho ?? undefined,
        flexShrink: tamanho ? 0 : undefined,
        borderRadius: tamanho ? 1.25 : 2,
        overflow: 'hidden',
        border: '1px solid rgba(27, 42, 107, 0.15)',
        bgcolor: '#f3f4f6',
        cursor: 'pointer',
        position: 'relative',
        transition: 'box-shadow 0.15s, transform 0.15s',
        '&:hover': {
          boxShadow: '0 4px 14px rgba(27, 42, 107, 0.18)',
          transform: tamanho ? 'scale(1.04)' : 'scale(1.02)',
        },
        '&:focus-visible': { outline: `2px solid ${NAVY}`, outlineOffset: 2 },
      }}
    >
      {erro && (
        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1 }}>
          <Typography variant="caption" color="error" sx={{ textAlign: 'center' }}>
            Erro
          </Typography>
        </Box>
      )}

      {!erro && !src && (
        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {!erro && src && tipo === 'imagem' && (
        <Box
          component="img"
          src={src}
          alt={anexo.nome_arquivo || 'Anexo'}
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}

      {!erro && src && tipo === 'video' && (
        <>
          <Box
            component="video"
            src={src}
            muted
            playsInline
            preload="metadata"
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', bgcolor: '#000' }}
          />
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(0,0,0,0.35)',
            }}
          >
            <PlayCircleIcon sx={{ fontSize: mini ? 20 : compact ? 24 : 40, color: '#fff' }} />
          </Box>
        </>
      )}

      {!erro && src && tipo === 'pdf' && (
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            bgcolor: '#FEE2E2',
            p: 1,
          }}
        >
          <PictureAsPdfIcon sx={{ fontSize: mini ? 18 : compact ? 22 : 36, color: '#DC2626' }} />
          {!tamanho && (
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#991B1B', textAlign: 'center', lineHeight: 1.2 }}>
              PDF
            </Typography>
          )}
        </Box>
      )}

      {!erro && src && tipo === 'arquivo' && (
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            bgcolor: '#E5E7EB',
            p: 1,
          }}
        >
          <InsertDriveFileIcon sx={{ fontSize: mini ? 18 : compact ? 22 : 36, color: NAVY }} />
          {!tamanho && (
            <Typography variant="caption" sx={{ fontWeight: 700, color: NAVY, textAlign: 'center', lineHeight: 1.2 }}>
              Arquivo
            </Typography>
          )}
        </Box>
      )}

      {!tamanho && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            px: 0.75,
            py: 0.5,
            bgcolor: 'rgba(0,0,0,0.55)',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.65rem',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {anexo.nome_arquivo || labelTipo(tipo)}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export function AnexoModal({
  anexo,
  open,
  onClose,
}: {
  anexo: ManutAnexo | null;
  open: boolean;
  onClose: () => void;
}) {
  const { src, erro } = useAnexoUrl(anexo?.media_url ?? '');
  const tipo = anexo ? tipoAnexo(anexo.tipo_mime) : 'arquivo';

  return (
    <Dialog open={open} onClose={onClose} maxWidth={tipo === 'pdf' ? 'lg' : 'md'} fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          fontWeight: 700,
          color: colors.textPrimary,
          pr: 1,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography component="span" variant="subtitle1" sx={{ fontWeight: 700, display: 'block' }}>
            {anexo?.nome_arquivo || labelTipo(tipo)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {labelTipo(tipo)}
            {anexo?.created_at && ` · ${formatDataHoraBrasilia(anexo.created_at)}`}
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Fechar">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {erro && <Alert severity="error">Não foi possível carregar este anexo.</Alert>}

        {!erro && !src && (
          <Box sx={{ py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {!erro && src && tipo === 'imagem' && (
          <Box
            component="img"
            src={src}
            alt={anexo?.nome_arquivo || 'Anexo'}
            sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 1 }}
          />
        )}

        {!erro && src && tipo === 'video' && (
          <Box
            component="video"
            src={src}
            controls
            autoPlay
            sx={{ width: '100%', maxHeight: '70vh', borderRadius: 1, bgcolor: '#000' }}
          />
        )}

        {!erro && src && tipo === 'pdf' && (
          <Box
            component="iframe"
            src={src}
            title={anexo?.nome_arquivo || 'PDF'}
            sx={{
              width: '100%',
              height: { xs: '60vh', sm: '72vh' },
              border: 'none',
              borderRadius: 1,
              bgcolor: '#f3f4f6',
            }}
          />
        )}

        {!erro && src && tipo === 'arquivo' && (
          <Box sx={{ width: '100%', textAlign: 'center', py: 2 }}>
            <InsertDriveFileIcon sx={{ fontSize: 64, color: NAVY, mb: 2 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Arquivo anexado ao chamado
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

type Props = {
  anexos: ManutAnexo[];
  emptyText?: string;
  /** Largura/altura fixa das miniaturas (px) */
  tamanhoMiniatura?: number;
};

export default function ChamadoAnexosGaleria({
  anexos,
  emptyText = 'Nenhum anexo enviado neste chamado.',
  tamanhoMiniatura = 64,
}: Props) {
  const [modalAnexo, setModalAnexo] = useState<ManutAnexo | null>(null);

  if (!anexos.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyText}
      </Typography>
    );
  }

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {anexos.map((a) => (
          <AnexoQuadrado
            key={a.id_anexo}
            anexo={a}
            compact
            tamanhoFixo={tamanhoMiniatura}
            onClick={() => setModalAnexo(a)}
          />
        ))}
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 1 }}
      >
        Clique no anexo para ver em tamanho maior.
      </Typography>
      <AnexoModal anexo={modalAnexo} open={modalAnexo != null} onClose={() => setModalAnexo(null)} />
    </>
  );
}
