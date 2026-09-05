import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import { useAppConfig } from '../hooks/useAppConfig';
import { APP_ABOUT, APP_MODULES, APP_NAME, APP_TAGLINE } from '../config/brand';
import { formatMobileVersionNumber } from './MobileVersionBadge';
import { useAppTheme } from '../context/ThemeContext';
import { colors } from '../theme/tokens';

const COPYRIGHT = '©2026 Grupo Alvim — Alvim Participações e Investimentos S/A';
const ORANGE = '#E8520A';

const MODULE_ICONS: Record<(typeof APP_MODULES)[number], SvgIconComponent> = {
  'Checklist e visitas': AssignmentOutlinedIcon,
  'Chamados e aprovações': BuildOutlinedIcon,
  'Energia e protocolos': BoltOutlinedIcon,
  'Frota e mapa': DirectionsCarOutlinedIcon,
  'Estoque e break': Inventory2OutlinedIcon,
  NCs: WarningAmberOutlinedIcon,
  Freelancers: BadgeOutlinedIcon,
  'Escala e metas': CalendarMonthOutlinedIcon,
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function SobreSistemaDialog({ open, onClose }: Props) {
  const { version, support, environment } = useAppConfig();
  const { mode } = useAppTheme();
  const escuro = mode === 'dark';
  const acento = escuro ? ORANGE : '#1B2A6B';
  const acentoSoft = escuro ? 'rgba(232, 82, 10, 0.14)' : 'rgba(27, 42, 107, 0.08)';
  const acentoBorder = escuro ? 'rgba(232, 82, 10, 0.28)' : 'rgba(27, 42, 107, 0.16)';
  const versao = formatMobileVersionNumber(version);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: colors.surface,
            backgroundImage: 'none',
            border: `1px solid ${colors.border}`,
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          pb: 0.75,
          fontWeight: 800,
          color: colors.textPrimary,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <InfoOutlinedIcon sx={{ fontSize: 22, color: acento }} />
        Sobre o sistema
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 2, bgcolor: colors.surface, borderColor: colors.border }}>
        <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', mb: 0.25, lineHeight: 1.15, color: escuro ? colors.textPrimary : ORANGE }}>
          {APP_NAME}
        </Typography>
        <Typography
          variant="body2"
          sx={{ mb: 1.25, color: colors.textSecondary, fontWeight: 500, fontSize: '0.78rem', lineHeight: 1.35 }}
        >
          {APP_TAGLINE}
        </Typography>

        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            px: 1.1,
            py: 0.45,
            mb: 1.5,
            borderRadius: 1.25,
            bgcolor: acentoSoft,
            border: `1px solid ${acentoBorder}`,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700, color: colors.textPrimary, fontSize: '0.8125rem' }}>
            Versão {versao}
          </Typography>
          {environment ? (
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontSize: '0.65rem',
              }}
            >
              {environment}
            </Typography>
          ) : null}
        </Box>

        <Typography
          sx={{
            fontSize: '0.8rem',
            color: colors.textSecondary,
            fontWeight: 400,
            lineHeight: 1.45,
            mb: 1.5,
          }}
        >
          {APP_ABOUT}
        </Typography>

        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mb: 1,
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: colors.textMuted,
          }}
        >
          Módulos
        </Typography>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.75,
            mb: 2,
          }}
        >
          {APP_MODULES.map((mod) => {
            const Icon = MODULE_ICONS[mod];
            return (
              <Box
                key={mod}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1,
                  py: 0.4,
                  borderRadius: 1.25,
                  bgcolor: acentoSoft,
                  border: `1px solid ${acentoBorder}`,
                }}
              >
                <Icon sx={{ fontSize: 14, color: acento }} />
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: colors.textPrimary }}>
                  {mod}
                </Typography>
              </Box>
            );
          })}
        </Box>

        <Divider sx={{ my: 1.5, borderColor: colors.border }} />

        <Typography
          sx={{
            display: 'block',
            fontSize: '0.68rem',
            color: colors.textMuted,
            fontWeight: 500,
            lineHeight: 1.35,
          }}
        >
          {COPYRIGHT}
        </Typography>

        {support?.name && (
          <Box sx={{ mt: 1.5 }}>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                mb: 0.5,
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: colors.textMuted,
                fontSize: '0.65rem',
              }}
            >
              Suporte
            </Typography>
            <Typography sx={{ fontWeight: 700, color: colors.textPrimary, fontSize: '0.8125rem' }}>
              {support.name}
            </Typography>
            {support.phone && (
              <Typography sx={{ color: colors.textSecondary, fontSize: '0.78rem' }}>
                {support.phone}
              </Typography>
            )}
            {support.email && (
              <Typography sx={{ color: colors.textSecondary, fontSize: '0.78rem' }}>
                {support.email}
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ bgcolor: colors.surface }}>
        <Button onClick={onClose} sx={{ fontWeight: 700, color: acento }}>
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
