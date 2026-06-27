import { useCallback, useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';

const VIEW = 280;
const OUTPUT = 256;
const NAVY = '#1B2A6B';

type Props = {
  open: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onConfirm: (dataUrl: string) => void;
};

export default function FotoPerfilCropDialog({ open, imageSrc, onClose, onConfirm }: Props) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [minScale, setMinScale] = useState(1);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const imgLoaded = imgSize.w > 0;
  const displayedW = imgSize.w * scale;
  const displayedH = imgSize.h * scale;

  useEffect(() => {
    if (!open) return;
    setPos({ x: 0, y: 0 });
    setImgSize({ w: 0, h: 0 });
    setScale(1);
    setMinScale(1);
  }, [open, imageSrc]);

  const clampPos = useCallback(
    (x: number, y: number, s: number) => {
      const dw = imgSize.w * s;
      const dh = imgSize.h * s;
      const maxX = Math.max(0, (dw - VIEW) / 2);
      const maxY = Math.max(0, (dh - VIEW) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    [imgSize],
  );

  function onImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const ms = Math.max(VIEW / nw, VIEW / nh);
    setMinScale(ms);
    setScale(ms);
    setImgSize({ w: nw, h: nh });
    setPos({ x: 0, y: 0 });
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setPos(clampPos(dragRef.current.px + dx, dragRef.current.py + dy, scale));
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function handleScaleChange(_: unknown, v: number | number[]) {
    const s = v as number;
    setScale(s);
    setPos((p) => clampPos(p.x, p.y, s));
  }

  function confirmar() {
    if (!imageSrc || !imgLoaded) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const ratio = OUTPUT / VIEW;
      ctx.save();
      ctx.beginPath();
      ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2);
      ctx.clip();
      const w = imgSize.w * scale * ratio;
      const h = imgSize.h * scale * ratio;
      const cx = OUTPUT / 2 + pos.x * ratio;
      const cy = OUTPUT / 2 + pos.y * ratio;
      ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
      ctx.restore();
      onConfirm(canvas.toDataURL('image/jpeg', 0.88));
    };
    img.src = imageSrc;
  }

  return (
    <Dialog open={open && !!imageSrc} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700, color: NAVY, pb: 0.5 }}>Ajustar foto</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Arraste e ajuste o zoom para centralizar o rosto no círculo.
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            sx={{
              position: 'relative',
              width: VIEW,
              height: VIEW,
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: '#1a1a1a',
              touchAction: 'none',
              cursor: 'grab',
              '&:active': { cursor: 'grabbing' },
            }}
          >
            {imageSrc && (
              <Box
                component="img"
                src={imageSrc}
                alt=""
                onLoad={onImgLoad}
                draggable={false}
                sx={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: displayedW || undefined,
                  height: displayedH || undefined,
                  transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
                  userSelect: 'none',
                  pointerEvents: 'none',
                  maxWidth: 'none',
                }}
              />
            )}
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background: `radial-gradient(circle at center, transparent ${VIEW / 2 - 1}px, rgba(0,0,0,0.58) ${VIEW / 2}px)`,
              }}
            />
          </Box>
        </Box>
        {imgLoaded && (
          <Box sx={{ mt: 2.5, px: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Zoom
            </Typography>
            <Slider
              min={minScale}
              max={minScale * 3}
              step={minScale * 0.015}
              value={scale}
              onChange={handleScaleChange}
              sx={{ color: NAVY, mt: 0.5 }}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={confirmar} disabled={!imgLoaded}>
          Usar foto
        </Button>
      </DialogActions>
    </Dialog>
  );
}
