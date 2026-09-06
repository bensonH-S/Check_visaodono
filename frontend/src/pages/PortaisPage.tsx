import { useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { assetUrl, toAppPath } from '../config/paths';
import { colors, radius, shadows } from '../theme/tokens';
import CkMarkLogoMenu from '../components/CkMarkLogoMenu';
import '../components/visitas/visitas-mobile.css';

type PortalItem = {
  id: string;
  nome: string;
  subtitulo: string;
  descricao: string;
  href: string;
  logo: string;
  logoBg: string;
  logoPad?: number;
};

const PORTAIS: PortalItem[] = [
  {
    id: 'ciga',
    nome: 'CIGA',
    subtitulo: 'Centro de Inteligência',
    descricao: 'Inteligência corporativa e financeira do Grupo Alvim.',
    href: 'https://centralga.com.br/ciga/',
    logo: 'CIGA.png',
    logoBg: '#FFFFFF',
    logoPad: 2,
  },
  {
    id: 'freecontrol',
    nome: 'Freecontrol',
    subtitulo: 'Cadastro de freelancers',
    descricao: 'Cadastro e gestão de freelancers das unidades.',
    href: 'https://www.grupoalvim.com.br/freelancers/Cadastro',
    logo: 'Logo_Grupo_Alvim.png',
    logoBg: '#FFFFFF',
    logoPad: 1.5,
  },
  {
    id: 'ouvidoria',
    nome: 'Ouvidoria',
    subtitulo: 'Canal confidencial',
    descricao: 'Acesse ou registre sua manifestação.',
    href: 'https://ouvidoriagrupoalvim.com.br/',
    logo: 'Logo_Ouvidoria.jpg',
    logoBg: '#FFFFFF',
    logoPad: 0.5,
  },
];

function PortalCardMobile({ portal }: { portal: PortalItem }) {
  return (
    <Box
      component="a"
      href={portal.href}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#182234' : '#fff'),
        border: '1px solid',
        borderColor: (theme) =>
          theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(27, 42, 107, 0.12)',
        borderLeft: (theme) =>
          theme.palette.mode === 'dark' ? '5px solid #FF7A3D' : '5px solid #1B2A6B',
        borderRadius: 3.5,
        boxShadow: (theme) =>
          theme.palette.mode === 'dark'
            ? '0 4px 16px rgba(0, 0, 0, 0.35)'
            : '0 4px 16px rgba(27, 42, 107, 0.08)',
        transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
        '&:hover': {
          borderColor: (theme) => (theme.palette.mode === 'dark' ? '#FF7A3D' : colors.navyBorder),
          borderLeft: (theme) =>
            theme.palette.mode === 'dark' ? '5px solid #FF7A3D' : '5px solid #1B2A6B',
        },
        '&:active': {
          transform: 'scale(0.985)',
          borderColor: '#FF7A3D',
        },
      }}
    >
      <Box
        sx={{
          height: 110,
          bgcolor: portal.logoBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          p: portal.logoPad ?? 1.5,
          borderBottom: (theme) =>
            theme.palette.mode === 'dark'
              ? '1px solid rgba(255, 255, 255, 0.08)'
              : '1px solid rgba(27, 42, 107, 0.08)',
        }}
      >
        <Box
          component="img"
          src={assetUrl(portal.logo)}
          alt={portal.nome}
          sx={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
        />
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.75,
          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'transparent' : '#F8FAFC'),
          flex: 1,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontWeight: 800,
              color: 'text.primary',
              fontSize: '1.02rem',
              lineHeight: 1.25,
            }}
          >
            {portal.nome}
          </Typography>
          <Typography
            sx={{
              mt: 0.25,
              fontSize: '0.78rem',
              fontWeight: 700,
              color: (theme) => (theme.palette.mode === 'dark' ? '#FF7A3D' : '#E8520A'),
            }}
          >
            {portal.subtitulo}
          </Typography>
          <Typography
            sx={{
              mt: 0.35,
              fontSize: '0.75rem',
              color: 'text.secondary',
              lineHeight: 1.4,
            }}
          >
            {portal.descricao}
          </Typography>
        </Box>

        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 2,
            bgcolor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 122, 61, 0.15)' : 'rgba(232, 82, 10, 0.1)',
            color: (theme) => (theme.palette.mode === 'dark' ? '#FF7A3D' : '#E8520A'),
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <OpenInNewIcon sx={{ fontSize: 20 }} />
        </Box>
      </Box>
    </Box>
  );
}

