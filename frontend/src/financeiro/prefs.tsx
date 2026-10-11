import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { gravarIdioma, MF_IDIOMA_EVENTO, type Idioma } from './idiomaFinanceiro'

export type { Idioma }
export type Modo = 'claro' | 'escuro'

type Prefs = {
  idioma: Idioma
  modo: Modo
  setIdioma: (idioma: Idioma) => void
  setModo: (modo: Modo) => void
  t: (pt: string, en: string) => string
}

const PrefsContext = createContext<Prefs | null>(null)

/** Idioma local do módulo Financeiro. Tema visual vem do portal Meridian. */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [idioma, setIdiomaState] = useState<Idioma>(() => (localStorage.getItem('mf-idioma') === 'en' ? 'en' : 'pt'))
  const [modo, setModo] = useState<Modo>(() =>
    document.documentElement.classList.contains('dark') ? 'escuro' : 'claro',
  )

  const setIdioma = (v: Idioma) => {
    setIdiomaState(v)
    gravarIdioma(v)
  }

  useEffect(() => {
    const sync = (ev: Event) => {
      const v = (ev as CustomEvent<Idioma>).detail
      if (v === 'pt' || v === 'en') setIdiomaState(v)
    }
    window.addEventListener(MF_IDIOMA_EVENTO, sync)
    return () => window.removeEventListener(MF_IDIOMA_EVENTO, sync)
  }, [])

  useEffect(() => {
    const sync = () => {
      setModo(document.documentElement.classList.contains('dark') ? 'escuro' : 'claro')
    }
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const value = useMemo(
    () => ({
      idioma,
      modo,
      setIdioma,
      setModo: () => {
        /* tema controlado pelo portal */
      },
      t: (pt: string, en: string) => (idioma === 'en' ? en : pt),
    }),
    [idioma, modo],
  )

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export function usePrefs() {
  const ctx = useContext(PrefsContext)
  if (!ctx) throw new Error('usePrefs fora do PrefsProvider')
  return ctx
}
