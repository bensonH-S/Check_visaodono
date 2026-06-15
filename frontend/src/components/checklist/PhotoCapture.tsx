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
import CameraCaptureOverlay from '../CameraCaptureOverlay';
import { compressImage } from '../../utils/compressImage';
import { fileToDataUrl } from '../../utils/mediaFile';

interface Props {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  disabled?: boolean;
  obrigatoria?: boolean;
}

export default function PhotoCapture({ value, onChange, disabled, obrigatoria }: Props) {
  const cameraFallbackRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [cameraAberta, setCameraAberta] = useState(false);

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
      if (cameraFallbackRef.current) cameraFallbackRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
    }
  };

  const abrirCamera = () => {
    if (disabled) return;
    setErro('');
    if (navigator.mediaDevices) {
      setCameraAberta(true);
      return;
    }
    cameraFallbackRef.current?.click();
  };

  const botoesAcao = (variante: 'inicial' | 'trocar') => (
    <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
      <Button
        variant={variante === 'inicial' ? 'contained' : 'outlined'}
        size="small"
        disabled={disabled || loading}
        startIcon={<CameraAltIcon sx={{ fontSize: 18 }} />}
        onClick={abrirCamera}
        sx={{
          flex: 1,
          minHeight: 40,
          fontSize: '0.8rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          px: 1,
        }}
      >
        {variante === 'inicial' ? 'Tirar foto' : 'Tirar outra'}
      </Button>
      <Button
        variant="outlined"
        size="small"
        disabled={disabled || loading}
        startIcon={<PhotoLibraryIcon sx={{ fontSize: 18 }} />}
        onClick={() => galleryRef.current?.click()}
        sx={{
          flex: 1,
          minHeight: 40,
          fontSize: '0.8rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          px: 1,
        }}
      >
        Galeria
      </Button>
    </Box>
  );

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
        {!disabled && <Box sx={{ mt: 1.25 }}>{botoesAcao('trocar')}</Box>}
        <input
          ref={cameraFallbackRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => processar(e.target.files?.[0])}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => processar(e.target.files?.[0])}
        />
        <CameraCaptureOverlay
          open={cameraAberta}
          onClose={() => setCameraAberta(false)}
          onCapture={(file) => void processar(file)}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {loading ? (
        <Box
          sx={{
            py: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <CircularProgress size={32} />
          <Typography variant="body2" color="text.secondary">
            Processando foto…
          </Typography>
        </Box>
      ) : (
        <>
          {botoesAcao('inicial')}
          {obrigatoria && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
              Foto obrigatória para esta pergunta
            </Typography>
          )}
        </>
      )}
      {erro && (
        <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
          {erro}
        </Typography>
      )}
      <input
        ref={cameraFallbackRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => processar(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => processar(e.target.files?.[0])}
      />
      <CameraCaptureOverlay
        open={cameraAberta}
        onClose={() => setCameraAberta(false)}
        onCapture={(file) => void processar(file)}
      />
    </Box>
  );
}
