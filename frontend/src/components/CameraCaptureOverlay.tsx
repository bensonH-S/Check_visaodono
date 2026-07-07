import { useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import CameraswitchIcon from '@mui/icons-material/Cameraswitch';

const MAX_VIDEO_SEG = 60;
const HOLD_MS = 280;

export type CameraFacing = 'user' | 'environment';

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  /** Câmera inicial: 'user' = frontal, 'environment' = traseira */
  facingMode?: CameraFacing;
  /** Botão para alternar frontal ↔ traseira */
  allowFlipCamera?: boolean;
  /** Modo retrato/quadrado para selfie de perfil — evita distorção e mostra guia de rosto */
  profileMode?: boolean;
};

function mimeGravacao() {
  const tipos = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  return tipos.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

function extensaoMime(mime: string) {
  if (mime.includes('mp4')) return '.mp4';
  return '.webm';
}

export default function CameraCaptureOverlay({
  open,
  onClose,
  onCapture,
  facingMode: facingModeInicial = 'environment',
  allowFlipCamera = false,
  profileMode = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef(0);
  const gravandoRef = useRef(false);
  const descartarRef = useRef(false);
  const capturandoFotoRef = useRef(false);
  const mimeRef = useRef('');

  const [erro, setErro] = useState('');
  const [pronto, setPronto] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [segurando, setSegurando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [facing, setFacing] = useState<CameraFacing>(facingModeInicial);

  useEffect(() => {
    gravandoRef.current = gravando;
  }, [gravando]);

  useEffect(() => {
    if (open) setFacing(facingModeInicial);
  }, [open, facingModeInicial]);

  function limparTimers() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function fechar(descartar = false) {
    descartarRef.current = descartar;
    limparTimers();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setGravando(false);
    setSegurando(false);
    setSegundos(0);
    onClose();
  }

  useEffect(() => {
    if (!open) {
      setPronto(false);
      setErro('');
      return;
    }

    descartarRef.current = false;
    capturandoFotoRef.current = false;
    let cancelado = false;

    function pararStreamAtual() {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      recorderRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    }

    pararStreamAtual();
    setPronto(false);
    setErro('');

    navigator.mediaDevices
      .getUserMedia({
        video: profileMode
          ? {
              facingMode: { ideal: facing },
              width: { ideal: 1080 },
              height: { ideal: 1080 },
              aspectRatio: { ideal: 1 },
            }
          : { facingMode: { ideal: facing } },
        audio: !profileMode,
      })
      .then((stream) => {
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          void video.play().then(() => setPronto(true));
        };
      })
      .catch(() => {
        if (!cancelado) {
          setErro('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
        }
      });

    return () => {
      cancelado = true;
      descartarRef.current = true;
      limparTimers();
      pararStreamAtual();
    };
  }, [open, facing, profileMode]);

  function alternarCamera() {
    if (gravandoRef.current || !allowFlipCamera) return;
    setFacing((atual) => (atual === 'user' ? 'environment' : 'user'));
  }

  function capturarFoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || gravandoRef.current || capturandoFotoRef.current) return;

    capturandoFotoRef.current = true;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const espelhar = facing === 'user';

    const canvas = document.createElement('canvas');
    if (profileMode) {
      const lado = Math.min(vw, vh);
      canvas.width = lado;
      canvas.height = lado;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const sx = (vw - lado) / 2;
      const sy = (vh - lado) / 2;
      if (espelhar) {
        ctx.translate(lado, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, sx, sy, lado, lado, 0, 0, lado, lado);
    } else {
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (espelhar) {
        ctx.translate(vw, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);
      } else {
        ctx.drawImage(video, 0, 0);
      }
    }

    canvas.toBlob(
      (blob) => {
        capturandoFotoRef.current = false;
        if (!blob) {
          setErro('Não foi possível capturar a foto. Tente novamente.');
          return;
        }
        onCapture(new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }));
        fechar(true);
      },
      'image/jpeg',
      profileMode ? 0.92 : 0.92,
    );
  }

  function iniciarGravacao() {
    const stream = streamRef.current;
    if (!stream || gravandoRef.current) return;

    const mime = mimeGravacao();
    if (!mime) {
      setErro('Gravação de vídeo não suportada neste navegador. Use a galeria.');
      return;
    }

    mimeRef.current = mime;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeRef.current });
      chunksRef.current = [];
      const descartar = descartarRef.current;
      descartarRef.current = false;
      if (descartar || !blob.size) return;

      const ext = extensaoMime(mimeRef.current);
      onCapture(
        new File([blob], `video-${Date.now()}${ext}`, {
          type: mimeRef.current.split(';')[0],
        }),
      );
      fechar(true);
    };

    recorder.start(250);
    setGravando(true);
    setSegundos(0);
    timerRef.current = setInterval(() => {
      setSegundos((s) => {
        if (s + 1 >= MAX_VIDEO_SEG) {
          pararGravacao();
          return MAX_VIDEO_SEG;
        }
        return s + 1;
      });
    }, 1000);
  }

  function pararGravacao() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
    setGravando(false);
    setSegurando(false);
  }

  function onPressStart(e: React.PointerEvent<HTMLDivElement>) {
    if (!pronto || erro) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pressStartRef.current = Date.now();
    setSegurando(true);
    longPressRef.current = setTimeout(() => {
      longPressRef.current = null;
      iniciarGravacao();
    }, HOLD_MS);
  }

  function onPressEnd() {
    const held = Date.now() - pressStartRef.current;

    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }

    setSegurando(false);

    if (gravandoRef.current) {
      pararGravacao();
      return;
    }

    if (held < HOLD_MS && pronto && !erro) {
      capturarFoto();
    }
  }

  return (
    <Dialog fullScreen open={open} onClose={() => fechar(true)}>
      <Box
        sx={{
          bgcolor: '#000',
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1, gap: 0.5 }}>
          <IconButton onClick={() => fechar(true)} aria-label="Fechar câmera" sx={{ color: '#fff' }}>
            <CloseIcon />
          </IconButton>
          <Typography sx={{ color: '#fff', flex: 1, fontWeight: 600 }}>
            {gravando
              ? `Gravando ${segundos}s`
              : profileMode
                ? 'Posicione o rosto'
                : facing === 'user'
                  ? 'Câmera frontal'
                  : 'Câmera traseira'}
          </Typography>
          {allowFlipCamera && !erro && !profileMode && (
            <IconButton
              onClick={alternarCamera}
              disabled={!pronto || gravando}
              aria-label={facing === 'user' ? 'Usar câmera traseira' : 'Usar câmera frontal'}
              sx={{ color: '#fff' }}
            >
              <CameraswitchIcon />
            </IconButton>
          )}
          {gravando && (
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: '#ef4444',
                mr: 1,
                animation: 'pulse 1s infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.4 },
                },
              }}
            />
          )}
        </Box>

        {erro ? (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
            <Typography sx={{ color: '#fff', textAlign: 'center' }}>{erro}</Typography>
          </Box>
        ) : profileMode ? (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              px: 2,
              py: 1,
              minHeight: 0,
            }}
          >
            <Box
              sx={{
                position: 'relative',
                width: 'min(92vw, 360px)',
                aspectRatio: '1',
                borderRadius: 3,
                overflow: 'hidden',
                bgcolor: '#000',
                flexShrink: 0,
              }}
            >
              <Box
                component="video"
                ref={videoRef}
                autoPlay
                playsInline
                muted
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center center',
                  transform: facing === 'user' ? 'scaleX(-1)' : 'none',
                }}
              />
              <Box
                aria-hidden
                sx={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  background:
                    'radial-gradient(ellipse 36% 44% at 50% 42%, transparent 68%, rgba(0,0,0,0.55) 69%)',
                }}
              />
              <Box
                aria-hidden
                sx={{
                  position: 'absolute',
                  left: '50%',
                  top: '42%',
                  width: '72%',
                  height: '88%',
                  transform: 'translate(-50%, -50%)',
                  border: '2px solid rgba(255,255,255,0.9)',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.2)',
                }}
              />
            </Box>
            <Typography
              variant="body2"
              sx={{ color: 'rgba(255,255,255,0.82)', textAlign: 'center', mt: 2, px: 1, lineHeight: 1.45 }}
            >
              Centralize o rosto dentro do oval. A imagem não será distorcida.
            </Typography>
          </Box>
        ) : (
          <Box
            component="video"
            ref={videoRef}
            autoPlay
            playsInline
            muted
            sx={{
              flex: 1,
              width: '100%',
              objectFit: 'cover',
              objectPosition: 'center center',
              transform: facing === 'user' ? 'scaleX(-1)' : 'none',
              bgcolor: '#000',
            }}
          />
        )}

        <Box
          sx={{
            p: 3,
            pb: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          {profileMode ? (
            <>
              <Box
                role="button"
                aria-label="Capturar foto"
                onClick={() => {
                  if (pronto && !erro) capturarFoto();
                }}
                sx={{
                  width: 76,
                  height: 76,
                  borderRadius: '50%',
                  border: '4px solid #fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: pronto && !erro ? 'pointer' : 'default',
                  opacity: pronto && !erro ? 1 : 0.45,
                }}
              >
                <Box sx={{ width: 60, height: 60, borderRadius: '50%', bgcolor: '#fff' }} />
              </Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>
                Toque para capturar
              </Typography>
            </>
          ) : (
            <>
          <Box
            role="button"
            aria-label="Toque para foto, segure para vídeo"
            onPointerDown={onPressStart}
            onPointerUp={onPressEnd}
            onPointerCancel={onPressEnd}
            onPointerLeave={(e) => {
              if (e.buttons > 0) onPressEnd();
            }}
            onContextMenu={(e) => e.preventDefault()}
            sx={{
              width: 76,
              height: 76,
              borderRadius: '50%',
              border: gravando ? '4px solid #ef4444' : '4px solid #fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: pronto && !erro ? 'pointer' : 'default',
              opacity: pronto && !erro ? 1 : 0.45,
              touchAction: 'none',
              userSelect: 'none',
              transition: 'transform 0.15s ease, border-color 0.15s ease',
              transform: segurando && !gravando ? 'scale(0.94)' : 'scale(1)',
            }}
          >
            <Box
              sx={{
                width: gravando ? 28 : segurando ? 52 : 60,
                height: gravando ? 28 : segurando ? 52 : 60,
                borderRadius: gravando ? 1.5 : '50%',
                bgcolor: gravando ? '#ef4444' : '#fff',
                transition: 'all 0.2s ease',
              }}
            />
          </Box>

          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>
            {gravando
              ? 'Solte para parar'
              : `Toque para foto · Segure para vídeo (até ${MAX_VIDEO_SEG}s)`}
          </Typography>
            </>
          )}
        </Box>
      </Box>
    </Dialog>
  );
}
