import { useEffect, useRef, useState } from 'react';

import Box from '@mui/material/Box';

import Button from '@mui/material/Button';

import IconButton from '@mui/material/IconButton';

import Typography from '@mui/material/Typography';

import CircularProgress from '@mui/material/CircularProgress';

import CameraAltIcon from '@mui/icons-material/CameraAlt';

import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';

import DeleteIcon from '@mui/icons-material/Delete';

import CameraCaptureOverlay from '../CameraCaptureOverlay';

import { fetchMediaBlobAutenticada } from '../../api/client';

import { compressImage } from '../../utils/compressImage';

import { fileToDataUrl, isVideoDataUrl } from '../../utils/mediaFile';

import { urlFoto } from '../../utils/checklistRules';
import { useAppTheme } from '../../context/ThemeContext';



const inputOculto = {

  position: 'absolute' as const,

  width: 1,

  height: 1,

  padding: 0,

  margin: -1,

  overflow: 'hidden',

  clip: 'rect(0,0,0,0)',

  whiteSpace: 'nowrap' as const,

  border: 0,

};



interface Props {

  fotos: string[];

  onChange: (fotos: string[]) => void;

  max?: number;

  disabled?: boolean;

  /** Botões câmera e galeria na mesma linha (mobile) */

  inlineActions?: boolean;

  /** Oculta legenda superior (ex.: chamados mobile) */

  hideCaption?: boolean;

  /** Miniaturas pequenas em grade (ex.: modal de anexos do chamado) */

  compactThumbs?: boolean;

  /** Lado da miniatura em px quando compactThumbs */
  thumbSize?: number;

  /** Colunas da grade de miniaturas (com inlineActions). Padrão: 2 */
  thumbColumns?: number;

  /** Exige ao menos 1 foto para avançar */
  obrigatoria?: boolean;

  /** Destaque de validação (foto obrigatória não anexada) */
  comErro?: boolean;

}

const TAMANHO_THUMB_COMPACTO = 92;

function srcPrecisaAuth(src: string): boolean {
  return Boolean(src) && !src.startsWith('data:') && !src.startsWith('blob:');
}

