import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { assetUrl, LOGO_ALVIM_ICONE } from '../config/paths';
import { colors } from '../theme/tokens';
import './estoque/estoque-hub.css';

/** Barra + texto de carregamento (padrão auditoria / checklist). */
export default function PageLoading({
  label = 'Carregando…',
  /** Só nos hubs mobile; no desktop fica a barra simples. */
  comLogo = false,
}: {
  label?: string;
  comLogo?: boolean;
}) {
  if (!comLogo) {
    return (
      <Box sx={{ p: 2, width: '100%' }}>
        <LinearProgress sx={{ borderRadius: 1 }} />
        <Typography
          variant="body2"
          sx={{ mt: 1.5, textAlign: 'center', color: colors.textSecondary }}
        >
          {label}
        </Typography>
      </Box>
    );
  }

  return (
    <div
      className="ck-estoque-hub ck-estoque-hub--hero ck-page-loading"
      style={{
        ['--ck-hero' as string]: `url(${assetUrl(LOGO_ALVIM_ICONE)})`,
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'stretch',
        padding: 'calc(16px + env(safe-area-inset-top, 0px)) 20px 24px',
        boxSizing: 'border-box',
        background: '#0b1721',
        overflow: 'hidden',
        zIndex: 1,
      }}
    >
      <div className="ck-estoque-hub__watermark" aria-hidden />
      <Box sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 480, mx: 'auto', pt: 0.5 }}>
        <LinearProgress
          sx={{
            height: 6,
            borderRadius: 999,
            backgroundColor: 'rgba(254, 108, 34, 0.18)',
            '& .MuiLinearProgress-bar': { backgroundColor: '#fe6c22' },
          }}
        />
        <Typography
          variant="body2"
          sx={{ mt: 1.5, textAlign: 'center', color: '#8d8d8d', fontWeight: 600 }}
        >
          {label}
        </Typography>
      </Box>
    </div>
  );
}
