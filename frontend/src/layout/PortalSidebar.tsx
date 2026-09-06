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
import BrandLogo from '../components/BrandLogo';
import SobreSistemaDialog from '../components/SobreSistemaDialog';
import IntegrationsStatusDialog from '../components/IntegrationsStatusDialog';
import { nomeExibicaoUsuario } from '../lib/auth';
import type { UsuarioSessao } from '../lib/auth';
import { toAppPath } from '../config/paths';
import { colors, layout, radius, sectionLabelSx } from '../theme/tokens';
import { APP_NAME } from '../config/brand';
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

export default function PortalSidebar({ nav, user, iniciais, onLogout }: Props) {
  const { version, environment } = useAppConfig();
  const { mode } = useAppTheme();
  const escuro = mode === 'dark';
  const acento = escuro ? '#E8520A' : '#1B2A6B';
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

  return (
    <Box
      component="aside"
      sx={{
        width: layout.sidebarWidth,
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
          px: 1.75,
          pt: 2,
          pb: 1.5,
          borderBottom: '1px solid',
          borderColor: colors.border,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <BrandLogo
          maxWidth={118}
          sx={{
            display: 'block',
            // Compensa padding transparente do PNG
            mb: '-14px',
          }}
        />
        <Typography
          sx={{
            mt: 0.25,
            textAlign: 'center',
            fontSize: '0.78rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            lineHeight: 1.15,
            color: escuro ? colors.textPrimary : '#E8520A',
          }}
        >
          {APP_NAME}
        </Typography>
      </Box>

      <Box component="nav" sx={{ flex: 1, px: 1.25, py: 1.75, overflowY: 'auto' }}>
        {(() => {
          const noSection = nav.filter((n) => !n.section);
          const sections = Array.from(new Set(nav.filter((n) => n.section).map((n) => n.section as string)));

          const renderItem = (item: SidebarNavItem) => (
            <NavLink key={item.to} to={item.to} end={item.end} style={{ textDecoration: 'none' }}>
              {({ isActive: navActive }) => {
                const isActive = item.isActive ? item.isActive(appPath) : navActive;
                return (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1.25,
                      py: 0.75,
                      mb: 0.375,
                      borderRadius: `${radius.md}px`,
                      fontSize: '0.8125rem',
                      fontWeight: isActive ? 600 : 450,
                      color: isActive ? 'var(--ga-sidebar-active-text)' : colors.textSecondary,
                      bgcolor: isActive ? 'var(--ga-sidebar-active-bg)' : 'transparent',
                      borderLeft: '3px solid',
                      borderColor: isActive ? 'var(--ga-sidebar-active-border)' : 'transparent',
                      transition: 'background-color 0.12s, color 0.12s, border-color 0.12s',
                      '&:hover': {
                        bgcolor: isActive ? 'var(--ga-sidebar-active-bg)' : colors.canvasAlt,
                        color: colors.textPrimary,
                      },
                      '& .MuiSvgIcon-root': {
                        fontSize: 17,
                        color: isActive ? 'var(--ga-sidebar-active-icon)' : colors.textMuted,
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
            <>
              {noSection.map(renderItem)}
              {sections.map((sec) => (
                <Box key={sec} sx={{ mt: 2.5 }}>
                  <Typography sx={{ ...sectionLabelSx, px: 1, mb: 1 }}>{sec}</Typography>
                  {nav.filter((n) => n.section === sec).map(renderItem)}
                </Box>
              ))}
            </>
          );
        })()}
      </Box>

      <Box
        sx={{
          position: 'relative',
          px: 1.5,
          py: 1.5,
          borderTop: '1px solid',
          borderColor: colors.border,
          bgcolor: colors.canvas,
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
              '&:hover': {
                bgcolor: colors.canvasAlt,
              },
              '&:hover .sidebar-user-avatar': {
                transform: 'scale(1.05)',
                boxShadow: `0 0 0 2px ${colors.surface}, 0 0 0 4px ${acento}44`,
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
                boxShadow: `0 0 0 2px ${colors.surface}`,
                transition: 'transform 0.12s, box-shadow 0.12s',
              }}
            >
              {iniciais}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontWeight: 600, lineHeight: 1.25, color: colors.textPrimary, fontSize: '0.75rem' }} noWrap>
                {user?.nome}
              </Typography>
              <Typography sx={{ color: colors.textSecondary, fontSize: '0.625rem', lineHeight: 1.25, opacity: 0.9, mt: 0.25 }} noWrap>
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
                color: colors.textMuted,
                '&:hover': { color: colors.navy, bgcolor: colors.navyMuted },
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
            color: colors.textMuted,
            fontSize: '0.6rem',
            fontWeight: 500,
            mt: 1.1,
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
