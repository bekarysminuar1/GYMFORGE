import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
import '@fontsource/bebas-neue/400.css'
import './index.css'
import App from './App'
import { AppStoreProvider } from './store/AppStore'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStoreProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </AppStoreProvider>
  </StrictMode>,
)
