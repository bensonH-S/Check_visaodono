import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DirectionsCarFilledOutlinedIcon from '@mui/icons-material/DirectionsCarFilledOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import type { FrotaVeiculo } from '../../api/client';
import { rotuloVeiculoOpcao } from '../../constants/frotaVeiculo';
import { colors } from '../../theme/tokens';
import { useAppTheme } from '../../context/ThemeContext';

type Props = {
  options: FrotaVeiculo[];
  value: FrotaVeiculo | null;
  onChange: (veiculo: FrotaVeiculo | null) => void;
  label?: string;
  size?: 'small' | 'medium';
  disabled?: boolean;
  sx?: object;
};

function rotuloModelo(v: FrotaVeiculo) {
  const modelo = [v.marca, v.modelo].filter(Boolean).join(' ');
  return modelo || 'Modelo não informado';
}

export default function FrotaVeiculoAutocomplete({
  options,
  value,
  onChange,
  label = 'Veículo',
  size = 'small',
  disabled = false,
  sx,
}: Props) {
  const { mode } = useAppTheme();
  const escuro = mode === 'dark';
  const acento = escuro ? '#E8520A' : colors.navy;
  const acentoMuted = escuro ? 'rgba(232, 82, 10, 0.12)' : 'rgba(27, 42, 107, 0.07)';
  const acentoBorder = escuro ? 'rgba(232, 82, 10, 0.28)' : 'rgba(27, 42, 107, 0.12)';
  const acentoSelectedBg = escuro ? 'rgba(232, 82, 10, 0.1)' : 'rgba(27, 42, 107, 0.08)';
  const acentoSelectedBorder = escuro ? 'rgba(232, 82, 10, 0.35)' : 'rgba(27, 42, 107, 0.28)';
  const hoverBg = escuro ? 'rgba(232, 82, 10, 0.08)' : 'rgba(27, 42, 107, 0.04)';

  return (
    <Autocomplete
      options={options}
      value={value}
      onChange={(_, v) => onChange(v)}
      disabled={disabled}
      getOptionLabel={(v) => rotuloVeiculoOpcao(v)}
      isOptionEqualToValue={(a, b) => a.id_veiculo === b.id_veiculo}
      filterOptions={(lista, { inputValue }) => {
        const q = inputValue.trim().toLowerCase();
        if (!q) return lista;
        return lista.filter((v) => {
          const texto = [
            v.placa,
            v.marca,
            v.modelo,
            v.nome_regiao,
            v.nome_responsavel,
            v.ano != null ? String(v.ano) : '',
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return texto.includes(q);
        });
      }}
      sx={{
        minWidth: 280,
        flex: 1,
        '& .MuiOutlinedInput-root': {
          borderRadius: '8px',
          height: 40,
          minHeight: 40,
          alignItems: 'center',
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: `${acento} !important`,
          },
        },
        '& .MuiOutlinedInput-input': {
          py: '4px !important',
          boxSizing: 'border-box' as const,
          fontSize: '0.875rem',
          fontWeight: value ? 700 : 400,
          color: value ? acento : colors.textPrimary,
        },
        '& .MuiInputLabel-root.Mui-focused': {
          color: `${acento} !important`,
        },
        ...sx,
      }}
      slotProps={{
        paper: {
          sx: { borderRadius: 2.5, mt: 0.5 },
        },
        listbox: {
          sx: { maxHeight: 360, py: 0.75 },
        },
      }}
      renderOption={(props, v) => {
        const { key, ...rest } = props;
        const selecionado = value?.id_veiculo === v.id_veiculo;
        return (
          <Box
            component="li"
            key={key}
            {...rest}
            sx={{
              mx: 0.75,
              mb: 0.5,
              px: 1.25,
              py: 1,
              borderRadius: 2,
              border: '1px solid',
              borderColor: selecionado ? acentoSelectedBorder : acentoBorder,
              bgcolor: selecionado ? acentoSelectedBg : 'transparent',
              '&[aria-selected="true"]': {
                bgcolor: acentoSelectedBg,
              },
              '&:hover': {
                bgcolor: selecionado ? (escuro ? 'rgba(232, 82, 10, 0.14)' : 'rgba(27, 42, 107, 0.12)') : hoverBg,
              },
            }}
          >
            <Box sx={{ display: 'flex', gap: 1.1, alignItems: 'flex-start', width: '100%' }}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 1.5,
                  bgcolor: selecionado ? acento : acentoMuted,
                  color: selecionado ? '#fff' : colors.textPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <DirectionsCarFilledOutlinedIcon sx={{ fontSize: 19 }} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 800, color: selecionado ? acento : colors.textPrimary, lineHeight: 1.2 }}
                >
                  {v.placa}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }}>
                  {rotuloModelo(v)}
                  {v.ano ? ` · ${v.ano}` : ''}
                </Typography>
                {v.nome_regiao && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mt: 0.35 }}>
                    <LocationOnOutlinedIcon sx={{ fontSize: 13, color: acento, opacity: 0.9 }} />
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                      {v.nome_regiao}
                    </Typography>
                  </Box>
                )}
                {v.nome_responsavel && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mt: 0.2 }}>
                    <PersonOutlineOutlinedIcon sx={{ fontSize: 13, opacity: 0.75 }} />
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                      {v.nome_responsavel}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          size={size}
          placeholder="Buscar por placa, modelo ou região"
          slotProps={{
            ...params.slotProps,
            inputLabel: { ...params.slotProps?.inputLabel, shrink: true },
          }}
        />
      )}
    />
  );
}
