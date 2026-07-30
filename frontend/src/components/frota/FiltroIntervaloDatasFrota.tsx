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

dayjs.locale('pt-br');

type Props = {
  dataInicio: string;
  dataFim: string;
  onChangeInicio: (value: string) => void;
  onChangeFim: (value: string) => void;
  compacto?: boolean;
};

function isoParaDayjs(iso: string): Dayjs | null {
  if (!iso) return null;
  const d = dayjs(iso, 'YYYY-MM-DD', true);
  return d.isValid() ? d : null;
}

function formatarTexto(inicio: string, fim: string) {
  const fmt = (iso: string) => dayjs(iso, 'YYYY-MM-DD').format('DD/MM/YYYY');
  if (!inicio && !fim) return '';
  if (inicio && fim && inicio !== fim) return `${fmt(inicio)} a ${fmt(fim)}`;
  return fmt(inicio || fim);
}

const filtroDataSx = {
  mb: 0,
  minWidth: 260,
  flex: '0 0 auto',
  pt: 0.75,
  position: 'relative',
  '& .MuiOutlinedInput-root': {
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
  minWidth: 220,
  maxWidth: 280,
  flex: '1 1 auto',
  position: 'relative',
  '& .MuiOutlinedInput-root': {
    minHeight: 32,
    height: 32,
  },
  '& .MuiInputBase-input': {
    fontSize: '0.73rem',
    py: 0.25,
    px: 0.5,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '& .MuiInputLabel-root': {
    fontSize: '0.72rem',
    transform: 'translate(10px, 7px) scale(1)',
    '&.MuiInputLabel-shrink': {
      transform: 'translate(10px, -7px) scale(0.72)',
    },
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
  const aberto = Boolean(anchorEl);

  const inicioDayjs = useMemo(() => isoParaDayjs(dataInicio), [dataInicio]);
  const fimDayjs = useMemo(() => isoParaDayjs(dataFim), [dataFim]);
  const texto = formatarTexto(dataInicio, dataFim);
  const temValor = !!(dataInicio || dataFim);

  function abrir(e: React.MouseEvent<HTMLElement>) {
    setAnchorEl(e.currentTarget);
  }

  function fechar() {
    if (dataInicio && !dataFim) {
      onChangeFim(dataInicio);
    }
    setAnchorEl(null);
  }

  function limpar(e: React.MouseEvent) {
    e.stopPropagation();
    onChangeInicio('');
    onChangeFim('');
  }

  function selecionarDia(day: Dayjs | null) {
    if (!day?.isValid()) return;
    const iso = day.format('YYYY-MM-DD');

    // Ainda escolhendo o fim do intervalo
    if (dataInicio && !dataFim) {
      const inicio = dayjs(dataInicio, 'YYYY-MM-DD');
      if (day.isSame(inicio, 'day')) {
        onChangeFim(iso);
        setAnchorEl(null);
        return;
      }
      if (day.isBefore(inicio, 'day')) {
        onChangeFim(dataInicio);
        onChangeInicio(iso);
      } else {
        onChangeFim(iso);
      }
      setAnchorEl(null);
      return;
    }

    // Novo período: 1º clique = um dia só (início = fim)
    onChangeInicio(iso);
    onChangeFim('');
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
      <Box sx={compacto ? filtroDataCompactoSx : filtroDataSx}>
        <TextField
          fullWidth
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
            ...(compacto ? {} : campoAlturaFrotaSx),
            mb: 0,
            '& .MuiInputBase-input': {
              letterSpacing: '0.01em',
            },
            '& .MuiInputBase-input::placeholder': {
              color: 'text.disabled',
              opacity: 1,
              fontSize: compacto ? '0.72rem' : '0.8rem',
            },
          }}
        />
        <Popover
          open={aberto}
          anchorEl={anchorEl}
          onClose={fechar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{
            paper: {
              sx: {
                mt: 0.5,
                borderRadius: 2,
                overflow: 'hidden',
                width: 320,
                maxWidth: 'calc(100vw - 24px)',
              },
            },
          }}
        >
          <Box sx={{ pb: 1, pt: 0 }}>
            <DateCalendar
              value={fimDayjs ?? inicioDayjs}
              onChange={selecionarDia}
              maxDate={dayjs()}
              sx={{
                width: '100%',
                maxWidth: 320,
                mx: 0,
                my: 0,
                height: 'auto',
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
                '& .MuiDayCalendar-monthContainer': {
                  paddingBottom: 0,
                },
                '& .MuiPickersSlideTransition-root': {
                  minHeight: 0,
                },
                '& .MuiDateCalendar-viewTransitionContainer': {
                  minHeight: 0,
                },
                '& .MuiPickersDay-root': {
                  margin: 0,
                },
              }}
            />
            <Box
              sx={{
                px: 2,
                mt: -0.75,
                mb: 0,
                fontSize: '0.75rem',
                color: 'text.secondary',
                lineHeight: 1.35,
              }}
            >
              {dataInicio && !dataFim
                ? 'Clique de novo no mesmo dia para confirmar, ou em outro para o intervalo.'
                : 'Clique num dia (só hoje) ou em dois dias para um período.'}
            </Box>
          </Box>
        </Popover>
      </Box>
    </LocalizationProvider>
  );
}
