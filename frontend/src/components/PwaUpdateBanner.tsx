import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import {
  PWA_UPDATE_DISPONIVEL,
  aplicarAtualizacaoPwa,
  verificarBuildDesatualizado,
} from '../pwa/pwaUpdate';

export default function PwaUpdateBanner() {
  const [visivel, setVisivel] = useState(false);
  const [aplicando, setAplicando] = useState(false);

  const checar = useCallback(async () => {
    if (import.meta.env.DEV) {
      setVisivel(false);
      return;
    }
    const stale = await verificarBuildDesatualizado();
    setVisivel(stale);
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    void checar();
    const onUpdate = () => setVisivel(true);
    window.addEventListener(PWA_UPDATE_DISPONIVEL, onUpdate);
    return () => window.removeEventListener(PWA_UPDATE_DISPONIVEL, onUpdate);
  }, [checar]);

  if (!visivel) return null;

  return (
    <Alert
      severity="warning"
      sx={{
        borderRadius: 0,
        alignItems: 'center',
        '& .MuiAlert-message': { flex: 1 },
      }}
      action={
        <Button
          color="inherit"
          size="small"
          variant="outlined"
          disabled={aplicando}
          onClick={() => {
            setAplicando(true);
            void aplicarAtualizacaoPwa();
          }}
          sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
        >
          {aplicando ? 'Atualizando…' : 'Atualizar agora'}
        </Button>
      }
    >
      Nova versão do app disponível. Toque em <strong>Atualizar agora</strong> para carregar o
      design e as correções mais recentes.
    </Alert>
  );
}
