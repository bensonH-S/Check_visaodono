import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { assetUrl, toAppPath, LOGO_GRUPO_ALVIM } from '../config/paths';
import { resolvePageTitle } from '../config/pageTitles';
import PageHeaderTitle from '../components/PageHeaderTitle';
import { usePageTitle } from '../hooks/usePageTitle';
import { getUsuario, logout, temPermissao, nomeExibicaoUsuario } from '../lib/auth';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AssignmentIcon from '@mui/icons-material/Assignment';
import HistoryIcon from '@mui/icons-material/History';
import BuildIcon from '@mui/icons-material/Build';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import { useEffect } from 'react';
import { showToast } from '../utils/toast';
import NotificacoesSino from '../components/NotificacoesSino';
import AppFooter from '../components/AppFooter';

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  show: boolean;
  end?: boolean;
  mobileTab?: boolean;
  /** Só no rodapé mobile; não aparece na sidebar desktop */
  mobileOnly?: boolean;
};

export default function PortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = toAppPath(location.pathname);
  const user = getUsuario();

  useEffect(() => {
    const nome = (location.state as { welcome?: string } | null)?.welcome;
    if (!nome) return;
    showToast(`Bem-vindo, ${nome}!`, 'success');
    navigate(location.pathname + location.search + location.hash, { replace: true, state: {} });
  }, [location.state, location.pathname, location.search, location.hash, navigate]);

  const isChecklist = path === '/checklist' || path.startsWith('/checklist/');
  const isChamadoNovo = path === '/chamados/novo';
  const emAprovacoes = path.startsWith('/chamados/aprovacoes');
  const emChamados = path.startsWith('/chamados') && !emAprovacoes;
  /** Formulários de campo: coluna estreita no celular, largura total no desktop. */
  const colunaEstreita = isChecklist || isChamadoNovo;

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
      end: true,
      mobileTab: true,
      mobileOnly: true,
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
      mobileTab: true,
    },
    {
      to: '/visitas',
      label: 'Visitas',
      icon: <HistoryIcon fontSize="small" />,
      show: temPermissao('portal.visitas.ver', user),
    },
    {
      to: '/configuracoes',
      label: 'Configurações',
      icon: <SettingsIcon fontSize="small" />,
      show: temPermissao('configuracoes.ver', user),
      end: true,
    },
  ].filter((n) => n.show);

  const sidebarNav = nav.filter((n) => !n.mobileOnly);
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
      className={`flex h-full bg-[#f5f5f3] ${colunaEstreita ? 'min-h-screen overflow-y-auto' : 'overflow-hidden'}`}
    >
      <Box
        component="aside"
        className={`${colunaEstreita ? 'hidden' : 'hidden md:flex'} w-56 shrink-0 flex-col border-r border-gray-200`}
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
          {sidebarNav.map((item) => (
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
        <Box className="px-3 py-2 border-t border-gray-100" sx={{ bgcolor: 'white' }}>
          <Box className="flex items-center gap-1.5 mb-1.5">
            <Box
              className="w-7 h-7 rounded-full flex items-center justify-center text-[0.65rem] text-white font-semibold shrink-0"
              sx={{ bgcolor: 'primary.main' }}
            >
              {iniciais}
            </Box>
            <Box className="min-w-0">
              <Typography
                variant="caption"
                sx={{ display: 'block', fontWeight: 600, fontSize: '0.7rem', lineHeight: 1.25 }}
                noWrap
              >
                {user?.nome}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: '0.65rem', lineHeight: 1.2 }}
                noWrap
              >
                {nomeExibicaoUsuario(user)}
              </Typography>
            </Box>
          </Box>
          <Button
            variant="text"
            size="small"
            fullWidth
            startIcon={<LogoutIcon sx={{ fontSize: 15 }} />}
            onClick={() => {
              logout();
              navigate('/login');
            }}
            sx={{
              justifyContent: 'flex-start',
              minHeight: 28,
              py: 0.25,
              px: 0.75,
              fontSize: '0.72rem',
              fontWeight: 500,
              color: 'text.secondary',
              '&:hover': { bgcolor: 'rgba(27, 42, 107, 0.06)' },
            }}
          >
            Sair
          </Button>
        </Box>
      </Box>

      <Box className="flex-1 flex flex-col min-w-0 min-h-0">
        <Box
          component="header"
          className="shrink-0 flex items-center bg-white border-b border-gray-200"
          sx={{
            px: { xs: 2, md: 4 },
            py: { xs: 1.25, md: 0 },
            minHeight: { md: 48 },
            gap: 1,
          }}
        >
          {isChamadoNovo && (
            <Box
              component="img"
              src={assetUrl(LOGO_GRUPO_ALVIM)}
              alt="Grupo Alvim"
              sx={{ height: 40, objectFit: 'contain', display: { md: 'none' }, flexShrink: 0 }}
            />
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <PageHeaderTitle {...pageTitle} />
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 0.25, md: 0.5 },
              flexShrink: 0,
              ml: 'auto',
            }}
          >
            {emChamados && (temPermissao('chamados.ver', user) || temPermissao('chamados.abrir', user)) && (
              <NotificacoesSino variante="portal" contexto="chamados" menuLargo />
            )}
            {emAprovacoes && temPermissao('chamados.aprovar', user) && (
              <NotificacoesSino variante="portal" contexto="aprovacoes" menuLargo />
            )}
            <IconButton
              size="small"
              aria-label="Sair"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              sx={{ display: { xs: 'inline-flex', md: 'none' }, color: 'text.secondary' }}
            >
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        <Box
          component="main"
          className={`flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-3 lg:p-4 xl:p-5 ${mobileTabs.length && !isChamadoNovo ? 'pb-20 md:pb-0' : ''}`}
          sx={{
            maxWidth: colunaEstreita ? { xs: 640, md: 'none' } : 'none',
            mx: colunaEstreita ? { xs: 'auto', md: 0 } : 0,
            width: '100%',
          }}
        >
          <Outlet />
        </Box>

        <Box sx={{ flexShrink: 0, display: { xs: mobileTabs.length && !isChamadoNovo ? 'none' : 'block', md: 'block' } }}>
          <AppFooter compact />
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
                  `flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 text-[0.62rem] sm:text-[0.65rem] font-semibold no-underline min-h-[48px] min-w-0 ${
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
    </Box>
  );
}
