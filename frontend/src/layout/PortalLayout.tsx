import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { assetUrl, toAppPath, LOGO_GRUPO_ALVIM } from '../config/paths';
import { resolvePageTitle } from '../config/pageTitles';
import PageHeaderTitle from '../components/PageHeaderTitle';
import { usePageTitle } from '../hooks/usePageTitle';
import { getUsuario, logout, temPermissao, nomeExibicaoUsuario } from '../lib/auth';
import PeopleIcon from '@mui/icons-material/People';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AssignmentIcon from '@mui/icons-material/Assignment';
import HistoryIcon from '@mui/icons-material/History';
import StoreIcon from '@mui/icons-material/Store';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BuildIcon from '@mui/icons-material/Build';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import { useEffect, useState } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import NotificacoesSino from '../components/NotificacoesSino';
import AppFooter from '../components/AppFooter';

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  show: boolean;
  end?: boolean;
  mobileTab?: boolean;
};

export default function PortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = toAppPath(location.pathname);
  const user = getUsuario();

  const [welcome, setWelcome] = useState('');

  useEffect(() => {
    const nome = (location.state as { welcome?: string } | null)?.welcome;
    if (!nome) return;
    setWelcome(nome);
    navigate(location.pathname + location.search + location.hash, { replace: true, state: {} });
  }, [location.state, location.pathname, location.search, location.hash, navigate]);

  const isChecklist = path === '/checklist' || path.startsWith('/checklist/');
  const isChamadoNovo = path === '/chamados/novo';
  const emAprovacoes = path.startsWith('/chamados/aprovacoes');
  const emChamados = path.startsWith('/chamados') && !emAprovacoes;
  const campoMobile = isChecklist;

  const nav: NavItem[] = [
    {
      to: '/',
      label: 'Início',
      icon: <DashboardIcon fontSize="small" />,
      show: temPermissao('portal.dashboard.ver', user),
      end: true,
      mobileTab: true,
    },
    {
      to: '/checklist',
      label: 'Checklist',
      icon: <AssignmentIcon fontSize="small" />,
      show: temPermissao('checklist.ver', user) || temPermissao('checklist.executar', user),
      mobileTab: temPermissao('checklist.executar', user),
    },
    {
      to: '/chamados',
      label: 'Chamados',
      icon: <BuildIcon fontSize="small" />,
      show: temPermissao('chamados.ver', user),
      end: true,
      mobileTab: true,
    },
    {
      to: '/chamados/aprovacoes',
      label: 'Aprovações',
      icon: <ThumbUpAltOutlinedIcon fontSize="small" />,
      show: temPermissao('chamados.aprovar', user),
      end: true,
    },
    {
      to: '/visitas',
      label: 'Visitas',
      icon: <HistoryIcon fontSize="small" />,
      show: temPermissao('portal.visitas.ver', user),
    },
    {
      to: '/ranking',
      label: 'Ranking',
      icon: <EmojiEventsIcon fontSize="small" />,
      show: temPermissao('portal.ranking.ver', user),
    },
    {
      to: '/lojas',
      label: 'Lojas',
      icon: <StoreIcon fontSize="small" />,
      show: temPermissao('portal.lojas.ver', user),
    },
    {
      to: '/nao-conformidades',
      label: 'NCs',
      icon: <WarningAmberIcon fontSize="small" />,
      show: temPermissao('portal.ncs.ver', user),
    },
    {
      to: '/usuarios',
      label: 'Usuários',
      icon: <PeopleIcon fontSize="small" />,
      show: temPermissao('usuarios.gerenciar', user),
    },
    {
      to: '/configuracoes',
      label: 'Configurações',
      icon: <SettingsIcon fontSize="small" />,
      show: temPermissao('configuracoes.ver', user),
      end: true,
    },
  ].filter((n) => n.show);

  const mobileTabs = nav.filter((n) => n.mobileTab);

  const pageTitle = resolvePageTitle(path);

  usePageTitle(pageTitle.title);

  const iniciais =
    user?.avatar_inicial ||
    user?.nome
      ?.split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ||
    '?';

  return (
    <Box
      className={`flex h-full bg-[#f5f5f3] ${campoMobile ? 'min-h-screen overflow-y-auto' : 'overflow-hidden'}`}
    >
      <Box
        component="aside"
        className={`${campoMobile ? 'hidden' : 'hidden md:flex'} w-56 shrink-0 flex-col border-r border-gray-200`}
        sx={{
          bgcolor: 'white',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <Box className="px-4 py-3 border-b border-gray-100 flex justify-center">
          <Box
            component="img"
            src={assetUrl(LOGO_GRUPO_ALVIM)}
            alt="Grupo Alvim"
            className="block w-full max-w-[140px] h-auto object-contain"
          />
        </Box>
        <Box component="nav" className="flex-1 py-2 overflow-y-auto" sx={{ bgcolor: 'white' }}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 text-sm no-underline border-l-[3px] transition-colors ${
                  isActive
                    ? 'bg-[#E8EBF5] text-[#1B2A6B] border-[#1B2A6B] font-medium'
                    : 'text-gray-600 border-transparent hover:bg-gray-50'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </Box>
        <Box className="p-3 border-t border-gray-100" sx={{ bgcolor: 'white' }}>
          <Box className="flex items-center gap-2 mb-2">
            <Box
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-semibold shrink-0"
              sx={{ bgcolor: 'primary.main' }}
            >
              {iniciais}
            </Box>
            <Box className="min-w-0">
              <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }} noWrap>
                {user?.nome}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {nomeExibicaoUsuario(user)}
              </Typography>
            </Box>
          </Box>
          <Button
            size="small"
            fullWidth
            startIcon={<LogoutIcon />}
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Sair
          </Button>
        </Box>
      </Box>

      <Box className="flex-1 flex flex-col min-w-0 min-h-0">
        <Box
          component="header"
          className="shrink-0 px-3 md:px-6 py-2.5 md:py-0 md:h-14 flex items-center gap-2 bg-white border-b border-gray-200"
        >
          {campoMobile && (
            <Box
              component="img"
              src={assetUrl(LOGO_GRUPO_ALVIM)}
              alt="Grupo Alvim"
              sx={{ height: 40, objectFit: 'contain', display: { md: 'none' } }}
            />
          )}
          <PageHeaderTitle {...pageTitle} />
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
            {emChamados && (temPermissao('chamados.ver', user) || temPermissao('chamados.abrir', user)) && (
              <NotificacoesSino variante="portal" contexto="chamados" />
            )}
            {emAprovacoes && temPermissao('chamados.aprovar', user) && (
              <NotificacoesSino variante="portal" contexto="aprovacoes" />
            )}
          </Box>
        </Box>

        <Box
          component="main"
          className={`flex-1 min-h-0 overflow-y-auto ${campoMobile || isChamadoNovo ? 'p-3 md:p-5' : 'p-4 md:p-5'} ${mobileTabs.length && !isChamadoNovo ? 'pb-20 md:pb-0' : ''}`}
          sx={{
            maxWidth: campoMobile || isChamadoNovo ? { xs: 640, md: 'none' } : 'none',
            mx: campoMobile || isChamadoNovo ? { xs: 'auto', md: 0 } : 0,
            width: '100%',
          }}
        >
          <Outlet />
        </Box>

        <Box sx={{ flexShrink: 0, display: { xs: mobileTabs.length && !isChamadoNovo ? 'none' : 'block', md: 'block' } }}>
          <AppFooter />
        </Box>

        {mobileTabs.length > 0 && !isChamadoNovo && (
          <Box
            component="nav"
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-gray-200 bg-[#1B2A6B]"
            sx={{ pb: 'env(safe-area-inset-bottom)' }}
          >
            {mobileTabs.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex-1 flex flex-col items-center justify-center py-2 text-[0.65rem] font-semibold no-underline min-h-[52px] ${
                    isActive ? 'bg-[#1B2A6B] text-white' : 'text-white/85'
                  }`
                }
              >
                {item.icon}
                <span className="mt-0.5">{item.label}</span>
              </NavLink>
            ))}
          </Box>
        )}
      </Box>

      <Snackbar
        open={!!welcome}
        autoHideDuration={2500}
        onClose={() => setWelcome('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setWelcome('')} sx={{ width: '100%' }}>
          Bem-vindo, {welcome}!
        </Alert>
      </Snackbar>
    </Box>
  );
}
