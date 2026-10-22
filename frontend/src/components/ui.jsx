import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
          <button key={key} role="tab" aria-selected={active === key} className={active === key ? 'tab active' : 'tab'} onClick={() => onChange(key)}>
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
          <button key={v} className={value === v ? 'active' : ''} aria-pressed={value === v} onClick={() => onChange(v)}>
            {l}
          </button>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------------ images
// Pixel values for the inspector are read from the PNG that MATLAB wrote
// (display only — no processing happens in the browser). Cached per image id.
const pixelCache = new Map()
function loadPixels(id) {
  if (pixelCache.has(id)) return pixelCache.get(id)
  const promise = new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, c.width, c.height).data
      let gray = true
      for (let i = 0; i < data.length && gray; i += 4 * 97) gray = data[i] === data[i + 1] && data[i] === data[i + 2]
      resolve({ w: c.width, h: c.height, data, gray })
    }
    img.onerror = () => reject(new Error('image not available'))
    img.src = imageUrl(id)
  })
  pixelCache.set(id, promise)
  if (pixelCache.size > 12) pixelCache.delete(pixelCache.keys().next().value)
  return promise
}

// Maps a pointer position to the 1-based (row, col) of the image pixel under it
function pixelAt(img, clientX, clientY) {
  const rect = img.getBoundingClientRect()
  const scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight)
  const w = img.naturalWidth * scale
  const h = img.naturalHeight * scale
  const x = (clientX - rect.left - (rect.width - w) / 2) / scale
  const y = (clientY - rect.top - (rect.height - h) / 2) / scale
  if (x < 0 || y < 0 || x >= img.naturalWidth || y >= img.naturalHeight) return null
  return { row: Math.floor(y) + 1, col: Math.floor(x) + 1, left: clientX - rect.left < rect.width / 2, top: clientY - rect.top < rect.height / 2 }
}

