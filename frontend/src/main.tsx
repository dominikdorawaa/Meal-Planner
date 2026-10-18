import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyLanguage } from './i18n'
import { listenForInstallPrompt } from './lib/useInstallPrompt'
import { applyTheme, listenForSystemThemeChanges } from './lib/theme'
import { installBackNavigation } from './lib/backNavigation'

applyLanguage()
applyTheme()
listenForSystemThemeChanges()
listenForInstallPrompt()
installBackNavigation()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
