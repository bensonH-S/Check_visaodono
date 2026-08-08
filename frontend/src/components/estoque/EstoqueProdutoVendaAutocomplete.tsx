import { useRef } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import LunchDiningOutlinedIcon from '@mui/icons-material/LunchDiningOutlined';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ProdutoVendaEstoque } from '../../api/client';

type Props = {
  produtos: ProdutoVendaEstoque[];
  value: string;
  onChange: (codigo: string, produto?: ProdutoVendaEstoque | null) => void;
  label?: string;
  size?: 'small' | 'medium';
  disabled?: boolean;
  sx?: SxProps<Theme>;
  hideLabel?: boolean;
  placeholder?: string;
};

function rotuloProduto(p: ProdutoVendaEstoque) {
  const desc = String(p.descricao || '').trim();
  const cod = String(p.codigo || '').trim();
  if (desc && cod) return `${desc} (${cod})`;
  return desc || cod;
}

function fecharTeclado() {
  const el = document.activeElement;
  if (el instanceof HTMLElement) el.blur();
}

export default function EstoqueProdutoVendaAutocomplete({
  produtos,
  value,
  onChange,
  label = 'Produto de venda',
  size = 'small',
  disabled = false,
  sx,
  hideLabel = false,
  placeholder = 'Digite ou escolha o produto…',
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const codVal = String(value || '').trim();
  const selecionado =
    produtos.find((p) => String(p.codigo || '').trim() === codVal) ?? null;

  return (
    <Autocomplete
      options={produtos}
      value={selecionado}
      onChange={(_, p) => {
        onChange(p?.codigo ?? '', p);
        // Fecha teclado do celular assim que escolher o item.
        requestAnimationFrame(() => {
          inputRef.current?.blur();
          fecharTeclado();
        });
      }}
      onClose={(_, reason) => {
        if (reason === 'selectOption' || reason === 'blur' || reason === 'escape') {
          requestAnimationFrame(() => {
            inputRef.current?.blur();
            fecharTeclado();
          });
        }
      }}
      disabled={disabled}
      size={size}
      fullWidth
      autoHighlight
      clearOnEscape
      openOnFocus
      blurOnSelect
      selectOnFocus
      handleHomeEndKeys
      getOptionLabel={(p) => rotuloProduto(p)}
      isOptionEqualToValue={(a, b) =>
        a.id_produto_venda === b.id_produto_venda ||
        String(a.codigo || '') === String(b.codigo || '')
      }
      filterOptions={(lista, { inputValue }) => {
        const q = inputValue.trim().toLowerCase();
        if (!q) return lista;
        return lista.filter((p) => {
          const texto = `${p.descricao} ${p.codigo}`.toLowerCase();
          return texto.includes(q);
        });
      }}
      noOptionsText="Nenhum produto encontrado"
      renderOption={(props, p) => (
        <li
          {...props}
          key={p.id_produto_venda || p.codigo}
          style={{ display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <LunchDiningOutlinedIcon
            sx={{ fontSize: 20, color: 'rgba(27, 42, 107, 0.72)', flexShrink: 0 }}
          />
          <span>{rotuloProduto(p)}</span>
        </li>
      )}
      renderInput={(params) => {
        const html = params.slotProps.htmlInput;
        return (
          <TextField
            {...params}
            label={hideLabel ? undefined : label}
            placeholder={placeholder}
            size={size}
            fullWidth
            margin="none"
            slotProps={{
              ...params.slotProps,
              htmlInput: {
                ...html,
                enterKeyHint: 'done',
                ref: (node: HTMLInputElement | null) => {
                  inputRef.current = node;
                  const r = html.ref;
                  if (typeof r === 'function') r(node);
                  else if (r && typeof r === 'object') {
                    (r as { current: HTMLInputElement | null }).current = node;
                  }
                },
              },
              ...(hideLabel
                ? {}
                : {
                    inputLabel: {
                      ...params.slotProps.inputLabel,
                      shrink: true,
                    },
                  }),
            }}
          />
        );
      }}
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
                minHeight: 48,
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
