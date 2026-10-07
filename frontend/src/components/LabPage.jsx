import { useEffect, useState } from 'react'
import Icon from './Icon'
import { CodeButton, NeedImage } from './ui'

// Slide-over panel used for theory notes, so lab pages stay uncluttered
export function Drawer({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>
  )
}

export function EmptyState({ icon = 'play', title, text, children }) {
  return (
    <div className="empty-state">
      <div className="ic"><Icon name={icon} size={30} /></div>
      <h3>{title}</h3>
      {text && <p className="small" style={{ maxWidth: 380 }}>{text}</p>}
      {children}
    </div>
  )
}

// Standard layout of every lab:
//   header (unit eyebrow, title, one-line subtitle, Theory + Code buttons)
//   left: compact settings panel     right: results
export default function LabPage({ unit, title, subtitle, theory, code, controls, panelTitle = 'Settings', needImage = true, children }) {
  const [showTheory, setShowTheory] = useState(false)
  const body = (
    <div className="lab">
      <div className="lab-panel">
        <div className="card">
          <div className="lab-panel-title">{panelTitle}</div>
          <div className="controls">{controls}</div>
        </div>
      </div>
      <div className="lab-results">{children}</div>
    </div>
  )
  return (
    <div className="page">
      <div className="page-head">
        <div>
          {unit && <div className="eyebrow">{unit}</div>}
          <h1>{title}</h1>
          {subtitle && <p className="subtitle">{subtitle}</p>}
        </div>
        <div className="page-actions">
          {theory && <button className="btn" onClick={() => setShowTheory(true)}><Icon name="book" size={17} /> Theory</button>}
          {code && <CodeButton functions={code.functions} snippets={code.snippets} />}
        </div>
      </div>
      {needImage ? <NeedImage>{body}</NeedImage> : body}
      {showTheory && <Drawer title={title} onClose={() => setShowTheory(false)}>{theory}</Drawer>}
    </div>
  )
}
