import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';

/** Avisa quando o navegador está com zoom (comum em produção vs localhost). */
export default function ZoomWarning() {
  const [open, setOpen] = useState(false);
  const [scalePct, setScalePct] = useState(100);

  useEffect(() => {
    function check() {
      const scale = window.visualViewport?.scale ?? 1;
      setScalePct(Math.round(scale * 100));
      setOpen(Math.abs(scale - 1) > 0.05);
    }

    check();
    window.visualViewport?.addEventListener('resize', check);
    window.addEventListener('resize', check);
    return () => {
      window.visualViewport?.removeEventListener('resize', check);
      window.removeEventListener('resize', check);
    };
  }, []);

  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ mt: 1 }}
    >
      <Alert severity="info" variant="filled" onClose={() => setOpen(false)} sx={{ width: '100%' }}>
        O navegador está com zoom ({scalePct}%). Pressione <strong>Ctrl+0</strong> (ou Cmd+0 no Mac) para
        voltar ao tamanho normal.
      </Alert>
    </Snackbar>
  );
}
