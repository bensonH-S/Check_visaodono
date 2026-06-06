import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { assetUrl, toAppPath, LOGO_GRUPO_ALVIM } from '../config/paths';
import { usePageTitle } from '../hooks/usePageTitle';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AssignmentIcon from '@mui/icons-material/Assignment';
import HistoryIcon from '@mui/icons-material/History';
import StoreIcon from '@mui/icons-material/Store';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AddIcon from '@mui/icons-material/Add';
import BuildIcon from '@mui/icons-material/Build';

const nav = [
  { to: '/', label: 'Dashboard', icon: <DashboardIcon fontSize="small" /> },
  { to: '/ranking', label: 'Ranking Lojas', icon: <EmojiEventsIcon fontSize="small" /> },
  { to: '/checklist', label: 'Novo Checklist', icon: <AssignmentIcon fontSize="small" /> },
  { to: '/visitas', label: 'Histórico', icon: <HistoryIcon fontSize="small" /> },
  { to: '/lojas', label: 'Lojas', icon: <StoreIcon fontSize="small" /> },
  { to: '/nao-conformidades', label: 'Não Conformidades', icon: <WarningAmberIcon fontSize="small" /> },
  { to: '/manutencao', label: 'Manutenção', icon: <BuildIcon fontSize="small" /> },
];

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/ranking': 'Ranking de Lojas',
  '/checklist': 'Visão de Dono — Checklist',
  '/visitas': 'Histórico de Visitas',
  '/lojas': 'Gestão de Lojas',
  '/nao-conformidades': 'Não Conformidades',
  '/manutencao': 'Manutenção',
  '/relatorio': 'Relatório da Visita',
};

const tabTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/ranking': 'Ranking',
  '/visitas': 'Histórico',
  '/lojas': 'Lojas',
  '/nao-conformidades': 'Não Conformidades',
  '/relatorio': 'Relatório',
};

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = toAppPath(location.pathname);
  const title =
    titles[path] ||
    (path.startsWith('/relatorio/') ? titles['/relatorio'] : undefined) ||
    'Vision Check';

  const tabTitle =
    tabTitles[path] ||
    (path.startsWith('/relatorio/') ? tabTitles['/relatorio'] : undefined) ||
    'Vision Check';

  usePageTitle(tabTitle);

  return (
    <Box className="flex h-screen overflow-hidden border border-gray-200 rounded-lg m-2">
      <Box
        component="aside"
        className="w-56 shrink-0 flex flex-col bg-white border-r border-gray-200"
      >
        <Box className="p-4 border-b border-gray-100">
          <Box
            component="img"
            src={assetUrl(LOGO_GRUPO_ALVIM)}
            alt="Grupo Alvim"
            className="block w-full max-w-[240px] h-auto object-contain"
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Visão de Dono · Gestão Operacional
          </Typography>
        </Box>
        <Box component="nav" className="flex-1 py-2 overflow-y-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 text-sm no-underline border-l-[3px] transition-colors ${
                  isActive
                    ? 'bg-[#E8EBF5] text-[#1B2A6B] border-[#1B2A6B] font-medium'
                    : 'text-gray-600 border-transparent hover:bg-gray-50 hover:text-[#1B2A6B]'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </Box>
        <Box className="p-3 border-t border-gray-100 flex items-center gap-2">
          <Box
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white font-medium"
            sx={{ bgcolor: 'primary.main' }}
          >
            GV
          </Box>
          <Box>
            <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
              Gabriela V.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Supervisora
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box className="flex-1 flex flex-col min-w-0 bg-[#f5f5f3]">
        <Box
          component="header"
          className="h-14 px-6 flex items-center justify-between shrink-0 bg-white border-b border-gray-200"
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => navigate('/checklist')}
          >
            Nova visita
          </Button>
        </Box>
        <Box component="main" className="flex-1 overflow-y-auto p-5">
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
