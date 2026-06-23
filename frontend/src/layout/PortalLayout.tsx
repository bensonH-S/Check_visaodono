import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { assetUrl, toAppPath, LOGO_GRUPO_ALVIM } from '../config/paths';
import { resolvePageTitle } from '../config/pageTitles';
import PageHeaderTitle from '../components/PageHeaderTitle';
import PortalSidebar from './PortalSidebar';
import { usePageTitle } from '../hooks/usePageTitle';
import { getUsuario, logout, temPermissao, podeUsarChecklist } from '../lib/auth';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AssignmentIcon from '@mui/icons-material/Assignment';
import HistoryIcon from '@mui/icons-material/History';
import BuildIcon from '@mui/icons-material/Build';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import { useEffect, useRef } from 'react';
import { showToast } from '../utils/toast';
import NotificacoesSino from '../components/NotificacoesSino';
import AtivarPushHeaderButton from '../components/AtivarPushHeaderButton';
import AppFooter from '../components/AppFooter';
import { colors } from '../theme/tokens';
import { isPaginaScrollInterno } from '../utils/pageFillLayout';
import {
  prepararNotificacoesPush,
  PUSH_ATUALIZADO_EVENT,
  sincronizarEstadoPush,
  usuarioAdministraChamados,
} from '../utils/pushNotifications';
import { iniciarServiceWorkerPwa } from '../pwa/registerServiceWorker';

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  show: boolean;
  end?: boolean;
  mobileTab?: boolean;
  mobileOnly?: boolean;
};

