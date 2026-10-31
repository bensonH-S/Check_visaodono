import { useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/pt-br';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Popover from '@mui/material/Popover';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import ClearIcon from '@mui/icons-material/Clear';
import { colors } from '../../theme/tokens';
import { useAppTheme } from '../../context/ThemeContext';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { labelFixo, campoAlturaFrotaSx } from '../../constants/frotaVeiculo';
import { datePickerPtBR } from '../../utils/datePickerLocale';
import { dataHojeBrasilia, formatDataCampoData, parseIsoDateLocal } from '../../utils/dateBr';

dayjs.locale('pt-br');

const temaCalendarioEscuro = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#1B6EF3' },
    text: { primary: '#F8FAFC', secondary: '#94A3B8', disabled: 'rgba(148,163,184,0.4)' },
    action: { active: '#F8FAFC', hover: 'rgba(27,110,243,0.22)' },
    background: { paper: '#122433', default: '#051017' },
  },
});

type Props = {
  dataInicio: string;
  dataFim: string;
  onChangeInicio: (value: string) => void;
  onChangeFim: (value: string) => void;
  compacto?: boolean;
  /** Texto clicável, sem campo — para cabeçalhos de dashboard. */
  variante?: 'campo' | 'texto';
  /** Popover/calendário em superfície escura (ex.: Inbox financeiro). */
  temaEscuro?: boolean;
  /** Rótulos do campo (padrão PT). */
  idioma?: 'pt' | 'en';
  /** Agenda/Inbox: permite escolher dias depois de hoje. */
  permitirFuturo?: boolean;
};

function isoParaDayjs(iso: string): Dayjs | null {
  const d = parseIsoDateLocal(iso);
  return d ? dayjs(d) : null;
}

function formatarTexto(inicio: string, fim: string, idioma: 'pt' | 'en' = 'pt') {
  const fmt = (iso: string) => formatDataCampoData(iso);
  const conj = idioma === 'en' ? ' to ' : ' a ';
  if (!inicio && !fim) return '';
  if (inicio && fim && inicio !== fim) return `${fmt(inicio)}${conj}${fmt(fim)}`;
  return fmt(inicio || fim);
}

function formatarTextoCurto(inicio: string, fim: string, idioma: 'pt' | 'en' = 'pt') {
  const periodoVazio = idioma === 'en' ? 'Period' : 'Período';
  const partes = (iso: string) => {
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    return { d, m, y };
  };
  const fmt = (iso: string, comAno: boolean) => {
    const { d, m, y } = partes(iso);
    if (!d || !m || !y) return formatDataCampoData(iso);
    return comAno ? `${d}/${m}/${y}` : `${d}/${m}`;
  };
  if (!inicio && !fim) return periodoVazio;
  if (inicio && fim && inicio !== fim) {
    const mesmoAno = inicio.slice(0, 4) === fim.slice(0, 4);
    return `${fmt(inicio, !mesmoAno)} — ${fmt(fim, true)}`;
  }
  return fmt(inicio || fim, true);
}

const filtroDataSx = {
  mb: 0,
  minWidth: 260,
  flex: '0 0 auto',
  pt: 0,
  position: 'relative',
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    minHeight: 40,
    height: 40,
  },
  '& .MuiInputLabel-root.MuiInputLabel-shrink': {
    transform: 'translate(14px, -9px) scale(0.75)',
  },
} as const;

const filtroDataCompactoSx = {
  mb: 0,
  width: '100%',
  minWidth: 0,
  maxWidth: 'none',
  flex: '0 0 auto',
  position: 'relative',
  '& .MuiOutlinedInput-root': {
    minHeight: 32,
    height: 32,
  },
  '& .MuiInputBase-input': {
    fontSize: '0.8125rem',
    py: 0,
    px: 0.75,
    height: 32,
    boxSizing: 'border-box',
  },
  '& .MuiInputLabel-root': {
    fontSize: '0.75rem',
  },
  '& .MuiInputLabel-root.MuiInputLabel-shrink': {
    transform: 'translate(12px, -8px) scale(0.85)',
  },
} as const;

