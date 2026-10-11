import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AuthProvider } from './state/AuthStore'
import { CaseProvider } from './state/CaseStore'
import { UiProvider } from './state/UiStore'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UiProvider>
      <AuthProvider>
        <CaseProvider>
          <App />
        </CaseProvider>
      </AuthProvider>
    </UiProvider>
  </StrictMode>,
)
