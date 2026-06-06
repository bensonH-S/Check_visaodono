import { useRef, useState } from 'react';

import Box from '@mui/material/Box';

import Button from '@mui/material/Button';

import IconButton from '@mui/material/IconButton';

import Typography from '@mui/material/Typography';

import CircularProgress from '@mui/material/CircularProgress';

import CameraAltIcon from '@mui/icons-material/CameraAlt';

import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';

import DeleteIcon from '@mui/icons-material/Delete';

import CameraCaptureOverlay from '../CameraCaptureOverlay';

import { compressImage } from '../../utils/compressImage';

import { fileToDataUrl, isVideoDataUrl } from '../../utils/mediaFile';

import { urlFoto } from '../../utils/checklistRules';



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

}

const TAMANHO_THUMB_COMPACTO = 92;



function MidiaPreview({

  src,

  idx,

  total,

  inlineActions,

  compactThumbs,

  disabled,

  onRemove,

}: {

  src: string;

  idx: number;

  total: number;

  inlineActions?: boolean;

  compactThumbs?: boolean;

  disabled?: boolean;

  onRemove: () => void;

}) {

  const isVideo = isVideoDataUrl(src);

  const url = urlFoto(src);



  return (

    <Box

      sx={{

        position: 'relative',

        borderRadius: compactThumbs ? 1 : inlineActions ? 1.5 : 2,

        overflow: 'hidden',

        border: '1px solid',

        borderColor: 'divider',

        bgcolor: '#000',

        width: compactThumbs ? TAMANHO_THUMB_COMPACTO : undefined,

        height: compactThumbs ? TAMANHO_THUMB_COMPACTO : undefined,

        flexShrink: compactThumbs ? 0 : undefined,

        aspectRatio: inlineActions && !compactThumbs ? '1' : undefined,

      }}

    >

      {isVideo ? (

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

      ) : (

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

      )}

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

}: Props) {

  const galleryRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);

  const [erro, setErro] = useState('');

  const [cameraAberta, setCameraAberta] = useState(false);

  const podeMais = fotos.length < max;



  const processar = async (file: File | undefined) => {

    if (!file || disabled || !podeMais) return;

    setErro('');

    setLoading(true);

    try {

      const dataUrl =

        file.type.startsWith('video/')

          ? await fileToDataUrl(file)

          : await compressImage(file, 1024, 0.72);

      onChange([...fotos, dataUrl]);

    } catch (err) {

      setErro(err instanceof Error ? err.message : 'Não foi possível processar o arquivo.');

    } finally {

      setLoading(false);

      if (galleryRef.current) galleryRef.current.value = '';

    }

  };



  const remover = (idx: number) => onChange(fotos.filter((_, i) => i !== idx));



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

          Fotos e vídeos opcionais ({fotos.length}/{max})

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

            gridTemplateColumns: compactThumbs ? undefined : inlineActions ? 'repeat(2, 1fr)' : '1fr',

            gap: compactThumbs ? 0.75 : inlineActions ? 1 : 1.5,

            mb: 2,

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

              display: 'flex',

              flexDirection: inlineActions ? 'row' : 'column',

              gap: 1.5,

            }}

          >

            <Button

              type="button"

              fullWidth

              variant="contained"

              size={inlineActions ? 'medium' : 'large'}

              startIcon={<CameraAltIcon />}

              onClick={abrirCamera}

              sx={{ minHeight: inlineActions ? 48 : 52, flex: inlineActions ? 1 : undefined }}

            >

              Câmera

            </Button>

            <Button

              type="button"

              fullWidth

              variant="outlined"

              size={inlineActions ? 'medium' : 'large'}

              startIcon={<PhotoLibraryIcon />}

              onClick={() => galleryRef.current?.click()}

              sx={{ minHeight: 48, flex: inlineActions ? 1 : undefined }}

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