function PixelPanel({ px, pixels }) {
  const value = (r, c) => {
    if (r < 1 || c < 1 || r > pixels.h || c > pixels.w) return null
    const i = ((r - 1) * pixels.w + (c - 1)) * 4
    return pixels.gray ? [pixels.data[i]] : [pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]]
  }
  const v = value(px.row, px.col)
  return (
    <div className={`pixel-panel ${px.left ? 'right' : 'left'} ${px.top ? 'bottom' : 'top'}`} aria-live="polite">
      <div className="pixel-head">
        <span>row {px.row}, col {px.col}</span>
        {v && <b>{pixels.gray ? v[0] : `${v[0]}, ${v[1]}, ${v[2]}`}</b>}
      </div>
      {v && !pixels.gray && <div className="pixel-swatch" style={{ background: `rgb(${v.join(',')})` }} />}
      <table className="pixel-grid">
        <tbody>
          {[-1, 0, 1].map((dr) => (
            <tr key={dr}>
              {[-1, 0, 1].map((dc) => {
                const n = value(px.row + dr, px.col + dc)
                const g = n ? Math.round(n.reduce((a, b) => a + b, 0) / n.length) : null
                return (
                  <td key={dc} className={dr === 0 && dc === 0 ? 'center' : ''}
                    style={g == null ? undefined : { background: `rgb(${n.length === 1 ? `${g},${g},${g}` : n.join(',')})`, color: g > 140 ? '#111' : '#fff' }}>
                    {g == null ? '·' : g}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pixel-foot">{pixels.gray ? '3×3 neighbourhood (grey level)' : '3×3 neighbourhood (mean of R, G, B)'}</div>
    </div>
  )
}

export function ImageView({ id, title, caption, zoom = 1, onPick, pixelated, height, badge, actions, emptyText, inspectable = true }) {
  const ref = useRef(null)
  const [inspect, setInspect] = useState(false)
  const [pixels, setPixels] = useState(null)
  const [px, setPx] = useState(null)

  useEffect(() => {
    setPx(null)
    if (!inspect || !id) { setPixels(null); return }
    let live = true
    loadPixels(id).then((p) => live && setPixels(p)).catch(() => live && setInspect(false))
    return () => { live = false }
  }, [inspect, id])

  const click = (e) => {
    if (!onPick || !ref.current) return
    const p = pixelAt(ref.current, e.clientX, e.clientY)
    if (p) onPick({ row: p.row, col: p.col })
  }
  const move = (e) => {
    if (!inspect || !ref.current) return
    setPx(pixelAt(ref.current, e.clientX, e.clientY))
  }
  const toggle = id && inspectable && (
    <button className={`icon-btn inspect-btn ${inspect ? 'on' : ''}`} onClick={() => setInspect((v) => !v)}
      aria-pressed={inspect} aria-label="Pixel inspector" title="Pixel inspector: hover to read pixel values">
      <Icon name="target" size={16} />
    </button>
  )
  return (
    <figure className="imgview">
      {(title || badge || actions || toggle) && (
        <figcaption className="imgview-title">
          <span>{title}</span>
          <span className="imgview-actions">
            {badge && <span className="badge">{badge}</span>}
            {actions}
            {toggle}
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
              onPointerMove={inspect ? move : undefined}
              onPointerLeave={inspect ? () => setPx(null) : undefined}
              className={`${pixelated || inspect ? 'pixelated' : ''} ${onPick || inspect ? 'pickable' : ''}`}
              style={zoom !== 1 ? { width: `${zoom * 100}%`, maxWidth: 'none', maxHeight: 'none', height: 'auto' } : undefined}
            />
          </div>
        ) : (
          <div className="imgview-empty"><Icon name="image" size={28} stroke={1.4} />{emptyText || 'Result appears here'}</div>
        )}
        {inspect && pixels && px && <PixelPanel px={px} pixels={pixels} />}
        {inspect && pixels && !px && <div className="pixel-hint">Hover over the image to read pixel values</div>}
      </div>
      {caption && <div className="imgview-caption">{caption}</div>}
    </figure>
  )
}

export function ImageGrid({ items, columns = 3, height = 240, pixelated }) {
  return (
    <div className="img-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${Math.floor(900 / columns)}px, 100%), 1fr))` }}>
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

export function Histogram({ counts, color = '#1f5aa6', height = 140, title, mapping, target }) {
  const data = asArray(counts)
  if (!data.length) return null
  const max = Math.max(...data, 1)
  const goal = asArray(target)
  const goalMax = Math.max(...goal, 1e-9)
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
        {goal.length > 0 && (
          <polyline
            fill="none" stroke="#22a565" strokeWidth="2" strokeDasharray="4 3" vectorEffect="non-scaling-stroke"
            points={goal.map((g, i) => `${i},${height - (g / goalMax) * (height - 4)}`).join(' ')}
          />
        )}
      </svg>
      <div className="axis"><span>0</span><span>128</span><span>255</span></div>
    </div>
  )
}

// Line plot of one or more series over the same x values
//   series: [{ values, color, label, dashed }]   x: [first, last] axis labels
export function LineChart({ series, x = ['', ''], title, height = 160, yMin, yMax, markers }) {
  const all = series.flatMap((s) => asArray(s.values)).filter((v) => v != null && isFinite(v))
  if (!all.length) return null
  const lo = yMin ?? Math.min(...all)
  const hi = yMax ?? Math.max(...all)
  const span = hi - lo || 1
  const W = 400
  const px = (i, n) => (n > 1 ? (i / (n - 1)) * W : W / 2)
  const py = (v) => height - 4 - ((v - lo) / span) * (height - 8)
  return (
    <div className="histogram">
      {title && <div className="chart-title">{title}</div>}
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ height }}>
        <rect x="0" y="0" width={W} height={height} fill="var(--chart-bg)" />
        {asArray(markers).map((m, i) => (
          <line key={i} x1={px(m, asArray(series[0].values).length)} x2={px(m, asArray(series[0].values).length)} y1="0" y2={height}
            stroke="var(--line, #888)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        ))}
        {series.map((s, k) => {
          const vals = asArray(s.values)
          return (
            <polyline key={k} fill="none" stroke={s.color || '#1f5aa6'} strokeWidth="2" vectorEffect="non-scaling-stroke"
              strokeDasharray={s.dashed ? '5 4' : undefined}
              points={vals.map((v, i) => `${px(i, vals.length)},${py(v ?? lo)}`).join(' ')} />
          )
        })}
      </svg>
      <div className="axis"><span>{x[0]}</span><span>{fmt(lo, 2)} … {fmt(hi, 2)}</span><span>{x[1]}</span></div>
      {series.some((s) => s.label) && (
        <div className="row small muted" style={{ gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
          {series.filter((s) => s.label).map((s) => (
            <span key={s.label}><span className="swatch" style={{ background: s.color || '#1f5aa6' }} />{s.label}</span>
          ))}
        </div>
      )}
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
  const box = useRef(null)
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  // Move focus into the dialog and give it back to the opener on close
  useEffect(() => {
    const opener = document.activeElement
    const first = box.current?.querySelector('.modal-body button, .modal-body a[href], .modal-body input, .modal-body select, .modal-body textarea')
    ;(first || box.current)?.focus()
    return () => opener?.focus?.()
  }, [])
  const titleId = `modal-${String(title).replace(/\W+/g, '-').toLowerCase()}`
  // Rendered into <body>: an ancestor with a transform or backdrop-filter (e.g. the
  // top bar) would otherwise become the containing block of this fixed overlay.
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div ref={box} tabIndex={-1} className={`modal ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-head">
          <h3 id={titleId}>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
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
