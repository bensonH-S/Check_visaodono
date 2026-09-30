import { useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/pt-br';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { labelFixo } from '../../constants/frotaVeiculo';
import { datePickerPtBR } from '../../utils/datePickerLocale';
import { dataHojeBrasilia, parseIsoDateLocal } from '../../utils/dateBr';

dayjs.locale('pt-br');

const ACENTO = '#fe6c22';
const ACENTO_HOVER = 'rgba(254, 108, 34, 0.22)';
const PAPER_BG = '#333840';
const PAPER_BORDER = 'rgba(255, 255, 255, 0.14)';
const TEXTO = '#f5f5f5';
const TEXTO_SEC = '#8d8d8d';
const CAMPO_BG = '#2a3038';

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

/** Date picker da frota mobile — sempre tema escuro com acento laranja. */
export default function CampoDataFrota({ label, value, onChange, disabled, max, min, sx }: Props) {
  const [aberto, setAberto] = useState(false);
  const maxDate = isoParaDayjs(max ?? dataHojeIso()) ?? dayjs();
  const minDate = min ? isoParaDayjs(min) ?? undefined : undefined;

  const pickerTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: 'dark',
          primary: { main: ACENTO, contrastText: '#fff' },
          background: { paper: PAPER_BG, default: CAMPO_BG },
          text: { primary: TEXTO, secondary: TEXTO_SEC },
          action: { active: TEXTO, hover: ACENTO_HOVER },
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                fontWeight: 700,
              },
              text: {
                color: `${ACENTO} !important`,
              },
            },
          },
        },
      }),
    [],
  );

  const daySx = {
    color: `${TEXTO} !important`,
    '&.MuiPickersDay-today': {
      border: `1px solid ${ACENTO} !important`,
      color: `${ACENTO} !important`,
      bgcolor: 'transparent !important',
    },
    '&.MuiPickersDay-today.Mui-selected': {
      bgcolor: `${ACENTO} !important`,
      color: '#fff !important',
    },
    '&.Mui-selected': {
      bgcolor: `${ACENTO} !important`,
      color: '#fff !important',
      '&:hover, &:focus': {
        bgcolor: `${ACENTO} !important`,
      },
    },
    '&:not(.Mui-selected):hover': {
      bgcolor: ACENTO_HOVER,
    },
  };

  const pickerPaperSx = {
    bgcolor: `${PAPER_BG} !important`,
    backgroundImage: 'none',
    border: `1px solid ${PAPER_BORDER}`,
    borderRadius: 2,
    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55)',
    color: TEXTO,
    '& .MuiPickersDay-root': {
      color: TEXTO,
    },
    '& .MuiPickersDay-root.Mui-selected': {
      bgcolor: `${ACENTO} !important`,
      color: '#fff !important',
    },
    '& .MuiPickersDay-root.Mui-selected:hover, & .MuiPickersDay-root.Mui-selected:focus': {
      bgcolor: `${ACENTO} !important`,
    },
    '& .MuiPickersDay-root:not(.Mui-selected):hover': {
      bgcolor: ACENTO_HOVER,
    },
    '& .MuiPickersDay-today:not(.Mui-selected)': {
      borderColor: `${ACENTO} !important`,
      color: `${ACENTO} !important`,
    },
    '& .MuiDayCalendar-weekDayLabel': {
      color: TEXTO_SEC,
    },
    '& .MuiPickersCalendarHeader-label, & .MuiPickersArrowSwitcher-button': {
      color: `${TEXTO} !important`,
    },
    '& .MuiYearCalendar-button.Mui-selected, & .MuiMonthCalendar-button.Mui-selected': {
      bgcolor: `${ACENTO} !important`,
      color: '#fff !important',
    },
    '& .MuiDialogActions-root .MuiButton-root': {
      color: `${ACENTO} !important`,
    },
    '& .MuiPickersLayout-actionBar .MuiButton-root': {
      color: `${ACENTO} !important`,
    },
  };

  const campoSx = {
    cursor: disabled ? 'default' : 'pointer',
    mb: 0,
    width: '100%',
    '& .MuiOutlinedInput-root, & .MuiPickersOutlinedInput-root': {
      background: `${CAMPO_BG} !important`,
      color: `${TEXTO} !important`,
      borderRadius: '14px !important',
      minHeight: '40px !important',
      height: '40px !important',
      alignItems: 'center',
      boxSizing: 'border-box',
    },
    '& .MuiOutlinedInput-notchedOutline, & .MuiPickersOutlinedInput-notchedOutline': {
      borderColor: 'rgba(255, 255, 255, 0.12) !important',
      borderWidth: '1px !important',
      borderRadius: '14px !important',
    },
    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline, & .MuiPickersOutlinedInput-root.Mui-focused .MuiPickersOutlinedInput-notchedOutline':
      {
        borderColor: '#ff9a5c !important',
        borderWidth: '2px !important',
      },
    '& .MuiOutlinedInput-input, & .MuiPickersInputBase-input, & .MuiPickersSectionList-root, & .MuiPickersSectionList-section, & .MuiPickersSectionList-sectionContent, & .MuiPickersInputBase-sectionsContainer, & input':
      {
        color: `${TEXTO} !important`,
        WebkitTextFillColor: `${TEXTO} !important`,
        caretColor: ACENTO,
        fontSize: '0.875rem',
        py: 0,
      },
    '& .MuiInputLabel-root': {
      color: `${TEXTO_SEC} !important`,
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: `#ff9a5c !important`,
    },
    ...sx,
  };

  function abrirCalendario() {
    if (!disabled) setAberto(true);
  }

  return (
    <ThemeProvider theme={pickerTheme}>
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
              sx: campoSx,
              slotProps: {
                inputLabel: { ...labelFixo.inputLabel, shrink: true },
                input: { readOnly: true },
                htmlInput: { placeholder: 'Selecionar data' },
              },
            },
            day: { sx: daySx },
            desktopPaper: { sx: pickerPaperSx },
            mobilePaper: { sx: pickerPaperSx },
            dialog: {
              sx: {
                '& .MuiPaper-root': pickerPaperSx,
                '& .MuiDialogActions-root .MuiButton-root': {
                  color: `${ACENTO} !important`,
                },
              },
            },
            layout: {
              sx: {
                bgcolor: PAPER_BG,
                color: TEXTO,
                '& .MuiPickersLayout-actionBar .MuiButton-root': {
                  color: `${ACENTO} !important`,
                },
              },
            },
            actionBar: {
              sx: {
                '& .MuiButton-root': {
                  color: `${ACENTO} !important`,
                },
              },
            },
            popper: {
              sx: {
                zIndex: 1400,
                '& .MuiPaper-root': pickerPaperSx,
              },
            },
          }}
        />
      </LocalizationProvider>
    </ThemeProvider>
  );
}
