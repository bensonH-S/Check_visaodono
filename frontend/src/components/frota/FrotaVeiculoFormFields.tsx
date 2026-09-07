import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import {
  ANOS_VEICULO,
  COMBUSTIVEIS_VEICULO,
  CORES_VEICULO,
  MARCAS_VEICULO,
  labelFixo,
  filtrarKmAoDigitar,
  ph,
  type FormVeiculoFrota,
} from '../../constants/frotaVeiculo';
import { selectMenuScrollProps } from '../../utils/selectMenuScroll';
import { colors } from '../../theme/tokens';
import { useAppTheme } from '../../context/ThemeContext';

type Props = {
  form: FormVeiculoFrota;
  onChange: (patch: Partial<FormVeiculoFrota>) => void;
};

const inputSx = {
  '& .MuiInputBase-input::placeholder': { color: 'text.disabled', opacity: 1 },
};

function renderSelectVazio(placeholder: string) {
  return (selected: unknown) => {
    if (!selected) {
      return (
        <Box component="span" sx={{ color: 'text.disabled' }}>
          {placeholder}
        </Box>
      );
    }
    return selected as React.ReactNode;
  };
}

function selectProps(placeholder: string) {
  return {
    displayEmpty: true,
    renderValue: renderSelectVazio(placeholder),
    ...selectMenuScrollProps,
  };
}

export default function FrotaVeiculoFormFields({ form, onChange }: Props) {
  const marcasOpcoes: string[] = [...MARCAS_VEICULO];
  if (form.marca && !marcasOpcoes.includes(form.marca)) {
    marcasOpcoes.push(form.marca);
  }

  const anosOpcoes = [...ANOS_VEICULO];
  if (form.ano && !anosOpcoes.includes(form.ano)) {
    anosOpcoes.unshift(form.ano);
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <SecaoFormTitulo icon={<BadgeOutlinedIcon fontSize="small" />}>IDENTIFICAÇÃO</SecaoFormTitulo>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
        <TextField
          label="Placa"
          required
          size="small"
          value={form.placa}
          onChange={(e) => onChange({ placa: e.target.value.toUpperCase() })}
          placeholder={ph.placa}
          slotProps={{ inputLabel: labelFixo.inputLabel }}
          sx={inputSx}
        />
        <TextField
          label="RENAVAM"
          size="small"
          value={form.renavam}
          onChange={(e) => onChange({ renavam: e.target.value.replace(/\D/g, '').slice(0, 11) })}
          placeholder={ph.renavam}
          slotProps={{ inputLabel: labelFixo.inputLabel }}
          sx={inputSx}
        />
        <TextField
          label="Chassi"
          size="small"
          value={form.chassi}
          onChange={(e) => onChange({ chassi: e.target.value.toUpperCase().slice(0, 17) })}
          placeholder={ph.chassi}
          slotProps={{ inputLabel: labelFixo.inputLabel }}
          sx={inputSx}
        />
      </Box>

      <SecaoFormTitulo icon={<DirectionsCarOutlinedIcon fontSize="small" />}>
        DADOS DO VEÍCULO
      </SecaoFormTitulo>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
        <TextField
          select
          label="Marca"
          size="small"
          value={form.marca}
          onChange={(e) => onChange({ marca: e.target.value })}
          slotProps={{ inputLabel: labelFixo.inputLabel, select: selectProps(ph.marca) }}
        >
          <MenuItem value="" disabled sx={{ display: 'none' }}>
            {ph.marca}
          </MenuItem>
          {marcasOpcoes.map((m) => (
            <MenuItem key={m} value={m}>
              {m}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Modelo"
          size="small"
          value={form.modelo}
          onChange={(e) => onChange({ modelo: e.target.value })}
          placeholder={ph.modelo}
          slotProps={{ inputLabel: labelFixo.inputLabel }}
          sx={inputSx}
        />
        <TextField
          select
          label="Ano"
          size="small"
          value={form.ano}
          onChange={(e) => onChange({ ano: e.target.value })}
          slotProps={{ inputLabel: labelFixo.inputLabel, select: selectProps(ph.ano) }}
        >
          <MenuItem value="" disabled sx={{ display: 'none' }}>
            {ph.ano}
          </MenuItem>
          {anosOpcoes.map((a) => (
            <MenuItem key={a} value={a}>
              {a}
            </MenuItem>
          ))}
        </TextField>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
        <TextField
          select
          label="Cor"
          size="small"
          value={form.cor}
          onChange={(e) => onChange({ cor: e.target.value })}
          slotProps={{ inputLabel: labelFixo.inputLabel, select: selectProps(ph.cor) }}
        >
          <MenuItem value="" disabled sx={{ display: 'none' }}>
            {ph.cor}
          </MenuItem>
          {CORES_VEICULO.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Combustível"
          size="small"
          value={form.combustivel}
          onChange={(e) => onChange({ combustivel: e.target.value })}
          slotProps={{ inputLabel: labelFixo.inputLabel, select: selectProps(ph.combustivel) }}
        >
          <MenuItem value="" disabled sx={{ display: 'none' }}>
            {ph.combustivel}
          </MenuItem>
          {COMBUSTIVEIS_VEICULO.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="KM inicial"
          size="small"
          value={form.km_atual}
          onChange={(e) => onChange({ km_atual: filtrarKmAoDigitar(e.target.value) })}
          placeholder={ph.kmInicial}
          inputMode="numeric"
          slotProps={{ inputLabel: labelFixo.inputLabel }}
          sx={inputSx}
        />
      </Box>
      <SecaoFormTitulo icon={<NotesOutlinedIcon fontSize="small" />}>OBSERVAÇÕES</SecaoFormTitulo>
      <TextField
        label="Observações"
        size="small"
        multiline
        minRows={2}
        value={form.observacoes}
        onChange={(e) => onChange({ observacoes: e.target.value })}
        placeholder={ph.observacoes}
        slotProps={{ inputLabel: labelFixo.inputLabel }}
        sx={inputSx}
      />
    </Box>
  );
}

function SecaoFormTitulo({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  const { mode } = useAppTheme();
  const acento = mode === 'dark' ? '#E8520A' : colors.navy;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
      <Box sx={{ display: 'inline-flex', color: acento, opacity: 0.85 }}>{icon}</Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontWeight: 600, letterSpacing: '0.04em' }}
      >
        {children}
      </Typography>
    </Box>
  );
}
