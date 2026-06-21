import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { iniciarServiceWorkerPwa } from './pwa/registerServiceWorker'
import './index.css'
import App from './App.tsx'

iniciarServiceWorkerPwa()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
