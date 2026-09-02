import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import { assetUrl } from '../config/paths';
import { colors, portalCardSx, radius } from '../theme/tokens';

type PortalItem = {
  id: string;
  nome: string;
  subtitulo: string;
  descricao: string;
  href: string;
  logo?: string;
  logoBg?: string;
};

const PORTAIS: PortalItem[] = [
  {
    id: 'ciga',
    nome: 'CIGA',
    subtitulo: 'Centro de Inteligência',
    descricao: 'Plataforma de inteligência corporativa e financeira do Grupo Alvim.',
    href: 'https://centralga.com.br/ciga/',
    logo: 'CIGA.png',
    logoBg: '#111111',
  },
  {
    id: 'freecontrol',
    nome: 'Freecontrol',
    subtitulo: 'Cadastro de freelancers',
    descricao: 'Cadastro e gestão de freelancers das unidades.',
    href: 'https://www.grupoalvim.com.br/freelancers/Cadastro',
    logo: 'Logo_GA_fonte_freecontrol.png',
    logoBg: '#111111',
  },
  {
    id: 'ouvidoria',
    nome: 'Ouvidoria',
    subtitulo: 'Canal confidencial',
    descricao: 'Denúncias, assédio, operações e sugestões — seguro e confidencial.',
    href: 'https://ouvidoriagrupoalvim.com.br/',
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
        ...portalCardSx,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.75,
        height: '100%',
        textDecoration: 'none',
        color: 'inherit',
        cursor: 'pointer',
        '&:hover .portal-abrir': {
          color: colors.orange,
        },
      }}
    >
      <Box
        sx={{
          height: 88,
          borderRadius: `${radius.md}px`,
          bgcolor: portal.logoBg ?? colors.navyMuted,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {portal.logo ? (
          <Box
            component="img"
            src={assetUrl(portal.logo)}
            alt=""
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              p: 1,
            }}
          />
        ) : (
          <RecordVoiceOverIcon sx={{ fontSize: 36, color: colors.navy }} />
        )}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, color: colors.navy, fontSize: '1rem', lineHeight: 1.25 }}>
          {portal.nome}
        </Typography>
        <Typography
          sx={{
            mt: 0.25,
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: colors.textMuted,
          }}
        >
          {portal.subtitulo}
        </Typography>
        <Typography sx={{ mt: 1, fontSize: '0.8125rem', color: colors.textSecondary, lineHeight: 1.45 }}>
          {portal.descricao}
        </Typography>
      </Box>

      <Typography
        className="portal-abrir"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: colors.navy,
          transition: 'color 0.12s',
        }}
      >
        Abrir portal
        <OpenInNewIcon sx={{ fontSize: 15 }} />
      </Typography>
    </Box>
  );
}

export default function PortaisPage() {
  return (
    <Box sx={{ width: '100%', maxWidth: 960 }}>
      <Typography sx={{ fontWeight: 700, color: colors.navy, fontSize: '1.125rem' }}>
        Portais do Grupo Alvim
      </Typography>
      <Typography sx={{ mt: 0.5, mb: 2.5, fontSize: '0.875rem', color: colors.textSecondary }}>
        Atalhos para os ambientes externos da operação.
      </Typography>

      <Grid container spacing={{ xs: 1.5, sm: 2 }}>
        {PORTAIS.map((portal) => (
          <Grid key={portal.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <PortalCard portal={portal} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
