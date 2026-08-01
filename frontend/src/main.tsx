import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { iniciarServiceWorkerPwa } from './pwa/registerServiceWorker'
import { iniciarVerificacaoPeriodicaPwa } from './pwa/pwaUpdate'
import { hidePwaSplash } from './pwa/hidePwaSplash'
import './index.css'
import App from './App.tsx'

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

createRoot(document.getElementById('root')!).render(<Root />)
