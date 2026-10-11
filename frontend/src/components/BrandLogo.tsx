import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { assetUrl, LOGO_MERIDIAN_GESTAO, LOGO_MERIDIAN_MARK_M } from '../config/paths';

type BrandLogoProps = {
  maxWidth?: number | { xs?: number; sm?: number; md?: number };
  sx?: SxProps<Theme>;
  /** icone = símbolo oficial | full = wordmark Gestão Operacional */
  variante?: 'full' | 'icone';
  /** Desliga o scale no hover (ex.: sidebar com crop). */
  disableHover?: boolean;
};

export default function BrandLogo({
  maxWidth = 200,
  sx,
  variante = 'full',
  disableHover = false,
}: BrandLogoProps) {
  const src =
    variante === 'icone'
      ? `${assetUrl(LOGO_MERIDIAN_MARK_M)}?v=oficial3`
      : `${assetUrl(LOGO_MERIDIAN_GESTAO)}?v=oficial3`;

  return (
    <Box
      component="img"
      src={src}
      alt="Meridian"
      sx={[
        {
          width: '100%',
          maxWidth,
          height: 'auto',
          display: 'block',
          objectFit: 'contain',
          transition: 'transform 0.2s ease',
          ...(!disableHover ? { '&:hover': { transform: 'scale(1.06)' } } : null),
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    />
  );
}
