import { useMemo } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import 'dayjs/locale/pt-br'
import 'dayjs/locale/en'
import Box from '@mui/material/Box'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { datePickerPtBR } from '../utils/datePickerLocale'
import {
  FIN_BORDER,
  FIN_CAMPO_H,
  FIN_MUTED,
  FIN_SURFACE,
  FIN_TEXT,
  finCampoSx,
} from './temaFinanceiroEscuro'

const temaClaro = createTheme({
  shape: { borderRadius: 10 },
  palette: {
    mode: 'light',
    primary: { main: '#1B6EF3' },
    text: { primary: FIN_TEXT, secondary: FIN_MUTED },
    background: { paper: FIN_SURFACE, default: '#F4F7FB' },
    action: { active: FIN_TEXT, hover: 'rgba(27,110,243,0.12)' },
  },
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: '10px !important',
          overflow: 'hidden',
        },
        notchedOutline: {
          borderRadius: '10px !important',
        },
      },
    },
  },
})

type Props = {
  value: string
  onChange: (mes: string) => void
  label?: string
  idioma?: 'pt' | 'en'
  width?: number | string
}

/** Seletor de mês moderno (MUI) para o Fechamento de caixa. value = YYYY-MM */
export default function FiltroMesFinanceiro({
  value,
  onChange,
  label = 'Mês',
  idioma = 'pt',
  width = 200,
}: Props) {
  const locale = idioma === 'en' ? 'en' : 'pt-br'
  const valor = useMemo(() => {
    if (!value || !/^\d{4}-\d{2}$/.test(value)) return null
    const d = dayjs(`${value}-01`)
    return d.isValid() ? d : null
  }, [value])

  return (
    <ThemeProvider theme={temaClaro}>
      <LocalizationProvider
        dateAdapter={AdapterDayjs}
        adapterLocale={locale}
        localeText={idioma === 'en' ? undefined : datePickerPtBR}
      >
        <Box sx={{ width, flexShrink: 0 }}>
          <DatePicker
            label={label}
            views={['year', 'month']}
            openTo="month"
            value={valor}
            onChange={(d: Dayjs | null) => {
              if (d?.isValid()) onChange(d.format('YYYY-MM'))
            }}
            format={idioma === 'en' ? 'MMM YYYY' : 'MMM/YYYY'}
            slotProps={{
              textField: {
                size: 'small',
                fullWidth: true,
                slotProps: { inputLabel: { shrink: true } },
                sx: {
                  ...finCampoSx,
                  width: '100%',
                  borderRadius: '10px',
                  '& .MuiOutlinedInput-root, & .MuiPickersOutlinedInput-root': {
                    ...finCampoSx['& .MuiOutlinedInput-root'],
                    minHeight: `${FIN_CAMPO_H}px !important`,
                    height: `${FIN_CAMPO_H}px !important`,
                    borderRadius: '10px !important',
                  },
                  '& .MuiOutlinedInput-notchedOutline, & .MuiPickersOutlinedInput-notchedOutline': {
                    borderRadius: '10px !important',
                  },
                  '& .MuiPickersSectionList-root, & .MuiPickersInputBase-sectionsContainer, & .MuiInputBase-input': {
                    py: '0 !important',
                    fontSize: '0.8125rem',
                    minHeight: `${FIN_CAMPO_H}px !important`,
                    height: `${FIN_CAMPO_H}px !important`,
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                  },
                  '& .MuiInputLabel-root': { fontSize: '0.8125rem' },
                  '& .MuiInputAdornment-root .MuiSvgIcon-root': { color: FIN_MUTED, fontSize: 18 },
                },
              },
              openPickerButton: {
                sx: { color: FIN_MUTED, p: 0.5 },
              },
              desktopPaper: {
                sx: {
                  bgcolor: `${FIN_SURFACE} !important`,
                  backgroundImage: 'none',
                  border: `1px solid ${FIN_BORDER}`,
                  borderRadius: '12px',
                  color: FIN_TEXT,
                  '& .MuiPickersCalendarHeader-label': { color: FIN_TEXT, fontWeight: 600 },
                  '& .MuiPickersArrowSwitcher-button': { color: FIN_MUTED },
                  '& .MuiYearCalendar-button, & .MuiMonthCalendar-button': {
                    color: FIN_TEXT,
                    fontSize: 13,
                  },
                  '& .MuiYearCalendar-button.Mui-selected, & .MuiMonthCalendar-button.Mui-selected': {
                    bgcolor: '#1B6EF3 !important',
                    color: '#fff !important',
                  },
                  '& .MuiYearCalendar-button:hover, & .MuiMonthCalendar-button:hover': {
                    bgcolor: 'rgba(27,110,243,0.2)',
                  },
                },
              },
              popper: { sx: { zIndex: 20000 } },
            }}
          />
        </Box>
      </LocalizationProvider>
    </ThemeProvider>
  )
}
