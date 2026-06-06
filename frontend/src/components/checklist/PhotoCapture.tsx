import { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { compressImage } from '../../utils/compressImage';
import { fileToDataUrl } from '../../utils/mediaFile';

interface Props {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  disabled?: boolean;
  obrigatoria?: boolean;
}

export default function PhotoCapture({ value, onChange, disabled, obrigatoria }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const processar = async (file: File | undefined) => {
    if (!file || disabled) return;
    setErro('');
    setLoading(true);
    try {
      const dataUrl = file.type.startsWith('video/')
        ? await fileToDataUrl(file)
        : await compressImage(file);
      onChange(dataUrl);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível processar o arquivo.');
    } finally {
      setLoading(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
    }
  };

  if (value) {
    return (
      <Box sx={{ width: '100%' }}>
        <Box
          sx={{
            position: 'relative',
            borderRadius: 2,
            overflow: 'hidden',
            border: '2px solid',
            borderColor: 'success.main',
            bgcolor: '#000',
          }}
        >
          <Box
            component="img"
            src={value}
            alt="Evidência"
            sx={{ width: '100%', maxHeight: 280, objectFit: 'contain', display: 'block' }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              bgcolor: 'rgba(59,109,17,0.92)',
              color: 'white',
              px: 1,
              py: 0.25,
              borderRadius: 1,
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              Foto anexada
            </Typography>
          </Box>
          {!disabled && (
            <IconButton
              onClick={() => onChange(undefined)}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                bgcolor: 'rgba(0,0,0,0.55)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(163,45,45,0.9)' },
              }}
              aria-label="Remover foto"
            >
              <DeleteIcon />
            </IconButton>
          )}
        </Box>
        {!disabled && (
          <Button
            fullWidth
            variant="outlined"
            size="large"
            startIcon={<CameraAltIcon />}
            onClick={() => cameraRef.current?.click()}
            sx={{ mt: 1.5, minHeight: 48 }}
          >
            Tirar outra foto
          </Button>
        )}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => processar(e.target.files?.[0])}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {loading ? (
        <Box
          sx={{
            py: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <CircularProgress size={36} />
          <Typography variant="body2" color="text.secondary">
            Processando foto…
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Button
            fullWidth
            variant="contained"
            size="large"
            disabled={disabled}
            startIcon={<CameraAltIcon />}
            onClick={() => cameraRef.current?.click()}
            sx={{ minHeight: 56, fontSize: '1rem', fontWeight: 600 }}
          >
            Tirar foto
          </Button>
          <Button
            fullWidth
            variant="outlined"
            size="large"
            disabled={disabled}
            startIcon={<PhotoLibraryIcon />}
            onClick={() => galleryRef.current?.click()}
            sx={{ minHeight: 48 }}
          >
            Escolher da galeria
          </Button>
          {obrigatoria && (
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block' }}>
              Foto obrigatória para esta pergunta
            </Typography>
          )}
        </Box>
      )}
      {erro && (
        <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
          {erro}
        </Typography>
      )}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => processar(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(e) => processar(e.target.files?.[0])}
      />
    </Box>
  );
}
