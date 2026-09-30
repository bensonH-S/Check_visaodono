import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ProdutoEstoque } from '../../api/client';

type Props = {
  produtos: ProdutoEstoque[];
  value: string;
  onChange: (codigo: string) => void;
  label?: string;
  size?: 'small' | 'medium';
  disabled?: boolean;
  sx?: SxProps<Theme>;
  /** Sem label MUI — só o input (mobile CSS). */
  hideLabel?: boolean;
  placeholder?: string;
};

function rotuloProduto(p: ProdutoEstoque) {
  return p.descricao || p.codigo;
}

export default function EstoqueInsumoAutocomplete({
  produtos,
  value,
  onChange,
  label = 'Insumo',
  size = 'small',
  disabled = false,
  sx,
  hideLabel = false,
  placeholder = 'Digite o nome do insumo…',
}: Props) {
  const codVal = String(value || '').trim().toUpperCase();
  const selecionado =
    produtos.find((p) => String(p.codigo || '').trim().toUpperCase() === codVal) ?? null;

  return (
    <Autocomplete
      options={produtos}
      value={selecionado}
      onChange={(_, p) => onChange(p?.codigo ?? '')}
      disabled={disabled}
      size={size}
      fullWidth
      autoHighlight
      clearOnEscape
      getOptionLabel={(p) => rotuloProduto(p)}
      isOptionEqualToValue={(a, b) =>
        a.id_produto === b.id_produto ||
        String(a.codigo || '').toUpperCase() === String(b.codigo || '').toUpperCase()
      }
      filterOptions={(lista, { inputValue }) => {
        const q = inputValue.trim().toLowerCase();
        if (!q) return lista;
        return lista.filter((p) => {
          const texto = `${p.descricao} ${p.codigo}`.toLowerCase();
          return texto.includes(q);
        });
      }}
      noOptionsText="Nenhum insumo encontrado"
      renderOption={(props, p) => (
        <li {...props} key={p.id_produto} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Inventory2OutlinedIcon
            sx={{ fontSize: 20, color: '#ff9a5c', flexShrink: 0 }}
          />
          <span>{p.descricao || p.codigo}</span>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={hideLabel ? undefined : label}
          placeholder={placeholder}
          size={size}
          fullWidth
          margin="none"
          slotProps={{
            ...params.slotProps,
            ...(hideLabel
              ? {}
              : {
                  inputLabel: {
                    ...(typeof params.slotProps?.inputLabel === 'object'
                      ? params.slotProps.inputLabel
                      : {}),
                    shrink: true,
                  },
                }),
          }}
        />
      )}
      slotProps={{
        popper: {
          sx: { zIndex: 14000 },
        },
        paper: {
          sx: {
            bgcolor: '#1a222c',
            color: '#f5f5f5',
            backgroundImage: 'none',
            border: '1px solid rgba(255,255,255,0.12)',
          },
        },
      }}
      sx={{
        ...(hideLabel
          ? {
              '& .MuiOutlinedInput-root': {
                borderRadius: '14px',
                background: '#2a3038',
                color: '#f5f5f5',
                minHeight: 48,
                fontWeight: 600,
                fontSize: 16,
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255, 255, 255, 0.14)',
              },
              '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255, 154, 92, 0.45)',
              },
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(254, 108, 34, 0.55)',
              },
              '& .MuiOutlinedInput-notchedOutline legend': {
                display: 'none',
                maxWidth: 0,
                padding: 0,
              },
              '& .MuiInputBase-input': {
                color: '#f5f5f5',
                WebkitTextFillColor: '#f5f5f5',
              },
              '& .MuiInputBase-input::placeholder': {
                color: '#8d8d8d',
                opacity: 1,
              },
              '& .MuiSvgIcon-root': {
                color: '#8d8d8d',
              },
            }
          : {}),
        ...sx,
      }}
    />
  );
}
