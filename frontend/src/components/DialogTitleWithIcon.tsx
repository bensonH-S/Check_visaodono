import Box from '@mui/material/Box';
import DialogTitle from '@mui/material/DialogTitle';
import type { ReactNode } from 'react';

const NAVY = '#1B2A6B';

type Props = {
  icon: ReactNode;
  children: ReactNode;
  /** Mantém o título fixo no topo enquanto o conteúdo do modal rola */
  fixed?: boolean;
};

export default function DialogTitleWithIcon({ icon, children, fixed }: Props) {
  return (
    <DialogTitle
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 3,
        pt: 3,
        pb: 2.5,
        m: 0,
        flexShrink: 0,
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
          width: 36,
          height: 36,
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
      {children}
    </DialogTitle>
  );
}
