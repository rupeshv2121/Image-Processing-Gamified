import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt, toMatrix } from '../api'
import Icon from '../components/Icon'
import { parseMatrix } from '../matrix'
import { Card, KernelGrid, Note, Page, Segmented, Slider, Tabs } from '../components/ui'

// ----------------------------------------------------------------- player
function usePlayer(total) {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(3)              // frames per second
  useEffect(() => { setI(0); setPlaying(total > 0) }, [total])
  useEffect(() => {
    if (!playing) return
    if (i >= total - 1) { setPlaying(false); return }
    const t = setTimeout(() => setI((x) => Math.min(total - 1, x + 1)), 1000 / speed)
    return () => clearTimeout(t)
  }, [playing, i, total, speed])
  return { i, setI, playing, setPlaying, speed, setSpeed, total }
}

function Player({ p, label }) {
  const { i, setI, playing, setPlaying, speed, setSpeed, total } = p
  const box = useRef(null)
  const key = (e) => {
    if (e.target.tagName === 'INPUT') return
    if (e.key === 'ArrowRight') { setPlaying(false); setI(Math.min(total - 1, i + 1)) }
    else if (e.key === 'ArrowLeft') { setPlaying(false); setI(Math.max(0, i - 1)) }
    else if (e.key === ' ') setPlaying(!playing)
    else return
    e.preventDefault()
  }
  return (
    <div className="player" ref={box} tabIndex={0} onKeyDown={key} aria-label="Animation controls: space plays or pauses, arrow keys step">
      <div className="player-buttons">
        <button className="icon-btn" onClick={() => { setPlaying(false); setI(0) }} aria-label="First step" title="First step"><Icon name="undo" size={17} /></button>
        <button className="icon-btn" onClick={() => { setPlaying(false); setI(Math.max(0, i - 1)) }} aria-label="Previous step" title="Previous step (←)">◀</button>
        <button className="btn btn-primary btn-small play-btn" onClick={() => { if (i >= total - 1) setI(0); setPlaying(!playing) }} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        <button className="icon-btn" onClick={() => { setPlaying(false); setI(Math.min(total - 1, i + 1)) }} aria-label="Next step" title="Next step (→)">▶</button>
        <button className="icon-btn" onClick={() => { setPlaying(false); setI(total - 1) }} aria-label="Last step" title="Last step"><Icon name="redo" size={17} /></button>
      </div>
      <input type="range" min={0} max={Math.max(0, total - 1)} value={i} onChange={(e) => { setPlaying(false); setI(Number(e.target.value)) }} aria-label="Step" className="player-scrub" />
      <span className="small mono player-count">{label || 'step'} {i + 1} / {total}</span>
      <label className="player-speed small">
        Speed
        <input type="range" min={0.5} max={12} step={0.5} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Speed (steps per second)" />
      </label>
    </div>
  )
}

const Chips = ({ values, mark, label }) => (
  <div className="chips-row">
    <span className="field-label">{label}</span>
    <div className="chips">{values.map((v, k) => <span key={k} className={`chip ${mark?.(k) || ''}`}>{fmt(v, 2)}</span>)}</div>
  </div>
)

// Matrix of '' (not computed yet) with the first n entries of `values` filled in
const partial = (rows, cols, upto, valueAt) => Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => (r * cols + c < upto ? valueAt(r, c) : '')))

// ----------------------------------------------------------------- median
function MedianView({ d }) {
  const steps = asArray(d.steps)
  const p = usePlayer(steps.length)
  const s = steps[p.i]
  const P = toMatrix(d.padded)
  const out = toMatrix(d.output)
  const k = d.k
  const done = p.i + 1
  const values = asArray(s.values)
  const sorted = asArray(s.sorted)
  return (
    <div className="stack">
      <Player p={p} label="pixel" />
      <div className="anim-grids">
        <KernelGrid matrix={P} title={`Input (padded symmetrically by ${d.pad}) — ${k}×${k} window`} small={P[0].length > 8}
          highlight={(r, c) => (r === s.row - 1 + d.pad && c === s.col - 1 + d.pad ? 'center' : r >= s.row - 1 && r < s.row - 1 + k && c >= s.col - 1 && c < s.col - 1 + k ? 'window' : null)} />
        <KernelGrid matrix={partial(out.length, out[0].length, done, (r, c) => out[r][c])} title="Output — fills in pixel by pixel" small={out[0].length > 8}
          highlight={(r, c) => (r === s.row - 1 && c === s.col - 1 ? 'current' : r * out[0].length + c < done ? 'done' : null)} />
      </div>
      <Card>
        <Chips label="1. Window values" values={values} mark={(i) => (i === Math.floor(values.length / 2) ? 'own' : '')} />
        <Chips label="2. Sorted" values={sorted} mark={(i) => (i === s.position - 1 ? 'win' : i === 0 || i === sorted.length - 1 ? 'extreme' : '')} />
        <p className="small mt-sm">3. The middle value (position {s.position} of {sorted.length}) is the median: <b>g({s.row},{s.col}) = {fmt(s.median, 2)}</b>.
          {(sorted[0] !== sorted[sorted.length - 1]) && <> Extreme values such as <b>{fmt(sorted[0], 2)}</b> and <b>{fmt(sorted[sorted.length - 1], 2)}</b> end up at the ends of the sorted list, so impulses never win.</>}</p>
      </Card>
    </div>
  )
}

