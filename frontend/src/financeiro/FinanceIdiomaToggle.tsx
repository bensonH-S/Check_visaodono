import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonGroup from '@mui/material/ButtonGroup'
import { gravarIdioma, lerIdioma, MF_IDIOMA_EVENTO, type Idioma } from './idiomaFinanceiro'

type Props = {
  /** Estilo do header escuro do Financeiro. */
  escuro?: boolean
  size?: 'small' | 'tiny'
}

/** PT/EN compacto para o header (ao lado da engrenagem). Funciona fora do PrefsProvider. */
export default function FinanceIdiomaToggle({ escuro = false, size = 'small' }: Props) {
  const [idioma, setIdioma] = useState<Idioma>(lerIdioma)

  useEffect(() => {
    const sync = (ev: Event) => {
      const v = (ev as CustomEvent<Idioma>).detail
      if (v === 'pt' || v === 'en') setIdioma(v)
    }
    window.addEventListener(MF_IDIOMA_EVENTO, sync)
    return () => window.removeEventListener(MF_IDIOMA_EVENTO, sync)
  }, [])

  const escolher = (v: Idioma) => {
    setIdioma(v)
    gravarIdioma(v)
  }

  const tiny = size === 'tiny'
  const ativo = escuro
    ? { color: '#F8FAFC', bgcolor: 'rgba(27,110,243,0.28)', borderColor: '#1B6EF3' }
    : { color: 'primary.main', bgcolor: 'action.selected' }
  const inativo = escuro
    ? { color: '#94A3B8', bgcolor: 'transparent', borderColor: 'rgba(255,255,255,0.16)' }
    : { color: 'text.secondary', bgcolor: 'background.paper' }

  return (
    <ButtonGroup
      size="small"
      variant="outlined"
      aria-label="Idioma"
      sx={{
        '& .MuiButtonGroup-grouped': {
          minWidth: tiny ? 32 : 36,
          px: tiny ? 0.75 : 1,
          py: 0.25,
          fontSize: tiny ? 11 : 12,
          fontWeight: 650,
          lineHeight: 1.2,
          borderColor: escuro ? 'rgba(255,255,255,0.16) !important' : undefined,
        },
      }}
    >
      {(['pt', 'en'] as const).map((code) => {
        const on = idioma === code
        return (
          <Button
            key={code}
            onClick={() => escolher(code)}
            sx={{
              ...(on ? ativo : inativo),
              '&:hover': {
                bgcolor: escuro ? 'rgba(27,110,243,0.2)' : 'action.hover',
                borderColor: escuro ? '#1B6EF3' : undefined,
              },
            }}
          >
            {code.toUpperCase()}
          </Button>
        )
      })}
    </ButtonGroup>
  )
}

/** Barra acima do conteúdo (legado). */
export function FinancePrefsBar() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1, flexShrink: 0 }}>
      <FinanceIdiomaToggle />
    </Box>
  )
}