function PortalCardDesktop({ portal }: { portal: PortalItem }) {
  return (
    <Box
      component="a"
      href={portal.href}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#182234' : colors.surface),
        border: '1px solid',
        borderColor: (theme) =>
          theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : colors.border,
        borderLeft: (theme) =>
          theme.palette.mode === 'dark' ? '5px solid #FF7A3D' : '5px solid #1B2A6B',
        borderRadius: `${radius.xl}px`,
        boxShadow: shadows.card,
        transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
        '&:hover': {
          borderColor: (theme) => (theme.palette.mode === 'dark' ? '#FF7A3D' : colors.navyBorder),
          borderLeft: (theme) =>
            theme.palette.mode === 'dark' ? '5px solid #FF7A3D' : '5px solid #1B2A6B',
          boxShadow: shadows.cardHover,
        },
        '&:active': {
          transform: 'scale(0.985)',
          borderColor: colors.orange,
        },
      }}
    >
      <Box
        sx={{
          height: 168,
          bgcolor: portal.logoBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Box
          component="img"
          src={assetUrl(portal.logo)}
          alt=""
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            p: portal.logoPad ?? 1.5,
          }}
        />
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: 2,
          py: 1.75,
          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'transparent' : '#F8FAFC'),
          flex: 1,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, color: colors.navy, fontSize: '1.05rem', lineHeight: 1.2 }}>
            {portal.nome}
          </Typography>
          <Typography sx={{ mt: 0.35, fontSize: '0.78rem', fontWeight: 600, color: colors.textSecondary }}>
            {portal.subtitulo}
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: '0.78rem', color: colors.textMuted, lineHeight: 1.4 }}>
            {portal.descricao}
          </Typography>
        </Box>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: `${radius.md}px`,
            bgcolor: colors.orangeLight,
            color: colors.orange,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <OpenInNewIcon sx={{ fontSize: 18 }} />
        </Box>
      </Box>
    </Box>
  );
}

export default function PortaisPage() {
  const mobile = toAppPath(useLocation().pathname).startsWith('/portais/mobile');

  if (mobile) {
    return (
      <div className="ck-visitas ck-portais ck-portais--page">
        <div className="ck-visitas__stage">
          <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
          <div className="ck-visitas__glow ck-visitas__glow--b" aria-hidden />
          <div className="ck-visitas__mesh" aria-hidden />

          <div className="ck-visitas__stage-inner">
            <div className="ck-visitas__hero-row ck-visitas__anim ck-visitas__anim--1">
              <div>
                <p className="ck-visitas__mark-text">Grupo Alvim</p>
                <h1 className="ck-visitas__title">Portais</h1>
              </div>
              <CkMarkLogoMenu size={72} className="ck-visitas__mark-icon" />
            </div>

            <p className="ck-visitas__sub ck-visitas__anim ck-visitas__anim--2">
              Atalhos para os ambientes externos e sistemas do Grupo Alvim.
            </p>
          </div>
        </div>

        <div
          className="ck-visitas__sheet ck-visitas__anim ck-visitas__anim--4"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            paddingTop: 16,
            paddingBottom: 'calc(24px + var(--app-tabbar-offset, 0px))',
            overflowY: 'auto',
          }}
        >
          {PORTAIS.map((portal) => (
            <PortalCardMobile key={portal.id} portal={portal} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 960 }}>
      <Typography sx={{ fontWeight: 700, color: colors.navy, fontSize: '1.125rem' }}>
        Portais do Grupo Alvim
      </Typography>
      <Typography sx={{ mt: 0.5, mb: 2.5, fontSize: '0.875rem', color: colors.textSecondary }}>
        Atalhos para os ambientes externos da operação.
      </Typography>

      <Grid container spacing={2}>
        {PORTAIS.map((portal) => (
          <Grid key={portal.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <PortalCardDesktop portal={portal} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
