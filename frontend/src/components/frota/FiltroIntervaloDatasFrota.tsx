import { useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/pt-br';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Popover from '@mui/material/Popover';
import IconButton from '@mui/material/IconButton';
import ClearIcon from '@mui/icons-material/Clear';
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
}: Props) {
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
        <Popover
          open={aberto}
          anchorEl={anchorEl}
          onClose={fechar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          marginThreshold={8}
          slotProps={{
            paper: {
              sx: {
                mt: 0.5,
                borderRadius: 2,
                overflow: 'visible',
                width: 320,
                maxWidth: 'calc(100vw - 24px)',
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
                '& .MuiPickersCalendarHeader-root': {
                  pl: 1.5,
                  pr: 1.5,
                  mt: 0.5,
                  mb: 0,
                },
                '& .MuiPickersCalendarHeader-label': {
                  fontSize: '0.9rem',
                },
                '& .MuiDayCalendar-header': {
                  justifyContent: 'space-around',
                  px: 0.5,
                },
                '& .MuiDayCalendar-weekContainer': {
                  justifyContent: 'space-around',
                  margin: 0,
                },
                /* Altura estável: sem slide absoluto (evita flash da 6ª semana) */
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
      </Box>
    </LocalizationProvider>
  );
}
