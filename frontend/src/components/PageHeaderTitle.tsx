import Typography from '@mui/material/Typography';
import type { PageTitleConfig } from '../config/pageTitles';
import { colors } from '../theme/tokens';

type Props = PageTitleConfig & {
  variant?: 'mobile' | 'desktop';
};

export default function PageHeaderTitle({ title, variant = 'mobile' }: Props) {
  if (variant === 'desktop') {
    return (
      <Typography
        component="h1"
        sx={{
          fontWeight: 600,
          fontSize: '1.125rem',
          color: colors.textPrimary,
          letterSpacing: '-0.015em',
          lineHeight: 1.3,
          m: 0,
        }}
      >
        {title}
      </Typography>
    );
  }

  return (
    <Typography
      sx={{
        fontWeight: 600,
        fontSize: '0.9375rem',
        color: colors.textPrimary,
        letterSpacing: '-0.01em',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {title}
    </Typography>
  );
}
