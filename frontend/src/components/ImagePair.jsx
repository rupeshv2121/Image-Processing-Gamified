import { useEffect, useRef, useState } from 'react'
import { useApp } from '../AppContext'
import { fmt, fmtPsnr, imageUrl } from '../api'
import { ImageView, Metrics, Segmented } from './ui'

// Before/after slider: both images are drawn in the same box, the "after"
// image is clipped at the handle. Mouse, touch, pen and keyboard (←/→).
export function CompareSlider({ before, after, beforeLabel = 'Before', afterLabel = 'After', height = 420, pixelated }) {
  const box = useRef(null)
  const [pos, setPos] = useState(50)
  const dragging = useRef(false)
  const move = (clientX) => {
    const r = box.current.getBoundingClientRect()
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)))
  }
  const key = (e) => {
    const step = e.shiftKey ? 10 : 2
    if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - step))
    else if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + step))
    else if (e.key === 'Home') setPos(0)
    else if (e.key === 'End') setPos(100)
    else return
    e.preventDefault()
  }
  return (
    <div
      ref={box} className={`cmp ${pixelated ? 'pixelated' : ''}`} style={{ height, '--pos': `${pos}%` }}
      onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); move(e.clientX) }}
      onPointerMove={(e) => dragging.current && move(e.clientX)}
      onPointerUp={() => { dragging.current = false }}
      onPointerCancel={() => { dragging.current = false }}
    >
      <img src={imageUrl(before)} alt={beforeLabel} draggable={false} />
      <img className="cmp-after" src={imageUrl(after)} alt={afterLabel} draggable={false} />
      <div className="cmp-handle" role="slider" tabIndex={0} aria-label={`Reveal ${afterLabel}`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pos)} aria-valuetext={`${Math.round(pos)}% ${beforeLabel}`}
        onKeyDown={key} />
      <span className="cmp-tag left">{beforeLabel}</span>
      <span className="cmp-tag right">{afterLabel}</span>
    </div>
  )
}

// |after − before| as a heat map, computed by MATLAB (errorMap.m)
const errorCache = new Map()
export function ErrorMapView({ id, refId, height = 420, title = '|Result − Input|' }) {
  const { call } = useApp()
  const key = `${id}|${refId}`
  const [res, setRes] = useState(() => errorCache.get(key) || null)
  const [failed, setFailed] = useState(null)
  useEffect(() => {
    setFailed(null)
    if (errorCache.has(key)) { setRes(errorCache.get(key)); return }
    setRes(null)
    let live = true
    call('errorMap', { id, refId, track: false }, { label: 'errorMap.m', quiet: true })
      .then((d) => {
        if (!live) return
        if (d) { errorCache.set(key, d); setRes(d) } else setFailed('MATLAB could not compare these two images (they must have the same size).')
      })
    return () => { live = false }
  }, [key, id, refId, call])

  if (failed) return <div className="note note-warn">{failed}</div>
  const stops = res ? (Array.isArray(res.colorStops) ? res.colorStops : [res.colorStops]) : []
  return (
    <div className="grid-2 errmap">
      <div>
        <ImageView id={res?.id || null} title={title} height={height} emptyText="MATLAB is computing the error map…" />
        {res && (
          <div className="colorbar" aria-hidden="true">
            <div style={{ background: `linear-gradient(to right, ${stops.join(', ')})` }} />
            <div className="axis"><span>0</span><span>{fmt(res.scaleMax / 2, 1)}</span><span>{fmt(res.scaleMax, 1)} grey levels</span></div>
          </div>
        )}
      </div>
      <div className="stack-sm">
        {res && (
          <>
            <Metrics items={[
              { label: 'PSNR', value: fmtPsnr(res.psnr) },
              { label: 'MSE', value: res.mse },
              { label: 'Mean |error|', value: `${fmt(res.meanAbs, 2)} lv` },
              { label: 'Max |error|', value: `${fmt(res.maxError, 1)} lv` },
              { label: 'Pixels changed', value: `${fmt(res.changedPct, 1)} %` },
            ]} />
            {res.maxError > 0 ? (
              <p className="small muted">
                Each pixel shows how much the result differs from the input (averaged over the colour channels).
                Dark blue = unchanged, red = the largest change ({fmt(res.maxError, 1)} grey levels). Colours are scaled to the largest
                error so even small differences become visible.
              </p>
            ) : <div className="note note-ok">The two images are identical — this operation changed no pixel.</div>}
          </>
        )}
      </div>
    </div>
  )
}

const MODE_LABELS = { side: 'Side by side', single: 'Result', slider: 'Slider', error: 'Error map' }
const readMode = () => {
  try { return localStorage.getItem('imagelab.pairMode') || 'side' } catch { return 'side' }
}

// Two related images (input → result) with three ways to compare them.
// left / right are ImageView props ({ id, title, badge, actions, onPick … }).
export default function ImagePair({ left, right, height = 420, modes = ['side', 'slider', 'error'], pixelated, zoom }) {
  const [stored, setStored] = useState(readMode)
  const both = !!(left?.id && right?.id) && left.id !== right.id
  const available = both ? modes : modes.filter((m) => m === 'side' || m === 'single')
  const mode = available.includes(stored) ? stored : available[0]
  const choose = (m) => {
    setStored(m)
    try { localStorage.setItem('imagelab.pairMode', m) } catch { /* storage unavailable */ }
  }
  return (
    <div className="pair">
      {both && available.length > 1 && (
        <div className="pair-head">
          <Segmented value={mode} onChange={choose} options={available.map((m) => ({ value: m, label: MODE_LABELS[m] }))} />
          {(mode === 'slider' || mode === 'error') && right.actions && <span className="imgview-actions">{right.actions}</span>}
        </div>
      )}
      {mode === 'side' && (
        <div className="grid-2">
          <ImageView height={height} pixelated={pixelated} zoom={zoom} {...left} />
          <ImageView height={height} pixelated={pixelated} zoom={zoom} {...right} />
        </div>
      )}
      {mode === 'single' && <ImageView height={height} pixelated={pixelated} {...right} />}
      {mode === 'slider' && (
        <CompareSlider before={left.id} after={right.id} beforeLabel={plain(left.title, 'Before')} afterLabel={plain(right.title, 'After')}
          height={height} pixelated={pixelated} />
      )}
      {mode === 'error' && <ErrorMapView id={right.id} refId={left.id} height={height}
        title={`|${plain(right.title, 'Result')} − ${plain(left.title, 'Input')}|`} />}
    </div>
  )
}

const plain = (t, fallback) => (typeof t === 'string' && t ? t : fallback)
