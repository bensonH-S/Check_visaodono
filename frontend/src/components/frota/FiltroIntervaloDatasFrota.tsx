import { useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/pt-br';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Popover from '@mui/material/Popover';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import ClearIcon from '@mui/icons-material/Clear';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
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
  /** Versão compacta para a barra de abas do modal. */
  compacto?: boolean;
};

function isoParaDayjs(iso: string): Dayjs | null {
  if (!iso) return null;
  const d = dayjs(iso, 'YYYY-MM-DD', true);
  return d.isValid() ? d : null;
}

function formatarTexto(inicio: string, fim: string) {
  const fmt = (iso: string) => dayjs(iso, 'YYYY-MM-DD').format('DD/MM/YYYY');
  if (inicio && fim) return `${fmt(inicio)} – ${fmt(fim)}`;
  if (inicio) return `${fmt(inicio)} – ...`;
  return '';
}

const filtroDataSx = {
  mb: 0,
  minWidth: 260,
  flex: '0 0 auto',
  pt: 0.75,
  '& .MuiOutlinedInput-root, & .MuiPickersOutlinedInput-root': {
    minHeight: 40,
    height: 40,
  },
  '& .MuiInputLabel-root.MuiInputLabel-shrink': {
    transform: 'translate(14px, -9px) scale(0.75)',
  },
} as const;

const filtroDataCompactoSx = {
  mb: 0,
  width: 198,
  minWidth: 198,
  maxWidth: 198,
  flex: '0 0 auto',
  '& .MuiOutlinedInput-root, & .MuiPickersOutlinedInput-root': {
    minHeight: 32,
    height: 32,
  },
  '& .MuiInputBase-input': {
    fontSize: '0.73rem',
    py: 0.25,
    px: 0.5,
    letterSpacing: '-0.01em',
  },
  '& .MuiInputLabel-root': {
    fontSize: '0.72rem',
    transform: 'translate(10px, 7px) scale(1)',
    '&.MuiInputLabel-shrink': {
      transform: 'translate(10px, -7px) scale(0.72)',
    },
  },
  '& .MuiInputLabel-root.Mui-focused': {
    transform: 'translate(10px, -7px) scale(0.72)',
  },
  '& .MuiInputAdornment-root .MuiSvgIcon-root': {
    fontSize: '0.95rem',
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

    if (!dataInicio || (dataInicio && dataFim)) {
      onChangeInicio(iso);
      onChangeFim('');
      return;
    }

    const inicio = dayjs(dataInicio, 'YYYY-MM-DD');
    if (day.isBefore(inicio, 'day')) {
      onChangeFim(dataInicio);
      onChangeInicio(iso);
    } else {
      onChangeFim(iso);
    }
    fechar();
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
      <Box sx={compacto ? filtroDataCompactoSx : filtroDataSx}>
        <TextField
          fullWidth
          size="small"
          label="Período"
          value={texto}
          placeholder={compacto ? 'Datas' : 'Selecione o intervalo'}
          onClick={abrir}
            slotProps={{
            inputLabel: compacto
              ? { shrink: true }
              : labelFixo.inputLabel,
            input: {
              readOnly: true,
              sx: { cursor: 'pointer' },
              endAdornment: (
                <InputAdornment position="end" sx={{ ml: 0 }}>
                  {temValor && (
                    <IconButton
                      size="small"
                      onClick={limpar}
                      aria-label="Limpar período"
                      edge="end"
                      sx={compacto ? { p: 0.25 } : undefined}
                    >
                      <ClearIcon sx={{ fontSize: compacto ? '0.85rem' : undefined }} />
                    </IconButton>
                  )}
                  <CalendarMonthIcon
                    fontSize="small"
                    color="action"
                    sx={{ fontSize: compacto ? '0.95rem' : undefined, ml: temValor ? 0 : 0.25 }}
                  />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            ...(compacto ? {} : campoAlturaFrotaSx),
            mb: 0,
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
          slotProps={{ paper: { sx: { mt: 0.5, borderRadius: 2 } } }}
        >
          <DateCalendar
            value={fimDayjs ?? inicioDayjs}
            onChange={selecionarDia}
            maxDate={dayjs()}
          />
        </Popover>
      </Box>
    </LocalizationProvider>
  );
}
