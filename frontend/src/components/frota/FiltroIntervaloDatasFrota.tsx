import { useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/pt-br';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Popover from '@mui/material/Popover';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
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

type Props = {
  dataInicio: string;
  dataFim: string;
  onChangeInicio: (value: string) => void;
  onChangeFim: (value: string) => void;
  compacto?: boolean;
  /** Texto clicável, sem campo — para cabeçalhos de dashboard. */
  variante?: 'campo' | 'texto';
};

function isoParaDayjs(iso: string): Dayjs | null {
  const d = parseIsoDateLocal(iso);
  return d ? dayjs(d) : null;
}

function formatarTexto(inicio: string, fim: string) {
  const fmt = (iso: string) => formatDataCampoData(iso);
  if (!inicio && !fim) return '';
  if (inicio && fim && inicio !== fim) return `${fmt(inicio)} a ${fmt(fim)}`;
  return fmt(inicio || fim);
}

function formatarTextoCurto(inicio: string, fim: string) {
  const partes = (iso: string) => {
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    return { d, m, y };
  };
  const fmt = (iso: string, comAno: boolean) => {
    const { d, m, y } = partes(iso);
    if (!d || !m || !y) return formatDataCampoData(iso);
    return comAno ? `${d}/${m}/${y}` : `${d}/${m}`;
  };
  if (!inicio && !fim) return 'Período';
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
  width: 300,
  minWidth: 300,
  maxWidth: 300,
  flex: '0 0 auto',
  position: 'relative',
  '& .MuiOutlinedInput-root': {
    minHeight: 32,
    height: 32,
  },
  '& .MuiInputBase-input': {
    fontSize: '0.74rem',
    py: 0.25,
    px: 0.75,
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
}: Props) {
  const { mode } = useAppTheme();
  const escuro = mode === 'dark';
  const acento = escuro ? '#E8520A' : '#1B2A6B';
  const acentoHover = escuro ? 'rgba(232, 82, 10, 0.22)' : 'rgba(27, 42, 107, 0.1)';
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [escolhendoFim, setEscolhendoFim] = useState(false);
  const aberto = Boolean(anchorEl);
  const hoje = dataHojeBrasilia();

  const inicioDayjs = useMemo(() => isoParaDayjs(dataInicio), [dataInicio]);
  const fimDayjs = useMemo(() => isoParaDayjs(dataFim), [dataFim]);
  const texto = formatarTexto(dataInicio, dataFim);
  const temValor = !!(dataInicio || dataFim);

  function abrir(e: React.MouseEvent<HTMLElement>) {
    setEscolhendoFim(false);
    setAnchorEl(e.currentTarget);
  }

  function fechar() {
    setEscolhendoFim(false);
    setAnchorEl(null);
  }

  function limpar(e: React.MouseEvent) {
    e.stopPropagation();
    onChangeInicio('');
    onChangeFim('');
    setEscolhendoFim(false);
  }

  function selecionarDia(day: Dayjs | null) {
    if (!day?.isValid()) return;
    const iso = day.format('YYYY-MM-DD');

    // 2º clique: define o fim do intervalo (ou confirma o mesmo dia)
    if (escolhendoFim && dataInicio) {
      const inicio = isoParaDayjs(dataInicio);
      if (!inicio) {
        onChangeInicio(iso);
        onChangeFim(iso);
        setEscolhendoFim(false);
        setAnchorEl(null);
        return;
      }
      if (day.isSame(inicio, 'day')) {
        onChangeFim(iso);
      } else if (day.isBefore(inicio, 'day')) {
        onChangeFim(dataInicio);
        onChangeInicio(iso);
      } else {
        onChangeFim(iso);
      }
      setEscolhendoFim(false);
      setAnchorEl(null);
      return;
    }

    // 1º clique: dia único já consultável; próximo clique estende o período
    onChangeInicio(iso);
    onChangeFim(iso);
    setEscolhendoFim(true);
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
          aria-label="Período"
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
            {formatarTextoCurto(dataInicio, dataFim)}
          </Typography>
        </Box>
      ) : (
      <Box sx={compacto ? filtroDataCompactoSx : filtroDataSx}>
        <TextField
          fullWidth={!compacto}
          size="small"
          label="Período"
          value={texto}
          placeholder={compacto ? 'Datas' : 'Clique para selecionar'}
          onClick={abrir}
          slotProps={{
            inputLabel: compacto ? { shrink: true } : labelFixo.inputLabel,
            input: {
              readOnly: true,
              sx: { cursor: 'pointer' },
              endAdornment: temValor ? (
                <IconButton
                  size="small"
                  onClick={limpar}
                  aria-label="Limpar período"
                  edge="end"
                  sx={compacto ? { p: 0.25 } : undefined}
                >
                  <ClearIcon sx={{ fontSize: compacto ? '0.85rem' : undefined }} />
                </IconButton>
              ) : undefined,
            },
          }}
          sx={{
            ...(compacto ? { width: 300 } : campoAlturaFrotaSx),
            mb: 0,
            '& .MuiOutlinedInput-root, & .MuiPickersOutlinedInput-root': {
              borderRadius: '8px',
              minHeight: 40,
              height: 40,
            },
            '& .MuiOutlinedInput-notchedOutline, & .MuiPickersOutlinedInput-notchedOutline': {
              borderRadius: '8px',
            },
            '& .MuiInputBase-input': {
              letterSpacing: '0.01em',
            },
            '& .MuiInputBase-input::placeholder': {
              color: 'text.disabled',
              opacity: 1,
              fontSize: compacto ? '0.74rem' : '0.8rem',
            },
          }}
        />
      </Box>
      )}
        <Popover
          open={aberto}
          anchorEl={anchorEl}
          onClose={fechar}
          anchorOrigin={{ vertical: 'bottom', horizontal: variante === 'texto' ? 'right' : 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: variante === 'texto' ? 'right' : 'left' }}
          marginThreshold={8}
          slotProps={{
            paper: {
              sx: {
                mt: 0.5,
                borderRadius: 2,
                overflow: 'visible',
                width: 320,
                maxWidth: 'calc(100vw - 24px)',
                bgcolor: 'var(--ga-picker-paper)',
                backgroundImage: 'none',
                border: `1px solid ${colors.borderStrong}`,
                boxShadow: '0 10px 28px rgba(0, 0, 0, 0.28)',
                color: colors.textPrimary,
              },
            },
          }}
        >
          <Box sx={{ pb: 1.25, pt: 0 }}>
            <DateCalendar
              value={fimDayjs ?? inicioDayjs}
              onChange={selecionarDia}
              maxDate={isoParaDayjs(hoje) ?? dayjs()}
              reduceAnimations
              sx={{
                width: '100%',
                maxWidth: 320,
                mx: 0,
                my: 0,
                height: 'auto !important',
                maxHeight: 'none',
                color: colors.textPrimary,
                '& .MuiPickersCalendarHeader-root': {
                  pl: 1.5,
                  pr: 1.5,
                  mt: 0.5,
                  mb: 0,
                },
                '& .MuiPickersCalendarHeader-label': {
                  fontSize: '0.9rem',
                  color: colors.textPrimary,
                },
                '& .MuiPickersArrowSwitcher-button': {
                  color: colors.textPrimary,
                },
                '& .MuiDayCalendar-header': {
                  justifyContent: 'space-around',
                  px: 0.5,
                },
                '& .MuiDayCalendar-weekDayLabel': {
                  color: colors.textSecondary,
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
                '& .MuiPickersDay-root': {
                  margin: 0,
                  color: colors.textPrimary,
                },
                '& .MuiPickersDay-root.Mui-selected': {
                  bgcolor: `${acento} !important`,
                  color: '#fff !important',
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
              }}
            />
            <Box
              sx={{
                px: 2,
                mt: 1,
                mb: 0.25,
                fontSize: '0.75rem',
                color: 'text.secondary',
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
