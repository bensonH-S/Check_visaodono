import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { CC_BORDER, CC_BRAND_ORANGE, CC_RADIUS, CC_SURFACE } from './ccTheme';

export { CC_RADIUS } from './ccTheme';

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
  title?: string;
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
        bgcolor: CC_SURFACE,
        borderRadius: `${CC_RADIUS}px`,
        border: `1px solid ${CC_BORDER}`,
        p: 1.75,
        display: 'flex',
        flexDirection: 'column',
        minHeight,
        minWidth: 0,
        boxShadow: 'none',
        height: '100%',
        overflow: 'hidden',
        ...sx,
      }}
    >
      {(title || action) && (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: subtitle ? 0.35 : 1.15, minWidth: 0 }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85, minWidth: 0 }}>
              {title && (
                <Typography
                  sx={{
                    fontWeight: 650,
                    fontSize: '0.875rem',
                    color: 'var(--ga-text-primary)',
                    letterSpacing: '-0.01em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {title}
                </Typography>
              )}
              {badge}
            </Box>
            {subtitle && (
              <Typography sx={{ fontSize: '0.6875rem', color: 'var(--ga-text-secondary)', mt: 0.15 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {action && actionTo && (
            <Typography
              component={RouterLink}
              to={actionTo}
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: CC_BRAND_ORANGE,
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
      )}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</Box>
    </Box>
  );
}

export function CcEmpty({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
      <Typography sx={{ fontSize: '0.75rem', color: 'var(--ga-text-secondary)', textAlign: 'center' }}>
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

export function CcSectionTitle({
  title,
  action,
  actionTo,
  badge,
}: {
  title: string;
  action?: string;
  actionTo?: string;
  badge?: React.ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85, minWidth: 0 }}>
        <Typography
          sx={{
            fontWeight: 650,
            fontSize: '0.875rem',
            color: 'var(--ga-text-primary)',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </Typography>
        {badge}
      </Box>
      {action && actionTo && (
        <Typography
          component={RouterLink}
          to={actionTo}
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: CC_BRAND_ORANGE,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          {action}
        </Typography>
      )}
    </Box>
  );
}
