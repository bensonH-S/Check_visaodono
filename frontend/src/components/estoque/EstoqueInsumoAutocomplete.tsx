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
  const selecionado = produtos.find((p) => p.codigo === value) ?? null;

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
      isOptionEqualToValue={(a, b) => a.id_produto === b.id_produto || a.codigo === b.codigo}
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
            sx={{ fontSize: 20, color: 'rgba(27, 42, 107, 0.72)', flexShrink: 0 }}
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
      }}
      sx={{
        ...(hideLabel
          ? {
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                background: '#fff',
                minHeight: 44,
                fontWeight: 600,
                fontSize: 16,
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(27, 42, 107, 0.18)',
              },
            }
          : {}),
        ...sx,
      }}
    />
  );
}
