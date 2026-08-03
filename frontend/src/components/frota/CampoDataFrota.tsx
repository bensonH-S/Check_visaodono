import { useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/pt-br';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import type { SxProps, Theme } from '@mui/material/styles';
import { labelFixo, campoAlturaFrotaSx } from '../../constants/frotaVeiculo';
import { datePickerPtBR } from '../../utils/datePickerLocale';
import { dataHojeBrasilia, parseIsoDateLocal } from '../../utils/dateBr';

dayjs.locale('pt-br');

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

export default function CampoDataFrota({ label, value, onChange, disabled, max, min, sx }: Props) {
  const [aberto, setAberto] = useState(false);
  const maxDate = isoParaDayjs(max ?? dataHojeIso()) ?? dayjs();
  const minDate = min ? isoParaDayjs(min) ?? undefined : undefined;

  function abrirCalendario() {
    if (!disabled) setAberto(true);
  }

  return (
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
            sx: {
              cursor: disabled ? 'default' : 'pointer',
              ...campoAlturaFrotaSx,
              ...sx,
            },
            slotProps: {
              inputLabel: { ...labelFixo.inputLabel, shrink: true },
              input: { readOnly: true },
              htmlInput: { placeholder: 'Selecionar data' },
            },
          },
        }}
      />
    </LocalizationProvider>
  );
}
