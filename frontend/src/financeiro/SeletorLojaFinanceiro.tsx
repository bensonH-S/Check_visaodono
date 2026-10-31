import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import type { SxProps, Theme } from '@mui/material/styles'
import { assetUrl } from '../config/paths'
import { ehLojaPopeyes } from '../components/escalas/escalaVisitasUtils'
import type { Empresa } from './api'
import {
  FIN_BORDER,
  FIN_MUTED,
  FIN_TEXT,
  finCampoSx,
  finMenuSx,
} from './temaFinanceiroEscuro'

type Opcao = {
  id: string
  nome: string
  detalhe: string
  todas?: boolean
}

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

function Marca({ opcao, size }: { opcao: Opcao | null; size: number }) {
  const base = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    bgcolor: '#F8FAFC',
    border: `1px solid ${FIN_BORDER}`,
    overflow: 'hidden',
  } as const
  if (!opcao || opcao.todas) {
    return (
      <Box sx={{ ...base, color: '#1B6EF3' }}>
        <StorefrontOutlinedIcon sx={{ fontSize: size * 0.58 }} />
      </Box>
    )
  }
  return (
    <Box sx={base}>
      <img
        src={assetUrl(ehLojaPopeyes(opcao.nome) ? 'Popeyes.png' : 'BK_logo.png')}
        alt=""
        width={size * 0.7}
        height={size * 0.7}
      />
    </Box>
  )
}

/** Autocomplete de loja com logo — mesmo padrão do filtro de Pedidos (estoque). */
export default function SeletorLojaFinanceiro({
  lojas,
  value,
  onChange,
  label = 'Loja',
  incluirTodas = false,
  todasLabel = 'Todas as lojas',
  width = 280,
  sx,
}: Props) {
  const opcoes: Opcao[] = [
    ...(incluirTodas
      ? [{ id: '', nome: todasLabel, detalhe: `${lojas.length} lojas`, todas: true }]
      : []),
    ...lojas.map((loja) => ({
      id: loja.id,
      nome: rotulo(loja),
      detalhe: loja.bk_number ? `BK ${loja.bk_number}` : loja.razao_social || loja.cnpj || '',
    })),
  ]

  const ids = new Set(lojas.map((l) => l.id))
  const valorOk = value && ids.has(value) ? value : incluirTodas || !lojas.length ? '' : lojas[0]?.id || ''
  const selecionada = opcoes.find((o) => o.id === valorOk) || opcoes[0] || null

  return (
    <Box
      sx={[
        {
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          width,
          flexShrink: 0,
          minWidth: 0,
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <Marca opcao={selecionada} size={30} />
      <Autocomplete
        size="small"
        fullWidth
        disableClearable
        options={opcoes}
        value={selecionada ?? undefined}
        onChange={(_, o) => o && onChange(o.id)}
        getOptionLabel={(o) => o.nome}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        noOptionsText="Nenhuma loja"
        slotProps={{
          paper: { sx: finMenuSx },
          listbox: { sx: { maxHeight: 320 } },
        }}
        renderOption={(props, o) => {
          const { key, ...rest } = props
          return (
            <Box
              component="li"
              key={key ?? (o.id || 'todas')}
              {...rest}
              sx={{ display: 'flex !important', alignItems: 'center', gap: 1, py: 0.75 }}
            >
              <Marca opcao={o} size={28} />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2, color: FIN_TEXT }}>
                  {o.nome}
                </Typography>
                {o.detalhe ? (
                  <Typography sx={{ fontSize: 11, color: FIN_MUTED, lineHeight: 1.2 }} noWrap>
                    {o.detalhe}
                  </Typography>
                ) : null}
              </Box>
            </Box>
          )
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder="Buscar loja…"
            sx={{
              ...finCampoSx,
              '& .MuiInputLabel-root': { fontSize: '0.8125rem' },
              '& .MuiAutocomplete-input': { fontSize: '0.8125rem' },
            }}
          />
        )}
      />
    </Box>
  )
}
