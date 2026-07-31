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
import type { SvgIconComponent } from '@mui/icons-material';
import { useAppConfig } from '../hooks/useAppConfig';
import { APP_ABOUT, APP_MODULES, APP_NAME, APP_TAGLINE } from '../config/brand';
import { formatMobileVersionNumber } from './MobileVersionBadge';
import { colors } from '../theme/tokens';

const COPYRIGHT = '©2026 Grupo Alvim — Alvim Participações e Investimentos S/A';

const MODULE_ICONS: Record<(typeof APP_MODULES)[number], SvgIconComponent> = {
  'Checklist e visitas': AssignmentOutlinedIcon,
  'Chamados e aprovações': BuildOutlinedIcon,
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
  const versao = formatMobileVersionNumber(version);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle
        sx={{
          pb: 0.75,
          fontWeight: 800,
          color: colors.navy,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <InfoOutlinedIcon sx={{ fontSize: 22, color: colors.orange }} />
        Sobre o sistema
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 2 }}>
        <Typography sx={{ fontWeight: 800, color: colors.orange, fontSize: '1.2rem', mb: 0.35 }}>
          {APP_NAME}
        </Typography>
        <Typography
          variant="body2"
          sx={{ mb: 1.75, color: colors.navy, fontWeight: 600, opacity: 0.75, lineHeight: 1.4 }}
        >
          {APP_TAGLINE}
        </Typography>

        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            px: 1.25,
            py: 0.55,
            mb: 2,
            borderRadius: 1.5,
            bgcolor: 'rgba(27, 42, 107, 0.06)',
            border: '1px solid rgba(27, 42, 107, 0.12)',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700, color: colors.navy }}>
            Versão {versao}
          </Typography>
          {environment ? (
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: 'rgba(27, 42, 107, 0.55)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {environment}
            </Typography>
          ) : null}
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65, mb: 2 }}>
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
            color: 'rgba(27, 42, 107, 0.5)',
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
                  bgcolor: 'rgba(232, 82, 10, 0.08)',
                  border: '1px solid rgba(232, 82, 10, 0.18)',
                }}
              >
                <Icon sx={{ fontSize: 14, color: colors.orange }} />
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: colors.navy }}>
                  {mod}
                </Typography>
              </Box>
            );
          })}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.5 }}>
          {COPYRIGHT}
        </Typography>

        {support?.name && (
          <Box sx={{ mt: 2 }}>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                mb: 0.75,
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'rgba(27, 42, 107, 0.5)',
              }}
            >
              Suporte
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: colors.navy }}>
              {support.name}
            </Typography>
            {support.phone && (
              <Typography variant="body2" color="text.secondary">
                {support.phone}
              </Typography>
            )}
            {support.email && (
              <Typography variant="body2" color="text.secondary">
                {support.email}
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ fontWeight: 700 }}>
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
