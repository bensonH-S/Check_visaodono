import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';
import { assetUrl } from '../config/paths';

type Props = {
  /** mark = sidebar | lockup = login / destaque */
  variant?: 'mark' | 'lockup';
  sx?: SxProps<Theme>;
};

/** Marca Meridian oficial — no sidebar a tagline vai em texto (legível). */
export default function MeridianMarca({ variant = 'mark', sx }: Props) {
  const isMark = variant === 'mark';
  const src = assetUrl(isMark ? 'meridian-mark-word.png' : 'meridian-lockup.png');

  return (
    <Box
      sx={[
        {
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box
        component="img"
        src={`${src}?v=legivel1`}
        alt="Meridian"
        sx={{
          width: '100%',
          height: 'auto',
          display: 'block',
          objectFit: 'contain',
          filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.16))',
        }}
      />
      {isMark ? (
        <Box
          sx={{
            mt: 0.9,
            display: 'flex',
            alignItems: 'center',
            gap: 0.65,
            px: 0.15,
          }}
        >
          <Box sx={{ flex: '0 0 14px', height: '1.5px', bgcolor: '#1B6EF3', borderRadius: 1 }} />
          <Typography
            component="span"
            sx={{
              flex: 1,
              color: '#FFFFFF',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.04em',
              lineHeight: 1.25,
              textAlign: 'center',
              textTransform: 'uppercase',
              textShadow: '0 0 10px rgba(255,255,255,0.28)',
            }}
          >
            Gestão financeira e operacional
          </Typography>
          <Box sx={{ flex: '0 0 14px', height: '1.5px', bgcolor: '#1B6EF3', borderRadius: 1 }} />
        </Box>
      ) : null}
    </Box>
  );
}
