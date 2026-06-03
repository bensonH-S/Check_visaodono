import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

/** Layout enxuto para auditoria no celular (sem menu lateral). */
export default function ChecklistLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const concluido = location.pathname.includes('/concluido/');

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
          px: 1,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          bgcolor: 'white',
          borderBottom: '1px solid',
          borderColor: 'divider',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        {!concluido && (
          <IconButton size="small" onClick={() => navigate('/')} aria-label="Voltar">
            <ArrowBackIcon />
          </IconButton>
        )}
        <Box
          component="img"
          src="/logo-grupo-alvim.png"
          alt="Grupo Alvim"
          sx={{ height: 52, maxWidth: 140, objectFit: 'contain' }}
        />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, ml: concluido ? 0 : 0.5, flex: 1 }}>
          {concluido ? 'Visita concluída' : 'Visão de Dono'}
        </Typography>
      </Box>
      <Box component="main" sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
