export type Idioma = 'pt' | 'en'

export const MF_IDIOMA_EVENTO = 'mf-idioma'

export function lerIdioma(): Idioma {
  return localStorage.getItem('mf-idioma') === 'en' ? 'en' : 'pt'
}

export function gravarIdioma(idioma: Idioma) {
  localStorage.setItem('mf-idioma', idioma)
  window.dispatchEvent(new CustomEvent(MF_IDIOMA_EVENTO, { detail: idioma }))
}
