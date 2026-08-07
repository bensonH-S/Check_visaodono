import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
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
import { api, type IntegrationStatusGroup } from '../api/client';

export type SidebarNavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
  isActive?: (pathname: string) => boolean;
};

type Props = {
  nav: SidebarNavItem[];
  user: UsuarioSessao | null;
  iniciais: string;
  onLogout: () => void;
};

export default function PortalSidebar({ nav, user, iniciais, onLogout }: Props) {
  const { version, environment } = useAppConfig();
  const { pathname } = useLocation();
  const appPath = toAppPath(pathname);
  const versionLabel = version === 'dev' ? 'dev' : version.startsWith('v') ? version : `v${version}`;

  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [sobreAberto, setSobreAberto] = useState(false);
  const [statusAberto, setStatusAberto] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusGroups, setStatusGroups] = useState<IntegrationStatusGroup[]>([]);
  const [statusErro, setStatusErro] = useState('');

  function fecharMenu() {
    setAnchor(null);
  }

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
    fecharMenu();
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
          pt: 2.25,
          pb: 2,
          borderBottom: '1px solid',
          borderColor: colors.border,
        }}
      >
        <BrandLogo maxWidth={118} sx={{ filter: 'none', mx: 'auto', display: 'block' }} />
        <Typography
          sx={{
            mt: 1.25,
            textAlign: 'center',
            fontSize: '0.625rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: colors.textMuted,
          }}
        >
          {APP_NAME}
        </Typography>
      </Box>

      <Box component="nav" sx={{ flex: 1, px: 1.25, py: 1.75, overflowY: 'auto' }}>
        <Typography sx={{ ...sectionLabelSx, px: 1, mb: 1 }}>Navegação</Typography>
        {nav.map((item) => (
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
                  color: isActive ? colors.navy : colors.textSecondary,
                  bgcolor: isActive ? colors.navyMuted : 'transparent',
                  borderLeft: '3px solid',
                  borderColor: isActive ? colors.orange : 'transparent',
                  transition: 'background-color 0.12s, color 0.12s, border-color 0.12s',
                  '&:hover': {
                    bgcolor: isActive ? colors.navyMuted : colors.canvasAlt,
                    color: colors.textPrimary,
                  },
                  '& .MuiSvgIcon-root': {
                    fontSize: 17,
                    color: isActive ? colors.navy : colors.textMuted,
                  },
                }}
              >
                {item.icon}
                {item.label}
              </Box>
            );
            }}
          </NavLink>
        ))}
      </Box>

      <Box
        sx={{
          px: 1.5,
          py: 1.5,
          borderTop: '1px solid',
          borderColor: colors.border,
          bgcolor: colors.canvas,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Conta, Sobre e Status API" placement="top">
            <Box
              component="button"
              type="button"
              aria-label="Menu da conta"
              aria-haspopup="true"
              aria-expanded={!!anchor}
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => setAnchor(e.currentTarget)}
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
                bgcolor: colors.navy,
                flexShrink: 0,
                boxShadow: `0 0 0 2px ${colors.surface}`,
                border: 'none',
                cursor: 'pointer',
                p: 0,
                fontFamily: 'inherit',
                transition: 'transform 0.12s, box-shadow 0.12s',
                '&:hover': {
                  transform: 'scale(1.06)',
                  boxShadow: `0 0 0 2px ${colors.surface}, 0 0 0 4px ${colors.orange}55`,
                },
              }}
            >
              {iniciais}
            </Box>
          </Tooltip>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 600, lineHeight: 1.25, color: colors.textPrimary, fontSize: '0.75rem' }} noWrap>
              {user?.nome}
            </Typography>
            <Typography sx={{ color: colors.textMuted, fontSize: '0.625rem', lineHeight: 1.25 }} noWrap>
              {nomeExibicaoUsuario(user)}
            </Typography>
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
        <Typography sx={{ display: 'block', textAlign: 'center', color: colors.textMuted, fontSize: '0.5625rem', mt: 1 }}>
          {versionLabel} · {environment}
        </Typography>
      </Box>

      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={fecharMenu}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 200,
              borderRadius: 2,
              mb: 0.75,
              boxShadow: '0 12px 32px rgba(27, 42, 107, 0.16)',
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            fecharMenu();
            setSobreAberto(true);
          }}
        >
          <ListItemIcon>
            <InfoOutlinedIcon fontSize="small" sx={{ color: colors.navy }} />
          </ListItemIcon>
          <ListItemText
            primary="Sobre"
            slotProps={{ primary: { sx: { fontSize: '0.875rem', fontWeight: 600, color: colors.navy } } }}
          />
        </MenuItem>
        <MenuItem onClick={abrirStatusApi}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <Activity size={18} strokeWidth={2} color={colors.navy} aria-hidden />
          </ListItemIcon>
          <ListItemText
            primary="Status API"
            slotProps={{ primary: { sx: { fontSize: '0.875rem', fontWeight: 600, color: colors.navy } } }}
          />
        </MenuItem>
      </Menu>

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
