import { useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/pt-br';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import type { SxProps, Theme } from '@mui/material/styles';
import { labelFixo, campoAlturaFrotaSx } from '../../constants/frotaVeiculo';
import { datePickerPtBR } from '../../utils/datePickerLocale';
import { dataHojeBrasilia, parseIsoDateLocal } from '../../utils/dateBr';
import { colors } from '../../theme/tokens';
import { useAppTheme } from '../../context/ThemeContext';

dayjs.locale('pt-br');

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  max?: string;
  min?: string;
  sx?: SxProps<Theme>;
};

export function dataHojeIso(): string {
  return dataHojeBrasilia();
}

function isoParaDayjs(iso: string): Dayjs | null {
  const d = parseIsoDateLocal(iso);
  return d ? dayjs(d) : null;
}

function dayjsParaIso(d: Dayjs | null): string {
  if (!d?.isValid()) return '';
  return d.format('YYYY-MM-DD');
}

export default function CampoDataFrota({ label, value, onChange, disabled, max, min, sx }: Props) {
  const { mode } = useAppTheme();
  const escuro = mode === 'dark';
  /** Claro = azul; escuro = laranja (hex para vencer o primary do MUI). */
  const acento = escuro ? '#E8520A' : '#1B2A6B';
  const acentoHover = escuro ? 'rgba(232, 82, 10, 0.22)' : 'rgba(27, 42, 107, 0.1)';
  const [aberto, setAberto] = useState(false);
  const maxDate = isoParaDayjs(max ?? dataHojeIso()) ?? dayjs();
  const minDate = min ? isoParaDayjs(min) ?? undefined : undefined;

  const daySx = {
    '&.MuiPickersDay-today': {
      border: `1px solid ${acento} !important`,
    },
    '&.Mui-selected': {
      bgcolor: `${acento} !important`,
      color: '#fff !important',
      '&:hover, &:focus': {
        bgcolor: `${acento} !important`,
      },
    },
    '&:not(.Mui-selected):hover': {
      bgcolor: acentoHover,
    },
  };

  const pickerPaperSx = {
    bgcolor: 'var(--ga-picker-paper)',
    backgroundImage: 'none',
    border: `1px solid ${colors.borderStrong}`,
    borderRadius: 2,
    boxShadow: '0 10px 28px rgba(0, 0, 0, 0.28)',
    color: colors.textPrimary,
    '& .MuiPickersDay-root': {
      color: colors.textPrimary,
    },
    '& .MuiPickersDay-root.Mui-selected': {
      bgcolor: `${acento} !important`,
      color: '#fff',
    },
    '& .MuiPickersDay-root.Mui-selected:hover, & .MuiPickersDay-root.Mui-selected:focus': {
      bgcolor: `${acento} !important`,
    },
    '& .MuiPickersDay-root:not(.Mui-selected):hover': {
      bgcolor: acentoHover,
    },
    '& .MuiPickersDay-today': {
      borderColor: `${acento} !important`,
    },
    '& .MuiDayCalendar-weekDayLabel': {
      color: colors.textSecondary,
    },
    '& .MuiPickersCalendarHeader-label, & .MuiPickersArrowSwitcher-button': {
      color: colors.textPrimary,
    },
  };

  function abrirCalendario() {
    if (!disabled) setAberto(true);
  }

  return (
    <LocalizationProvider
      dateAdapter={AdapterDayjs}
      adapterLocale="pt-br"
      localeText={datePickerPtBR}
    >
      <DatePicker
        label={label}
        value={isoParaDayjs(value)}
        onChange={(d) => onChange(dayjsParaIso(d))}
        disabled={disabled}
        disableOpenPicker
        open={aberto}
        onOpen={() => setAberto(true)}
        onClose={() => setAberto(false)}
        maxDate={maxDate}
        minDate={minDate}
        format="DD/MM/YYYY"
        localeText={datePickerPtBR}
        slotProps={{
          textField: {
            fullWidth: true,
            onClick: abrirCalendario,
            sx: {
              cursor: disabled ? 'default' : 'pointer',
              ...campoAlturaFrotaSx,
              ...sx,
            },
            slotProps: {
              inputLabel: { ...labelFixo.inputLabel, shrink: true },
              input: { readOnly: true },
              htmlInput: { placeholder: 'Selecionar data' },
            },
          },
          day: { sx: daySx },
          desktopPaper: { sx: pickerPaperSx },
          mobilePaper: { sx: pickerPaperSx },
          popper: {
            sx: {
              '& .MuiPaper-root': pickerPaperSx,
            },
          },
        }}
      />
    </LocalizationProvider>
  );
}
