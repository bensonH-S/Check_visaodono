import Box from '@mui/material/Box';
import { useNavigate } from 'react-router-dom';
import { getUsuario, logout } from '../lib/auth';
import MobileUsuarioMenu from './MobileUsuarioMenu';
import ThemeToggleButton from './ThemeToggleButton';

type Props = {
  /** Tamanho do ícone (px), alinhado ao mark-icon das telas immersive. */
  size?: number;
  className?: string;
};

/** Logo do header immersive — abre menu (Sobre, Status API, terminar sessão). */
export default function CkMarkLogoMenu({ size = 72, className }: Props) {
  const navigate = useNavigate();
  const user = getUsuario();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <ThemeToggleButton />
      <MobileUsuarioMenu
        triggerLogo
        logoSize={size}
        logoClassName={className}
        user={user}
        onLogout={() => {
          logout();
          navigate('/login/mobile');
        }}
      />
    </Box>
  );
}
