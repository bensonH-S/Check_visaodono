import Box from '@mui/material/Box';
import DialogTitle from '@mui/material/DialogTitle';
import type { ReactNode } from 'react';

const NAVY = '#1B2A6B';

type Props = {
  icon: ReactNode;
  children: ReactNode;
  /** Conteúdo alinhado à direita (ex.: switch no título) */
  endAction?: ReactNode;
  /** Mantém o título fixo no topo enquanto o conteúdo do modal rola */
  fixed?: boolean;
  compact?: boolean;
};

export default function DialogTitleWithIcon({ icon, children, endAction, fixed, compact }: Props) {
  return (
    <DialogTitle
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 1.25 : 2,
        px: compact ? { xs: 2, sm: 2.5 } : 3,
        pt: compact ? { xs: 1.5, sm: 2 } : 3,
        pb: compact ? { xs: 1.25, sm: 1.5 } : 2.5,
        m: 0,
        flexShrink: 0,
        fontSize: compact ? { xs: '0.95rem', sm: '1rem' } : undefined,
        ...(fixed && {
          position: 'sticky',
          top: 0,
          zIndex: 2,
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }),
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: compact ? 1.25 : 2,
          flex: 1,
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            width: compact ? 30 : 36,
            height: compact ? 30 : 36,
            borderRadius: 1.5,
            bgcolor: '#E8EBF5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: NAVY,
          }}
        >
          {icon}
        </Box>
        <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {children}
        </Box>
      </Box>
      {endAction ? (
        <Box sx={{ ml: 1, flexShrink: 0 }}>{endAction}</Box>
      ) : null}
    </DialogTitle>
  );
}
