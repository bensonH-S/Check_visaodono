import { useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/pt-br';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { colors } from '../../theme/tokens';
import { periodoTrajetoCompleto } from '../../utils/mapaTrajetoPeriodo';
import { datePickerPtBR } from '../../utils/datePickerLocale';
import { dataHojeBrasilia, formatDataCampoData, parseIsoDateLocal } from '../../utils/dateBr';

dayjs.locale('pt-br');

type Props = {
  dataInicio: string;
  dataFim: string;
  onPeriodoChange: (inicio: string, fim: string) => void;
  /** Botão sobre fundo navy (stage immersive). */
  tomEscuro?: boolean;
  /** Campo largo com a data visível, no estilo do portal. */
  variante?: 'icone' | 'campo';
};

function isoParaDayjs(iso: string): Dayjs | null {
  const d = parseIsoDateLocal(iso);
  return d ? dayjs(d) : null;
}

function rotuloPeriodo(inicio: string, fim: string) {
  const fmt = (iso: string) => formatDataCampoData(iso);
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
  variante = 'icone',
}: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [escolhendoFim, setEscolhendoFim] = useState(false);
  const aberto = Boolean(anchorEl);
  const hoje = dataHojeBrasilia();
  const inicioDayjs = useMemo(() => isoParaDayjs(dataInicio), [dataInicio]);
  const fimDayjs = useMemo(() => isoParaDayjs(dataFim), [dataFim]);
  const periodoCompleto = periodoTrajetoCompleto(dataInicio, dataFim);
  const campo = variante === 'campo';
  const periodoAtivo =
    periodoCompleto && (dataInicio !== hoje || dataFim !== hoje || dataInicio !== dataFim);
  const rotulo = rotuloPeriodo(dataInicio, dataFim);

  function fechar() {
    setEscolhendoFim(false);
    setAnchorEl(null);
  }

  function selecionarDia(day: Dayjs | null) {
    if (!day?.isValid()) return;
    const iso = day.format('YYYY-MM-DD');

    if (escolhendoFim && dataInicio) {
      const inicio = isoParaDayjs(dataInicio);
      if (!inicio) {
        onPeriodoChange(iso, iso);
        setEscolhendoFim(false);
        setAnchorEl(null);
        return;
      }
      if (day.isSame(inicio, 'day')) {
        onPeriodoChange(iso, iso);
      } else if (day.isBefore(inicio, 'day')) {
        onPeriodoChange(iso, dataInicio);
      } else {
        onPeriodoChange(dataInicio, iso);
      }
      setEscolhendoFim(false);
      setAnchorEl(null);
      return;
    }

    onPeriodoChange(iso, iso);
    setEscolhendoFim(true);
  }

  return (
    <LocalizationProvider
      dateAdapter={AdapterDayjs}
      adapterLocale="pt-br"
      localeText={datePickerPtBR}
    >
      {campo ? (
        <button
          type="button"
          className="ck-mapa__consulta-field"
          onClick={(e) => {
            setEscolhendoFim(false);
            setAnchorEl(e.currentTarget);
          }}
          aria-label="Filtrar trajeto por data"
        >
          <span className="ck-mapa__consulta-label">Período</span>
          <span className="ck-mapa__consulta-value">
            <CalendarMonthOutlinedIcon sx={{ fontSize: 18, color: colors.navy, flexShrink: 0 }} />
            {rotulo}
          </span>
        </button>
      ) : (
        <button
          type="button"
          className={`ck-mapa__tool-btn${periodoAtivo || escolhendoFim ? ' is-on' : ''}${tomEscuro ? ' is-dark' : ''}`}
          onClick={(e) => {
            setEscolhendoFim(false);
            setAnchorEl(e.currentTarget);
          }}
          aria-label="Filtrar trajeto por data"
          title={`Trajeto: ${rotulo}`}
        >
          <CalendarMonthOutlinedIcon sx={{ fontSize: 20 }} />
        </button>
      )}
      <Popover
        open={aberto}
        anchorEl={anchorEl}
        onClose={fechar}
        anchorOrigin={{ vertical: 'bottom', horizontal: campo ? 'left' : 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: campo ? 'left' : 'right' }}
        slotProps={{ paper: { sx: { mt: 0.5, borderRadius: 2, width: 320, maxWidth: 'calc(100vw - 24px)' } } }}
      >
        <Box sx={{ px: 1.5, pt: 1, pb: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
            Período do trajeto
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 600, color: colors.navy }}>
            {rotulo}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            {escolhendoFim
              ? 'Toque de novo no mesmo dia para confirmar, ou em outro para o intervalo.'
              : 'Toque num dia (só esse dia) ou em dois dias para um período.'}
          </Typography>
        </Box>
        <DateCalendar
          value={fimDayjs ?? inicioDayjs}
          onChange={selecionarDia}
          maxDate={isoParaDayjs(hoje) ?? dayjs()}
          reduceAnimations
        />
      </Popover>
    </LocalizationProvider>
  );
}
