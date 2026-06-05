import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { assetUrl, toAppPath, LOGO_GRUPO_ALVIM } from '../../config/paths';
import { usePageTitle } from '../../hooks/usePageTitle';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import BuildIcon from '@mui/icons-material/Build';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ListAltIcon from '@mui/icons-material/ListAlt';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import IconButton from '@mui/material/IconButton';

const navMobile = [
  { to: '/manutencao', label: 'Chamados', icon: <ListAltIcon fontSize="small" /> },
  { to: '/manutencao/novo', label: 'Abrir', icon: <AddCircleIcon fontSize="small" /> },
];

export default function ManutencaoLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = toAppPath(location.pathname);
  const isNovo = path === '/manutencao/novo';

  usePageTitle(isNovo ? 'Manutenção — Novo chamado' : 'Manutenção');

  return (
    <Box className="flex flex-col min-h-[calc(100vh-1rem)] md:flex-row md:h-screen overflow-hidden border border-gray-200 rounded-lg m-2 bg-[#f5f5f3]">
      <Box
        component="aside"
        className="hidden md:flex w-56 shrink-0 flex-col bg-white border-r border-gray-200"
      >
        <Box className="p-4 border-b border-gray-100">
          <Box
            component="img"
            src={assetUrl(LOGO_GRUPO_ALVIM)}
            alt="Grupo Alvim"
            className="block w-full max-w-[200px] h-auto"
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Portal de Manutenção
          </Typography>
        </Box>
        <Box component="nav" className="flex-1 py-2">
          {navMobile.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/manutencao'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2.5 text-sm no-underline border-l-[3px] ${
                  isActive
                    ? 'bg-[#FFF0E8] text-[#1B2A6B] border-[#E8520A] font-semibold'
                    : 'text-gray-600 border-transparent hover:bg-gray-50'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to="/"
            className="flex items-center gap-2 px-4 py-2 mt-4 text-sm text-gray-500 no-underline hover:text-[#1B2A6B]"
          >
            <ArrowBackIcon fontSize="small" />
            Voltar ao Vision Check
          </NavLink>
        </Box>
      </Box>

      <Box className="flex-1 flex flex-col min-w-0 min-h-0">
        <Box
          component="header"
          className="shrink-0 px-4 py-3 md:px-6 md:py-4 flex items-center gap-2 bg-white border-b border-gray-200"
        >
          <IconButton
            size="small"
            className="md:hidden"
            onClick={() => navigate('/')}
            aria-label="Voltar"
          >
            <ArrowBackIcon />
          </IconButton>
          <BuildIcon sx={{ color: 'primary.main', display: { xs: 'none', md: 'block' } }} />
          <Box className="flex-1 min-w-0">
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {isNovo ? 'Abrir chamado' : 'Manutenção'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Grupo Alvim
            </Typography>
          </Box>
        </Box>

        <Box
          component="main"
          className="flex-1 overflow-y-auto p-4 md:p-5 pb-24 md:pb-5"
          sx={{ WebkitOverflowScrolling: 'touch' }}
        >
          <Outlet />
        </Box>

        <Box
          component="nav"
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-gray-200 bg-[#1B2A6B] safe-area-pb"
          sx={{ pb: 'env(safe-area-inset-bottom)' }}
        >
          {navMobile.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/manutencao'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2.5 text-[0.7rem] font-semibold no-underline ${
                  isActive ? 'bg-[#E8520A] text-white' : 'text-white/85'
                }`
              }
            >
              {item.icon}
              <span className="mt-0.5">{item.label}</span>
            </NavLink>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
