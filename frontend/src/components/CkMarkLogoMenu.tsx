import { useNavigate } from 'react-router-dom';
import { getUsuario, logout } from '../lib/auth';
import MobileUsuarioMenu from './MobileUsuarioMenu';

type Props = {
  /** Tamanho do ícone (px), alinhado ao mark-icon das telas immersive. */
  size?: number;
  className?: string;
};

/** Logo do header immersive — abre menu (Sobre, Status API, terminar sessão). */
export default function CkMarkLogoMenu({ size = 56, className }: Props) {
  const navigate = useNavigate();
  const user = getUsuario();

  return (
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
  );
}
