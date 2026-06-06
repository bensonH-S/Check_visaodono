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

export const dialogContentSxCompact: SxProps<Theme> = {
  pt: 1.5,
  display: 'flex',
  flexDirection: 'column',
  gap: 1.25,
  overflow: 'visible',
};

export const dialogFieldPropsCompact = {
  fullWidth: true,
  size: 'small' as const,
  margin: 'none' as const,
  slotProps: {
    inputLabel: { shrink: true },
    formHelper: { sx: { mt: 0.25, fontSize: '0.7rem' } },
  },
};

export const dialogFieldPropsMini = {
  fullWidth: true,
  size: 'small' as const,
  margin: 'none' as const,
  slotProps: {
    inputLabel: { shrink: true, sx: { fontSize: '0.75rem' } },
    input: { sx: { fontSize: '0.8rem' } },
    formHelper: { sx: { mt: 0.25, fontSize: '0.68rem' } },
  },
  sx: {
    '& .MuiOutlinedInput-root': { minHeight: 34 },
    '& .MuiOutlinedInput-input': { py: '6px' },
    '& .MuiSelect-select': { py: '5px !important', fontSize: '0.8rem !important' },
  },
};

/** Campos uniformes no mobile/tablet; maiores a partir de lg. */
export const dialogFieldPropsResponsive = {
  fullWidth: true,
  size: 'small' as const,
  margin: 'none' as const,
  slotProps: {
    inputLabel: {
      shrink: true,
      sx: { fontSize: { xs: '0.78rem', sm: '0.78rem', lg: '0.875rem' } },
    },
    input: { sx: { fontSize: { xs: '0.8rem', sm: '0.8rem', lg: '0.9rem' } } },
    formHelper: {
      sx: { mt: 0.25, fontSize: { xs: '0.68rem', sm: '0.68rem', lg: '0.75rem' } },
    },
  },
  sx: {
    '& .MuiOutlinedInput-root': {
      minHeight: { xs: 36, sm: 36, lg: 44 },
    },
    '& .MuiOutlinedInput-input': {
      py: { xs: '7px', sm: '7px', lg: '10px' },
    },
    '& .MuiSelect-select': {
      py: { xs: '6px !important', sm: '6px !important', lg: '9px !important' },
      fontSize: { xs: '0.8rem !important', sm: '0.8rem !important', lg: '0.9rem !important' },
    },
  },
};