export default function FiltroIntervaloDatasFrota({
  dataInicio,
  dataFim,
  onChangeInicio,
  onChangeFim,
  compacto = false,
  variante = 'campo',
  temaEscuro = false,
  idioma = 'pt',
  permitirFuturo = false,
}: Props) {
  const { mode } = useAppTheme();
  const escuro = temaEscuro || mode === 'dark';
  const acento = temaEscuro ? '#1B6EF3' : escuro ? '#0548d1' : '#1B2A6B';
  const acentoHover = temaEscuro
    ? 'rgba(27, 110, 243, 0.22)'
    : escuro
      ? 'rgba(5, 72, 209, 0.22)'
      : 'rgba(27, 42, 107, 0.1)';
  const papelCalendario = temaEscuro ? '#122433' : 'var(--ga-picker-paper)';
  const textoCalendario = temaEscuro ? '#F8FAFC' : colors.textPrimary;
  const textoSecCalendario = temaEscuro ? '#94A3B8' : colors.textSecondary;
  const bordaCalendario = temaEscuro ? 'rgba(255,255,255,0.14)' : colors.borderStrong;
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [escolhendoFim, setEscolhendoFim] = useState(false);
  const [rascunhoInicio, setRascunhoInicio] = useState(dataInicio);
  const [rascunhoFim, setRascunhoFim] = useState(dataFim);
  const aberto = Boolean(anchorEl);
  const hoje = dataHojeBrasilia();
  const maxDate = permitirFuturo ? undefined : (isoParaDayjs(hoje) ?? dayjs());
  const rotuloPeriodo = idioma === 'en' ? 'Period' : 'Período';
  const placeholderPeriodo = idioma === 'en'
    ? (compacto ? 'Dates' : 'Click to select')
    : (compacto ? 'Datas' : 'Clique para selecionar');
  const limparLabel = idioma === 'en' ? 'Clear period' : 'Limpar período';

  const inicioMostrado = aberto ? rascunhoInicio : dataInicio;
  const fimMostrado = aberto ? rascunhoFim : dataFim;
  const inicioDayjs = useMemo(() => isoParaDayjs(inicioMostrado), [inicioMostrado]);
  const fimDayjs = useMemo(() => isoParaDayjs(fimMostrado), [fimMostrado]);
  const texto = formatarTexto(inicioMostrado, fimMostrado, idioma);
  const temValor = !!(inicioMostrado || fimMostrado);

  function abrir(e: React.MouseEvent<HTMLElement>) {
    setRascunhoInicio(dataInicio);
    setRascunhoFim(dataFim);
    setEscolhendoFim(false);
    setAnchorEl(e.currentTarget);
  }

  function fechar() {
    if (escolhendoFim && rascunhoInicio) {
      onChangeInicio(rascunhoInicio);
      onChangeFim(rascunhoInicio);
    }
    setEscolhendoFim(false);
    setAnchorEl(null);
  }

  function limpar(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setRascunhoInicio('');
    setRascunhoFim('');
    setEscolhendoFim(false);
    setAnchorEl(null);
    onChangeInicio('');
    onChangeFim('');
  }

  function selecionarDia(day: Dayjs | null) {
    if (!day?.isValid()) return;
    const iso = day.format('YYYY-MM-DD');

    if (!escolhendoFim || !rascunhoInicio) {
      setRascunhoInicio(iso);
      setRascunhoFim(iso);
      setEscolhendoFim(true);
      return;
    }

    const ini = iso < rascunhoInicio ? iso : rascunhoInicio;
    const fim = iso < rascunhoInicio ? rascunhoInicio : iso;
    setRascunhoInicio(ini);
    setRascunhoFim(fim);
    setEscolhendoFim(false);
    onChangeInicio(ini);
    onChangeFim(fim);
    setAnchorEl(null);
  }

  return (
    <LocalizationProvider
      dateAdapter={AdapterDayjs}
      adapterLocale="pt-br"
      localeText={datePickerPtBR}
    >
      {variante === 'texto' ? (
        <Box
          role="button"
          tabIndex={0}
          aria-label={rotuloPeriodo}
          onClick={abrir}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setAnchorEl(e.currentTarget);
              setEscolhendoFim(false);
            }
          }}
          sx={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            minHeight: 32,
            px: 0.5,
            borderRadius: 1,
            '&:hover .periodo-texto': { color: colors.textPrimary },
          }}
        >
          <Typography
            className="periodo-texto"
            sx={{
              fontSize: '0.875rem',
              fontWeight: 500,
              letterSpacing: '-0.01em',
              color: colors.textSecondary,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {formatarTextoCurto(dataInicio, dataFim, idioma)}
          </Typography>
        </Box>
      ) : (
      <Box sx={compacto ? filtroDataCompactoSx : filtroDataSx}>
        <TextField
          fullWidth={!compacto}
          size="small"
          /** Compacto: sem label flutuante — evita corte em containers com overflow hidden. */
          label={compacto ? undefined : rotuloPeriodo}
          aria-label={rotuloPeriodo}
          value={texto}
          placeholder={compacto ? rotuloPeriodo : placeholderPeriodo}
          onClick={abrir}
          slotProps={{
            inputLabel: compacto ? undefined : labelFixo.inputLabel,
            input: {
              readOnly: true,
              sx: { cursor: 'pointer' },
              endAdornment: temValor ? (
                <IconButton
                  size="small"
                  onClick={limpar}
                  aria-label={limparLabel}
                  edge="end"
                  sx={compacto ? { p: 0.25 } : undefined}
                >
                  <ClearIcon sx={{ fontSize: compacto ? '0.85rem' : undefined }} />
                </IconButton>
              ) : undefined,
            },
          }}
          sx={{
            ...(compacto ? { width: '100%' } : campoAlturaFrotaSx),
            mb: 0,
            '& .MuiOutlinedInput-root, & .MuiPickersOutlinedInput-root': {
              borderRadius: compacto ? '10px' : '8px',
              minHeight: compacto ? 34 : 40,
              height: compacto ? 34 : 40,
            },
            '& .MuiOutlinedInput-notchedOutline, & .MuiPickersOutlinedInput-notchedOutline': {
              borderRadius: compacto ? '10px' : '8px',
            },
            '& .MuiInputBase-input': {
              letterSpacing: '0.01em',
              ...(compacto
                ? { height: 34, py: 0, boxSizing: 'border-box', fontSize: '0.8125rem' }
                : {}),
            },
            '& .MuiInputBase-input::placeholder': {
              color: 'text.disabled',
              opacity: 1,
              fontSize: compacto ? '0.8125rem' : '0.8rem',
            },
          }}
        />
      </Box>
      )}
        <Popover
          open={aberto}
          anchorEl={anchorEl}
          onClose={fechar}
          disableScrollLock
          anchorOrigin={{ vertical: 'bottom', horizontal: variante === 'texto' ? 'right' : 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: variante === 'texto' ? 'right' : 'left' }}
          marginThreshold={8}
          slotProps={{
            paper: {
              onMouseDown: (ev: ReactMouseEvent<HTMLElement>) => ev.preventDefault(),
              sx: {
                mt: 0.5,
                borderRadius: 2,
                overflow: 'visible',
                width: 320,
                maxWidth: 'calc(100vw - 24px)',
                bgcolor: papelCalendario,
                backgroundImage: 'none',
                border: `1px solid ${bordaCalendario}`,
                boxShadow: '0 10px 28px rgba(0, 0, 0, 0.28)',
                color: textoCalendario,
              },
            },
          }}
        >
          <Box sx={{ pb: 1.25, pt: 0, color: textoCalendario }}>
            {(() => {
              const calendario = (
              <DateCalendar
                value={fimDayjs ?? inicioDayjs}
                onChange={selecionarDia}
                maxDate={maxDate}
                reduceAnimations
                sx={{
                  width: '100%',
                  maxWidth: 320,
                  mx: 0,
                  my: 0,
                  height: 'auto !important',
                  maxHeight: 'none',
                  color: textoCalendario,
                  '& .MuiPickersCalendarHeader-root': {
                    pl: 1.5,
                    pr: 1.5,
                    mt: 0.5,
                    mb: 0,
                  },
                  '& .MuiPickersCalendarHeader-label': {
                    fontSize: '0.9rem',
                    color: `${textoCalendario} !important`,
                  },
                  '& .MuiPickersArrowSwitcher-button': {
                    color: `${textoCalendario} !important`,
                  },
                  '& .MuiDayCalendar-header': {
                    justifyContent: 'space-around',
                    px: 0.5,
                  },
                  '& .MuiDayCalendar-weekDayLabel': {
                    color: `${textoSecCalendario} !important`,
                  },
                  '& .MuiDayCalendar-weekContainer': {
                    justifyContent: 'space-around',
                    margin: 0,
                  },
                  '& .MuiDayCalendar-monthContainer': {
                    minHeight: 'unset !important',
                    height: 'auto !important',
                    position: 'relative !important',
                    overflow: 'visible !important',
                  },
                  '& .MuiPickersSlideTransition-root': {
                    minHeight: 'unset !important',
                    height: 'auto !important',
                    overflow: 'visible !important',
                    transition: 'none !important',
                  },
                  '& .MuiDateCalendar-viewTransitionContainer': {
                    minHeight: 'unset !important',
                    height: 'auto !important',
                    overflow: 'visible !important',
                    transition: 'none !important',
                  },
                  '& .MuiDayCalendar-slideTransition': {
                    minHeight: 'unset !important',
                    height: 'auto !important',
                    overflow: 'visible !important',
                    transition: 'none !important',
                  },
                  '& .MuiDayCalendar-slideTransition > *': {
                    position: 'relative !important',
                    transform: 'none !important',
                    transition: 'none !important',
                  },
                  '& .MuiPickersDay-root, & button.MuiPickersDay-root': {
                    margin: 0,
                    color: `${textoCalendario} !important`,
                    WebkitTextFillColor: `${textoCalendario} !important`,
                  },
                  '& .MuiPickersDay-root.Mui-disabled, & button.MuiPickersDay-root.Mui-disabled': {
                    color: 'rgba(148,163,184,0.4) !important',
                    WebkitTextFillColor: 'rgba(148,163,184,0.4) !important',
                  },
                  '& .MuiPickersDay-root.Mui-selected, & button.MuiPickersDay-root.Mui-selected': {
                    bgcolor: `${acento} !important`,
                    color: '#fff !important',
                    WebkitTextFillColor: '#fff !important',
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
                  '& .MuiYearCalendar-button, & .MuiMonthCalendar-button': {
                    color: `${textoCalendario} !important`,
                  },
                  '& .MuiYearCalendar-button.Mui-selected, & .MuiMonthCalendar-button.Mui-selected': {
                    bgcolor: `${acento} !important`,
                    color: '#fff !important',
                  },
                }}
              />
              );
              return temaEscuro ? (
                <ThemeProvider theme={temaCalendarioEscuro}>{calendario}</ThemeProvider>
              ) : (
                calendario
              );
            })()}
            <Box
              sx={{
                px: 2,
                mt: 1,
                mb: 0.25,
                fontSize: '0.75rem',
                color: textoSecCalendario,
                lineHeight: 1.35,
                textAlign: 'center',
              }}
            >
              {escolhendoFim
                ? 'Clique de novo no mesmo dia para confirmar, ou em outro para o intervalo.'
                : 'Clique num dia (só esse dia) ou em dois dias para um período.'}
            </Box>
          </Box>
        </Popover>
    </LocalizationProvider>
  );
}
