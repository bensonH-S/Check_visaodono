import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { assetUrl, toAppPath, LOGO_GRUPO_ALVIM } from '../config/paths';
import { resolvePageTitle } from '../config/pageTitles';
import PageHeaderTitle from '../components/PageHeaderTitle';
import PortalSidebar from './PortalSidebar';
import { usePageTitle } from '../hooks/usePageTitle';
import { getUsuario, logout, temPermissao, podeUsarChecklist, podeGerenciarFrota, podeGerenciarRegioesFrota, podeGerenciarChecklistPerguntas, podeVerAuditoria, podeReceberPainelDiretorChamados } from '../lib/auth';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AssignmentIcon from '@mui/icons-material/Assignment';
import HistoryIcon from '@mui/icons-material/History';
import BuildIcon from '@mui/icons-material/Build';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import MapIcon from '@mui/icons-material/Map';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import { useEffect, useRef } from 'react';
import { showWelcomeToast } from '../utils/toast';
import NotificacoesSino from '../components/NotificacoesSino';
import SobreSistemaButton from '../components/SobreSistemaButton';
import AtivarPushHeaderButton from '../components/AtivarPushHeaderButton';
import AtivarGpsHeaderButton from '../components/AtivarGpsHeaderButton';
import { colors } from '../theme/tokens';
import { isPaginaScrollInterno } from '../utils/pageFillLayout';
import {
  prepararNotificacoesPush,
  PUSH_ATUALIZADO_EVENT,
  sincronizarEstadoPush,
  usuarioAdministraChamados,
} from '../utils/pushNotifications';
import { useAppConfig } from '../hooks/useAppConfig';
import { useTecnicoGpsTracking } from '../hooks/useTecnicoGpsTracking';
import { iniciarServiceWorkerPwa } from '../pwa/registerServiceWorker';
import { SAFE_AREA_TOP, mobileTabBarItemSx, mobileTabBarNavSx, mobileTabBarShellSx, safeAreaBottomCalc, safeAreaX } from '../theme/safeArea';

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  show: boolean;
  end?: boolean;
  mobileTab?: boolean;
  mobileOnly?: boolean;
  isActive?: (pathname: string) => boolean;
};

