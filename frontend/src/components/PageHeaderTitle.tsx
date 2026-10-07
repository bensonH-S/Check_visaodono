import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { PageTitleConfig } from '../config/pageTitles';
import { colors } from '../theme/tokens';

type Props = PageTitleConfig & {
  variant?: 'mobile' | 'desktop';
};

export default function PageHeaderTitle({ title, subtitle, icon, variant = 'mobile' }: Props) {
  const typographySx =
    variant === 'desktop'
      ? {
          fontWeight: 600,
          fontSize: 15,
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          color: colors.textPrimary,
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
          m: 0,
        }
      : {
          fontWeight: 600,
          fontSize: 14,
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          color: colors.textPrimary,
          letterSpacing: '-0.01em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
      {icon ? <Box sx={{ display: 'flex', flexShrink: 0, alignItems: 'center', '& .MuiSvgIcon-root': { fontSize: 18 } }}>{icon}</Box> : null}
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Typography component="h1" sx={typographySx}>
          {title}
        </Typography>
        {subtitle && variant === 'desktop' && (
          <Typography sx={{ fontSize: 11, fontWeight: 400, color: colors.textSecondary, mt: 0.15, lineHeight: 1.3 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