export default function PortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = toAppPath(location.pathname);
  const user = getUsuario();
  const welcomeShown = useRef(false);

  useEffect(() => {
    const nome = (location.state as { welcome?: string } | null)?.welcome;
    if (!nome || welcomeShown.current) return;
    welcomeShown.current = true;
    showToast(`Bem-vindo, ${nome}!`, 'success');
    navigate(location.pathname + location.search + location.hash, { replace: true, state: {} });
  }, [location.state, location.pathname, location.search, location.hash, navigate]);

  const isChecklist = path === '/checklist' || path.startsWith('/checklist/');
  const isChamadoNovo = path === '/chamados/novo';
  const emAprovacoes = path.startsWith('/chamados/aprovacoes');
  const isDashboard = path === '/';
  const emChamados = path.startsWith('/chamados') && !emAprovacoes;

  const podeChamados = temPermissao('chamados.ver', user) || temPermissao('chamados.abrir', user);
  const podeAprovar = temPermissao('chamados.aprovar', user);
  const administraChamados = usuarioAdministraChamados(user);

  useEffect(() => {
    if (!user || !administraChamados) return;
    iniciarServiceWorkerPwa();
    const atualizar = () => {
      void sincronizarEstadoPush();
    };
    void sincronizarEstadoPush().then(() => prepararNotificacoesPush());
    window.addEventListener(PUSH_ATUALIZADO_EVENT, atualizar);
    return () => window.removeEventListener(PUSH_ATUALIZADO_EVENT, atualizar);
  }, [user, administraChamados]);

  /** Dashboard: um sino só (chamados). Aprovações só na rota de aprovações. */
  const notificacoes = (
    <>
      {podeChamados && (emChamados || isDashboard) && (
        <>
          {administraChamados && emChamados && <AtivarPushHeaderButton />}
          <NotificacoesSino variante="portal" contexto="chamados" menuLargo />
        </>
      )}
      {podeAprovar && emAprovacoes && (
        <NotificacoesSino variante="portal" contexto="aprovacoes" menuLargo />
      )}
    </>
  );

  const colunaEstreita = isChecklist || isChamadoNovo;
  const scrollInterno = isPaginaScrollInterno(path);
  const emConfiguracoes = path === '/configuracoes' || path.startsWith('/configuracoes/');

  const nav: NavItem[] = [
    { to: '/', label: 'Início', icon: <DashboardIcon fontSize="small" />, show: temPermissao('portal.dashboard.ver', user), end: true, mobileTab: true },
    { to: '/checklist', label: 'Checklist', icon: <AssignmentIcon fontSize="small" />, show: podeUsarChecklist(user), end: true, mobileTab: true, mobileOnly: true },
    { to: '/chamados', label: 'Chamados', icon: <BuildIcon fontSize="small" />, show: temPermissao('chamados.ver', user), end: true, mobileTab: true },
    { to: '/chamados/aprovacoes', label: 'Aprovações', icon: <ThumbUpAltOutlinedIcon fontSize="small" />, show: temPermissao('chamados.aprovar', user), end: true, mobileTab: true },
    { to: '/visitas', label: 'Visitas', icon: <HistoryIcon fontSize="small" />, show: temPermissao('portal.visitas.ver', user) },
    {
      to: '/configuracoes',
      label: 'Configurações',
      icon: <SettingsIcon fontSize="small" />,
      show: temPermissao('configuracoes.ver', user) || temPermissao('usuarios.gerenciar', user) || temPermissao('portal.lojas.ver', user),
      end: false,
    },
  ].filter((n) => n.show);

  const sidebarNav = nav.filter((n) => !n.mobileOnly);
  const mobileTabs = nav.filter((n) => n.mobileTab);
  const mobileTabsRodape = user?.perfil === 'tecnico' ? mobileTabs.filter((n) => n.to === '/chamados') : mobileTabs;

  const pageTitle = resolvePageTitle(path);
  usePageTitle(pageTitle.title);

  const iniciais =
    user?.avatar_inicial ||
    user?.nome?.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() ||
    '?';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const theme = useTheme();
  const isMobileLayout = useMediaQuery(theme.breakpoints.down('md'));

  const hideSidebar = colunaEstreita;

  return (
    <Box
      className={`flex h-full ${colunaEstreita ? 'min-h-screen overflow-y-auto' : 'overflow-hidden'}`}
      sx={{ bgcolor: colors.canvas }}
    >
      {!hideSidebar && (
        <PortalSidebar nav={sidebarNav} user={user} iniciais={iniciais} onLogout={handleLogout} />
      )}

      <Box className="flex-1 flex flex-col min-w-0 min-h-0" sx={{ bgcolor: colors.surface }}>
        {/* Topbar desktop */}
        {!hideSidebar && (
          <Box
            component="header"
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 3,
              height: 56,
              flexShrink: 0,
              borderBottom: '1px solid',
              borderColor: colors.border,
            }}
          >
            <PageHeaderTitle {...pageTitle} variant="desktop" />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {!isMobileLayout ? notificacoes : null}
            </Box>
          </Box>
        )}

        {/* Topbar mobile */}
        <Box
          component="header"
          sx={{
            display: { xs: 'flex', md: 'none' },
            alignItems: 'center',
            px: 2,
            height: 52,
            flexShrink: 0,
            borderBottom: '1px solid',
            borderColor: colors.border,
            gap: 1,
          }}
        >
          {isChamadoNovo && (
            <Box component="img" src={assetUrl(LOGO_GRUPO_ALVIM)} alt="" sx={{ height: 28, objectFit: 'contain' }} />
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <PageHeaderTitle {...pageTitle} variant="mobile" />
          </Box>
          {isMobileLayout ? notificacoes : null}
          <IconButton size="small" aria-label="Sair" onClick={handleLogout} sx={{ color: colors.textSecondary }}>
            <LogoutIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Box
          component="main"
          className={`flex-1 min-h-0 flex flex-col ${scrollInterno ? 'overflow-hidden' : 'overflow-y-auto'} ${mobileTabsRodape.length && !isChamadoNovo ? 'pb-20 md:pb-0' : ''}`}
          sx={{
            px: { xs: 2, sm: 2.5, md: 3, xl: 4 },
            py: scrollInterno ? { xs: 2, md: 2 } : emConfiguracoes ? { xs: 2, md: 2.5 } : { xs: 2.5, md: 3 },
            maxWidth: colunaEstreita ? { xs: 640, md: 'none' } : 'none',
            mx: colunaEstreita ? { xs: 'auto', md: 0 } : 0,
            width: '100%',
            bgcolor: hideSidebar ? colors.canvas : colors.surface,
          }}
        >
          <Outlet />
        </Box>

        <Box sx={{ display: { xs: 'block', md: 'none' }, flexShrink: 0 }}>
          <AppFooter compact />
        </Box>

        {mobileTabsRodape.length > 0 && !isChamadoNovo && (
          <Box
            component="nav"
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex bg-white"
            sx={{
              pb: 'env(safe-area-inset-bottom)',
              borderTop: '1px solid',
              borderColor: colors.border,
            }}
          >
            {mobileTabsRodape.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                style={{ textDecoration: 'none', flex: 1 }}
              >
                {({ isActive }) => (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      py: 1,
                      minHeight: 52,
                      color: isActive ? colors.navy : colors.textMuted,
                      fontSize: '0.625rem',
                      fontWeight: isActive ? 600 : 500,
                      '& .MuiSvgIcon-root': { fontSize: 20, mb: 0.25 },
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </Box>
                )}
              </NavLink>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
