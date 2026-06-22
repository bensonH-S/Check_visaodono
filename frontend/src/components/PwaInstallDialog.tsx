import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';
import GetAppIcon from '@mui/icons-material/GetApp';
import IosShareIcon from '@mui/icons-material/IosShare';
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import BrandLogo from './BrandLogo';
import { usePwaInstallPrompt } from '../hooks/usePwaInstallPrompt';

const NAVY = '#1B2A6B';
const ORANGE = '#E8520A';

function PassoInstalacao({
  numero,
  icone,
  titulo,
  descricao,
}: {
  numero: number;
  icone: ReactNode;
  titulo: string;
  descricao: ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: 'rgba(27, 42, 107, 0.08)',
          color: NAVY,
          fontWeight: 700,
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {numero}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
          {icone}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: NAVY }}>
            {titulo}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
          {descricao}
        </Typography>
      </Box>
    </Box>
  );
}

export default function PwaInstallDialog() {
  const { aberto, modo, instalando, dispensar, instalarAndroid } = usePwaInstallPrompt();

  const titulo =
    modo === 'ios'
      ? 'Adicione à Tela de Início'
      : 'Instale o app na tela inicial';

  const subtitulo =
    modo === 'ios'
      ? 'No iPhone, o Safari não permite instalar com um toque — siga estes 2 passos rápidos:'
      : modo === 'android'
        ? 'Toque em Instalar agora. O celular mostra o atalho na tela inicial — sem abrir configurações.'
        : 'Toque no menu do navegador e escolha instalar o aplicativo.';

  return (
    <Dialog
      open={aberto}
      onClose={dispensar}
      fullWidth
      maxWidth="xs"
      aria-labelledby="pwa-install-title"
      slotProps={{
        paper: {
          sx: {
            m: 2,
            borderRadius: 3,
            overflow: 'visible',
          },
        },
      }}
    >
      <DialogContent sx={{ pt: 3, pb: 1.5, px: 2.5 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: 2.5,
              bgcolor: '#fff',
              boxShadow: '0 8px 24px rgba(27, 42, 107, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 1.5,
            }}
          >
            <BrandLogo maxWidth={120} />
          </Box>
          <Typography id="pwa-install-title" variant="h6" sx={{ fontWeight: 700, color: NAVY, textAlign: 'center' }}>
            {titulo}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, textAlign: 'center', lineHeight: 1.5 }}>
            {subtitulo}
          </Typography>
        </Box>

        {modo === 'ios' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <PassoInstalacao
              numero={1}
              icone={<IosShareIcon sx={{ fontSize: 18, color: ORANGE }} />}
              titulo="Compartilhar"
              descricao={
                <>
                  Toque no ícone{' '}
                  <IosShareIcon sx={{ fontSize: 16, verticalAlign: 'text-bottom' }} /> na barra inferior do
                  Safari.
                </>
              }
            />
            <PassoInstalacao
              numero={2}
              icone={<AddBoxOutlinedIcon sx={{ fontSize: 18, color: ORANGE }} />}
              titulo="Adicionar à Tela de Início"
              descricao="Role o menu e toque em Adicionar à Tela de Início. Depois abra sempre pelo ícone Meridian."
            />
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1.25,
                borderRadius: 2,
                bgcolor: 'rgba(27, 42, 107, 0.05)',
              }}
            >
              <PhoneIphoneIcon sx={{ color: NAVY, fontSize: 20 }} />
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.45 }}>
                Assim você recebe notificações dos chamados mesmo com o app fechado.
              </Typography>
            </Box>
            {aberto && (
              <Box
                aria-hidden
                sx={{
                  position: 'fixed',
                  bottom: 12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  color: ORANGE,
                  fontSize: '2rem',
                  lineHeight: 1,
                  animation: 'pwa-bounce 1.2s ease-in-out infinite',
                  '@keyframes pwa-bounce': {
                    '0%, 100%': { transform: 'translateX(-50%) translateY(0)' },
                    '50%': { transform: 'translateX(-50%) translateY(6px)' },
                  },
                  pointerEvents: 'none',
                  zIndex: 1400,
                }}
              >
                ↓
              </Box>
            )}
          </Box>
        )}

        {modo === 'android-manual' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <PassoInstalacao
              numero={1}
              icone={<Typography sx={{ fontWeight: 700, fontSize: '1rem', color: ORANGE }}>⋮</Typography>}
              titulo="Menu do Chrome"
              descricao="Toque nos três pontos no canto superior direito do navegador."
            />
            <PassoInstalacao
              numero={2}
              icone={<GetAppIcon sx={{ fontSize: 18, color: ORANGE }} />}
              titulo="Instalar aplicativo"
              descricao='Selecione "Instalar aplicativo" ou "Adicionar à tela inicial".'
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 0, flexDirection: 'column', gap: 1 }}>
        {modo === 'android' && (
          <Button
            fullWidth
            variant="contained"
            size="large"
            startIcon={<GetAppIcon />}
            onClick={instalarAndroid}
            disabled={instalando}
            sx={{ fontWeight: 700, py: 1.25 }}
          >
            {instalando ? 'Abrindo instalação…' : 'Instalar agora'}
          </Button>
        )}
        <Button
          fullWidth
          variant={modo === 'android' ? 'text' : 'contained'}
          size={modo === 'android' ? 'medium' : 'large'}
          onClick={dispensar}
          sx={{ fontWeight: modo === 'android' ? 500 : 700 }}
        >
          {modo === 'ios' || modo === 'android-manual' ? 'Entendi' : 'Agora não'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
