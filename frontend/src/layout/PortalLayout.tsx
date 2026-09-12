import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { assetUrl, toAppPath, LOGO_GRUPO_ALVIM } from '../config/paths';
import { resolvePageTitle } from '../config/pageTitles';
import PageHeaderTitle from '../components/PageHeaderTitle';
import PortalSidebar from './PortalSidebar';
import { usePageTitle } from '../hooks/usePageTitle';
import { getUsuario, logout, temPermissao, podeUsarChecklist, podeReceberPainelDiretorChamados, podeVerEscalaVisitas, podeVerMetas, podeVerEstoque, podeVerEnergia } from '../lib/auth';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Paper from '@mui/material/Paper';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AssignmentIcon from '@mui/icons-material/Assignment';
import HistoryIcon from '@mui/icons-material/History';
import BuildIcon from '@mui/icons-material/Build';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import BoltIcon from '@mui/icons-material/Bolt';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BarChartIcon from '@mui/icons-material/BarChart';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppTheme } from '../context/ThemeContext';
import {
  CommandCenterFiltersProvider,
  useCommandCenterFilters,
} from '../context/CommandCenterFiltersContext';
import { showWelcomeToast } from '../utils/toast';
import NotificacoesSino from '../components/NotificacoesSino';
import SobreSistemaButton from '../components/SobreSistemaButton';
import AtivarPushHeaderButton from '../components/AtivarPushHeaderButton';
import AtivarGpsHeaderButton from '../components/AtivarGpsHeaderButton';
import { colors } from '../theme/tokens';
import { CC_BG } from '../components/dashboard/commandCenter/ccTheme';
import '../components/dashboard/commandCenter/commandCenter.css';
import { isPaginaScrollInterno } from '../utils/pageFillLayout';
import { podeAcessarModuloFrota } from '../pages/frota/frotaNav';
import {
  prepararNotificacoesPush,
  PUSH_ATUALIZADO_EVENT,
  sincronizarEstadoPush,
  usuarioAdministraChamados,
} from '../utils/pushNotifications';
import { useAppConfig } from '../hooks/useAppConfig';
import { useTecnicoGpsTracking } from '../hooks/useTecnicoGpsTracking';
import { iniciarServiceWorkerPwa } from '../pwa/registerServiceWorker';
import { safeAreaBottomCalc, safeAreaTopPadding, safeAreaX } from '../theme/safeArea';
import MobileTabBar from '../components/MobileTabBar';
import { api } from '../api/client';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/pt-br';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { datePickerPtBR } from '../utils/datePickerLocale';
import { dataHojeBrasilia } from '../utils/dateBr';
import { getConfigNavSections } from '../pages/configuracoes/configNav';

dayjs.locale('pt-br');

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  show: boolean;
  end?: boolean;
  mobileOnly?: boolean;
  isActive?: (pathname: string) => boolean;
  section?: string;
};

export default function PortalLayout() {
  return (
    <CommandCenterFiltersProvider>
      <PortalLayoutInner />
    </CommandCenterFiltersProvider>
  );
}