// ----------------------------------------------------------------- histeq
function HisteqView({ d }) {
  const A = toMatrix(d.input)
  const out = toMatrix(d.output)
  const L = d.L
  const N = d.N
  const cols = A[0].length
  const counts = asArray(d.counts)
  const pr = asArray(d.p)
  const cdf = asArray(d.cdf)
  const map = asArray(d.mapping)
  const total = N + L + N
  const p = usePlayer(total)
  const phase = p.i < N ? 'count' : p.i < N + L ? 'cdf' : 'map'
  const counted = phase === 'count' ? p.i + 1 : N
  const rowsShown = phase === 'count' ? 0 : phase === 'cdf' ? p.i - N + 1 : L
  const mapped = phase === 'map' ? p.i - N - L + 1 : 0
  const cur = phase === 'count' ? p.i : phase === 'map' ? p.i - N - L : -1
  const curR = Math.floor(cur / cols)
  const curC = cur % cols
  const live = Array(L).fill(0)
  A.flat().slice(0, counted).forEach((v) => { live[v] += 1 })
  const max = Math.max(...counts, 1)
  const after = asArray(d.countsAfter)
  return (
    <div className="stack">
      <Player p={p} label={phase === 'count' ? 'counting' : phase === 'cdf' ? 'level' : 'mapping'} />
      <div className="anim-grids">
        <KernelGrid matrix={A} title={`Input f (${L} grey levels, N = ${N})`} small={cols > 8}
          highlight={(r, c) => (cur >= 0 && r === curR && c === curC ? 'current' : phase === 'count' && r * cols + c < counted ? 'done' : null)} />
        <div>
          <div className="kernel-title">Histogram n_r {phase === 'map' ? '(before → after)' : ''}</div>
          <div className="mini-hist" aria-label="Histogram">
            {live.map((n, r) => (
              <div key={r} className="mini-bar-col">
                <span className="mini-val">{n}</span>
                <div className="mini-bar" style={{ height: `${(n / max) * 100}%` }} />
                {phase === 'map' && <div className="mini-bar after" style={{ height: `${(after[r] / Math.max(...after, 1)) * 100}%` }} />}
                <span className="mini-lab">{r}</span>
              </div>
            ))}
          </div>
        </div>
        <KernelGrid matrix={partial(out.length, cols, mapped, (r, c) => out[r][c])} title="Output g = s(f)" small={cols > 8}
          highlight={(r, c) => (phase === 'map' && r === curR && c === curC ? 'current' : r * cols + c < mapped ? 'done' : null)} />
      </div>
      <Card>
        <table className="data compact steps-table">
          <thead><tr><th>r</th><th>n_r</th><th>p_r = n_r / {N}</th><th>cdf_r = Σ p</th><th>s_r = round({L - 1} · cdf_r)</th></tr></thead>
          <tbody>
            {counts.map((n, r) => (
              <tr key={r} className={phase === 'cdf' && r === rowsShown - 1 ? 'best' : ''} style={{ opacity: r < rowsShown ? 1 : 0.3 }}>
                <td>{r}</td><td>{r < rowsShown ? n : ''}</td><td>{r < rowsShown ? fmt(pr[r], 3) : ''}</td>
                <td>{r < rowsShown ? fmt(cdf[r], 3) : ''}</td><td><b>{r < rowsShown ? map[r] : ''}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small mt-sm">
          {phase === 'count' && <>1. <b>Count</b>: pixel ({curR + 1},{curC + 1}) has level {A[curR][curC]}, so n<sub>{A[curR][curC]}</sub> grows to {live[A[curR][curC]]}.</>}
          {phase === 'cdf' && <>2. <b>Normalise and accumulate</b>: level {rowsShown - 1} holds {counts[rowsShown - 1]} pixels, the running total of p is {fmt(cdf[rowsShown - 1], 3)}, so it maps to round({L - 1} × {fmt(cdf[rowsShown - 1], 3)}) = <b>{map[rowsShown - 1]}</b>.</>}
          {phase === 'map' && <>3. <b>Map</b>: f({curR + 1},{curC + 1}) = {A[curR][curC]} → s<sub>{A[curR][curC]}</sub> = <b>{map[A[curR][curC]]}</b>. Crowded levels are pushed apart, so the histogram spreads over 0…{L - 1}.</>}
        </p>
      </Card>
    </div>
  )
}

// ----------------------------------------------------------------- region growing
function RegionView({ d }) {
  const events = asArray(d.events)
  const p = usePlayer(events.length)
  const A = toMatrix(d.input)
  const cols = A[0].length
  const state = useMemo(() => {
    const inRegion = new Set([`${d.seedRow - 1},${d.seedCol - 1}`])
    const queue = [[d.seedRow - 1, d.seedCol - 1]]
    let current = null
    for (let k = 0; k <= p.i; k++) {
      const e = events[k]
      if (e.type === 'take') { current = queue.shift() }
      else if (e.accepted) { inRegion.add(`${e.row - 1},${e.col - 1}`); queue.push([e.row - 1, e.col - 1]) }
    }
    return { inRegion, queue, current }
  }, [p.i, events, d.seedRow, d.seedCol])
  const e = events[p.i]
  return (
    <div className="stack">
      <Player p={p} label="event" />
      <div className="anim-grids">
        <KernelGrid matrix={A} title={`Values — seed (${d.seedRow},${d.seedCol}) = ${d.seedValue}, tolerance T = ${d.tolerance}, ${d.conn}-connectivity`} small={cols > 8}
          highlight={(r, c) => {
            if (e.type === 'check' && r === e.row - 1 && c === e.col - 1) return e.accepted ? 'n4' : 'nd'
            if (state.current && r === state.current[0] && c === state.current[1]) return 'current'
            if (r === d.seedRow - 1 && c === d.seedCol - 1) return 'center'
            return state.inRegion.has(`${r},${c}`) ? 'done' : null
          }} />
        <div className="queue-box">
          <div className="kernel-title">Queue (first in, first out)</div>
          <div className="chips">{state.queue.length ? state.queue.map(([r, c], k) => <span key={k} className="chip">({r + 1},{c + 1})</span>) : <span className="faint small">empty — growing has finished</span>}</div>
          <div className="kernel-title" style={{ marginTop: 14 }}>Region so far: {state.inRegion.size} pixels</div>
        </div>
      </div>
      <Note kind={e.type === 'take' ? 'info' : e.accepted ? 'ok' : 'error'}>
        {e.type === 'take'
          ? <>Take ({e.row},{e.col}) from the queue and look at its {d.conn} neighbours.</>
          : <>Neighbour ({e.row},{e.col}) = {e.value}: |{e.value} − {d.seedValue}| = {fmt(e.diff, 2)} {e.accepted ? '≤' : '>'} {d.tolerance} → {e.accepted ? <b>joins the region and is queued</b> : <b>rejected</b>}.</>}
      </Note>
    </div>
  )
}

// ----------------------------------------------------------------- examples
const rnd = (n) => Math.floor(Math.random() * n)
const toText = (m) => m.map((r) => r.join(' ')).join('\n')
const EXAMPLES = {
  median: () => toText(Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => (Math.random() < 0.15 ? (Math.random() < 0.5 ? 0 : 255) : 100 + rnd(30))))),
  histeq: () => toText(Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => 2 + rnd(3)))),
  regiongrow: () => toText(Array.from({ length: 7 }, (_, r) => Array.from({ length: 7 }, (_, c) => (Math.hypot(r - 3, c - 3) < 2.6 ? 40 + rnd(12) : 120 + rnd(60))))),
}
const DEFAULTS = {
  median: '10 12 11 255 13 12\n11 0 12 13 12 11\n12 13 11 12 255 13\n13 12 12 11 12 12\n0 11 13 12 13 11\n12 12 255 11 12 13',
  histeq: '2 3 3 2 4 3\n3 2 2 3 3 4\n2 3 4 4 3 2\n3 3 2 2 3 3\n4 3 3 2 2 3\n3 2 3 3 4 2',
  regiongrow: '200 190 185 180 170 160 150\n195 45 48 50 160 155 150\n190 42 40 47 52 150 145\n185 44 41 43 49 140 140\n180 175 46 45 130 135 130\n170 165 160 48 125 120 125\n160 155 150 145 120 115 110',
}
const ALGOS = [
  { key: 'median', label: 'Median filter', lab: 'filters', text: 'Sort each 3×3 window and take the middle value — watch impulses (0 and 255) lose.' },
  { key: 'histeq', label: 'Histogram equalisation', lab: 'histogram', text: 'Count → normalise → cumulative sum → map. Watch crowded grey levels spread out.' },
  { key: 'regiongrow', label: 'Region growing', lab: 'segmentation', text: 'Pixels join the region in queue order when they are close enough to the seed value.' },
]

