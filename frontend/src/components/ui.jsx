import { useEffect, useRef, useState } from 'react'
import { asArray, fmt, imageUrl, run } from '../api'
import { useApp } from '../AppContext'
import Icon from './Icon'

// ------------------------------------------------------------------ layout
export function Page({ title, subtitle, actions, eyebrow, children }) {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1>{title}</h1>
          {subtitle && <p className="subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

export function Card({ title, extra, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || extra) && (
        <div className="card-head">
          {title && <h3>{title}</h3>}
          {extra}
        </div>
      )}
      {children}
    </section>
  )
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => {
        const key = typeof t === 'string' ? t : t.key
        const label = typeof t === 'string' ? t : t.label
        return (
          <button key={key} role="tab" className={active === key ? 'tab active' : 'tab'} onClick={() => onChange(key)}>
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function Note({ children, kind = 'info' }) {
  return <div className={`note note-${kind}`}>{children}</div>
}

// ------------------------------------------------------------------ inputs
export function Slider({ label, value, min, max, step = 1, onChange, format = (v) => v, onCommit }) {
  return (
    <label className="field">
      <span className="field-label">
        {label} <b>{format(value)}</b>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onCommit} onTouchEnd={onCommit} onKeyUp={onCommit}
      />
    </label>
  )
}

export function Select({ label, value, options, onChange }) {
  return (
    <label className="field">
      {label && <span className="field-label">{label}</span>}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const v = typeof o === 'string' ? o : o.value
          const l = typeof o === 'string' ? o : o.label
          return <option key={v} value={v}>{l}</option>
        })}
      </select>
    </label>
  )
}