function PortalLayoutInner() {
  const { mode, toggleTheme } = useAppTheme();
  const { data: dataFiltro, setData: setDataFiltro, regiaoId, regiaoNome, setRegiao } =
    useCommandCenterFilters();
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

  const isChamadoNovo = path === '/chamados/novo';
  const emAprovacoes = path.startsWith('/chamados/aprovacoes');
  const isDashboard = path === '/dashboard';
  const emChamados = path.startsWith('/chamados') && !emAprovacoes;
  const emEscala = path === '/escalas/visitas' || path.startsWith('/escalas/visitas');

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
      {(veSinoChamados && (emChamados || isDashboard || emEscala)) ||
      (podeVerEscalaVisitas(user) && emEscala) ? (
        <>
          {administraChamados && (emChamados || isDashboard || emEscala) && <AtivarPushHeaderButton />}
          <NotificacoesSino variante="portal" contexto="chamados" menuLargo />
        </>
      ) : null}
      {podeAprovar && emAprovacoes && (
        <NotificacoesSino variante="portal" contexto="aprovacoes" menuLargo />
      )}
    </>
  );

  const [regiaoAberto, setRegiaoAberto] = useState(false);
  const [dataAberto, setDataAberto] = useState(false);
  const [regioesOpcoes, setRegioesOpcoes] = useState<{ id: number | null; nome: string }[]>([
    { id: null, nome: 'Todas as regiões' },
  ]);

  const dataFiltroLabel = useMemo(() => {
    const d = dayjs(dataFiltro);
    if (!d.isValid()) return dataFiltro;
    return d.locale('pt-br').format('D [de] MMMM [de] YYYY');
  }, [dataFiltro]);

  useEffect(() => {
    if (!isDashboard) return;
    let cancelado = false;
    api
      .frotaRegioes()
      .then((lista) => {
        if (cancelado) return;
        const nomes = lista
          .filter((r) => r.ativo !== false)
          .map((r) => ({ id: r.id_regiao, nome: r.nome }))
          .filter((r) => r.nome);
        setRegioesOpcoes([{ id: null, nome: 'Todas as regiões' }, ...nomes]);
      })
      .catch(() => {
        if (!cancelado) setRegioesOpcoes([{ id: null, nome: 'Todas as regiões' }]);
      });
    return () => {
      cancelado = true;
    };
  }, [isDashboard]);

  // Dropdowns absolutos (não MUI Popover/Menu): o zoom 0.8 do html desloca Popover.
  const painelAbsolutoSx = {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    mt: 0.75,
    zIndex: 10000,
    borderRadius: '14px',
    border: '1px solid',
    borderColor: colors.border,
    bgcolor: colors.surface,
    backgroundImage: 'none',
    boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
    overflow: 'hidden',
  };

  const dashboardFilters = isDashboard ? (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mr: { xs: 0, md: 1 } }}>
      <ClickAwayListener onClickAway={() => setDataAberto(false)}>
        <Box sx={{ position: 'relative' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              height: 34,
              borderRadius: '14px',
              border: '1px solid',
              borderColor: colors.border,
              bgcolor: 'transparent',
              color: colors.textPrimary,
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
              '&:hover': { borderColor: colors.borderStrong },
            }}
            onClick={() => {
              setDataAberto((v) => !v);
              setRegiaoAberto(false);
            }}
          >
            <span style={{ textTransform: 'none' }}>{dataFiltroLabel}</span>
            <CalendarMonthIcon sx={{ fontSize: 16, color: '#E8520A' }} />
          </Box>
          {dataAberto ? (
            <Paper elevation={0} sx={painelAbsolutoSx}>
              <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br" localeText={datePickerPtBR}>
                <DateCalendar
                  value={dayjs(dataFiltro)}
                  onChange={(d: Dayjs | null) => {
                    if (!d?.isValid()) return;
                    setDataFiltro(d.format('YYYY-MM-DD'));
                    setDataAberto(false);
                  }}
                  maxDate={dayjs(dataHojeBrasilia())}
                  sx={{
                    '& .MuiPickersDay-root': { borderRadius: '14px' },
                    '& .MuiPickersDay-root.Mui-selected': { bgcolor: colors.orange },
                  }}
                />
              </LocalizationProvider>
            </Paper>
          ) : null}
        </Box>
      </ClickAwayListener>

      <ClickAwayListener onClickAway={() => setRegiaoAberto(false)}>
        <Box sx={{ position: 'relative' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 1.5,
              height: 34,
              width: { xs: 130, md: 160 },
              borderRadius: '14px',
              border: '1px solid',
              borderColor: colors.border,
              bgcolor: 'transparent',
              color: colors.textPrimary,
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
              '&:hover': { borderColor: colors.borderStrong },
            }}
            onClick={() => {
              setRegiaoAberto((v) => !v);
              setDataAberto(false);
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{regiaoNome}</span>
            <Box sx={{ display: 'flex', alignItems: 'center', ml: 1, color: '#E8520A' }}>
              <ArrowDropDownIcon sx={{ fontSize: 18 }} />
            </Box>
          </Box>
          {regiaoAberto ? (
            <Paper elevation={0} sx={{ ...painelAbsolutoSx, width: 'max-content', minWidth: 200, maxWidth: 320 }}>
              <MenuList dense disablePadding>
                {regioesOpcoes.map((r) => (
                  <MenuItem
                    key={r.id ?? 'todas'}
                    selected={r.id === regiaoId}
                    onClick={() => {
                      setRegiao(r.id, r.nome);
                      setRegiaoAberto(false);
                    }}
                    sx={{
                      fontSize: '0.8125rem',
                      color: colors.textPrimary,
                      gap: 1,
                      whiteSpace: 'normal',
                      alignItems: 'center',
                    }}
                  >
                    {r.id == null ? (
                      <PublicOutlinedIcon sx={{ fontSize: 18, color: '#E8520A', flexShrink: 0 }} />
                    ) : (
                      <PlaceOutlinedIcon sx={{ fontSize: 18, color: '#E8520A', flexShrink: 0 }} />
                    )}
                    <Box component="span" sx={{ lineHeight: 1.35 }}>
                      {r.nome}
                    </Box>
                  </MenuItem>
                ))}
              </MenuList>
            </Paper>
          ) : null}
        </Box>
      </ClickAwayListener>
    </Box>
  ) : null;

  /** Novo chamado: coluna estreita sem sidebar. Checklist desktop fica no portal completo. */
  const colunaEstreita = isChamadoNovo;
  const scrollInterno = isPaginaScrollInterno(path);
  const paginaEscalaVisitas = emEscala;
  const emConfiguracoes = path === '/configuracoes' || path.startsWith('/configuracoes/');
  const emFrota = path === '/frota' || (path.startsWith('/frota/') && !path.startsWith('/frota/mobile'));

  const nav: NavItem[] = [
    { to: '/dashboard', label: 'Command Center', icon: <DashboardIcon fontSize="small" />, show: temPermissao('portal.dashboard.ver', user), end: true },
    
    // OPERAÇÃO
    { to: '/checklist', label: 'AutoREV', icon: <AssignmentIcon fontSize="small" />, show: podeUsarChecklist(user), section: 'OPERAÇÃO' },
    { to: '/nao-conformidades', label: 'Não Conformidades', icon: <WarningAmberIcon fontSize="small" />, show: temPermissao('portal.dashboard.ver', user), section: 'OPERAÇÃO' },
    { to: '/metas', label: 'Metas', icon: <TrackChangesIcon fontSize="small" />, show: podeVerMetas(user), section: 'OPERAÇÃO' },
    { to: '/chamados', label: 'Chamados', icon: <BuildIcon fontSize="small" />, show: temPermissao('chamados.ver', user), section: 'OPERAÇÃO' },
    { to: '/energia', label: 'Energia', icon: <BoltIcon fontSize="small" />, show: podeVerEnergia(user), section: 'OPERAÇÃO' },

    // CAMPO
    { to: '/frota', label: 'Frota', icon: <DirectionsCarIcon fontSize="small" />, show: podeAcessarModuloFrota(user), section: 'CAMPO' },
    { to: '/escalas/visitas', label: 'Planejamento', icon: <CalendarMonthIcon fontSize="small" />, show: podeVerEscalaVisitas(user), section: 'CAMPO' },
    { to: '/visitas', label: 'Visitas', icon: <HistoryIcon fontSize="small" />, show: temPermissao('portal.visitas.ver', user), section: 'CAMPO' },

    // GESTÃO
    { to: '/estoque', label: 'Estoque & CMV', icon: <Inventory2Icon fontSize="small" />, show: podeVerEstoque(user), section: 'GESTÃO' },
    { to: '/ranking', label: 'Indicadores', icon: <BarChartIcon fontSize="small" />, show: temPermissao('portal.dashboard.ver', user), section: 'GESTÃO' },

    // CONFIGURAÇÃO — cadastros e módulos ficam no menu interno de /configuracoes
    {
      to: '/configuracoes',
      label: 'Configurações',
      icon: <SettingsIcon fontSize="small" />,
      show: getConfigNavSections(user).length > 0,
      end: false,
      section: 'CONFIGURAÇÃO',
      isActive: (pathname: string) => pathname === '/configuracoes' || pathname.startsWith('/configuracoes/'),
    },
  ].filter((n) => n.show);

  const sidebarNav = nav.filter((n) => !n.mobileOnly);
  const mobileTabsRodape = nav;

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
      className={`flex h-full ${colunaEstreita ? 'min-h-screen overflow-y-auto' : 'overflow-hidden'}${isDashboard ? ' cc-page' : ''}`}
      sx={{ bgcolor: colors.canvas }}
    >
      {!hideSidebar && (
        <PortalSidebar
          nav={sidebarNav}
          user={user}
          iniciais={iniciais}
          onLogout={handleLogout}
        />
      )}

      <Box className="flex-1 flex flex-col min-w-0 min-h-0" sx={{ bgcolor: isDashboard ? CC_BG : colors.canvas }}>
        {/* Topbar desktop */}
        {!hideSidebar && (
          <Box
            component="header"
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 3,
              height: isDashboard ? 58 : 56,
              flexShrink: 0,
              borderBottom: isDashboard ? 'none' : '1px solid',
              borderColor: colors.border,
              bgcolor: isDashboard ? CC_BG : colors.canvas,
              overflow: 'visible',
              position: 'relative',
              zIndex: isDashboard ? 10000 : 1,
            }}
          >
            <PageHeaderTitle {...pageTitle} variant="desktop" />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {dashboardFilters}
              <IconButton size="small" aria-label="Alternar Tema" onClick={toggleTheme} sx={{ color: colors.textSecondary }}>
                {mode === 'dark' ? <LightModeIcon sx={{ fontSize: 20 }} /> : <DarkModeIcon sx={{ fontSize: 20 }} />}
              </IconButton>
              {!isMobileLayout ? notificacoes : null}
            </Box>
          </Box>
        )}

        {/* Topbar mobile */}
        <Box
          component="header"
          className="mobile-app-header"
          sx={{
            display: { xs: 'flex', md: 'none' },
            alignItems: 'center',
            ...safeAreaX(16),
            pt: safeAreaTopPadding(8),
            pb: 1,
            minHeight: 52,
            flexShrink: 0,
            borderBottom: '1px solid',
            borderColor: colors.border,
            bgcolor: colors.canvas,
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
          {/* Tema escuro oculto no mobile por enquanto — só claro. */}
          {isMobileLayout ? notificacoes : null}
          <IconButton size="small" aria-label="Sair" onClick={handleLogout} sx={{ color: colors.textSecondary }}>
            <LogoutIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Box
          component="main"
          className={`flex-1 min-h-0 flex flex-col ${scrollInterno ? 'overflow-hidden' : 'overflow-y-auto'}`}
          sx={{
            pl: { xs: 'max(16px, env(safe-area-inset-left, 0px))', md: paginaEscalaVisitas ? 1.5 : 3, xl: paginaEscalaVisitas ? 1.5 : 3 },
            pr: { xs: 'max(16px, env(safe-area-inset-right, 0px))', md: paginaEscalaVisitas ? 1.5 : 3, xl: paginaEscalaVisitas ? 1.5 : 3 },
            py: paginaEscalaVisitas
              ? { xs: 1, md: 1 }
              : scrollInterno
                ? { xs: 2, md: 2 }
                : isDashboard
                  ? { xs: 1.25, md: 1.5 }
                  : emConfiguracoes || emFrota
                    ? { xs: 2, md: 2.5 }
                    : { xs: 2.5, md: 3 },
            pb:
              mobileTabsRodape.length > 0 && !isChamadoNovo
                ? { xs: safeAreaBottomCalc(80), md: 3 }
                : isDashboard
                  ? { xs: 1.25, md: 1.5 }
                  : 3,
            maxWidth: colunaEstreita ? { xs: 640, md: 'none' } : 'none',
            mx: colunaEstreita ? { xs: 'auto', md: 0 } : 0,
            width: '100%',
            bgcolor: isDashboard ? CC_BG : colors.canvas,
            ...(isDashboard
              ? {
                  flex: 1,
                  minHeight: 0,
                }
              : null),
          }}
        >
          <Outlet />
        </Box>

        {mobileTabsRodape.length > 0 && !isChamadoNovo && (
          <MobileTabBar
            items={mobileTabsRodape}
            pinnedTos={['/dashboard', '/checklist', '/chamados']}
            hiddenOnDesktop
          />
        )}
      </Box>
    </Box>
  );
}
