import type { SelectProps } from '@mui/material/Select';

export const selectMenuScrollProps: Pick<SelectProps, 'MenuProps'> = {
  MenuProps: {
    slotProps: {
      paper: {
        sx: {
          maxHeight: 280,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        },
      },
    },
  },
};
