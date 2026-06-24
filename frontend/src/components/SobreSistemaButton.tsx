import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useAppConfig } from '../hooks/useAppConfig';
import { APP_NAME, APP_TAGLINE } from '../config/brand';
import { formatMobileVersionNumber } from './MobileVersionBadge';
import { colors } from '../theme/tokens';

const COPYRIGHT = '©2026 Grupo Alvim — Alvim Participações e Investimentos S/A';

type Props = {
  variante?: 'mobile' | 'portal';
};

export default function SobreSistemaButton({ variante = 'portal' }: Props) {
  const [aberto, setAberto] = useState(false);
  const { version, support } = useAppConfig();
  const versao = formatMobileVersionNumber(version);

  return (
    <>
      <IconButton
        size="small"
        aria-label="Sobre o sistema"
        onClick={() => setAberto(true)}
        sx={{ color: variante === 'mobile' ? colors.navy : colors.textSecondary }}
      >
        <InfoOutlinedIcon fontSize="small" />
      </IconButton>

      <Dialog open={aberto} onClose={() => setAberto(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Sobre o sistema</DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <Typography sx={{ fontWeight: 800, color: colors.orange, fontSize: '1.1rem', mb: 0.5 }}>
            {APP_NAME}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {APP_TAGLINE}
          </Typography>

          <Box
            sx={{
              display: 'inline-block',
              px: 1.25,
              py: 0.5,
              mb: 2,
              borderRadius: 1,
              bgcolor: 'rgba(27, 42, 107, 0.06)',
              border: '1px solid rgba(27, 42, 107, 0.12)',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, color: colors.navy }}>
              Versão {versao}
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, mb: 2 }}>
            Plataforma integrada para checklist de lojas, chamados de manutenção, gestão de frota e
            auditoria operacional do Grupo Alvim.
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.5 }}>
            {COPYRIGHT}
          </Typography>

          {support?.name && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Suporte
              </Typography>
              <Typography variant="body2">{support.name}</Typography>
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
          <Button onClick={() => setAberto(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
