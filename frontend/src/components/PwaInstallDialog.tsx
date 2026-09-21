import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import GetAppIcon from '@mui/icons-material/GetApp';
import IosShareIcon from '@mui/icons-material/IosShare';
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import BrandLogo from './BrandLogo';
import { useLocation } from 'react-router-dom';
import { isIosChrome, usePwaInstallPrompt } from '../hooks/usePwaInstallPrompt';
import { APP_NAME } from '../config/brand';

const NAVY = '#1B2A6B';
const ORANGE = '#FF7A3D';

function Passo({
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
          bgcolor: 'rgba(255,255,255,0.14)',
          color: '#fff',
          fontWeight: 800,
          fontSize: '0.82rem',
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
          <Typography sx={{ fontWeight: 800, color: '#fff', fontSize: '0.95rem' }}>{titulo}</Typography>
        </Box>
        <Typography sx={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.45 }}>
          {descricao}
        </Typography>
      </Box>
    </Box>
  );
}

export default function PwaInstallDialog() {
  const { pathname } = useLocation();
  const { aberto, modo, instalando, instalarAndroid } = usePwaInstallPrompt(pathname);
  if (!aberto) return null;

  const chromeIos = isIosChrome();

  return (
    <Box
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 4000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        px: 2.5,
        pt: 'calc(28px + env(safe-area-inset-top, 0px))',
        pb: 'calc(28px + env(safe-area-inset-bottom, 0px))',
        background: 'linear-gradient(160deg, #0E1848 0%, #1B2A6B 48%, #243987 100%)',
        color: '#fff',
      }}
    >
      <Box sx={{ maxWidth: 420, mx: 'auto', width: '100%' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3, textAlign: 'center' }}>
          <Box
            sx={{
              width: 76,
              height: 76,
              borderRadius: 3,
              bgcolor: '#fff',
              boxShadow: '0 12px 32px rgba(0,0,0,0.28)',
              display: 'grid',
              placeItems: 'center',
              mb: 2,
            }}
          >
            <BrandLogo variante="icone" maxWidth={80} />
          </Box>
          <Typography id="pwa-install-title" sx={{ fontWeight: 800, fontSize: '1.45rem', lineHeight: 1.2 }}>
            {modo === 'computador' ? 'O app é só no celular' : 'Instale o app antes de usar'}
          </Typography>
          <Typography sx={{ mt: 1, fontSize: '0.92rem', color: 'rgba(255,255,255,0.74)', lineHeight: 1.45 }}>
            {modo === 'computador'
              ? 'Notebook e computador não entram. Abra no iPhone ou Android e instale na tela inicial.'
              : `Instale o ${APP_NAME} na tela inicial. Sem o ícone, não dá para usar — nem recusando a instalação.`}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            p: 2,
            borderRadius: 3,
            bgcolor: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          {modo === 'computador' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PhoneIphoneIcon sx={{ color: ORANGE, fontSize: 22 }} />
              <Typography sx={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.78)', lineHeight: 1.45 }}>
                No telefone: Safari (iPhone) ou Chrome (Android) → instalar / adicionar à tela inicial → abrir o
                ícone.
              </Typography>
            </Box>
          )}

          {modo === 'ios' && chromeIos && (
            <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: ORANGE, lineHeight: 1.4 }}>
              No iPhone isso só funciona no Safari. Feche o Chrome e abra este mesmo endereço no Safari.
            </Typography>
          )}

          {modo === 'ios' && (
            <>
              <Passo
                numero={1}
                icone={<IosShareIcon sx={{ fontSize: 18, color: ORANGE }} />}
                titulo="Compartilhar"
                descricao={
                  <>
                    Toque em{' '}
                    <IosShareIcon sx={{ fontSize: 16, verticalAlign: 'text-bottom' }} /> na barra de baixo do
                    Safari.
                  </>
                }
              />
              <Passo
                numero={2}
                icone={<AddBoxOutlinedIcon sx={{ fontSize: 18, color: ORANGE }} />}
                titulo="Adicionar à Tela de Início"
                descricao={`Role o menu, toque nisso e confirme. Depois abra sempre o ícone ${APP_NAME}.`}
              />
            </>
          )}

          {modo === 'android' && (
            <Passo
              numero={1}
              icone={<GetAppIcon sx={{ fontSize: 18, color: ORANGE }} />}
              titulo="Instalar agora"
              descricao="Toque no botão abaixo. O Chrome coloca o atalho na tela inicial."
            />
          )}

          {modo === 'android-manual' && (
            <>
              <Passo
                numero={1}
                icone={<Typography sx={{ fontWeight: 800, fontSize: '1rem', color: ORANGE }}>⋮</Typography>}
                titulo="Menu do Chrome"
                descricao="Toque nos três pontos no canto de cima."
              />
              <Passo
                numero={2}
                icone={<GetAppIcon sx={{ fontSize: 18, color: ORANGE }} />}
                titulo="Instalar aplicativo"
                descricao='Escolha "Instalar aplicativo" ou "Adicionar à tela inicial".'
              />
            </>
          )}

          {modo !== 'computador' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: 0.5 }}>
              <PhoneIphoneIcon sx={{ color: ORANGE, fontSize: 20 }} />
              <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.68)', lineHeight: 1.4 }}>
                Sem instalar, o app não abre. Recusar não libera o uso no navegador.
              </Typography>
            </Box>
          )}
        </Box>

        {modo === 'android' && (
          <Button
            fullWidth
            variant="contained"
            size="large"
            startIcon={<GetAppIcon />}
            onClick={() => void instalarAndroid()}
            disabled={instalando}
            sx={{
              mt: 2.5,
              py: 1.4,
              fontWeight: 800,
              bgcolor: ORANGE,
              '&:hover': { bgcolor: '#e8520a' },
            }}
          >
            {instalando ? 'Abrindo instalação…' : 'Instalar agora'}
          </Button>
        )}

        {modo === 'ios' && (
          <Typography
            sx={{
              mt: 3,
              textAlign: 'center',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            Depois de adicionar, abra o ícone — esta página some.
          </Typography>
        )}
      </Box>

      {modo === 'ios' && !chromeIos && (
        <Box
          aria-hidden
          sx={{
            position: 'fixed',
            bottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
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
          }}
        >
          ↓
        </Box>
      )}
    </Box>
  );
}
