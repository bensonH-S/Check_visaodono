import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { toAppPath } from '../config/paths';
import { usePageTitle } from '../hooks/usePageTitle';
import BrandLogo from '../components/BrandLogo';
import { APP_NAME } from '../config/brand';

const NAVY = '#1B2A6B';
const BRAND_ORANGE = '#E8520A';

/** Layout enxuto para auditoria no celular (sem menu lateral). */
export default function ChecklistLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = toAppPath(location.pathname);
  const concluido = path.startsWith('/checklist/concluido/');

  usePageTitle(concluido ? 'Visita concluída' : 'Checklist');

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#f5f5f3',
        maxWidth: 640,
        mx: 'auto',
        boxShadow: { xs: 'none', sm: '0 0 0 1px rgba(0,0,0,0.06)' },
      }}
    >
      <Box
        component="header"
        sx={{
          px: 2,
          pt: 'max(12px, env(safe-area-inset-top))',
          pb: 1.5,
          bgcolor: 'white',
          borderBottom: '1px solid rgba(27, 42, 107, 0.1)',
          boxShadow: '0 2px 12px rgba(27, 42, 107, 0.06)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {!concluido && (
            <IconButton
              size="small"
              onClick={() => navigate('/dashboard')}
              aria-label="Voltar"
              sx={{ color: NAVY, ml: -0.5, flexShrink: 0 }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          )}
          <BrandLogo maxWidth={68} sx={{ flexShrink: 0 }} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              sx={{
                fontWeight: 800,
                color: BRAND_ORANGE,
                fontSize: '1rem',
                lineHeight: 1.15,
              }}
            >
              {APP_NAME}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                lineHeight: 1.25,
                color: NAVY,
                display: 'block',
                fontSize: '0.75rem',
              }}
            >
              {concluido ? 'Visita concluída' : 'Checklist'}
            </Typography>
          </Box>
        </Box>
      </Box>
      <Box component="main" sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