function useSrcMidia(src: string): { url: string | null; isVideo: boolean; loading: boolean } {
  const [state, setState] = useState(() =>
    srcPrecisaAuth(src)
      ? { url: null as string | null, isVideo: false, loading: true }
      : { url: urlFoto(src), isVideo: isVideoDataUrl(src), loading: false },
  );

  useEffect(() => {
    if (!srcPrecisaAuth(src)) {
      setState({ url: urlFoto(src), isVideo: isVideoDataUrl(src), loading: false });
      return;
    }

    let ativo = true;
    let objectUrl: string | null = null;
    setState({ url: null, isVideo: false, loading: true });

    fetchMediaBlobAutenticada(src)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        objectUrl = url;
        if (!ativo) {
          URL.revokeObjectURL(url);
          return;
        }
        setState({ url, isVideo: blob.type.startsWith('video/'), loading: false });
      })
      .catch(() => {
        if (ativo) setState({ url: null, isVideo: false, loading: false });
      });

    return () => {
      ativo = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return state;
}

function MidiaPreview({

  src,

  idx,

  total,

  inlineActions,

  compactThumbs,

  thumbSize = TAMANHO_THUMB_COMPACTO,

  disabled,

  onRemove,

}: {

  src: string;

  idx: number;

  total: number;

  inlineActions?: boolean;

  compactThumbs?: boolean;

  thumbSize?: number;

  disabled?: boolean;

  onRemove: () => void;

}) {

  const { url, isVideo, loading } = useSrcMidia(src);



  return (

    <Box

      sx={{

        position: 'relative',

        borderRadius: compactThumbs ? 1 : inlineActions ? 1.5 : 2,

        overflow: 'hidden',

        border: '1px solid',

        borderColor: 'divider',

        bgcolor: '#000',

        width: compactThumbs ? thumbSize : undefined,

        height: compactThumbs ? thumbSize : undefined,

        flexShrink: compactThumbs ? 0 : undefined,

        aspectRatio: inlineActions && !compactThumbs ? '1' : undefined,

      }}

    >

      {loading ? (

        <Box

          sx={{

            width: '100%',

            height: '100%',

            minHeight: compactThumbs ? undefined : inlineActions ? undefined : 80,

            display: 'flex',

            alignItems: 'center',

            justifyContent: 'center',

          }}

        >

          <CircularProgress size={compactThumbs ? 18 : 28} sx={{ color: 'rgba(255,255,255,0.7)' }} />

        </Box>

      ) : isVideo && url ? (

        <Box

          component="video"

          src={url}

          controls

          sx={{

            width: '100%',

            height: inlineActions ? '100%' : 'auto',

            maxHeight: inlineActions ? undefined : 200,

            objectFit: inlineActions ? 'cover' : 'contain',

            display: 'block',

          }}

        />

      ) : url ? (

        <Box

          component="img"

          src={url}

          alt={`Evidência ${idx + 1}`}

          sx={{

            width: '100%',

            height: inlineActions ? '100%' : 'auto',

            maxHeight: inlineActions ? undefined : 200,

            objectFit: inlineActions ? 'cover' : 'contain',

            display: 'block',

          }}

        />

      ) : null}

      <Typography

        variant="caption"

        sx={{

          position: 'absolute',

          top: inlineActions ? 4 : 8,

          left: inlineActions ? 4 : 8,

          bgcolor: 'rgba(0,0,0,0.6)',

          color: 'white',

          px: inlineActions ? 0.5 : 1,

          py: inlineActions ? 0.25 : 0,

          fontSize: inlineActions ? '0.65rem' : undefined,

          borderRadius: 1,

          lineHeight: 1.2,

        }}

      >

        {idx + 1}/{total}

      </Typography>

      {!disabled && (

        <IconButton

          onClick={onRemove}

          size={inlineActions ? 'small' : 'medium'}

          sx={{

            position: 'absolute',

            top: inlineActions ? 2 : 8,

            right: inlineActions ? 2 : 8,

            bgcolor: 'rgba(0,0,0,0.55)',

            color: 'white',

            p: inlineActions ? 0.5 : undefined,

          }}

          aria-label="Remover mídia"

        >

          <DeleteIcon fontSize={inlineActions ? 'small' : 'medium'} />

        </IconButton>

      )}

    </Box>

  );

}



export default function PhotoCaptureMulti({

  fotos,

  onChange,

  max = 5,

  disabled,

  inlineActions = false,

  hideCaption = false,

  compactThumbs = false,

  thumbSize = TAMANHO_THUMB_COMPACTO,

  thumbColumns,

  obrigatoria = false,

  comErro = false,

}: Props) {
  const { mode } = useAppTheme();
  const escuro = mode === 'dark';
  const btnFotoBg = escuro ? 'rgba(232, 82, 10, 0.72)' : 'rgba(27, 42, 107, 0.88)';
  const btnFotoHover = escuro ? 'rgba(232, 82, 10, 0.88)' : 'rgba(21, 32, 86, 0.95)';

  const galleryRef = useRef<HTMLInputElement>(null);
  const fotosRef = useRef(fotos);
  const processandoRef = useRef(false);
  const [loading, setLoading] = useState(false);

  const [erro, setErro] = useState('');

  const [cameraAberta, setCameraAberta] = useState(false);

  const podeMais = fotos.length < max;

  useEffect(() => {
    fotosRef.current = fotos;
  }, [fotos]);

  const cols = thumbColumns ?? (inlineActions ? 2 : 1);

  const processar = async (file: File | undefined) => {
    if (!file || disabled || fotosRef.current.length >= max || processandoRef.current) return;

    processandoRef.current = true;
    setErro('');
    setLoading(true);

    try {
      const dataUrl =
        file.type.startsWith('video/')
          ? await fileToDataUrl(file)
          : await compressImage(file, 1024, 0.72);

      const novas = max === 1 ? [dataUrl] : [...fotosRef.current, dataUrl].slice(0, max);
      fotosRef.current = novas;
      onChange(novas);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível processar o arquivo.');
    } finally {
      processandoRef.current = false;
      setLoading(false);
      if (galleryRef.current) galleryRef.current.value = '';
    }
  };



  const remover = (idx: number) =>
    onChange(fotosRef.current.filter((_, i) => i !== idx));



  function abrirCamera() {

    if (disabled || !podeMais) return;

    if (!navigator.mediaDevices?.getUserMedia) {

      setErro('Câmera não disponível neste dispositivo.');

      return;

    }

    setErro('');

    setCameraAberta(true);

  }



  return (

    <Box sx={{ width: '100%' }}>

      {!hideCaption && (

        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>

          Fotos ({fotos.length}/{max})

        </Typography>

      )}



      {hideCaption && fotos.length > 0 && (

        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>

          {fotos.length} de {max} anexos

        </Typography>

      )}



      {fotos.length > 0 && (

        <Box

          sx={{

            display: compactThumbs ? 'flex' : 'grid',

            flexWrap: compactThumbs ? 'wrap' : undefined,

            gridTemplateColumns: compactThumbs
              ? undefined
              : `repeat(${cols}, minmax(0, 1fr))`,

            gap: compactThumbs ? 0.75 : cols >= 3 ? 0.75 : inlineActions ? 1 : 1.5,

            mb: compactThumbs ? 1 : 2,

          }}

        >

          {fotos.map((src, idx) => (

            <MidiaPreview

              key={idx}

              src={src}

              idx={idx}

              total={fotos.length}

              inlineActions={inlineActions}

              compactThumbs={compactThumbs}

              thumbSize={thumbSize}

              disabled={disabled}

              onRemove={() => remover(idx)}

            />

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

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 1,
              width: '100%',
            }}
          >
            <Button
              type="button"
              fullWidth
              variant="contained"
              size="small"
              startIcon={<CameraAltIcon sx={{ fontSize: 18 }} />}
              onClick={abrirCamera}
              sx={{
                minHeight: 40,
                fontSize: '0.8rem',
                fontWeight: 600,
                px: 1,
                bgcolor: btnFotoBg,
                color: '#fff',
                boxShadow: 'none',
                '&:hover': {
                  bgcolor: btnFotoHover,
                  boxShadow: 'none',
                },
              }}
            >
              {inlineActions ? 'Tirar foto' : 'Câmera'}
            </Button>
            <Button
              type="button"
              fullWidth
              variant="outlined"
              size="small"
              startIcon={<PhotoLibraryIcon sx={{ fontSize: 18 }} />}
              onClick={() => galleryRef.current?.click()}
              sx={{
                minHeight: 40,
                fontSize: '0.8rem',
                fontWeight: 600,
                px: 1,
                borderColor: 'rgba(148, 163, 184, 0.55)',
                color: 'var(--ga-text-secondary)',
                bgcolor: 'transparent',
                '&:hover': {
                  borderColor: 'rgba(148, 163, 184, 0.85)',
                  bgcolor: 'rgba(148, 163, 184, 0.1)',
                },
              }}
            >
              Galeria
            </Button>
          </Box>

        )

      )}

      {obrigatoria && fotos.length === 0 && !loading && !comErro && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
          Pelo menos 1 foto obrigatória
        </Typography>
      )}

      {comErro && fotos.length === 0 && !loading && (
        <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
          Anexe a foto obrigatória para continuar
        </Typography>
      )}



      {erro && (

        <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>

          {erro}

        </Typography>

      )}



      <input

        ref={galleryRef}

        type="file"

        accept="image/*,video/*"

        tabIndex={-1}

        aria-hidden

        style={inputOculto}

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


