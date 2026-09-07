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
          fontSize: '1.125rem',
          color: colors.textPrimary,
          letterSpacing: '-0.015em',
          lineHeight: 1.2,
          m: 0,
        }
      : {
          fontWeight: 600,
          fontSize: '0.9375rem',
          color: colors.textPrimary,
          letterSpacing: '-0.01em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      {icon ? <Box sx={{ display: 'flex', flexShrink: 0, alignItems: 'center' }}>{icon}</Box> : null}
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Typography component="h1" sx={typographySx}>
          {title}
        </Typography>
        {subtitle && variant === 'desktop' && (
          <Typography sx={{ fontSize: '0.8125rem', color: colors.textSecondary, mt: 0.25, lineHeight: 1 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
