import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Paper from '@mui/material/Paper';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Grow from '@mui/material/Grow';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import LogoutIcon from '@mui/icons-material/Logout';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Activity } from 'lucide-react';
import MeridianMarca from '../brand/MeridianMarca';
import SobreSistemaDialog from '../components/SobreSistemaDialog';
import IntegrationsStatusDialog from '../components/IntegrationsStatusDialog';
import { nomeExibicaoUsuario } from '../lib/auth';
import type { UsuarioSessao } from '../lib/auth';
import { toAppPath } from '../config/paths';
import { colors, layout, radius } from '../theme/tokens';
import { useAppConfig } from '../hooks/useAppConfig';
import { useAppTheme } from '../context/ThemeContext';
import { api, type IntegrationStatusGroup } from '../api/client';

export type SidebarNavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
  isActive?: (pathname: string) => boolean;
  section?: string;
};

type Props = {
  nav: SidebarNavItem[];
  user: UsuarioSessao | null;
  iniciais: string;
  onLogout: () => void;
};

/** Menu plano estilo Azimut: tudo visível, compacto, sem acordeão. */
export default function PortalSidebar({ nav, user, iniciais, onLogout }: Props) {
  const { version, environment } = useAppConfig();
  const { mode } = useAppTheme();
  const escuro = mode === 'dark';
  const acento = '#1B6EF3';
  const { pathname } = useLocation();
  const appPath = toAppPath(pathname);
  const versionLabel = version === 'dev' ? 'dev' : version.startsWith('v') ? version : `v${version}`;

  const [menuAberto, setMenuAberto] = useState(false);
  const [sobreAberto, setSobreAberto] = useState(false);
  const [statusAberto, setStatusAberto] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusGroups, setStatusGroups] = useState<IntegrationStatusGroup[]>([]);
  const [statusErro, setStatusErro] = useState('');

  async function carregarStatus() {
    setStatusLoading(true);
    setStatusErro('');
    try {
      const res = await api.integrationsStatus();
      setStatusGroups(res.groups?.length ? res.groups : []);
    } catch (e) {
      setStatusGroups([]);
      setStatusErro(e instanceof Error ? e.message : 'Não foi possível consultar o status');
    } finally {
      setStatusLoading(false);
    }
  }

  function abrirStatusApi() {
    setMenuAberto(false);
    setStatusAberto(true);
    void carregarStatus();
  }

  const noSection = nav.filter((n) => !n.section);
  const sections = Array.from(new Set(nav.filter((n) => n.section).map((n) => n.section as string)));

  const renderItem = (item: SidebarNavItem) => (
    <NavLink key={`${item.section ?? ''}:${item.to}:${item.label}`} to={item.to} end={item.end} style={{ textDecoration: 'none' }}>
      {({ isActive: navActive }) => {
        const isActive = item.isActive ? item.isActive(appPath) : navActive;
        return (
          <Box
            sx={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 1.1,
              px: 1.15,
              py: 0.55,
              mb: 0.2,
              borderRadius: '8px',
              fontSize: 12.5,
              fontWeight: isActive ? 600 : 500,
              letterSpacing: isActive ? '0.01em' : 0,
              color: isActive ? 'var(--ga-sidebar-active-text)' : 'rgba(248, 250, 252, 0.88)',
              bgcolor: isActive ? 'var(--ga-sidebar-active-bg)' : 'transparent',
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              transition: 'background-color 0.15s ease, color 0.15s ease',
              '&::before': {
                content: '""',
                position: 'absolute',
                left: 0,
                top: '18%',
                bottom: '18%',
                width: 2.5,
                borderRadius: '0 2px 2px 0',
                bgcolor: isActive ? 'var(--ga-sidebar-active-border)' : 'transparent',
                transition: 'background-color 0.15s ease',
              },
              '&:hover': {
                bgcolor: isActive ? 'var(--ga-sidebar-active-bg)' : 'var(--ga-sidebar-hover)',
                color: '#FFFFFF',
              },
              '& .MuiSvgIcon-root': {
                fontSize: 16,
                color: isActive ? 'var(--ga-sidebar-active-icon)' : 'rgba(248, 250, 252, 0.78)',
                transition: 'color 0.15s ease',
              },
              '&:hover .MuiSvgIcon-root': {
                color: isActive ? 'var(--ga-sidebar-active-icon)' : '#FFFFFF',
              },
            }}
          >
            {item.icon}
            {item.label}
          </Box>
        );
      }}
    </NavLink>
  );

  return (
    <Box
      component="aside"
      sx={{
        width: layout.sidebarWidth,
        minWidth: layout.sidebarWidth,
        maxWidth: layout.sidebarWidth,
        flexShrink: 0,
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        bgcolor: colors.sidebarBg,
        height: '100%',
        borderRight: '1px solid',
        borderColor: colors.sidebarBorder,
      }}
    >
      <Box
        sx={{
          px: 1.5,
          pt: 1.75,
          pb: 1.25,
          borderBottom: '1px solid',
          borderColor: 'var(--ga-sidebar-border)',
          flexShrink: 0,
        }}
      >
        <MeridianMarca variant="mark" sx={{ width: '100%', maxWidth: 200, mx: 'auto' }} />
      </Box>

      <Box
        component="nav"
        sx={{
          flex: 1,
          minHeight: 0,
          px: 1.15,
          pt: 1.35,
          pb: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {noSection.map(renderItem)}
        {sections.map((sec) => (
          <Box key={sec} sx={{ mt: 1.75 }}>
            <Typography
              sx={{
                px: 1.15,
                mb: 0.55,
                fontSize: '0.625rem',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--ga-sidebar-muted)',
                lineHeight: 1.2,
              }}
            >
              {sec}
            </Typography>
            {nav.filter((n) => n.section === sec).map(renderItem)}
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          position: 'relative',
          px: 1.5,
          py: 1.25,
          borderTop: '1px solid',
          borderColor: 'var(--ga-sidebar-border)',
          bgcolor: 'var(--ga-sidebar-bg)',
          flexShrink: 0,
        }}
      >
        {menuAberto && (
          <ClickAwayListener onClickAway={() => setMenuAberto(false)}>
            <Grow in={menuAberto} style={{ transformOrigin: 'bottom center' }}>
              <Paper
                elevation={8}
                sx={{
                  position: 'absolute',
                  bottom: 'calc(100% + 8px)',
                  left: 12,
                  right: 12,
                  zIndex: 1300,
                  borderRadius: `${radius.md}px`,
                  bgcolor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  boxShadow: escuro ? '0 12px 32px rgba(0, 0, 0, 0.6)' : '0 12px 32px rgba(15, 23, 42, 0.16)',
                  overflow: 'hidden',
                }}
              >
                <MenuList sx={{ py: 0.5 }}>
                  <MenuItem
                    onClick={() => {
                      setMenuAberto(false);
                      setSobreAberto(true);
                    }}
                  >
                    <ListItemIcon>
                      <InfoOutlinedIcon fontSize="small" sx={{ color: acento }} />
                    </ListItemIcon>
                    <ListItemText
                      primary="Sobre"
                      slotProps={{ primary: { sx: { fontSize: '0.875rem', fontWeight: 600, color: colors.textPrimary } } }}
                    />
                  </MenuItem>
                  <MenuItem onClick={abrirStatusApi}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Activity size={18} strokeWidth={2} color={acento} aria-hidden />
                    </ListItemIcon>
                    <ListItemText
                      primary="Status API"
                      slotProps={{ primary: { sx: { fontSize: '0.875rem', fontWeight: 600, color: colors.textPrimary } } }}
                    />
                  </MenuItem>
                  <Divider sx={{ my: 0.5, borderColor: escuro ? 'rgba(255, 255, 255, 0.08)' : colors.border }} />
                  <MenuItem
                    onClick={() => {
                      setMenuAberto(false);
                      onLogout();
                    }}
                    sx={{ color: '#EF4444' }}
                  >
                    <ListItemIcon>
                      <LogoutIcon fontSize="small" sx={{ color: '#EF4444' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary="Sair"
                      slotProps={{ primary: { sx: { fontSize: '0.875rem', fontWeight: 600, color: '#EF4444' } } }}
                    />
                  </MenuItem>
                </MenuList>
              </Paper>
            </Grow>
          </ClickAwayListener>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            component="button"
            type="button"
            aria-label="Menu da conta"
            aria-haspopup="true"
            aria-expanded={menuAberto}
            onClick={() => setMenuAberto((v) => !v)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              minWidth: 0,
              flex: 1,
              p: 0.5,
              borderRadius: `${radius.md}px`,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              transition: 'background-color 0.12s, transform 0.12s',
              '&:hover': { bgcolor: 'var(--ga-sidebar-hover)' },
              '&:hover .sidebar-user-avatar': {
                transform: 'scale(1.05)',
                boxShadow: `0 0 0 2px var(--ga-sidebar-bg), 0 0 0 4px ${acento}44`,
              },
            }}
          >
            <Box
              className="sidebar-user-avatar"
              sx={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.625rem',
                fontWeight: 600,
                color: '#fff',
                bgcolor: acento,
                flexShrink: 0,
                boxShadow: `0 0 0 2px var(--ga-sidebar-bg)`,
                transition: 'transform 0.12s, box-shadow 0.12s',
              }}
            >
              {iniciais}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontWeight: 600, lineHeight: 1.2, color: 'var(--ga-sidebar-text)', fontSize: 13 }} noWrap>
                {user?.nome}
              </Typography>
              <Typography sx={{ color: 'var(--ga-sidebar-muted)', fontSize: 12, lineHeight: 1.2, mt: 0.25 }} noWrap>
                {nomeExibicaoUsuario(user)}
              </Typography>
            </Box>
          </Box>
          <Tooltip title="Sair" placement="top">
            <IconButton
              size="small"
              aria-label="Sair"
              onClick={onLogout}
              sx={{
                width: 28,
                height: 28,
                color: 'var(--ga-sidebar-muted)',
                '&:hover': { color: '#fff', bgcolor: 'var(--ga-sidebar-hover)' },
              }}
            >
              <LogoutIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography
          sx={{
            display: 'block',
            textAlign: 'center',
            color: 'var(--ga-sidebar-muted)',
            fontSize: '0.6rem',
            fontWeight: 500,
            mt: 0.9,
            letterSpacing: '0.02em',
          }}
        >
          {versionLabel} · {environment}
        </Typography>
      </Box>

      <IntegrationsStatusDialog
        open={statusAberto}
        onClose={() => setStatusAberto(false)}
        loading={statusLoading}
        erro={statusErro}
        groups={statusGroups}
        onAtualizar={() => void carregarStatus()}
      />
      <SobreSistemaDialog open={sobreAberto} onClose={() => setSobreAberto(false)} />
    </Box>
  );
}
