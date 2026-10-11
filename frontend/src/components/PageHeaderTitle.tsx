import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { PageTitleConfig } from '../config/pageTitles';
import { colors } from '../theme/tokens';

type Props = PageTitleConfig & {
  variant?: 'mobile' | 'desktop';
  /** dark = título claro (ex.: Inbox financeiro) */
  tone?: 'default' | 'dark';
};

export default function PageHeaderTitle({ title, subtitle, icon, variant = 'mobile', tone = 'default' }: Props) {
  const tituloCor = tone === 'dark' ? '#F8FAFC' : colors.textPrimary;
  const subCor = tone === 'dark' ? '#94A3B8' : colors.textSecondary;
  const typographySx =
    variant === 'desktop'
      ? {
          fontWeight: 600,
          fontSize: 15,
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          color: tituloCor,
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
          m: 0,
        }
      : {
          fontWeight: 600,
          fontSize: 14,
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          color: tituloCor,
          letterSpacing: '-0.01em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
      {icon ? (
        <Box
          sx={{
            display: 'flex',
            flexShrink: 0,
            alignItems: 'center',
            color: tone === 'dark' ? '#94A3B8' : 'inherit',
            '& .MuiSvgIcon-root': { fontSize: 18, color: 'inherit' },
          }}
        >
          {icon}
        </Box>
      ) : null}
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Typography component="h1" sx={typographySx}>
          {title}
        </Typography>
        {subtitle && variant === 'desktop' && (
          <Typography sx={{ fontSize: 11, fontWeight: 400, color: subCor, mt: 0.15, lineHeight: 1.3 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
