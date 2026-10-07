import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { iniciarServiceWorkerPwa, limparServiceWorkerEmDev } from './pwa/registerServiceWorker'
import { iniciarVerificacaoPeriodicaPwa } from './pwa/pwaUpdate'
import { hidePwaSplash } from './pwa/hidePwaSplash'
import './index.css'
import App from './App.tsx'

// Dev: tira SW/cache velho antes de montar (evita splash infinita no localhost).
limparServiceWorkerEmDev()
iniciarServiceWorkerPwa()
void iniciarVerificacaoPeriodicaPwa()

function Root() {
  useEffect(() => {
    hidePwaSplash()
  }, [])

  return (
    <StrictMode>
      <App />
    </StrictMode>
  )
}

const rootEl = document.getElementById('root')
if (rootEl) {
  try {
    createRoot(rootEl).render(<Root />)
  } catch (err) {
    console.error('[boot] React falhou ao montar:', err)
    hidePwaSplash()
  }
} else {
  hidePwaSplash()
}

// Rede de segurança: se o React não montar, some a splash mesmo assim.
window.setTimeout(() => hidePwaSplash(), 4000)
