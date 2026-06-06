import { useRef, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Popover from '@mui/material/Popover';
import Link from '@mui/material/Link';
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import { useAppConfig } from '../hooks/useAppConfig';

function InfoLinha({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
      <Box sx={{ display: 'flex', color: 'action.active', flexShrink: 0 }}>{icon}</Box>
      <Typography variant="body2" component="div">
        {children}
      </Typography>
    </Box>
  );
}

type SupportContactProps = {
  compact?: boolean;
};

export default function SupportContact({ compact }: SupportContactProps) {
  const { support } = useAppConfig();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [aberto, setAberto] = useState(false);

  return (
    <Box sx={{ mt: compact ? 1.5 : 3 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: compact ? '0.72rem' : undefined }}>
        Problemas de acesso?{' '}
        <Typography
          component="button"
          type="button"
          ref={anchorRef}
          variant="caption"
          onClick={() => setAberto((v) => !v)}
          sx={{
            border: 'none',
            bgcolor: 'transparent',
            cursor: 'pointer',
            color: 'secondary.main',
            font: 'inherit',
            fontWeight: 600,
            p: 0,
            textDecoration: 'underline',
            textUnderlineOffset: 2,
            '&:hover': { color: 'secondary.dark' },
          }}
        >
          Contate o suporte de TI.
        </Typography>
      </Typography>

      <Popover
        open={aberto}
        anchorEl={anchorRef.current}
        onClose={() => setAberto(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              px: 2,
              py: 1.5,
              maxWidth: 300,
              textAlign: 'left',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <SupportAgentOutlinedIcon fontSize="small" color="action" />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Suporte de TI
          </Typography>
        </Box>

        <InfoLinha icon={<PersonOutlineOutlinedIcon fontSize="small" />}>
          {support.name}
        </InfoLinha>

        <InfoLinha icon={<PhoneOutlinedIcon fontSize="small" />}>
          <Link href={`tel:${support.phone.replace(/\s/g, '')}`} underline="hover">
            {support.phone}
          </Link>
        </InfoLinha>

        <InfoLinha icon={<EmailOutlinedIcon fontSize="small" />}>
          <Link href={`mailto:${support.email}`} underline="hover">
            {support.email}
          </Link>
        </InfoLinha>
      </Popover>
    </Box>
  );
}
