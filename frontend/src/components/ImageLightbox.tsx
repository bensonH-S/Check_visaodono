import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';

type Props = {
  open: boolean;
  src: string | null;
  /** Texto da pergunta / evidência aberta. */
  titulo?: string | null;
  alt?: string;
  onClose: () => void;
};

/** Visualização ampliada — header com a pergunta + fundo semi-transparente. */
export default function ImageLightbox({ open, src, titulo, alt = 'Evidência', onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !src || typeof document === 'undefined') return null;

  return createPortal(
    <Box
      role="dialog"
      aria-modal="true"
      aria-label={titulo?.trim() || alt}
      onClick={onClose}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        width: '100vw',
        height: '100dvh',
        bgcolor: 'rgba(5, 8, 20, 0.42)',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'zoom-out',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
      }}
    >
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          px: 1.5,
          pt: 'max(12px, env(safe-area-inset-top))',
          pb: 1.25,
          bgcolor: 'rgba(8, 12, 28, 0.88)',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          cursor: 'default',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0, pt: 0.5 }}>
          <Typography
            sx={{
              color: 'rgba(255,255,255,0.55)',
              fontSize: '0.65rem',
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              mb: 0.35,
            }}
          >
            Evidência
          </Typography>
          <Typography
            sx={{
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.95rem',
              lineHeight: 1.35,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {titulo?.trim() || alt}
          </Typography>
        </Box>
        <IconButton
          aria-label="Fechar"
          onClick={onClose}
          sx={{
            flexShrink: 0,
            color: '#fff',
            bgcolor: 'rgba(255,255,255,0.12)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
        }}
      >
        <Box
          component="img"
          src={src}
          alt={titulo?.trim() || alt}
          onClick={(e) => e.stopPropagation()}
          sx={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: 1,
            boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
            cursor: 'default',
            bgcolor: 'transparent',
          }}
        />
      </Box>
    </Box>,
    document.body,
  );
}
