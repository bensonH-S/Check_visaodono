import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import { iniciaisUsuario, type UsuarioSessao } from '../lib/auth';
import { assetUrl, LOGO_ALVIM_ICONE, toAppPath } from '../config/paths';
import { getFotoPerfil } from '../utils/fotoPerfil';
import { api, type IntegrationStatusGroup } from '../api/client';
import SobreSistemaDialog from './SobreSistemaDialog';
import IntegrationsStatusDialog from './IntegrationsStatusDialog';

const NAVY = '#1B2A6B';

type Props = {
  user: UsuarioSessao | null;
  onLogout: () => void;
  triggerLogo?: boolean;
  logoSize?: number;
  logoClassName?: string;
};

function contextoDaRota(pathname: string): string | undefined {
  const p = toAppPath(pathname);
  if (p.startsWith('/freelancers')) return 'freela';
  if (p.startsWith('/mapa')) return 'mapa';
  if (p.startsWith('/frota')) return 'frota';
  if (p.startsWith('/checklist')) return 'checklist';
  if (p.startsWith('/visitas') || p.startsWith('/relatorio')) return 'visitas';
  if (p.startsWith('/chamados')) return 'chamados';
  if (p.startsWith('/nc')) return 'ncs';
  if (p.startsWith('/estoque')) return 'estoque';
  if (p.startsWith('/escalas')) return 'escala';
  return undefined;
}

export default function MobileUsuarioMenu({
  user,
  onLogout,
  triggerLogo = false,
  logoSize = 64,
  logoClassName,
}: Props) {
  const location = useLocation();
  const contexto = contextoDaRota(location.pathname);
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [sobreAberto, setSobreAberto] = useState(false);
  const [statusAberto, setStatusAberto] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusGroups, setStatusGroups] = useState<IntegrationStatusGroup[]>([]);
  const [statusErro, setStatusErro] = useState('');
  const foto = user ? getFotoPerfil(user.id_usuario) : null;
  const iniciais = iniciaisUsuario(user);

  function fecharMenu() {
    setAnchor(null);
  }

  async function carregarStatus() {
    setStatusLoading(true);
    setStatusErro('');
    try {
      const res = await api.integrationsStatus(contexto ? { contexto } : undefined);
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
    <>
      <IconButton
        aria-label="Menu do utilizador"
        aria-haspopup="true"
        aria-expanded={!!anchor}
        onClick={(e) => setAnchor(e.currentTarget)}
        className={triggerLogo ? logoClassName : undefined}
        sx={{
          p: triggerLogo ? 0 : 0.15,
          ml: triggerLogo ? 0 : 0.35,
          flexShrink: 0,
          alignSelf: triggerLogo ? 'flex-start' : undefined,
        }}
      >
        {triggerLogo ? (
          <Box
            component="img"
            src={assetUrl(LOGO_ALVIM_ICONE)}
            alt="Grupo Alvim"
            className={logoClassName || 'ck-visitas__mark-icon'}
            sx={{
              width: logoSize,
              height: logoSize,
              objectFit: 'contain',
              display: 'block',
              margin: 0,
            }}
          />
        ) : (
          <Avatar
            src={foto ?? undefined}
            alt={user?.nome ?? 'Utilizador'}
            sx={{
              width: 46,
              height: 46,
              bgcolor: foto ? 'transparent' : 'rgba(27, 42, 107, 0.12)',
              color: NAVY,
              fontWeight: 800,
              fontSize: '0.88rem',
              border: 'none',
            }}
          >
            {!foto && iniciais}
          </Avatar>
        )}
      </IconButton>

      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={fecharMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 220,
              borderRadius: 2.5,
              mt: 0.75,
              boxShadow: '0 12px 32px rgba(27, 42, 107, 0.16)',
            },
          },
        }}
      >
        <MenuItem onClick={abrirStatusApi}>
          <ListItemIcon>
            <DnsOutlinedIcon fontSize="small" sx={{ color: NAVY }} />
          </ListItemIcon>
          <ListItemText
            primary="Status API"
            slotProps={{ primary: { sx: { fontSize: '0.9rem', fontWeight: 600 } } }}
          />
        </MenuItem>
        <MenuItem
          onClick={() => {
            fecharMenu();
            setSobreAberto(true);
          }}
        >
          <ListItemIcon>
            <InfoOutlinedIcon fontSize="small" sx={{ color: NAVY }} />
          </ListItemIcon>
          <ListItemText
            primary="Sobre"
            slotProps={{ primary: { sx: { fontSize: '0.9rem', fontWeight: 600 } } }}
          />
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem
          onClick={() => {
            fecharMenu();
            onLogout();
          }}
          sx={{ color: '#DC2626' }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" sx={{ color: '#DC2626' }} />
          </ListItemIcon>
          <ListItemText
            primary="Terminar sessão"
            slotProps={{ primary: { sx: { fontSize: '0.9rem', fontWeight: 600 } } }}
          />
        </MenuItem>
      </Menu>

      <IntegrationsStatusDialog
        open={statusAberto}
        onClose={() => setStatusAberto(false)}
        loading={statusLoading}
        erro={statusErro}
        groups={statusGroups}
        contexto={contexto}
        onAtualizar={() => void carregarStatus()}
      />

      <SobreSistemaDialog open={sobreAberto} onClose={() => setSobreAberto(false)} />
    </>
  );
}
