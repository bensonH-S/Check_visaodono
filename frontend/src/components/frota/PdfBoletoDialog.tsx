import { useCallback, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { api } from '../../api/client';
import { getToken } from '../../lib/auth';

type Props = {
  open: boolean;
  url: string | null;
  /** Quando informado, Baixar/Imprimir usam proxy autenticado (sem nova aba). */
  idDebito?: number | null;
  titulo?: string;
  onClose: () => void;
};

/** Viewer só com a página do PDF (sem painel de miniaturas à esquerda). */
function urlViewerPdf(url: string): string {
  // zoom 95%
  const hashParams = 'navpanes=0&scrollbar=1&toolbar=0&zoom=95';
  const base = url.split('#')[0];
  return `${base}#${hashParams}`;
}

async function obterPdfBlob(url: string, idDebito?: number | null): Promise<Blob> {
  if (idDebito != null && Number.isFinite(idDebito)) {
    const token = getToken();
    const res = await fetch(api.frotaDebitoBoletoUrl(idDebito), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Falha ao obter boleto (${res.status})`);
    return new Blob([await res.arrayBuffer()], { type: 'application/pdf' });
  }

  const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error(`Falha ao obter PDF (${res.status})`);
  const blob = await res.blob();
  return new Blob([blob], { type: 'application/pdf' });
}

/** Modal para visualizar boleto PDF com baixar e imprimir. */
export default function PdfBoletoDialog({ open, url, idDebito, titulo, onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [busy, setBusy] = useState<'baixar' | 'imprimir' | null>(null);

  const baixar = useCallback(async () => {
    if (!url && idDebito == null) return;
    setBusy('baixar');
    try {
      const blob = await obterPdfBlob(url || '', idDebito);
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `boleto-${Date.now()}.pdf`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Não foi possível baixar o boleto');
    } finally {
      setBusy(null);
    }
  }, [url, idDebito]);

  const imprimir = useCallback(async () => {
    if (!url && idDebito == null) return;
    setBusy('imprimir');
    try {
      const blob = await obterPdfBlob(url || '', idDebito);
      const objectUrl = URL.createObjectURL(blob);
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      printFrame.src = objectUrl;
      document.body.appendChild(printFrame);

      await new Promise<void>((resolve) => {
        const done = () => resolve();
        printFrame.onload = () => {
          try {
            printFrame.contentWindow?.focus();
            printFrame.contentWindow?.print();
          } catch {
            /* ignore */
          }
          done();
        };
        setTimeout(done, 2500);
      });

      setTimeout(() => {
        printFrame.remove();
        URL.revokeObjectURL(objectUrl);
      }, 60_000);
    } catch (e) {
      // Último recurso: tenta o iframe do modal
      try {
        iframeRef.current?.contentWindow?.focus();
        iframeRef.current?.contentWindow?.print();
      } catch {
        alert(e instanceof Error ? e.message : 'Não foi possível imprimir o boleto');
      }
    } finally {
      setBusy(null);
    }
  }, [url, idDebito]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      sx={{
        '& .MuiDialog-container': { alignItems: 'stretch' },
      }}
      slotProps={{
        paper: {
          sx: {
            m: { xs: 1, sm: 1.5 },
            width: '100%',
            maxWidth: { xs: '100%', sm: '720px', md: '780px' },
            height: 'calc(100vh - 16px)',
            maxHeight: 'calc(100vh - 16px)',
            display: 'flex',
            flexDirection: 'column',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          color: '#0B1A3B',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pr: 1,
          flexShrink: 0,
          py: 1.25,
        }}
      >
        <PictureAsPdfIcon color="error" />
        <Typography component="span" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>
          {titulo || 'Boleto PDF'}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="Fechar">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        sx={{
          p: 0,
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {url ? (
          <iframe
            ref={iframeRef}
            title="Boleto PDF"
            src={urlViewerPdf(url)}
            style={{
              flex: 1,
              width: '100%',
              height: '100%',
              minHeight: 0,
              border: 0,
              background: '#525659',
            }}
          />
        ) : (
          <Box sx={{ p: 3 }}>
            <Typography color="text.secondary">URL do boleto indisponível.</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.25, gap: 1, flexShrink: 0 }}>
        <Button
          startIcon={busy === 'baixar' ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
          onClick={() => void baixar()}
          disabled={(!url && idDebito == null) || busy != null}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          Baixar
        </Button>
        <Button
          startIcon={busy === 'imprimir' ? <CircularProgress size={16} color="inherit" /> : <PrintIcon />}
          onClick={() => void imprimir()}
          disabled={(!url && idDebito == null) || busy != null}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          Imprimir
        </Button>
        <Button variant="contained" onClick={onClose} sx={{ textTransform: 'none', fontWeight: 600 }}>
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
