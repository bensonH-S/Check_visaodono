import { useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/pt-br';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { colors } from '../../theme/tokens';
import { periodoTrajetoCompleto } from '../../utils/mapaTrajetoPeriodo';

dayjs.locale('pt-br');

type Props = {
  dataInicio: string;
  dataFim: string;
  onPeriodoChange: (inicio: string, fim: string) => void;
  /** Botão sobre fundo navy (stage immersive). */
  tomEscuro?: boolean;
};

function isoParaDayjs(iso: string): Dayjs | null {
  if (!iso) return null;
  const d = dayjs(iso, 'YYYY-MM-DD', true);
  return d.isValid() ? d : null;
}

function rotuloPeriodo(inicio: string, fim: string) {
  const fmt = (iso: string) => dayjs(iso, 'YYYY-MM-DD').format('DD/MM/YYYY');
  if (periodoTrajetoCompleto(inicio, fim)) {
    if (inicio === fim) return fmt(inicio);
    return `${fmt(inicio)} a ${fmt(fim)}`;
  }
  if (inicio) return `De ${fmt(inicio)}…`;
  return 'Hoje';
}

export default function MapaFiltroTrajetoCalendario({
  dataInicio,
  dataFim,
  onPeriodoChange,
  tomEscuro = false,
}: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const aberto = Boolean(anchorEl);
  const hoje = dayjs().format('YYYY-MM-DD');
  const inicioDayjs = useMemo(() => isoParaDayjs(dataInicio), [dataInicio]);
  const fimDayjs = useMemo(() => isoParaDayjs(dataFim), [dataFim]);
  const periodoCompleto = periodoTrajetoCompleto(dataInicio, dataFim);
  const selecionandoFim = !!dataInicio && !dataFim;
  const periodoAtivo =
    periodoCompleto && (dataInicio !== hoje || dataFim !== hoje || dataInicio !== dataFim);

  function selecionarDia(day: Dayjs | null) {
    if (!day?.isValid()) return;
    const iso = day.format('YYYY-MM-DD');

    if (!dataInicio || dataFim) {
      onPeriodoChange(iso, '');
      return;
    }

    const inicio = dayjs(dataInicio, 'YYYY-MM-DD');
    if (day.isBefore(inicio, 'day')) {
      onPeriodoChange(iso, dataInicio);
    } else {
      onPeriodoChange(dataInicio, iso);
    }
    setAnchorEl(null);
  }

  const instrucao = selecionandoFim
    ? 'Toque na data final do intervalo'
    : 'Toque na data inicial';

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
      <Tooltip title={`Trajeto: ${rotuloPeriodo(dataInicio, dataFim)}`} arrow>
        <IconButton
          size="small"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-label="Filtrar trajeto por data"
          sx={{
            flexShrink: 0,
            width: 36,
            height: 36,
            bgcolor:
              periodoAtivo || selecionandoFim
                ? colors.orange
                : tomEscuro
                  ? 'rgba(255, 255, 255, 0.14)'
                  : 'rgba(27, 42, 107, 0.06)',
            color: periodoAtivo || selecionandoFim || tomEscuro ? '#fff' : colors.navy,
            boxShadow: periodoAtivo || selecionandoFim ? '0 2px 8px rgba(232, 82, 10, 0.28)' : 'none',
            '&:hover': {
              bgcolor:
                periodoAtivo || selecionandoFim
                  ? colors.orange
                  : tomEscuro
                    ? 'rgba(255, 255, 255, 0.22)'
                    : 'rgba(27, 42, 107, 0.1)',
            },
          }}
        >
          <CalendarMonthOutlinedIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Tooltip>
      <Popover
        open={aberto}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { mt: 0.5, borderRadius: 2 } } }}
      >
        <Box sx={{ px: 1.5, pt: 1, pb: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
            Período do trajeto
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 600, color: colors.navy }}>
            {rotuloPeriodo(dataInicio, dataFim)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            {instrucao}
          </Typography>
        </Box>
        <DateCalendar
          value={fimDayjs ?? inicioDayjs}
          onChange={selecionarDia}
          maxDate={dayjs()}
        />
      </Popover>
    </LocalizationProvider>
  );
}