export function NumberInput({ label, value, onChange, step = 1, min, max }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input type="number" value={value} step={step} min={min} max={max} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

export function Segmented({ value, options, onChange }) {
  return (
    <div className="segmented">
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value
        const l = typeof o === 'string' ? o : o.label
        return (
          <button key={v} className={value === v ? 'active' : ''} onClick={() => onChange(v)}>
            {l}
          </button>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------------ images
export function ImageView({ id, title, caption, zoom = 1, onPick, pixelated, height, badge, actions, emptyText }) {
  const ref = useRef(null)
  const click = (e) => {
    if (!onPick || !ref.current) return
    const img = ref.current
    const rect = img.getBoundingClientRect()
    const scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight)
    const w = img.naturalWidth * scale
    const h = img.naturalHeight * scale
    const x = (e.clientX - rect.left - (rect.width - w) / 2) / scale
    const y = (e.clientY - rect.top - (rect.height - h) / 2) / scale
    if (x >= 0 && y >= 0 && x < img.naturalWidth && y < img.naturalHeight) {
      onPick({ row: Math.floor(y) + 1, col: Math.floor(x) + 1 })
    }
  }
  return (
    <figure className="imgview">
      {(title || badge || actions) && (
        <figcaption className="imgview-title">
          <span>{title}</span>
          <span className="imgview-actions">
            {badge && <span className="badge">{badge}</span>}
            {actions}
          </span>
        </figcaption>
      )}
      <div className="imgview-box" style={height ? { height } : undefined}>
        {id ? (
          <div className="imgview-scroll">
            <img
              ref={ref}
              src={imageUrl(id)}
              alt={title || 'image'}
              onClick={click}
              className={`${pixelated ? 'pixelated' : ''} ${onPick ? 'pickable' : ''}`}
              style={zoom !== 1 ? { width: `${zoom * 100}%`, maxWidth: 'none', maxHeight: 'none', height: 'auto' } : undefined}
            />
          </div>
        ) : (
          <div className="imgview-empty"><Icon name="image" size={28} stroke={1.4} />{emptyText || 'Result appears here'}</div>
        )}
      </div>
      {caption && <div className="imgview-caption">{caption}</div>}
    </figure>
  )
}

export function ImageGrid({ items, columns = 3, height = 240, pixelated }) {
  return (
    <div className="img-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${Math.floor(900 / columns)}px, 1fr))` }}>
      {items.filter(Boolean).map((it, i) => (
        <ImageView key={it.id || i} height={height} pixelated={pixelated} {...it} />
      ))}
    </div>
  )
}

// A result card with "use in workspace" action
export function UseButton({ id, label }) {
  const { push } = useApp()
  if (!id) return null
  return (
    <button className="btn btn-small" title="Make this the working image (undo/redo in Workspace)" onClick={() => push(id, label)}>
      ➜ Workspace
    </button>
  )
}

// ------------------------------------------------------------------ data
export function Metrics({ items }) {
  return (
    <div className="metrics">
      {items.filter(Boolean).map((m) => (
        <div className="metric" key={m.label}>
          <div className="metric-value">{typeof m.value === 'number' ? fmt(m.value) : m.value}</div>
          <div className="metric-label">{m.label}</div>
        </div>
      ))}
    </div>
  )
}

export function KernelGrid({ matrix, editable, onChange, highlight, small, title }) {
  if (!matrix) return null
  return (
    <div className="kernel-wrap">
      {title && <div className="kernel-title">{title}</div>}
      <table className={`kernel ${small ? 'small' : ''}`}>
        <tbody>
          {matrix.map((row, r) => (
            <tr key={r}>
              {row.map((v, c) => {
                const hl = highlight && highlight(r, c)
                return (
                  <td key={c} className={hl ? `hl-${hl}` : ''}>
                    {editable ? (
                      <input
                        value={v}
                        onChange={(e) => {
                          const next = matrix.map((rr) => rr.slice())
                          next[r][c] = e.target.value
                          onChange(next)
                        }}
                      />
                    ) : v === '' || v == null ? (
                      ''
                    ) : (
                      fmt(typeof v === 'number' ? v : Number(v), 3)
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Histogram({ counts, color = '#1f5aa6', height = 140, title, mapping }) {
  const data = asArray(counts)
  if (!data.length) return null
  const max = Math.max(...data, 1)
  return (
    <div className="histogram">
      {title && <div className="chart-title">{title}</div>}
      <svg viewBox={`0 0 256 ${height}`} preserveAspectRatio="none" style={{ height }}>
        <rect x="0" y="0" width="256" height={height} fill="var(--chart-bg)" />
        {data.map((c, i) => {
          const h = (c / max) * (height - 4)
          return <rect key={i} x={i} y={height - h} width="1" height={h} fill={color} />
        })}
        {mapping && (
          <polyline
            fill="none" stroke="#e08a1e" strokeWidth="1.5" vectorEffect="non-scaling-stroke"
            points={asArray(mapping).map((m, i) => `${i},${height - (m / 255) * (height - 4)}`).join(' ')}
          />
        )}
      </svg>
      <div className="axis"><span>0</span><span>128</span><span>255</span></div>
    </div>
  )
}

export function BarChart({ values, labels, title, unit = '', height = 180, higherIsBetter = true }) {
  const vals = values.map((v) => (v == null || !isFinite(v) ? 0 : v))
  const max = Math.max(...vals, 1e-9)
  const best = higherIsBetter ? Math.max(...vals) : Math.min(...vals)
  return (
    <div className="barchart">
      {title && <div className="chart-title">{title}</div>}
      <div className="bars" style={{ height }}>
        {vals.map((v, i) => (
          <div className="bar-col" key={i}>
            <div className="bar-val">{fmt(values[i], 2)}{unit}</div>
            <div className={`bar ${v === best ? 'best' : ''}`} style={{ height: `${(v / max) * (height - 40)}px` }} />
            <div className="bar-label">{labels[i]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ modal
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

// "View MATLAB Code" — shows the real .m source files from the project
export function CodeButton({ functions, label = 'View MATLAB Code', snippets }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="btn btn-code" onClick={() => setOpen(true)}><Icon name="code" size={17} /> {label}</button>
      {open && <CodeModal functions={functions} snippets={snippets} onClose={() => setOpen(false)} />}
    </>
  )
}

export function CodeModal({ functions = [], snippets = [], onClose }) {
  const tabs = [...snippets.map((s) => ({ key: `s:${s.title}`, label: s.title })), ...functions.map((f) => ({ key: f, label: `${f}.m` }))]
  const [active, setActive] = useState(tabs[0]?.key)
  const [sources, setSources] = useState({})
  const [error, setError] = useState(null)
  useEffect(() => {
    if (!active || active.startsWith('s:') || sources[active]) return
    run('source', { name: active })
      .then((d) => setSources((s) => ({ ...s, [active]: d })))
      .catch((e) => setError(e.message))
  }, [active, sources])
  const snippet = snippets.find((s) => `s:${s.title}` === active)
  const src = sources[active]
  return (
    <Modal title="MATLAB Code" onClose={onClose} wide>
      <Tabs tabs={tabs} active={active} onChange={setActive} />
      {snippet && (
        <>
          <pre className="code">{snippet.code}</pre>
          {snippet.explain && (
            <div className="how">
              <h4>How it works</h4>
              <ol>{snippet.explain.map((l, i) => <li key={i}>{l}</li>)}</ol>
            </div>
          )}
        </>
      )}
      {!snippet && src && (
        <>
          <div className="code-file">{src.file}</div>
          <pre className="code">{highlight(src.code)}</pre>
        </>
      )}
      {!snippet && !src && !error && <p className="muted">Loading source from MATLAB…</p>}
      {error && <Note kind="error">{error}</Note>}
    </Modal>
  )
}

// Minimal MATLAB syntax colouring: comments and keywords
function highlight(code) {
  const kw = /\b(function|end|for|while|if|elseif|else|switch|case|otherwise|return|break|continue|try|catch|persistent|global)\b/
  return code.split('\n').map((line, i) => {
    const idx = line.indexOf('%')
    const codePart = idx >= 0 ? line.slice(0, idx) : line
    const comment = idx >= 0 ? line.slice(idx) : ''
    const parts = codePart.split(/(\b\w+\b)/).map((p, j) => (kw.test(p) && p.match(kw)[0] === p ? <span key={j} className="kw">{p}</span> : p))
    return (
      <span key={i}>
        {parts}
        {comment && <span className="cm">{comment}</span>}
        {'\n'}
      </span>
    )
  })
}

// ------------------------------------------------------------------ guards
export function NeedImage({ children }) {
  const { current, loadSample } = useApp()
  if (current) return children
  return (
    <div className="empty-state">
      <div className="ic"><Icon name="image" size={30} /></div>
      <h3>Load an image to begin</h3>
      <p className="small" style={{ maxWidth: 420 }}>This lab works on the image in your workspace. Pick a sample to start — MATLAB will do the processing.</p>
      <div className="row center mt-sm">
        <button className="btn btn-primary" onClick={() => loadSample('peppers.png')}>Use peppers.png</button>
        <button className="btn" onClick={() => loadSample('lowcontrast.png')}>Low-contrast</button>
        <button className="btn" onClick={() => loadSample('shapes.png')}>Shapes</button>
        <a className="btn btn-ghost" href="#workspace">Upload my own →</a>
      </div>
    </div>
  )
}
