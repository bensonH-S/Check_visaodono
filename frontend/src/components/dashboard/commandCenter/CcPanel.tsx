import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { shadows } from '../../../theme/tokens';

/** Command Center: cantos mais arredondados. */
export const CC_RADIUS = 14;

export function CcPanel({
  title,
  subtitle,
  action,
  actionTo,
  badge,
  children,
  sx,
  minHeight,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  actionTo?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  sx?: object;
  minHeight?: number | string;
}) {
  return (
    <Box
      sx={{
        bgcolor: 'var(--ga-surface)',
        borderRadius: `${CC_RADIUS}px`,
        border: '1px solid var(--ga-border)',
        p: 2.25,
        display: 'flex',
        flexDirection: 'column',
        minHeight,
        minWidth: 0,
        boxShadow: shadows.sm,
        height: '100%',
        overflow: 'hidden',
        ...sx,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: subtitle ? 0.5 : 1.5, minWidth: 0 }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontWeight: 650,
                fontSize: { xs: '0.78rem', md: '0.9375rem' },
                color: 'var(--ga-text-primary)',
                letterSpacing: '-0.01em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </Typography>
            {badge}
          </Box>
          {subtitle && (
            <Typography sx={{ fontSize: '0.75rem', color: 'var(--ga-text-secondary)', mt: 0.25 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {action && actionTo && (
          <Typography
            component={RouterLink}
            to={actionTo}
            sx={{
              fontSize: { xs: '0.65rem', md: '0.75rem' },
              fontWeight: 600,
              color: 'var(--ga-orange)',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {action}
          </Typography>
        )}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</Box>
    </Box>
  );
}

export function CcEmpty({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', py: 3 }}>
      <Typography sx={{ fontSize: '0.8125rem', color: 'var(--ga-text-secondary)', textAlign: 'center' }}>
        {children}
      </Typography>
    </Box>
  );
}

export function CcSkeleton({ height = 120 }: { height?: number }) {
  return (
    <Box
      sx={{
        height,
        borderRadius: `${CC_RADIUS}px`,
        bgcolor: 'var(--ga-canvas-alt)',
        animation: 'pulse 1.4s ease-in-out infinite',
        '@keyframes pulse': {
          '0%, 100%': { opacity: 0.55 },
          '50%': { opacity: 1 },
        },
      }}
    />
  );
}
