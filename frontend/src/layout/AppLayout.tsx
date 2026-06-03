import { Outlet, NavLink, useNavigate } from 'react-router-dom';
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

const nav = [
  { to: '/', label: 'Dashboard', icon: <DashboardIcon fontSize="small" /> },
  { to: '/ranking', label: 'Ranking Lojas', icon: <EmojiEventsIcon fontSize="small" /> },
  { to: '/checklist', label: 'Novo Checklist', icon: <AssignmentIcon fontSize="small" /> },
  { to: '/visitas', label: 'Histórico', icon: <HistoryIcon fontSize="small" /> },
  { to: '/lojas', label: 'Lojas', icon: <StoreIcon fontSize="small" /> },
  { to: '/nao-conformidades', label: 'Não Conformidades', icon: <WarningAmberIcon fontSize="small" /> },
];

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/ranking': 'Ranking de Lojas',
  '/checklist': 'Novo Checklist',
  '/visitas': 'Histórico de Visitas',
  '/lojas': 'Gestão de Lojas',
  '/nao-conformidades': 'Não Conformidades',
  '/relatorio': 'Relatório da Visita',
};

export default function AppLayout() {
  const navigate = useNavigate();
  const path = location.pathname;
  const title = titles[path] || titles[path.replace(/\/\d+$/, '/relatorio')] || 'Vision Check';

  return (
    <Box className="flex h-screen overflow-hidden border border-gray-200 rounded-lg m-2">
      <Box
        component="aside"
        className="w-56 shrink-0 flex flex-col"
        sx={{ bgcolor: 'secondary.main' }}
      >
        <Box className="p-4 border-b border-white/10 flex items-center gap-2">
          <Box
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            sx={{ bgcolor: 'primary.main' }}
          >
            ga
          </Box>
          <Box>
            <Typography variant="body2" sx={{ color: 'white', fontWeight: 600 }}>
              grupo<span style={{ color: '#E8520A' }}>alvim</span>
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              Gestão Operacional
            </Typography>
          </Box>
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
                    ? 'bg-[rgba(232,82,10,0.2)] text-white border-[#E8520A]'
                    : 'text-white/65 border-transparent hover:bg-white/8 hover:text-white'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </Box>
        <Box className="p-3 border-t border-white/10 flex items-center gap-2">
          <Box
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white font-medium"
            sx={{ bgcolor: 'primary.main' }}
          >
            GV
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'white', display: 'block' }}>
              Gabriela V.
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)' }}>
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
