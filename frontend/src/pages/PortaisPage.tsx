import { useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { assetUrl, toAppPath } from '../config/paths';
import { colors, radius, shadows } from '../theme/tokens';

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
    logoBg: '#111111',
    logoPad: 2,
  },
  {
    id: 'freecontrol',
    nome: 'Freecontrol',
    subtitulo: 'Cadastro de freelancers',
    descricao: 'Cadastro e gestão de freelancers das unidades.',
    href: 'https://www.grupoalvim.com.br/freelancers/Cadastro',
    logo: 'Logo_Grupo_Alvim.png',
    logoBg: '#000000',
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

function PortalCard({ portal }: { portal: PortalItem }) {
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
        bgcolor: colors.surface,
        border: '1px solid',
        borderColor: colors.border,
        borderRadius: `${radius.xl}px`,
        boxShadow: shadows.card,
        transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
        '&:hover': {
          borderColor: colors.navyBorder,
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
          height: { xs: 188, sm: 168 },
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

  return (
    <Box sx={{ width: '100%', maxWidth: mobile ? 480 : 960, mx: mobile ? 'auto' : 0 }}>
      {!mobile && (
        <>
          <Typography sx={{ fontWeight: 700, color: colors.navy, fontSize: '1.125rem' }}>
            Portais do Grupo Alvim
          </Typography>
          <Typography sx={{ mt: 0.5, mb: 2.5, fontSize: '0.875rem', color: colors.textSecondary }}>
            Atalhos para os ambientes externos da operação.
          </Typography>
        </>
      )}

      <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mt: mobile ? 0.5 : 0 }}>
        {PORTAIS.map((portal) => (
          <Grid key={portal.id} size={{ xs: 12, sm: 6, md: mobile ? 12 : 4 }}>
            <PortalCard portal={portal} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
