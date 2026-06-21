import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { assetUrl, FAVICON_ICON } from '../config/paths';
import { colors } from '../theme/tokens';

type Props = {
  /** Sidebar estreita — só ícone */
  compact?: boolean;
};

/** Marca Grupo Alvim para fundo navy (sem PNG com fundo branco). */
export default function PortalBrandMark({ compact }: Props) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 0.75 : 1.25 }}>
      <Box
        component="img"
        src={assetUrl(FAVICON_ICON)}
        alt=""
        sx={{
          width: compact ? 36 : 44,
          height: compact ? 36 : 44,
          objectFit: 'contain',
          filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.2))',
        }}
      />
      {!compact && (
        <>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '1.05rem',
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            <Box component="span" sx={{ color: 'rgba(255,255,255,0.92)' }}>
              grupo
            </Box>
            <Box component="span" sx={{ color: colors.orange }}>
              alvim
            </Box>
          </Typography>
          <Typography
            sx={{
              fontSize: '0.625rem',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: colors.orange,
              opacity: 0.9,
            }}
          >
            Vision Check
          </Typography>
        </>
      )}
    </Box>
  );
}
