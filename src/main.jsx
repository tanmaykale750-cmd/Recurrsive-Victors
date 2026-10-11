import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { CaseProvider } from './state/CaseStore'
import { UiProvider } from './state/UiStore'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UiProvider>
      <CaseProvider>
        <App />
      </CaseProvider>
    </UiProvider>
  </StrictMode>,
)
