import { useApp } from '../AppContext'
import Icon from './Icon'

const THEMES = { system: { icon: 'monitor', label: 'System theme' }, light: { icon: 'sun', label: 'Light theme' }, dark: { icon: 'moon', label: 'Dark theme' } }

// Cycles system → light → dark (stored per browser)
export default function ThemeToggle({ className = 'icon-btn' }) {
  const { theme, setTheme } = useApp()
  const next = { system: 'light', light: 'dark', dark: 'system' }[theme] || 'light'
  const now = THEMES[theme] || THEMES.system
  return (
    <button className={`${className} theme-btn`} onClick={() => setTheme(next)}
      aria-label={`${now.label}. Switch to ${THEMES[next].label.toLowerCase()}`}
      title={`${now.label} — click for ${THEMES[next].label.toLowerCase()}`}>
      <Icon name={now.icon} size={19} />
    </button>
  )
}
