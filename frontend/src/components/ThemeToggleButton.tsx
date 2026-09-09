import IconButton from '@mui/material/IconButton';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useAppTheme } from '../context/ThemeContext';
import { deveForcarTemaClaroMobile } from '../utils/device';

type Props = {
  /** Cor do ícone. Padrão: colors.textSecondary */
  color?: string;
  size?: 'small' | 'medium';
};

/** Temporário: tema escuro oculto no mobile (app força claro). */
const TEMA_ESCURO_MOBILE_VISIVEL = false;

/**
 * Botão de alternância de tema claro/escuro para headers mobile.
 * Mantido no código; oculto enquanto o mobile fica só no tema claro.
 */
export default function ThemeToggleButton({ color, size = 'small' }: Props) {
  const { mode, toggleTheme } = useAppTheme();
  if (deveForcarTemaClaroMobile()) return null;
  const escuro = mode === 'dark';

  if (!TEMA_ESCURO_MOBILE_VISIVEL) return null;

  return (
    <IconButton
      size={size}
      aria-label="Alternar tema"
      onClick={toggleTheme}
      sx={{
        color: color ?? (escuro ? '#f59e0b' : 'inherit'),
        flexShrink: 0,
        opacity: escuro ? 1 : 0.9,
        transition: 'transform 0.15s ease',
        '&:active': { transform: 'scale(0.92)' },
      }}
    >
      {escuro
        ? <LightModeIcon sx={{ fontSize: size === 'small' ? 20 : 24, color: '#f59e0b' }} />
        : <DarkModeIcon sx={{ fontSize: size === 'small' ? 20 : 24, color: color ?? 'inherit' }} />
      }
    </IconButton>
  );
}
