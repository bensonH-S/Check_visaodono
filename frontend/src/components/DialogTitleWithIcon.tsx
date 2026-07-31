import Box from '@mui/material/Box';
import DialogTitle from '@mui/material/DialogTitle';
import type { ReactNode } from 'react';
import { colors, portalIconBoxSx } from '../theme/tokens';

type Props = {
  icon: ReactNode;
  children: ReactNode;
  endAction?: ReactNode;
  fixed?: boolean;
  compact?: boolean;
  /** Ícone na mesma cor do título, sem caixa cinza. */
  plainIcon?: boolean;
  /** Linha divisória abaixo do título. */
  divider?: boolean;
};

export default function DialogTitleWithIcon({
  icon,
  children,
  endAction,
  fixed,
  compact,
  plainIcon,
  divider,
}: Props) {
  return (
    <DialogTitle
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 1.25 : 1.5,
        px: compact ? { xs: 2, sm: 2.5 } : 3,
        pt: compact ? { xs: 1.5, sm: 2 } : 2.5,
        pb: compact ? { xs: 1.25, sm: 1.5 } : 2,
        m: 0,
        flexShrink: 0,
        fontWeight: 600,
        fontSize: compact ? { xs: '0.95rem', sm: '1rem' } : '1rem',
        color: colors.textPrimary,
        ...((fixed || divider) && {
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }),
        ...(fixed && {
          position: 'sticky',
          top: 0,
          zIndex: 2,
        }),
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: compact ? 1.25 : 1.5,
          flex: 1,
          minWidth: 0,
        }}
      >
        <Box
          sx={
            plainIcon
              ? {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: 'inherit',
                  '& .MuiSvgIcon-root': {
                    fontSize: compact ? 22 : 24,
                    color: 'inherit',
                  },
                }
              : {
                  ...portalIconBoxSx,
                  width: compact ? 32 : 36,
                  height: compact ? 32 : 36,
                  '& .MuiSvgIcon-root': { fontSize: compact ? 18 : 20 },
                }
          }
        >
          {icon}
        </Box>
        <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {children}
        </Box>
      </Box>
      {endAction ? <Box sx={{ ml: 1, flexShrink: 0 }}>{endAction}</Box> : null}
    </DialogTitle>
  );
}
