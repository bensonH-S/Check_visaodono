import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { assetUrl, toAppPath, LOGO_GRUPO_ALVIM } from '../config/paths';
import { usePageTitle } from '../hooks/usePageTitle';
import { getUsuario, logout, temPermissao, labelPerfil } from '../lib/auth';
import PeopleIcon from '@mui/icons-material/People';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AssignmentIcon from '@mui/icons-material/Assignment';
import HistoryIcon from '@mui/icons-material/History';
import StoreIcon from '@mui/icons-material/Store';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BuildIcon from '@mui/icons-material/Build';
import AddIcon from '@mui/icons-material/Add';
import LogoutIcon from '@mui/icons-material/Logout';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { useState } from 'react';

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  show: boolean;
  end?: boolean;
  mobileTab?: boolean;
};

const titles: Record<string, string> = {
  '/': 'Início',
  '/ranking': 'Ranking de Lojas',
  '/checklist': 'Checklist — Visão de Dono',
  '/visitas': 'Histórico de Visitas',
  '/lojas': 'Lojas',
  '/nao-conformidades': 'Não Conformidades',
  '/chamados': 'Chamados',
  '/chamados/novo': 'Abrir chamado',
  '/usuarios': 'Gestão de usuários',
  '/relatorio': 'Relatório da Visita',
};

export default function PortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = toAppPath(location.pathname);
  const user = getUsuario();

  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);

  const isChecklist = path === '/checklist' || path.startsWith('/checklist/');
  const isChamadoNovo = path === '/chamados/novo';
  const campoMobile = isChecklist || isChamadoNovo;

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
  ].filter((n) => n.show);

  const mobileTabs = nav.filter((n) => n.mobileTab);

  const title =
    titles[path] ||
    (path.startsWith('/checklist/concluido') ? 'Visita concluída' : undefined) ||
    (path.startsWith('/relatorio/') ? titles['/relatorio'] : undefined) ||
    'Portal Grupo Alvim';

  usePageTitle(title);

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
    <Box className="flex min-h-screen md:h-screen md:overflow-hidden bg-[#f5f5f3]">
      <Box
        component="aside"
        className={`${campoMobile ? 'hidden' : 'hidden md:flex'} w-56 shrink-0 flex-col bg-white border-r border-gray-200`}
      >
        <Box className="p-4 border-b border-gray-100">
          <Box
            component="img"
            src={assetUrl(LOGO_GRUPO_ALVIM)}
            alt="Grupo Alvim"
            className="block w-full max-w-[220px] h-auto object-contain"
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Portal operacional · BK
          </Typography>
        </Box>
        <Box component="nav" className="flex-1 py-2 overflow-y-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 text-sm no-underline border-l-[3px] transition-colors ${
                  isActive
                    ? 'bg-[#FFF0E8] text-[#1B2A6B] border-[#E8520A] font-medium'
                    : 'text-gray-600 border-transparent hover:bg-gray-50'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </Box>
        <Box className="p-3 border-t border-gray-100">
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
                {user?.perfil ? labelPerfil(user.perfil) : '—'}
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
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }} noWrap>
            {title}
          </Typography>
          <Box className="hidden md:flex items-center gap-2">
            {temPermissao('checklist.executar', user) && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<AssignmentIcon />}
                onClick={() => navigate('/checklist')}
              >
                Checklist
              </Button>
            )}
            {temPermissao('chamados.abrir', user) && (
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => navigate('/chamados/novo')}
              >
                Abrir chamado
              </Button>
            )}
          </Box>
          <IconButton
            className="md:hidden"
            onClick={(e) => setMenuEl(e.currentTarget)}
            aria-label="Menu"
          >
            <MoreHorizIcon />
          </IconButton>
          <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
            {nav
              .filter((n) => !n.mobileTab)
              .map((item) => (
                <MenuItem
                  key={item.to}
                  onClick={() => {
                    setMenuEl(null);
                    navigate(item.to);
                  }}
                >
                  {item.label}
                </MenuItem>
              ))}
            <MenuItem
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              Sair
            </MenuItem>
          </Menu>
        </Box>

        <Box
          component="main"
          className={`flex-1 overflow-y-auto ${campoMobile ? 'p-3 md:p-5' : 'p-4 md:p-5'} ${mobileTabs.length ? 'pb-20 md:pb-5' : ''}`}
          sx={{
            maxWidth: campoMobile ? { xs: 640, md: 'none' } : 'none',
            mx: campoMobile ? { xs: 'auto', md: 0 } : 0,
            width: '100%',
          }}
        >
          <Outlet />
        </Box>

        {mobileTabs.length > 0 && (
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
                    isActive ? 'bg-[#E8520A] text-white' : 'text-white/85'
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