export default function PortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = toAppPath(location.pathname);
  const user = getUsuario();
  const appConfig = useAppConfig();
  useTecnicoGpsTracking(appConfig);
  const welcomeShown = useRef(false);

  useEffect(() => {
    const nome = (location.state as { welcome?: string } | null)?.welcome;
    if (!nome || welcomeShown.current) return;
    welcomeShown.current = true;
    showWelcomeToast(nome);
    navigate(location.pathname + location.search + location.hash, { replace: true, state: {} });
  }, [location.state, location.pathname, location.search, location.hash, navigate]);

  const isChecklist = path === '/checklist' || path.startsWith('/checklist/');
  const isChamadoNovo = path === '/chamados/novo';
  const emAprovacoes = path.startsWith('/chamados/aprovacoes');
  const isDashboard = path === '/dashboard';
  const emChamados = path.startsWith('/chamados') && !emAprovacoes;

  const podeChamados = temPermissao('chamados.ver', user) || temPermissao('chamados.abrir', user);
  const podeAprovar = temPermissao('chamados.aprovar', user);
  const painelDiretor = podeReceberPainelDiretorChamados(user);
  const administraChamados = usuarioAdministraChamados(user);
  const veSinoChamados = podeChamados || painelDiretor;

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
      {veSinoChamados && (emChamados || isDashboard) && (
        <>
          {administraChamados && (emChamados || isDashboard) && <AtivarPushHeaderButton />}
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
    { to: '/dashboard', label: 'Início', icon: <DashboardIcon fontSize="small" />, show: temPermissao('portal.dashboard.ver', user), end: true, mobileTab: true },
    { to: '/checklist', label: 'Checklist', icon: <AssignmentIcon fontSize="small" />, show: podeUsarChecklist(user), end: true, mobileTab: true, mobileOnly: true },
    { to: '/chamados', label: 'Chamados', icon: <BuildIcon fontSize="small" />, show: temPermissao('chamados.ver', user), end: true, mobileTab: true },
    {
      to: '/frota',
      label: 'Frota',
      icon: <DirectionsCarIcon fontSize="small" />,
      show: podeGerenciarFrota(user),
      isActive: (p: string) =>
        p === '/frota' || (p.startsWith('/frota/') && !p.startsWith('/frota/regioes')),
    },
    { to: '/frota/regioes', label: 'Região de atuação', icon: <MapIcon fontSize="small" />, show: podeGerenciarRegioesFrota(user), end: true },
    { to: '/chamados/aprovacoes', label: 'Aprovações', icon: <ThumbUpAltOutlinedIcon fontSize="small" />, show: temPermissao('chamados.aprovar', user), end: true, mobileTab: true },
    { to: '/visitas', label: 'Visitas', icon: <HistoryIcon fontSize="small" />, show: temPermissao('portal.visitas.ver', user) },
    {
      to: '/configuracoes',
      label: 'Configurações',
      icon: <SettingsIcon fontSize="small" />,
      show: temPermissao('configuracoes.ver', user) || podeGerenciarChecklistPerguntas(user) || temPermissao('usuarios.gerenciar', user) || temPermissao('portal.lojas.ver', user) || podeVerAuditoria(user),
      end: false,
    },
  ].filter((n) => n.show);

  const sidebarNav = nav.filter((n) => !n.mobileOnly);
  const mobileTabs = nav.filter((n) => n.mobileTab);
  const mobileTabsRodape = mobileTabs;

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
              <SobreSistemaButton variante="portal" />
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
            ...safeAreaX(16),
            ...SAFE_AREA_TOP,
            pb: 1,
            minHeight: 52,
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
          <SobreSistemaButton variante="portal" />
          <AtivarGpsHeaderButton gpsAtivo={appConfig.gpsTecnicosEnabled !== false} />
          {isMobileLayout ? notificacoes : null}
          <IconButton size="small" aria-label="Sair" onClick={handleLogout} sx={{ color: colors.textSecondary }}>
            <LogoutIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Box
          component="main"
          className={`flex-1 min-h-0 flex flex-col ${scrollInterno ? 'overflow-hidden' : 'overflow-y-auto'}`}
          sx={{
            pl: { xs: 'max(16px, env(safe-area-inset-left, 0px))', md: 2, xl: 2.5 },
            pr: { xs: 'max(16px, env(safe-area-inset-right, 0px))', md: 2, xl: 2.5 },
            py: scrollInterno ? { xs: 2, md: 2 } : emConfiguracoes ? { xs: 2, md: 2.5 } : { xs: 2.5, md: 3 },
            pb:
              mobileTabsRodape.length > 0 && !isChamadoNovo
                ? { xs: safeAreaBottomCalc(80), md: undefined }
                : undefined,
            maxWidth: colunaEstreita ? { xs: 640, md: 'none' } : 'none',
            mx: colunaEstreita ? { xs: 'auto', md: 0 } : 0,
            width: '100%',
            bgcolor: hideSidebar ? colors.canvas : colors.surface,
          }}
        >
          <Outlet />
        </Box>

        {mobileTabsRodape.length > 0 && !isChamadoNovo && (
          <Box
            component="nav"
            className="md:hidden mobile-tab-bar"
            sx={{
              ...mobileTabBarShellSx(colors.surface, 50),
              display: { xs: 'block', md: 'none' },
              borderColor: colors.border,
            }}
          >
            <Box sx={{ ...mobileTabBarNavSx(52), display: 'flex' }}>
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
                      ...mobileTabBarItemSx(52),
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
          </Box>
        )}
      </Box>
    </Box>
  );
}
