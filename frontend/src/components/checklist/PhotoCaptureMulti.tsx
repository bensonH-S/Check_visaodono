import { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import DeleteIcon from '@mui/icons-material/Delete';
import { compressImage } from '../../utils/compressImage';
import { urlFoto } from '../../utils/checklistRules';

interface Props {
  fotos: string[];
  onChange: (fotos: string[]) => void;
  max?: number;
  disabled?: boolean;
}

export default function PhotoCaptureMulti({ fotos, onChange, max = 5, disabled }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const podeMais = fotos.length < max;

  const processar = async (file: File | undefined) => {
    if (!file || disabled || !podeMais) return;
    setErro('');
    setLoading(true);
    try {
      const dataUrl = await compressImage(file, 1024, 0.72);
      onChange([...fotos, dataUrl]);
    } catch {
      setErro('Não foi possível processar a foto.');
    } finally {
      setLoading(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
    }
  };

  const remover = (idx: number) => onChange(fotos.filter((_, i) => i !== idx));

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        Fotos opcionais ({fotos.length}/{max}) — anexe quantas precisar
      </Typography>

      {fotos.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
          {fotos.map((src, idx) => (
            <Box
              key={idx}
              sx={{
                position: 'relative',
                borderRadius: 2,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: '#000',
              }}
            >
              <Box
                component="img"
                src={urlFoto(src)}
                alt={`Evidência ${idx + 1}`}
                sx={{ width: '100%', maxHeight: 200, objectFit: 'contain', display: 'block' }}
              />
              <Typography
                variant="caption"
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  bgcolor: 'rgba(0,0,0,0.6)',
                  color: 'white',
                  px: 1,
                  borderRadius: 1,
                }}
              >
                {idx + 1}/{fotos.length}
              </Typography>
              {!disabled && (
                <IconButton
                  onClick={() => remover(idx)}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: 'rgba(0,0,0,0.55)',
                    color: 'white',
                  }}
                  aria-label="Remover foto"
                >
                  <DeleteIcon />
                </IconButton>
              )}
            </Box>
          ))}
        </Box>
      )}

      {loading ? (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        podeMais &&
        !disabled && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<CameraAltIcon />}
              onClick={() => cameraRef.current?.click()}
              sx={{ minHeight: 52 }}
            >
              Tirar foto
            </Button>
            <Button
              fullWidth
              variant="outlined"
              size="large"
              startIcon={<PhotoLibraryIcon />}
              onClick={() => galleryRef.current?.click()}
              sx={{ minHeight: 48 }}
            >
              Galeria
            </Button>
          </Box>
        )
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
        accept="image/*"
        hidden
        onChange={(e) => processar(e.target.files?.[0])}
      />
    </Box>
  );
}
