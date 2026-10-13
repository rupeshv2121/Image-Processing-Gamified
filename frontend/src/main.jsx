import { createRoot } from 'react-dom/client'
import App from './App'
import { AppProvider } from './AppContext'
import './styles.css'

// Offline support: cache the built UI (production build only, see public/sw.js)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}

createRoot(document.getElementById('root')).render(
  <AppProvider>
    <App />
  </AppProvider>,
)