export default function Animations() {
  const { call, matlab } = useApp()
  const [algo, setAlgo] = useState(() => {
    const m = window.location.hash.match(/[?&]algo=(\w+)/)
    return m && EXAMPLES[m[1]] ? m[1] : 'median'
  })
  const [text, setText] = useState(DEFAULTS)
  const [k, setK] = useState(3)
  const [levels, setLevels] = useState(8)
  const [seed, setSeed] = useState({ row: 4, col: 4 })
  const [tol, setTol] = useState(15)
  const [conn, setConn] = useState(4)
  const [data, setData] = useState({})
  const [error, setError] = useState(null)
  const a = ALGOS.find((x) => x.key === algo)

  const animate = async (which = algo, src = text[which]) => {
    setError(null)
    let matrix
    try { matrix = parseMatrix(src) } catch (e) { setError(e.message); return }
    const params = { algorithm: which, matrix }
    if (which === 'median') params.k = k
    if (which === 'histeq') params.levels = levels
    if (which === 'regiongrow') Object.assign(params, { seedRow: seed.row, seedCol: seed.col, tolerance: tol, conn })
    const d = await call('steps', params, { label: `${ALGOS.find((x) => x.key === which).label}: computing every step` })
    if (d) setData((x) => ({ ...x, [which]: d }))
  }
  useEffect(() => {
    if (matlab.ok && !data[algo]) animate(algo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matlab.ok, algo])

  const d = data[algo]
  return (
    <Page eyebrow="Study" title="Step-by-step animations" subtitle="MATLAB computes every intermediate step on a small matrix; play, pause or step through them to see exactly how the algorithm works."
      actions={<a className="btn" href={`#${a.lab}`}>Try it on an image →</a>}>
      <Tabs tabs={ALGOS.map((x) => ({ key: x.key, label: x.label }))} active={algo} onChange={setAlgo} />
      <div className="lab">
        <div className="lab-panel">
          <div className="card">
            <div className="lab-panel-title">Input</div>
            <div className="controls">
              <p className="small muted">{a.text}</p>
              <label className="field"><span className="field-label">Matrix (rows on new lines, max 12×12)</span>
                <textarea rows={7} value={text[algo]} onChange={(e) => setText({ ...text, [algo]: e.target.value })} spellCheck={false} /></label>
              <button className="btn btn-small" onClick={() => { const t = EXAMPLES[algo](); setText({ ...text, [algo]: t }); animate(algo, t) }}>🎲 Random example</button>
              {algo === 'median' && <Segmented value={k} onChange={setK} options={[{ value: 3, label: '3×3' }, { value: 5, label: '5×5' }]} />}
              {algo === 'histeq' && <Slider label="Grey levels L" value={levels} min={4} max={16} onChange={setLevels} format={(v) => `${v} (0…${v - 1})`} />}
              {algo === 'regiongrow' && (
                <>
                  <div className="grid-2" style={{ gap: 10 }}>
                    <label className="field"><span className="field-label">Seed row</span><input type="number" min={1} max={12} value={seed.row} onChange={(e) => setSeed({ ...seed, row: Number(e.target.value) })} /></label>
                    <label className="field"><span className="field-label">Seed column</span><input type="number" min={1} max={12} value={seed.col} onChange={(e) => setSeed({ ...seed, col: Number(e.target.value) })} /></label>
                  </div>
                  <Slider label="Tolerance T" value={tol} min={0} max={100} onChange={setTol} />
                  <Segmented value={conn} onChange={setConn} options={[{ value: 4, label: '4-connected' }, { value: 8, label: '8-connected' }]} />
                </>
              )}
              <button className="btn btn-primary btn-block" onClick={() => animate()}>▶ Compute steps in MATLAB</button>
              {error && <Note kind="error">{error}</Note>}
              <p className="tiny faint">Keyboard: click the player, then Space = play/pause, ← → = step.</p>
            </div>
          </div>
        </div>
        <div className="lab-results">
          {!d ? <Card><p className="muted">{matlab.ok ? 'MATLAB is computing the steps…' : 'Waiting for MATLAB…'}</p></Card> : (
            <>
              {algo === 'median' && <MedianView key={JSON.stringify(d.output)} d={d} />}
              {algo === 'histeq' && <HisteqView key={JSON.stringify(d.output) + d.L} d={d} />}
              {algo === 'regiongrow' && <RegionView key={JSON.stringify(d.order) + d.tolerance + d.conn} d={d} />}
            </>
          )}
        </div>
      </div>
    </Page>
  )
}
