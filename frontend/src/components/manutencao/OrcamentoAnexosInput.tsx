import { useRef } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { fileToDataUrl, isImageDataUrl } from '../../utils/mediaFile';

type Props = {
  anexos: string[];
  onChange: (anexos: string[]) => void;
  max?: number;
  disabled?: boolean;
  /** Botão na mesma linha que outros controles (ex.: destino da aprovação). */
  inline?: boolean;
};

export default function OrcamentoAnexosInput({ anexos, onChange, max = 5, disabled, inline }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function onArquivos(files: FileList | null) {
    if (!files?.length || disabled) return;
    const restante = max - anexos.length;
    if (restante <= 0) return;

    const novos: string[] = [];
    for (const file of Array.from(files).slice(0, restante)) {
      const ok =
        file.type.startsWith('image/') || file.type === 'application/pdf';
      if (!ok) continue;
      try {
        novos.push(await fileToDataUrl(file));
      } catch {
        /* ignora arquivo inválido */
      }
    }
    if (novos.length) onChange([...anexos, ...novos]);
    if (inputRef.current) inputRef.current.value = '';
  }

  const listaAnexos = anexos.length > 0 && (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: inline ? '100%' : undefined }}>
          {anexos.map((src, idx) => (
            <Box
              key={`${idx}-${src.slice(0, 24)}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              {isImageDataUrl(src) ? (
                <Box
                  component="img"
                  src={src}
                  alt={`Anexo ${idx + 1}`}
                  sx={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 1 }}
                />
              ) : (
                <PictureAsPdfIcon sx={{ fontSize: 40, color: '#DC2626' }} />
              )}
              <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
                {isImageDataUrl(src) ? `Foto ${idx + 1}` : `PDF ${idx + 1}`}
              </Typography>
              {!disabled && (
                <IconButton size="small" onClick={() => onChange(anexos.filter((_, i) => i !== idx))}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          ))}
    </Box>
  );

  return (
    <Box sx={inline ? { display: 'contents' } : undefined}>
      {!inline && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Fotos do orçamento ou recibo em PDF (máx. {max})
        </Typography>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        disabled={disabled || anexos.length >= max}
        onChange={(e) => onArquivos(e.target.files)}
        style={{ display: 'none' }}
      />
      <Button
        variant="outlined"
        startIcon={<AttachFileIcon />}
        disabled={disabled || anexos.length >= max}
        onClick={() => inputRef.current?.click()}
        sx={{
          flexShrink: 0,
          mb: !inline && anexos.length ? 1.5 : 0,
          whiteSpace: 'nowrap',
        }}
      >
        Selecionar arquivos
      </Button>
      {listaAnexos}
    </Box>
  );
}
