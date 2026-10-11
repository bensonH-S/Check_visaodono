import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import type { SxProps, Theme } from '@mui/material/styles'
import type { Empresa } from './api'
import {
  FIN_BORDER,
  FIN_TEXT,
  finCampoSx,
  finMenuSx,
} from './temaFinanceiroEscuro'

type Props = {
  lojas: Empresa[]
  value: string
  onChange: (empresaId: string) => void
  label?: string
  /** Inclui opção “Todas as lojas” com id vazio. */
  incluirTodas?: boolean
  todasLabel?: string
  width?: number | string | { xs?: string | number; md?: string | number }
  sx?: SxProps<Theme>
}

function rotulo(loja: Pick<Empresa, 'apelido' | 'razao_social' | 'id'>) {
  return loja.apelido || loja.razao_social || loja.id
}

/** Dropdown de loja: clique abre a lista completa (MUI Select). */
export default function SeletorLojaFinanceiro({
  lojas,
  value,
  onChange,
  label = 'Loja',
  incluirTodas = false,
  todasLabel = 'Todas as lojas',
  width = { xs: '100%', md: 220 },
  sx,
}: Props) {
  const ids = new Set(lojas.map((l) => l.id))
  const valorOk = value && ids.has(value) ? value : incluirTodas || !lojas.length ? '' : lojas[0].id

  return (
    <TextField
      select
      size="small"
      label={label}
      value={valorOk}
      onChange={(ev) => onChange(ev.target.value)}
      slotProps={{
        inputLabel: { shrink: true },
        select: {
          displayEmpty: incluirTodas,
          MenuProps: {
            slotProps: {
              paper: {
                sx: {
                  ...finMenuSx,
                  maxHeight: 'min(70vh, 480px)',
                },
              },
              list: {
                dense: true,
                sx: { maxHeight: 'none', py: 0.5 },
              },
            },
          },
        },
      }}
      sx={[
        {
          width,
          flexShrink: 0,
          ...finCampoSx,
          borderRadius: '10px',
          '& .MuiOutlinedInput-root': {
            ...finCampoSx['& .MuiOutlinedInput-root'],
            borderRadius: '10px !important',
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: value ? '#1B6EF3' : FIN_BORDER,
            borderRadius: '10px !important',
          },
          '& .MuiSelect-select': {
            color: FIN_TEXT,
            fontSize: '0.8125rem',
          },
          '& .MuiInputLabel-root': { fontSize: '0.8125rem' },
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {incluirTodas && (
        <MenuItem value="">
          <em style={{ fontStyle: 'normal' }}>{todasLabel}</em>
        </MenuItem>
      )}
      {lojas.map((loja) => (
        <MenuItem key={loja.id} value={loja.id}>
          {rotulo(loja)}
        </MenuItem>
      ))}
    </TextField>
  )
}
