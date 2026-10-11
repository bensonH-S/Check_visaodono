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

const POP_BG = '#0B1220';
const POP_BORDER = 'rgba(27, 110, 243, 0.28)';
const POP_TEXT = '#F8FAFC';
const POP_MUTED = '#94A3B8';
const POP_LINK = '#7DD3FC';

function InfoLinha({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
      <Box sx={{ display: 'flex', color: POP_MUTED, flexShrink: 0 }}>{icon}</Box>
      <Typography variant="body2" component="div" sx={{ color: POP_TEXT }}>
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
    <Box sx={{ mt: compact ? 1.5 : 3, textAlign: 'center' }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', fontSize: compact ? '0.72rem' : undefined, lineHeight: 1.35 }}
      >
        Problemas de acesso?
      </Typography>
      <Typography
        component="button"
        type="button"
        ref={anchorRef}
        variant="caption"
        onClick={() => setAberto((v) => !v)}
        sx={{
          display: 'block',
          mx: 'auto',
          mt: 0.25,
          border: 'none',
          bgcolor: 'transparent',
          cursor: 'pointer',
          color: '#F8FAFC',
          font: 'inherit',
          fontSize: compact ? '0.72rem' : undefined,
          fontWeight: 600,
          p: 0,
          textDecoration: 'underline',
          textUnderlineOffset: 3,
          textDecorationThickness: '1px',
          textDecorationColor: 'rgba(248, 250, 252, 0.45)',
          transition: 'color 0.15s ease, text-decoration-color 0.15s ease',
          '&:hover': {
            color: '#0548d1',
            textDecorationColor: 'rgba(5, 72, 209, 0.9)',
          },
        }}
      >
        Contate o suporte de TI.
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
              bgcolor: POP_BG,
              backgroundImage: 'none',
              color: POP_TEXT,
              border: `1px solid ${POP_BORDER}`,
              borderRadius: '12px',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55)',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <SupportAgentOutlinedIcon fontSize="small" sx={{ color: POP_MUTED }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: POP_TEXT }}>
            Suporte de TI
          </Typography>
        </Box>

        <InfoLinha icon={<PersonOutlineOutlinedIcon fontSize="small" />}>
          {support.name}
        </InfoLinha>

        <InfoLinha icon={<PhoneOutlinedIcon fontSize="small" />}>
          <Link
            href={`tel:${support.phone.replace(/\s/g, '')}`}
            underline="hover"
            sx={{ color: POP_LINK, '&:hover': { color: '#BAE6FD' } }}
          >
            {support.phone}
          </Link>
        </InfoLinha>

        <InfoLinha icon={<EmailOutlinedIcon fontSize="small" />}>
          <Link
            href={`mailto:${support.email}`}
            underline="hover"
            sx={{ color: POP_LINK, '&:hover': { color: '#BAE6FD' } }}
          >
            {support.email}
          </Link>
        </InfoLinha>
      </Popover>
    </Box>
  );
}
