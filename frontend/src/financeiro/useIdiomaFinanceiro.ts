import { useEffect, useState } from 'react'
import { lerIdioma, MF_IDIOMA_EVENTO, type Idioma } from './idiomaFinanceiro'

/** Idioma PT/EN do módulo financeiro (header, sidebar e páginas). */
export function useIdiomaFinanceiro(): Idioma {
  const [idioma, setIdioma] = useState<Idioma>(lerIdioma)

  useEffect(() => {
    const sync = (ev: Event) => {
      const v = (ev as CustomEvent<Idioma>).detail
      if (v === 'pt' || v === 'en') setIdioma(v)
    }
    window.addEventListener(MF_IDIOMA_EVENTO, sync)
    return () => window.removeEventListener(MF_IDIOMA_EVENTO, sync)
  }, [])

  return idioma
}
