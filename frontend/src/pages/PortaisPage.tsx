import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { assetUrl, LOGO_ALVIM_ICONE, LOGO_GA_LOCKUP, toAppPath } from '../config/paths';
import { colors, radius, shadows } from '../theme/tokens';
import { getUsuario, logout } from '../lib/auth';
import MobileUsuarioMenu from '../components/MobileUsuarioMenu';
import NotificacoesSino from '../components/NotificacoesSino';
import AppHubDock from '../components/hub/AppHubDock';
import '../components/estoque/estoque-hub.css';
import '../components/visitas/visitas-mobile.css';
import '../components/portais/portais-mobile.css';

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
    <a href={portal.href} target="_blank" rel="noopener noreferrer" className="ck-portais-hub__card">
      <div className="ck-portais-hub__card-logo" style={{ background: portal.logoBg }}>
        <img src={assetUrl(portal.logo)} alt={portal.nome} />
      </div>
      <div className="ck-portais-hub__card-body">
        <div className="ck-portais-hub__card-copy">
          <strong>{portal.nome}</strong>
          <em>{portal.subtitulo}</em>
          <span>{portal.descricao}</span>
        </div>
        <span className="ck-portais-hub__card-open" aria-hidden>
          <OpenInNewIcon sx={{ fontSize: 20 }} />
        </span>
      </div>
    </a>
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
  const navigate = useNavigate();
  const user = getUsuario();

  if (mobile) {
    return (
      <div
        className="ck-estoque-hub ck-estoque-hub--hero ck-portais-hub"
        style={{ ['--ck-hero' as string]: `url(${assetUrl(LOGO_ALVIM_ICONE)})` }}
      >
        <div className="ck-estoque-hub__watermark" aria-hidden />
        <header className="ck-estoque-hub__top ck-estoque-hub__top--fixed">
          <div className="ck-estoque-hub__brand-row">
            <img
              className="ck-estoque-hub__mark ck-estoque-hub__mark--hero"
              src={assetUrl(LOGO_GA_LOCKUP)}
              alt="Grupo Alvim"
            />
            <div className="ck-estoque-hub__actions">
              <NotificacoesSino variante="mobile" contexto="chamados-mobile" />
              <MobileUsuarioMenu
                user={user}
                onLogout={() => {
                  logout();
                  navigate('/login/mobile');
                }}
              />
            </div>
          </div>
          <div className="ck-estoque-hub__hero-copy">
            <div className="ck-estoque-hub__store-row ck-estoque-hub__store-row--hero">
              <h1>Portais</h1>
            </div>
            <p className="ck-portais-hub__sub">
              Atalhos para os ambientes externos e sistemas do Grupo Alvim.
            </p>
          </div>
        </header>

        <div className="ck-estoque-hub__scroll ck-portais-hub__scroll">
          {PORTAIS.map((portal) => (
            <PortalCardMobile key={portal.id} portal={portal} />
          ))}
        </div>

        <AppHubDock ativo={null} plusLabel="Sem ação nesta tela" plusDisabled onPlus={() => {}} />
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
