import { useRef } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { fileToDataUrl, isImageDataUrl } from '../../utils/mediaFile';

const TAMANHO_QUADRADO = 52;

type Props = {
  anexos: string[];
  onChange: (anexos: string[]) => void;
  max?: number;
  disabled?: boolean;
  /** Só o botão, sem legenda (ex.: mesma linha do aprovador). */
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
      const ok = file.type.startsWith('image/') || file.type === 'application/pdf';
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

  const gradeAnexos = anexos.length > 0 && (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${TAMANHO_QUADRADO}px, 1fr))`,
        gap: 0.75,
        width: '100%',
        flexBasis: inline ? '100%' : undefined,
        mt: inline ? 1.25 : 1,
      }}
    >
      {anexos.map((src, idx) => (
        <Box
          key={`${idx}-${src.slice(0, 24)}`}
          sx={{
            position: 'relative',
            width: TAMANHO_QUADRADO,
            height: TAMANHO_QUADRADO,
            borderRadius: 1,
            overflow: 'hidden',
            border: '1px solid rgba(27, 42, 107, 0.15)',
            bgcolor: '#f3f4f6',
          }}
        >
          {isImageDataUrl(src) ? (
            <Box
              component="img"
              src={src}
              alt={`Anexo ${idx + 1}`}
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#FEE2E2',
              }}
            >
              <PictureAsPdfIcon sx={{ fontSize: 22, color: '#DC2626' }} />
            </Box>
          )}
          {!disabled && (
            <IconButton
              size="small"
              aria-label="Remover anexo"
              onClick={() => onChange(anexos.filter((_, i) => i !== idx))}
              sx={{
                position: 'absolute',
                top: 2,
                right: 2,
                p: 0.25,
                bgcolor: 'rgba(0,0,0,0.55)',
                color: '#fff',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' },
              }}
            >
              <DeleteIcon sx={{ fontSize: 14 }} />
            </IconButton>
          )}
        </Box>
      ))}
    </Box>
  );

  const botaoSelecionar = (
    <>
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
        size="small"
        startIcon={<AttachFileIcon sx={{ fontSize: 16 }} />}
        disabled={disabled || anexos.length >= max}
        onClick={() => inputRef.current?.click()}
        sx={{
          flexShrink: 0,
          fontSize: '0.75rem',
          py: 0.35,
          px: 1,
          minHeight: 30,
          whiteSpace: 'nowrap',
        }}
      >
        Selecionar arquivos
      </Button>
    </>
  );

  if (inline) {
    return (
      <>
        {botaoSelecionar}
        {gradeAnexos}
      </>
    );
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Fotos do orçamento ou recibo em PDF (máx. {max})
      </Typography>
      {botaoSelecionar}
      {gradeAnexos}
    </Box>
  );
}
