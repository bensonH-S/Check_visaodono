import { useMemo, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import 'dayjs/locale/pt-br'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { datePickerPtBR } from '../utils/datePickerLocale'
import { parseIsoDateLocal } from '../utils/dateBr'
import {
  FIN_BORDER,
  FIN_CAMPO_H,
  FIN_CAMPO_RADIUS,
  FIN_MUTED,
  FIN_SURFACE,
  FIN_SURFACE_ALT,
  FIN_TEXT,
} from './temaFinanceiroEscuro'

dayjs.locale('pt-br')

const ACENTO = '#1B6EF3'
const ACENTO_HOVER = 'rgba(27, 110, 243, 0.22)'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  max?: string
  min?: string
  sx?: SxProps<Theme>
}

function isoParaDayjs(iso: string): Dayjs | null {
  const d = parseIsoDateLocal(iso)
  return d ? dayjs(d) : null
}

function dayjsParaIso(d: Dayjs | null): string {
  if (!d?.isValid()) return ''
  return d.format('YYYY-MM-DD')
}

/** DatePicker do Financeiro — tema claro, sem teto em “hoje” (vencimentos futuros ok). */
export default function CampoDataFinanceiro({ label, value, onChange, disabled, max, min, sx }: Props) {
  const [aberto, setAberto] = useState(false)
  const maxDate = max ? isoParaDayjs(max) ?? undefined : undefined
  const minDate = min ? isoParaDayjs(min) ?? undefined : undefined

  const pickerTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: 'light',
          primary: { main: ACENTO, contrastText: '#fff' },
          background: { paper: FIN_SURFACE, default: FIN_SURFACE_ALT },
          text: { primary: FIN_TEXT, secondary: FIN_MUTED },
          action: { active: FIN_TEXT, hover: ACENTO_HOVER },
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: { textTransform: 'none', fontWeight: 700 },
              text: { color: `${ACENTO} !important` },
            },
          },
        },
      }),
    [],
  )

  const daySx = {
    color: `${FIN_TEXT} !important`,
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
      '&:hover, &:focus': { bgcolor: `${ACENTO} !important` },
    },
    '&:not(.Mui-selected):hover': { bgcolor: ACENTO_HOVER },
  }

  const pickerPaperSx = {
    bgcolor: `${FIN_SURFACE} !important`,
    backgroundImage: 'none',
    border: `1px solid ${FIN_BORDER}`,
    borderRadius: 2,
    boxShadow: '0 16px 40px rgba(15, 23, 42, 0.14)',
    color: FIN_TEXT,
    '& .MuiPickersDay-root': { color: FIN_TEXT },
    '& .MuiPickersDay-root.Mui-selected': {
      bgcolor: `${ACENTO} !important`,
      color: '#fff !important',
    },
    '& .MuiPickersDay-root.Mui-selected:hover, & .MuiPickersDay-root.Mui-selected:focus': {
      bgcolor: `${ACENTO} !important`,
    },
    '& .MuiPickersDay-root:not(.Mui-selected):hover': { bgcolor: ACENTO_HOVER },
    '& .MuiPickersDay-today:not(.Mui-selected)': {
      borderColor: `${ACENTO} !important`,
      color: `${ACENTO} !important`,
    },
    '& .MuiDayCalendar-weekDayLabel': { color: FIN_MUTED },
    '& .MuiPickersCalendarHeader-label, & .MuiPickersArrowSwitcher-button': {
      color: `${FIN_TEXT} !important`,
    },
    '& .MuiYearCalendar-button.Mui-selected, & .MuiMonthCalendar-button.Mui-selected': {
      bgcolor: `${ACENTO} !important`,
      color: '#fff !important',
    },
    '& .MuiDialogActions-root .MuiButton-root, & .MuiPickersLayout-actionBar .MuiButton-root': {
      color: `${ACENTO} !important`,
    },
  }

  const campoSx = {
    cursor: disabled ? 'default' : 'pointer',
    mb: 0,
    width: '100%',
    bgcolor: `${FIN_SURFACE} !important`,
    borderRadius: FIN_CAMPO_RADIUS,
    '& .MuiOutlinedInput-root, & .MuiPickersOutlinedInput-root': {
      background: `${FIN_SURFACE} !important`,
      color: `${FIN_TEXT} !important`,
      borderRadius: `${FIN_CAMPO_RADIUS} !important`,
      minHeight: `${FIN_CAMPO_H}px !important`,
      height: `${FIN_CAMPO_H}px !important`,
      alignItems: 'center',
      boxSizing: 'border-box',
    },
    '& .MuiOutlinedInput-notchedOutline, & .MuiPickersOutlinedInput-notchedOutline': {
      borderColor: `${FIN_BORDER} !important`,
      borderWidth: '1px !important',
      borderRadius: `${FIN_CAMPO_RADIUS} !important`,
    },
    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline, & .MuiPickersOutlinedInput-root.Mui-focused .MuiPickersOutlinedInput-notchedOutline':
      {
        borderColor: `${ACENTO} !important`,
        borderWidth: '1px !important',
      },
    '& .MuiOutlinedInput-input, & .MuiPickersInputBase-input, & .MuiPickersSectionList-root, & .MuiPickersSectionList-section, & .MuiPickersSectionList-sectionContent, & .MuiPickersInputBase-sectionsContainer, & input':
      {
        color: `${FIN_TEXT} !important`,
        WebkitTextFillColor: `${FIN_TEXT} !important`,
        caretColor: ACENTO,
        fontSize: '0.875rem',
        py: 0,
      },
    '& .MuiInputLabel-root': { color: `${FIN_MUTED} !important` },
    '& .MuiInputLabel-root.Mui-focused': { color: `${ACENTO} !important` },
    '& .MuiIconButton-root': { color: FIN_MUTED },
    ...sx,
  }

  function abrirCalendario() {
    if (!disabled) setAberto(true)
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
              size: 'small',
              onClick: abrirCalendario,
              sx: campoSx,
              slotProps: {
                inputLabel: { shrink: true },
                input: { readOnly: true },
                htmlInput: { placeholder: 'DD/MM/AAAA' },
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
                bgcolor: FIN_SURFACE,
                color: FIN_TEXT,
                '& .MuiPickersLayout-actionBar .MuiButton-root': {
                  color: `${ACENTO} !important`,
                },
              },
            },
            actionBar: {
              sx: { '& .MuiButton-root': { color: `${ACENTO} !important` } },
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
  )
}
