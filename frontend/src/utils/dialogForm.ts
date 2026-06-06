import type { SxProps, Theme } from '@mui/material/styles';

export const dialogContentSx: SxProps<Theme> = {
  pt: 2.5,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  overflow: 'visible',
};

export const dialogFieldProps = {
  fullWidth: true,
  margin: 'none' as const,
  slotProps: { inputLabel: { shrink: true } },
};
