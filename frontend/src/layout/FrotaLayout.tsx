import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { toAppPath } from '../config/paths';
import { getUsuario } from '../lib/auth';
import { colors, radius } from '../theme/tokens';
import { useAppTheme } from '../context/ThemeContext';
import {
  getFrotaNavSections,
  isFrotaNavItemAtivo,
} from '../pages/frota/frotaNav';

function FrotaMenuItem({
  to,
  label,
  icon,
  ativo,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  ativo: boolean;
}) {
  return (
    <NavLink to={to} end={false} style={{ textDecoration: 'none' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.25,
          py: 0.875,
          borderRadius: `${radius.md}px`,
          fontSize: '0.8125rem',
          fontWeight: ativo ? 600 : 450,
          color: ativo ? colors.textPrimary : colors.textSecondary,
          bgcolor: ativo ? colors.surface : 'transparent',
          borderLeft: '3px solid',
          borderColor: ativo ? '#E8520A' : 'transparent',
          transition: 'background-color 0.12s, color 0.12s',
          '&:hover': {
            bgcolor: colors.surface,
            color: colors.textPrimary,
          },
          '& .MuiSvgIcon-root': {
            fontSize: 16,
            color: ativo ? '#E8520A' : colors.textMuted,
          },
        }}
      >
        {icon}
        {label}
      </Box>
    </NavLink>
  );
}

/** Módulo único de frota — menu interno dentro de um painel fechado. */
export default function FrotaLayout() {
  const theme = useTheme();
  const { mode } = useAppTheme();
  const escuro = mode === 'dark';
  const acento = escuro ? '#E8520A' : colors.navy;
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();
  const path = toAppPath(location.pathname);
  const search = location.search;
  const sections = getFrotaNavSections(getUsuario());
  const items = sections.flatMap((s) => s.items);
  const tabAtivo = Math.max(
    0,
    items.findIndex((item) => isFrotaNavItemAtivo(path, item.to)),
  );

  return (
    <Paper
      elevation={0}
      sx={{
        flex: 1,
        minHeight: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: colors.border,
        borderRadius: 2,
        bgcolor: colors.surface,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      {isMobile && items.length > 1 && (
        <Box
          sx={{
            flexShrink: 0,
            borderBottom: '1px solid',
            borderColor: colors.border,
            bgcolor: colors.canvas,
          }}
        >
          <Tabs
            value={tabAtivo}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              minHeight: 44,
              px: 1,
              '& .MuiTabs-indicator': { bgcolor: acento, height: 2 },
              '& .MuiTab-root': {
                minHeight: 44,
                py: 1,
                px: 1.25,
                minWidth: 'auto',
                textTransform: 'none',
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: colors.textSecondary,
                '&.Mui-selected': { color: `${acento} !important`, fontWeight: 600 },
              },
            }}
          >
            {items.map((item) => (
              <Tab key={item.to} label={item.label} component={Link} to={`${item.to}${search}`} />
            ))}
          </Tabs>
        </Box>
      )}

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          overflow: 'hidden',
        }}
      >
        {!isMobile && (
          <Box
            component="nav"
            aria-label="Módulos de frota"
            sx={{
              width: 232,
              flexShrink: 0,
              borderRight: '1px solid',
              borderColor: colors.border,
              bgcolor: colors.canvas,
              overflowY: 'auto',
              py: 2,
              px: 1.25,
            }}
          >
            {sections.map((section, idx) => (
              <Box key={section.title} sx={{ mb: idx < sections.length - 1 ? 2 : 0 }}>
                {idx > 0 && <Divider sx={{ mb: 1.5 }} />}
                <Typography
                  sx={{
                    px: 1.25,
                    pb: 0.75,
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: colors.textMuted,
                  }}
                >
                  {section.title}
                </Typography>
                {section.items.map((item) => (
                  <FrotaMenuItem
                    key={item.to}
                    to={`${item.to}${search}`}
                    label={item.label}
                    icon={item.icon}
                    ativo={isFrotaNavItemAtivo(path, item.to)}
                  />
                ))}
              </Box>
            ))}
          </Box>
        )}

        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            p: { xs: 2, md: 2.5 },
            bgcolor: colors.surface,
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Paper>
  );
}
