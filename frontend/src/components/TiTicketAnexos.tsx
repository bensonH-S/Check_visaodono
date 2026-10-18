import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import {
  api,
  fetchMediaAutenticada,
  type TiTicketAnexo,
} from '../api/client';
import { fileToDataUrl } from '../utils/mediaFile';
import { showToast } from '../utils/toast';

const ACCEPT =
  'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv';

const MAX = 10;

function isImageMime(mime: string) {
  return mime.startsWith('image/');
}

function isPdfMime(mime: string) {
  return mime === 'application/pdf';
}

function AnexoPreview({
  anexo,
  onRemove,
  disabled,
}: {
  anexo: TiTicketAnexo;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let ativo = true;
    if (!isImageMime(anexo.tipo_mime) && !isPdfMime(anexo.tipo_mime)) {
      setSrc(null);
      return undefined;
    }
    fetchMediaAutenticada(anexo.media_url)
      .then((u) => {
        if (!ativo) {
          URL.revokeObjectURL(u);
          return;
        }
        url = u;
        setSrc(u);
      })
      .catch(() => {
        if (ativo) setSrc(null);
      });
    return () => {
      ativo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [anexo.media_url, anexo.tipo_mime]);

  return (
    <Box
      sx={{
        position: 'relative',
        width: 72,
        height: 72,
        borderRadius: 1.5,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'action.hover',
        flexShrink: 0,
      }}
    >
      {isImageMime(anexo.tipo_mime) && src ? (
        <Box
          component="a"
          href={src}
          target="_blank"
          rel="noreferrer"
          sx={{ display: 'block', width: '100%', height: '100%' }}
        >
          <Box component="img" src={src} alt={anexo.nome_arquivo} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </Box>
      ) : (
        <Box
          component="a"
          href={src || anexo.media_url}
          target="_blank"
          rel="noreferrer"
          onClick={async (e) => {
            if (src) return;
            e.preventDefault();
            try {
              const u = await fetchMediaAutenticada(anexo.media_url);
              window.open(u, '_blank', 'noopener,noreferrer');
              setTimeout(() => URL.revokeObjectURL(u), 60_000);
            } catch {
              showToast('Não foi possível abrir o anexo', 'error');
            }
          }}
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.25,
            textDecoration: 'none',
            color: 'text.secondary',
            px: 0.5,
          }}
        >
          {isPdfMime(anexo.tipo_mime) ? (
            <PictureAsPdfIcon sx={{ fontSize: 22, color: '#DC2626' }} />
          ) : (
            <InsertDriveFileOutlinedIcon sx={{ fontSize: 22 }} />
          )}
          <Typography sx={{ fontSize: 9, fontWeight: 700, textAlign: 'center', lineHeight: 1.15 }} noWrap>
            {anexo.nome_arquivo}
          </Typography>
        </Box>
      )}
      {!disabled && onRemove ? (
        <IconButton
          size="small"
          aria-label="Remover anexo"
          onClick={onRemove}
          sx={{
            position: 'absolute',
            top: 2,
            right: 2,
            p: 0.2,
            bgcolor: 'rgba(0,0,0,0.55)',
            color: '#fff',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' },
          }}
        >
          <DeleteOutlineIcon sx={{ fontSize: 14 }} />
        </IconButton>
      ) : null}
    </Box>
  );
}

type Props = {
  idTicket?: number | null;
  anexos: TiTicketAnexo[];
  onChange: (anexos: TiTicketAnexo[]) => void;
  disabled?: boolean;
  onPendentesChange?: (itens: { nome: string; mime: string; dataUrl: string }[]) => void;
  pendentesMeta?: { nome: string; mime: string; dataUrl: string }[];
};

export default function TiTicketAnexos({
  idTicket,
  anexos,
  onChange,
  disabled,
  pendentesMeta = [],
  onPendentesChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const total = anexos.length + pendentesMeta.length;

  async function onArquivos(files: FileList | null) {
    if (!files?.length || disabled || enviando) return;
    const restante = MAX - total;
    if (restante <= 0) {
      showToast(`Máximo de ${MAX} anexos`, 'error');
      return;
    }

    const escolhidos = Array.from(files).slice(0, restante);
    setEnviando(true);
    try {
      if (idTicket) {
        const payload = [];
        for (const file of escolhidos) {
          const dataUrl = await fileToDataUrl(file);
          payload.push({
            nome_arquivo: file.name,
            tipo_mime: file.type || 'application/octet-stream',
            data_url: dataUrl,
          });
        }
        const res = await api.tiTicketAnexar(idTicket, payload);
        onChange(res.anexos);
        showToast(payload.length === 1 ? 'Anexo enviado' : `${payload.length} anexos enviados`, 'success');
      } else if (onPendentesChange) {
        const novos = [...pendentesMeta];
        for (const file of escolhidos) {
          const dataUrl = await fileToDataUrl(file);
          novos.push({
            nome: file.name,
            mime: file.type || 'application/octet-stream',
            dataUrl,
          });
        }
        onPendentesChange(novos);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao anexar', 'error');
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function removerSalvo(idAnexo: number) {
    if (!idTicket || disabled) return;
    try {
      const res = await api.tiTicketAnexoExcluir(idAnexo);
      onChange(res.anexos);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao remover anexo', 'error');
    }
  }

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, flex: 1 }}>Anexos</Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AttachFileIcon />}
          disabled={disabled || enviando || total >= MAX}
          onClick={() => inputRef.current?.click()}
        >
          {enviando ? 'Enviando…' : 'Anexar'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          hidden
          multiple
          accept={ACCEPT}
          disabled={disabled || enviando || total >= MAX}
          onChange={(e) => void onArquivos(e.target.files)}
        />
      </Stack>
      <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
        Imagens, PDF, Word, Excel ou texto · até {MAX} arquivos
      </Typography>
      {total === 0 ? (
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Nenhum anexo.</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {anexos.map((anexo) => (
            <AnexoPreview
              key={anexo.id_anexo}
              anexo={anexo}
              disabled={disabled}
              onRemove={() => void removerSalvo(anexo.id_anexo)}
            />
          ))}
          {pendentesMeta.map((item, idx) => (
            <Box
              key={`pendente-${idx}-${item.nome}`}
              sx={{
                position: 'relative',
                width: 72,
                height: 72,
                borderRadius: 1.5,
                overflow: 'hidden',
                border: '1px dashed',
                borderColor: 'divider',
                bgcolor: 'action.hover',
              }}
            >
              {item.mime.startsWith('image/') ? (
                <Box component="img" src={item.dataUrl} alt={item.nome} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', px: 0.5 }}>
                  {item.mime === 'application/pdf' ? (
                    <PictureAsPdfIcon sx={{ color: '#DC2626' }} />
                  ) : (
                    <InsertDriveFileOutlinedIcon />
                  )}
                  <Typography sx={{ fontSize: 9, fontWeight: 700, textAlign: 'center' }} noWrap>
                    {item.nome}
                  </Typography>
                </Box>
              )}
              {!disabled && onPendentesChange ? (
                <IconButton
                  size="small"
                  aria-label="Remover"
                  onClick={() => onPendentesChange(pendentesMeta.filter((_, i) => i !== idx))}
                  sx={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    p: 0.2,
                    bgcolor: 'rgba(0,0,0,0.55)',
                    color: '#fff',
                  }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                </IconButton>
              ) : null}
            </Box>
          ))}
        </Box>
      )}
    </Stack>
  );
}

