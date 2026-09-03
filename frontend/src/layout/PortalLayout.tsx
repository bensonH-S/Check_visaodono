import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { assetUrl, toAppPath, LOGO_GRUPO_ALVIM } from '../config/paths';
import { resolvePageTitle } from '../config/pageTitles';
import PageHeaderTitle from '../components/PageHeaderTitle';
import PortalSidebar from './PortalSidebar';
import { usePageTitle } from '../hooks/usePageTitle';
import { getUsuario, logout, temPermissao, podeUsarChecklist, podeGerenciarChecklistPerguntas, podeVerAuditoria, podeReceberPainelDiretorChamados, podeVerEscalaVisitas, podeVerMetas, podeVerEstoque, podeVerEnergia } from '../lib/auth';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AssignmentIcon from '@mui/icons-material/Assignment';
import HistoryIcon from '@mui/icons-material/History';
import BuildIcon from '@mui/icons-material/Build';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import BoltIcon from '@mui/icons-material/Bolt';
import SettingsIcon from '@mui/icons-material/Settings';
import LanguageIcon from '@mui/icons-material/Language';
import LogoutIcon from '@mui/icons-material/Logout';
import StoreIcon from '@mui/icons-material/Store';
import PeopleIcon from '@mui/icons-material/People';
import BadgeIcon from '@mui/icons-material/Badge';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TimelineIcon from '@mui/icons-material/Timeline';
import DescriptionIcon from '@mui/icons-material/Description';
import BarChartIcon from '@mui/icons-material/BarChart';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
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
import Popover from '@mui/material/Popover';
import { datePickerPtBR } from '../utils/datePickerLocale';
import { dataHojeBrasilia } from '../utils/dateBr';

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

  const [anchorRegiao, setAnchorRegiao] = useState<null | HTMLElement>(null);
  const [anchorData, setAnchorData] = useState<null | HTMLElement>(null);
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
  
  const dashboardFilters = isDashboard ? (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mr: { xs: 0, md: 1 } }}>
      {/* Date Filter */}
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
        onClick={(e) => setAnchorData(e.currentTarget)}
      >
        <span style={{ textTransform: 'none' }}>{dataFiltroLabel}</span>
        <CalendarMonthIcon sx={{ fontSize: 16, color: colors.textSecondary }} />
      </Box>
      <Popover
        open={Boolean(anchorData)}
        anchorEl={anchorData}
        onClose={() => setAnchorData(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.75,
              borderRadius: '14px',
              border: '1px solid',
              borderColor: colors.border,
              bgcolor: colors.surface,
              overflow: 'hidden',
            },
          },
        }}
      >
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br" localeText={datePickerPtBR}>
          <DateCalendar
            value={dayjs(dataFiltro)}
            onChange={(d: Dayjs | null) => {
              if (!d?.isValid()) return;
              setDataFiltro(d.format('YYYY-MM-DD'));
              setAnchorData(null);
            }}
            maxDate={dayjs(dataHojeBrasilia())}
            sx={{
              '& .MuiPickersDay-root': { borderRadius: '14px' },
              '& .MuiPickersDay-root.Mui-selected': { bgcolor: colors.orange },
            }}
          />
        </LocalizationProvider>
      </Popover>

      {/* Region Filter */}
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
          '&:hover': { borderColor: colors.borderStrong }
        }}
        onClick={(e) => setAnchorRegiao(e.currentTarget)}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{regiaoNome}</span>
        <Box sx={{ display: 'flex', alignItems: 'center', ml: 1, color: colors.textSecondary }}>
          <ArrowDropDownIcon sx={{ fontSize: 18 }} />
        </Box>
      </Box>
      <Menu
        anchorEl={anchorRegiao}
        open={Boolean(anchorRegiao)}
        onClose={() => setAnchorRegiao(null)}
        sx={{ '& .MuiPaper-root': { bgcolor: colors.surface, borderRadius: '14px', minWidth: 160 } }}
      >
        {regioesOpcoes.map((r) => (
          <MenuItem 
            key={r.id ?? 'todas'} 
            selected={r.id === regiaoId}
            onClick={() => { setRegiao(r.id, r.nome); setAnchorRegiao(null); }}
            sx={{ fontSize: '0.8125rem', color: colors.textPrimary }}
          >
            {r.nome}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  ) : null;

  const colunaEstreita = isChecklist || isChamadoNovo;
  const scrollInterno = isPaginaScrollInterno(path);
  const paginaEscalaVisitas = path === '/escalas/visitas';
  const emConfiguracoes = path === '/configuracoes' || path.startsWith('/configuracoes/');
  const emFrota = path === '/frota' || (path.startsWith('/frota/') && !path.startsWith('/frota/mobile'));

  const nav: NavItem[] = [
    { to: '/dashboard', label: 'Command Center', icon: <DashboardIcon fontSize="small" />, show: temPermissao('portal.dashboard.ver', user), end: true },
    
    // OPERAÇÃO
    { to: '/visao-geral', label: 'Visão Geral', icon: <TimelineIcon fontSize="small" />, show: temPermissao('portal.dashboard.ver', user), section: 'OPERAÇÃO' },
    { to: '/checklist', label: 'Auditorias', icon: <AssignmentIcon fontSize="small" />, show: podeUsarChecklist(user), section: 'OPERAÇÃO' },
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
    { to: '/relatorios', label: 'Relatórios', icon: <DescriptionIcon fontSize="small" />, show: true, section: 'GESTÃO' },
    { to: '/indicadores', label: 'Indicadores', icon: <BarChartIcon fontSize="small" />, show: true, section: 'GESTÃO' },

    // CONFIGURAÇÃO
    { to: '/configuracoes/lojas', label: 'Unidades', icon: <StoreIcon fontSize="small" />, show: temPermissao('portal.lojas.ver', user) || temPermissao('configuracoes.ver', user), section: 'CONFIGURAÇÃO' },
    { to: '/usuarios', label: 'Usuários', icon: <PeopleIcon fontSize="small" />, show: temPermissao('usuarios.gerenciar', user), section: 'CONFIGURAÇÃO' },
    { to: '/configuracoes/cargos', label: 'Permissões', icon: <BadgeIcon fontSize="small" />, show: temPermissao('usuarios.gerenciar', user), section: 'CONFIGURAÇÃO' },
    { to: '/configuracoes', label: 'Configurações', icon: <SettingsIcon fontSize="small" />, show: temPermissao('configuracoes.ver', user) || podeGerenciarChecklistPerguntas(user), end: false, section: 'CONFIGURAÇÃO' },
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
          <IconButton size="small" aria-label="Alternar Tema" onClick={toggleTheme} sx={{ color: colors.textSecondary }}>
            {mode === 'dark' ? <LightModeIcon sx={{ fontSize: 20 }} /> : <DarkModeIcon sx={{ fontSize: 20 }} />}
          </IconButton>
          {isMobileLayout ? notificacoes : null}
          <IconButton size="small" aria-label="Sair" onClick={handleLogout} sx={{ color: colors.textSecondary }}>
            <LogoutIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Box
          component="main"
          className={`flex-1 min-h-0 flex flex-col ${scrollInterno ? 'overflow-hidden' : 'overflow-y-auto'}`}
          sx={{
            pl: { xs: 'max(16px, env(safe-area-inset-left, 0px))', md: paginaEscalaVisitas ? 1.5 : 2, xl: paginaEscalaVisitas ? 1.5 : 2.5 },
            pr: { xs: 'max(16px, env(safe-area-inset-right, 0px))', md: paginaEscalaVisitas ? 1.5 : 2, xl: paginaEscalaVisitas ? 1.5 : 2.5 },
            py: paginaEscalaVisitas
              ? { xs: 1, md: 1 }
              : scrollInterno
                ? { xs: 2, md: 2 }
                : emConfiguracoes || emFrota
                  ? { xs: 2, md: 2.5 }
                  : { xs: 2.5, md: 3 },
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
