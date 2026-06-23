import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { colors } from '../../theme/tokens';

type Props = {
  titulo: string;
  descricao: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

export default function FrotaHubCard({ titulo, descricao, icon, onClick, disabled }: Props) {
  return (
    <Paper
      elevation={0}
      onClick={disabled ? undefined : onClick}
      sx={{
        p: 2.5,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        border: '1px solid',
        borderColor: colors.border,
        borderLeft: `4px solid ${colors.navy}`,
        borderRadius: 2,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        transition: 'box-shadow 0.2s, border-color 0.2s',
        '&:hover': disabled
          ? undefined
          : {
              borderColor: colors.navy,
              boxShadow: '0 4px 16px rgba(27, 42, 107, 0.08)',
            },
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 1.5,
          bgcolor: 'rgba(27, 42, 107, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: colors.navy,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, color: colors.textPrimary, mb: 0.5 }}>{titulo}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.45 }}>
          {descricao}
        </Typography>
      </Box>
      {!disabled && <ChevronRightIcon sx={{ color: colors.textMuted, mt: 0.5 }} />}
    </Paper>
  );
}
